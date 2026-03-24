const { spawn } = require('child_process');
const path = require('path');
const os = require('os');

const WINGET_LINKS = path.join(os.homedir(), 'AppData', 'Local', 'Microsoft', 'WinGet', 'Links');
const ENV_PATH = `${process.env.PATH};${WINGET_LINKS}`;

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
    // 실제로 인코더를 초기화해서 동작하는지 테스트
    const proc = spawn('ffmpeg', [
      '-f', 'lavfi', '-i', 'nullsrc=s=256x256:d=1', '-frames:v', '1',
      '-c:v', encoder, '-f', 'null', '-',
    ], { stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, PATH: ENV_PATH } });
    proc.on('close', (code) => resolve(code === 0));
    proc.on('error', () => resolve(false));
  });
}

async function checkGpuSupport() {
  // 실제 인코딩 테스트로 GPU 지원 여부 확인
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

async function convertVideo(inputPath, outputPath, settings, onProgress) {
  const duration = await getVideoDuration(inputPath);
  const args = ['-i', inputPath];

  // 해상도 설정
  const filters = [];
  if (settings.resolution && settings.resolution !== 'original') {
    const resMap = {
      '4k': '3840:-2',
      '1080p': '1920:-2',
      '720p': '1280:-2',
      '480p': '854:-2',
    };
    if (resMap[settings.resolution]) {
      filters.push(`scale=${resMap[settings.resolution]}`);
    } else if (settings.customWidth && settings.customHeight) {
      if (settings.keepAspectRatio) {
        filters.push(`scale=${settings.customWidth}:-2`);
      } else {
        filters.push(`scale=${settings.customWidth}:${settings.customHeight}`);
      }
    }
  }

  if (filters.length > 0) {
    args.push('-vf', filters.join(','));
  }

  // 인코더 선택
  const useGpu = settings.gpuAccel && settings.gpuAccel !== 'cpu';
  const isNvenc = useGpu && settings.gpuEncoder && settings.gpuEncoder.includes('nvenc');
  const isQsv = useGpu && settings.gpuEncoder && settings.gpuEncoder.includes('qsv');
  const isAmf = useGpu && settings.gpuEncoder && settings.gpuEncoder.includes('amf');

  if (useGpu && settings.gpuEncoder) {
    args.push('-c:v', settings.gpuEncoder);
    if (settings.bitrateMode === 'crf') {
      // NVENC: -rc vbr -cq 값, QSV: -global_quality 값, AMF: -rc vbr_peak -qp_i/qp_p 값
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
    // GPU 인코더별 preset 매핑
    if (isNvenc) {
      const nvencPresetMap = { ultrafast: 'p1', fast: 'p3', medium: 'p4', slow: 'p6', veryslow: 'p7' };
      args.push('-preset', nvencPresetMap[settings.preset] || 'p4');
    } else if (isQsv) {
      args.push('-preset', settings.preset === 'ultrafast' ? 'veryfast' : (settings.preset || 'medium'));
    }
    // AMF는 preset 생략 (기본값 사용)
  } else {
    args.push('-c:v', 'libx264');
    if (settings.bitrateMode === 'crf') {
      args.push('-crf', String(settings.crf || 23));
    } else {
      args.push('-b:v', `${settings.videoBitrate || 5000}k`);
    }
    args.push('-preset', settings.preset || 'medium');
  }

  // 오디오 설정
  args.push('-c:a', 'aac', '-b:a', `${settings.audioBitrate || 192}k`);

  // 파일 크기 제한 (2-pass는 별도 처리가 복잡하므로 비트레이트 계산으로 근사)
  if (settings.maxFileSizeMB && duration > 0) {
    const targetBits = settings.maxFileSizeMB * 8 * 1024 * 1024;
    const audioBits = (settings.audioBitrate || 192) * 1000 * duration;
    const videoBitrate = Math.max(100, Math.floor((targetBits - audioBits) / duration / 1000));
    // 파일 크기 제한이 설정되면 비트레이트 강제 적용
    const idx = args.indexOf('-crf');
    if (idx > -1) args.splice(idx, 2);
    const idx2 = args.indexOf('-cq');
    if (idx2 > -1) args.splice(idx2, 2);
    const idx3 = args.indexOf('-b:v');
    if (idx3 > -1) args.splice(idx3, 2);
    args.push('-b:v', `${videoBitrate}k`);
  }

  args.push(outputPath);

  await runFFmpeg(args, onProgress, duration);
}

async function extractAudio(inputPath, outputPath, settings, onProgress) {
  const duration = await getVideoDuration(inputPath);
  const args = [
    '-i', inputPath,
    '-vn',
    '-acodec', 'libmp3lame',
    '-ab', `${settings.audioBitrate || 192}k`,
    outputPath,
  ];
  await runFFmpeg(args, onProgress, duration);
}

module.exports = { convertVideo, extractAudio, checkGpuSupport };
