const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const isWin = process.platform === 'win32';
const EXTRA_PATHS = [];
if (isWin) {
  EXTRA_PATHS.push(path.join(os.homedir(), 'AppData', 'Local', 'Microsoft', 'WinGet', 'Links'));
} else {
  EXTRA_PATHS.push('/usr/local/bin', '/opt/homebrew/bin', '/usr/bin');
}
const PATH_SEP = isWin ? ';' : ':';
const ENV_PATH = [process.env.PATH, ...EXTRA_PATHS].join(PATH_SEP);
const ASSET_DIR = path.join(__dirname, 'assets');

function runFFmpeg(args, onProgress, duration) {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', ['-y', ...args, '-progress', 'pipe:1', '-nostats'], {
      env: { ...process.env, PATH: ENV_PATH },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stderr = '';

    proc.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (line.startsWith('out_time_us=')) {
          const timeUs = parseInt(line.split('=')[1], 10);
          if (duration > 0 && !isNaN(timeUs)) {
            const percent = Math.min(100, (timeUs / 1000000 / duration) * 100);
            onProgress(Math.round(percent));
          }
        }
      }
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg exited with code ${code}: ${stderr.slice(-500)}`));
    });

    proc.on('error', (err) => reject(err));
  });
}

function getVideoDuration(inputPath) {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'csv=p=0',
      inputPath,
    ], { env: { ...process.env, PATH: ENV_PATH } });

    let output = '';
    proc.stdout.on('data', (d) => (output += d.toString()));
    proc.on('close', (code) => {
      if (code === 0) resolve(parseFloat(output.trim()) || 0);
      else resolve(0);
    });
    proc.on('error', () => resolve(0));
  });
}

function testEncoder(encoder) {
  return new Promise((resolve) => {
    const proc = spawn('ffmpeg', [
      '-f', 'lavfi', '-i', 'nullsrc=s=256x256:d=1', '-frames:v', '1',
      '-c:v', encoder, '-f', 'null', '-',
    ], { stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, PATH: ENV_PATH } });
    proc.on('close', (code) => resolve(code === 0));
    proc.on('error', () => resolve(false));
  });
}

async function checkGpuSupport() {
  const [nvenc, qsv, amf] = await Promise.all([
    testEncoder('h264_nvenc'),
    testEncoder('h264_qsv'),
    testEncoder('h264_amf'),
  ]);

  return {
    nvenc,
    qsv,
    amf,
    available: nvenc || qsv || amf,
    recommended: nvenc ? 'h264_nvenc' : qsv ? 'h264_qsv' : amf ? 'h264_amf' : 'libx264',
  };
}

function parseTimeToSeconds(timeStr) {
  if (!timeStr) return 0;
  const parts = timeStr.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

// FFmpeg 자막 필터용 경로 이스케이프 (Windows)
function escapeSubtitlePath(p) {
  return p.replace(/\\/g, '/').replace(/:/g, '\\:');
}

// CPU 인코더 매핑
function getCpuEncoder(codec) {
  const map = {
    h264: 'libx264',
    h265: 'libx265',
    av1: 'libsvtav1',
    vp9: 'libvpx-vp9',
    mpeg4: 'mpeg4',
    prores: 'prores_ks',
    copy: 'copy',
  };
  return map[codec] || 'libx264';
}

// 오디오 인코더 매핑
function getAudioEncoder(audioCodec) {
  const map = {
    aac: 'aac',
    mp3: 'libmp3lame',
    opus: 'libopus',
    flac: 'flac',
    ac3: 'ac3',
    pcm: 'pcm_s16le',
    copy: 'copy',
  };
  return map[audioCodec] || 'aac';
}

// 컨테이너 확장자
function getContainerExt(container) {
  const map = { mp4: '.mp4', mkv: '.mkv', webm: '.webm', mov: '.mov', avi: '.avi' };
  return map[container] || '.mp4';
}

// 프로파일 매핑
function getProfileArg(codec, profile, isGpu) {
  if (['av1', 'vp9', 'mpeg4', 'prores', 'copy'].includes(codec)) return null;

  if (codec === 'h265') {
    const h265Map = { baseline: 'main', main: 'main', high: 'main', high10: 'main10' };
    return h265Map[profile] || 'main';
  }

  // h264
  if (isGpu) {
    const gpuMap = { baseline: 'baseline', main: 'main', high: 'high', high10: 'high' };
    return gpuMap[profile] || 'high';
  }
  return profile || 'high';
}

async function convertVideo(inputPath, outputPath, settings, onProgress) {
  const totalDuration = await getVideoDuration(inputPath);

  // 트림 시 유효 길이 계산
  const trimStartSec = parseTimeToSeconds(settings.trimStart);
  const trimEndSec = parseTimeToSeconds(settings.trimEnd);
  let effectiveDuration = totalDuration;
  if (trimEndSec > 0) effectiveDuration = trimEndSec - trimStartSec;
  else if (trimStartSec > 0) effectiveDuration = totalDuration - trimStartSec;

  const args = [];

  // 인코더 사전 결정 (hwaccel에 필요)
  const codec = settings.codec || 'h264';
  const useGpu = settings.gpuAccel && settings.gpuAccel !== 'cpu';
  const gpuEncoder = useGpu && settings.gpuEncoder ? settings.gpuEncoder : null;
  const isNvenc = gpuEncoder && gpuEncoder.includes('nvenc');
  const isQsv = gpuEncoder && gpuEncoder.includes('qsv');
  const isAmf = gpuEncoder && gpuEncoder.includes('amf');

  // 하드웨어 디코딩 (-i 앞에 위치해야 함)
  if (isNvenc) {
    args.push('-hwaccel', 'cuda');
  } else if (isQsv) {
    args.push('-hwaccel', 'qsv');
  } else if (isAmf) {
    args.push('-hwaccel', 'd3d11va');
  }

  // 트림: -ss before -i (input seeking)
  if (settings.trimStart) {
    args.push('-ss', settings.trimStart);
  }

  args.push('-i', inputPath);

  // 트림: -to after -i
  if (settings.trimEnd) {
    const endRelative = trimEndSec - trimStartSec;
    if (endRelative > 0) args.push('-t', String(endRelative));
  }

  // 워터마크 입력
  const hasWatermark = settings.watermarkFile?.serverFilename;
  if (hasWatermark) {
    const wmPath = path.join(ASSET_DIR, settings.watermarkFile.serverFilename);
    args.push('-i', wmPath);
  }

  // 비디오 필터 체인 구축
  const videoFilters = [];

  // 1. 크롭
  if (settings.cropEnabled && settings.cropWidth && settings.cropHeight) {
    const x = settings.cropX || 0;
    const y = settings.cropY || 0;
    videoFilters.push(`crop=${settings.cropWidth}:${settings.cropHeight}:${x}:${y}`);
  }

  // 2. 해상도 (스케일) + 리사이즈 필터
  if (settings.resolution && settings.resolution !== 'original') {
    const flagsMap = { bilinear: 'bilinear', bicubic: 'bicubic', lanczos: 'lanczos', neighbor: 'neighbor', spline: 'spline' };
    const flags = flagsMap[settings.scaleFilter] || 'bilinear';
    const resMap = { '4k': '3840:-2', '1080p': '1920:-2', '720p': '1280:-2', '480p': '854:-2' };
    if (resMap[settings.resolution]) {
      videoFilters.push(`scale=${resMap[settings.resolution]}:flags=${flags}`);
    } else if (settings.customWidth && settings.customHeight) {
      if (settings.keepAspectRatio) {
        videoFilters.push(`scale=${settings.customWidth}:-2:flags=${flags}`);
      } else {
        videoFilters.push(`scale=${settings.customWidth}:${settings.customHeight}:flags=${flags}`);
      }
    }
  }

  // 3. 디인터레이스
  if (settings.deinterlace) {
    videoFilters.push('yadif');
  }

  // 4. 노이즈 제거
  if (settings.noiseReduction) {
    const strength = (settings.noiseStrength || 5) * 1.5;
    videoFilters.push(`hqdn3d=${strength}`);
  }

  // 5. 자막 burn-in
  const hasSubtitle = settings.subtitleFile?.serverFilename;
  if (hasSubtitle) {
    const subPath = escapeSubtitlePath(path.join(ASSET_DIR, settings.subtitleFile.serverFilename));
    const fontSize = settings.subtitleFontSize || 24;
    // 자막 위치: MarginV로 조절 (bottom=기본, top=상단, center=중앙)
    const posStyle = settings.subtitlePosition === 'top' ? ',Alignment=6,MarginV=20'
      : settings.subtitlePosition === 'center' ? ',Alignment=5' : '';
    videoFilters.push(`subtitles='${subPath}':force_style='FontSize=${fontSize}${posStyle}'`);
  }

  // pixel format 보장 (h264/h265는 yuv420p 필요)
  if (codec !== 'copy' && !['vp9', 'av1', 'prores'].includes(codec)) {
    videoFilters.push('format=yuv420p');
  }

  // 필터 적용: 워터마크 있으면 filter_complex, 없으면 -vf
  if (hasWatermark) {
    const opacity = settings.watermarkOpacity ?? 0.7;
    const posMap = {
      'top-left': 'overlay=10:10',
      'top-right': 'overlay=W-w-10:10',
      'bottom-left': 'overlay=10:H-h-10',
      'bottom-right': 'overlay=W-w-10:H-h-10',
      'center': 'overlay=(W-w)/2:(H-h)/2',
    };
    const overlayPos = posMap[settings.watermarkPosition] || posMap['bottom-right'];

    // filter_complex: [0:v] 비디오필터 [base]; [1:v] 투명도 [wm]; [base][wm] overlay [out]
    // format=yuv420p는 이미 videoFilters에 포함되어 있으므로 별도 추가 불필요
    const baseFilters = videoFilters.length > 0 ? videoFilters.join(',') + ',' : '';
    const fc = `[0:v]${baseFilters.replace('format=yuv420p,', '').replace(',format=yuv420p', '')}format=yuv420p[base];[1:v]format=rgba,colorchannelmixer=aa=${opacity}[wm];[base][wm]${overlayPos}[out]`;
    args.push('-filter_complex', fc, '-map', '[out]', '-map', '0:a?');
  } else if (videoFilters.length > 0) {
    args.push('-vf', videoFilters.join(','));
  }

  // 인코더 선택
  if (codec === 'copy') {
    // 스트림 복사 - 재인코딩 없음 (필터 무시)
    args.push('-c:v', 'copy');
  } else if (gpuEncoder) {
    args.push('-c:v', gpuEncoder);

    if (settings.bitrateMode === 'crf') {
      if (isNvenc) {
        args.push('-rc', 'vbr', '-cq', String(settings.crf || 23));
      } else if (isQsv) {
        args.push('-global_quality', String(settings.crf || 23));
      } else if (isAmf) {
        args.push('-rc', 'vbr_peak', '-qp_i', String(settings.crf || 23), '-qp_p', String(settings.crf || 23));
      }
    } else {
      args.push('-b:v', `${settings.videoBitrate || 5000}k`);
    }

    // GPU preset 매핑
    if (isNvenc) {
      const nvencPresetMap = { ultrafast: 'p1', fast: 'p3', medium: 'p4', slow: 'p6', veryslow: 'p7' };
      args.push('-preset', nvencPresetMap[settings.preset] || 'p4');
    } else if (isQsv) {
      args.push('-preset', settings.preset === 'ultrafast' ? 'veryfast' : (settings.preset || 'medium'));
    }
  } else {
    const cpuEncoder = getCpuEncoder(codec);
    args.push('-c:v', cpuEncoder);

    if (settings.bitrateMode === 'crf') {
      args.push('-crf', String(settings.crf || 23));
    } else {
      args.push('-b:v', `${settings.videoBitrate || 5000}k`);
    }
    // AV1 (libsvtav1)은 preset 대신 다른 옵션 사용
    if (codec === 'av1') {
      const av1PresetMap = { ultrafast: '12', fast: '10', medium: '8', slow: '5', veryslow: '2' };
      args.push('-preset', av1PresetMap[settings.preset] || '8');
    } else {
      args.push('-preset', settings.preset || 'medium');
    }
  }

  // 프로파일
  const profileVal = getProfileArg(codec, settings.profile, !!gpuEncoder);
  if (profileVal) {
    args.push('-profile:v', profileVal);
  }

  // FPS
  if (settings.fps) {
    args.push('-r', String(settings.fps));
  }

  // 오디오 설정
  const audioEnc = getAudioEncoder(settings.audioCodec);
  args.push('-c:a', audioEnc);
  // 비트레이트: copy/flac/pcm에는 불필요
  if (audioEnc !== 'copy' && audioEnc !== 'flac' && audioEnc !== 'pcm_s16le') {
    args.push('-b:a', `${settings.audioBitrate || 192}k`);
  }

  // 오디오 채널
  const channelMap = { mono: '1', stereo: '2', '5.1': '6' };
  if (settings.audioChannels && channelMap[settings.audioChannels]) {
    args.push('-ac', channelMap[settings.audioChannels]);
  }

  // 샘플레이트
  if (settings.audioSampleRate) {
    args.push('-ar', String(settings.audioSampleRate));
  }

  // 파일 크기 제한
  if (settings.maxFileSizeMB && effectiveDuration > 0) {
    const targetBits = settings.maxFileSizeMB * 8 * 1024 * 1024;
    const audioBits = (settings.audioBitrate || 192) * 1000 * effectiveDuration;
    const videoBitrate = Math.max(100, Math.floor((targetBits - audioBits) / effectiveDuration / 1000));
    // CRF/CQ 제거하고 비트레이트 강제 적용
    const removeArgs = ['-crf', '-cq', '-global_quality', '-b:v'];
    for (const ra of removeArgs) {
      const idx = args.indexOf(ra);
      if (idx > -1) args.splice(idx, 2);
    }
    args.push('-b:v', `${videoBitrate}k`);
    args.push('-maxrate', `${videoBitrate}k`);
    args.push('-bufsize', `${Math.floor(videoBitrate / 2)}k`);
  }

  // 멀티스레드 (모든 CPU 코어 활용)
  args.push('-threads', '0');

  // 출력 컨테이너 결정
  if (codec === 'av1' && outputPath.endsWith('.mp4')) {
    // AV1은 mp4도 지원하지만 movflags 추가
    args.push('-movflags', '+faststart');
  }

  args.push(outputPath);

  // 디버그 로그: 실제 FFmpeg 명령어 출력
  console.log('[FFmpeg CMD]', 'ffmpeg -y', args.join(' '));

  await runFFmpeg(args, onProgress, effectiveDuration);
}

// === 세그먼트 병렬 인코딩 ===

function getKeyframes(inputPath, duration) {
  return new Promise((resolve) => {
    const proc = spawn('ffprobe', [
      '-v', 'error', '-select_streams', 'v:0',
      '-show_entries', 'packet=pts_time,flags',
      '-of', 'csv=p=0',
      inputPath,
    ], { env: { ...process.env, PATH: ENV_PATH } });

    let output = '';
    proc.stdout.on('data', (d) => (output += d.toString()));
    proc.on('close', () => {
      const keyframes = [];
      for (const line of output.split('\n')) {
        const parts = line.trim().split(',');
        if (parts.length >= 2 && parts[1] && parts[1].includes('K')) {
          const t = parseFloat(parts[0]);
          if (!isNaN(t)) keyframes.push(t);
        }
      }
      resolve(keyframes.length > 0 ? keyframes : null);
    });
    proc.on('error', () => resolve(null));
  });
}

function findNearestKeyframe(keyframes, targetTime) {
  if (!keyframes || keyframes.length === 0) return targetTime;
  let closest = keyframes[0];
  let minDiff = Math.abs(keyframes[0] - targetTime);
  for (const kf of keyframes) {
    const diff = Math.abs(kf - targetTime);
    if (diff < minDiff) { minDiff = diff; closest = kf; }
    if (kf > targetTime) break;
  }
  return closest;
}

async function convertVideoParallel(inputPath, outputPath, settings, onProgress) {
  const totalDuration = await getVideoDuration(inputPath);
  if (totalDuration <= 0) {
    // 길이를 알 수 없으면 일반 변환으로 폴백
    return convertVideo(inputPath, outputPath, settings, onProgress);
  }

  const numSegments = settings.parallelSegments || os.cpus().length;
  const segDuration = totalDuration / numSegments;

  // 키프레임 목록 가져오기 (정확한 분할점)
  const keyframes = await getKeyframes(inputPath, totalDuration);

  // 분할 지점 계산
  const splitPoints = [0];
  for (let i = 1; i < numSegments; i++) {
    const target = segDuration * i;
    splitPoints.push(keyframes ? findNearestKeyframe(keyframes, target) : target);
  }
  splitPoints.push(totalDuration);

  // 임시 디렉토리
  const tmpDir = path.join(os.tmpdir(), `videomaker_parallel_${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  const segmentFiles = [];
  const segmentProgresses = new Array(numSegments).fill(0);

  const reportProgress = () => {
    const totalPercent = segmentProgresses.reduce((a, b) => a + b, 0) / numSegments;
    onProgress(Math.round(totalPercent));
  };

  // 세그먼트별 인코딩 args 빌드 (공통 설정 복사, 트림 구간 변경)
  const buildSegmentSettings = (startSec, endSec) => {
    const segSettings = { ...settings };
    segSettings.trimStart = formatTime(startSec);
    segSettings.trimEnd = formatTime(endSec);
    // 자막/워터마크는 각 세그먼트에 적용
    return segSettings;
  };

  try {
    // 모든 세그먼트 동시 인코딩
    const promises = [];
    for (let i = 0; i < numSegments; i++) {
      const segStart = splitPoints[i];
      const segEnd = splitPoints[i + 1];
      const segOutput = path.join(tmpDir, `seg_${String(i).padStart(3, '0')}${path.extname(outputPath)}`);
      segmentFiles.push(segOutput);

      const segSettings = buildSegmentSettings(segStart, segEnd);
      const segOnProgress = (percent) => {
        segmentProgresses[i] = percent;
        reportProgress();
      };

      promises.push(convertVideo(inputPath, segOutput, segSettings, segOnProgress));
    }

    await Promise.all(promises);

    // concat 파일 리스트 생성
    const concatListPath = path.join(tmpDir, 'concat_list.txt');
    const concatContent = segmentFiles.map(f => `file '${f.replace(/\\/g, '/')}'`).join('\n');
    fs.writeFileSync(concatListPath, concatContent, 'utf8');

    // concat으로 합치기 (재인코딩 없이 스트림 복사)
    const concatArgs = ['-f', 'concat', '-safe', '0', '-i', concatListPath, '-c', 'copy', outputPath];
    console.log('[FFmpeg CONCAT]', 'ffmpeg -y', concatArgs.join(' '));
    await runFFmpeg(concatArgs, () => {}, 0);

    onProgress(100);
  } finally {
    // 임시 파일 정리
    try {
      for (const f of segmentFiles) { if (fs.existsSync(f)) fs.unlinkSync(f); }
      const concatList = path.join(tmpDir, 'concat_list.txt');
      if (fs.existsSync(concatList)) fs.unlinkSync(concatList);
      fs.rmdirSync(tmpDir);
    } catch {}
  }
}

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = (seconds % 60).toFixed(3);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(6, '0')}`;
}

async function extractAudio(inputPath, outputPath, settings, onProgress) {
  const totalDuration = await getVideoDuration(inputPath);
  const trimStartSec = parseTimeToSeconds(settings.trimStart);
  const trimEndSec = parseTimeToSeconds(settings.trimEnd);
  let effectiveDuration = totalDuration;
  if (trimEndSec > 0) effectiveDuration = trimEndSec - trimStartSec;
  else if (trimStartSec > 0) effectiveDuration = totalDuration - trimStartSec;

  const args = [];

  if (settings.trimStart) args.push('-ss', settings.trimStart);
  args.push('-i', inputPath);
  if (settings.trimEnd) {
    const endRelative = trimEndSec - trimStartSec;
    if (endRelative > 0) args.push('-t', String(endRelative));
  }

  args.push('-vn', '-acodec', 'libmp3lame', '-ab', `${settings.audioBitrate || 192}k`);

  const channelMap = { mono: '1', stereo: '2', '5.1': '6' };
  if (settings.audioChannels && channelMap[settings.audioChannels]) {
    args.push('-ac', channelMap[settings.audioChannels]);
  }
  if (settings.audioSampleRate) {
    args.push('-ar', String(settings.audioSampleRate));
  }

  args.push(outputPath);
  await runFFmpeg(args, onProgress, effectiveDuration);
}

module.exports = { convertVideo, convertVideoParallel, extractAudio, checkGpuSupport };
