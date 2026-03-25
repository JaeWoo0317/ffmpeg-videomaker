import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import FileUpload from './components/FileUpload';
import SettingsModal from './components/SettingsModal';
import OutputTargets from './components/OutputTargets';
import ProgressBar from './components/ProgressBar';

const socket = io();

const DEFAULT_SETTINGS = {
  outputs: ['high'],
  resolution: 'original',
  customWidth: '',
  customHeight: '',
  keepAspectRatio: true,
  bitrateMode: 'crf',
  crf: 23,
  videoBitrate: 5000,
  audioBitrate: 192,
  preset: 'medium',
  gpuAccel: 'auto',
  gpuEncoder: '',
  maxFileSizeMB: '',
  scaleFilter: 'bilinear',
  codec: 'h264',
  container: 'mp4',
  profile: 'high',
  audioCodec: 'aac',
  subtitleFile: null,
  subtitleFontSize: 24,
  subtitlePosition: 'bottom',
  trimStart: '',
  trimEnd: '',
  watermarkFile: null,
  watermarkPosition: 'bottom-right',
  watermarkOpacity: 0.7,
  fps: '',
  cropEnabled: false,
  cropWidth: '',
  cropHeight: '',
  cropX: '',
  cropY: '',
  deinterlace: false,
  noiseReduction: false,
  noiseStrength: 5,
  audioChannels: 'stereo',
  audioSampleRate: 48000,
  targets: [
    { type: 'local', enabled: true, path: '' },
    { type: 'ftp', enabled: false, host: '', port: 21, username: '', password: '', remotePath: '', secure: false },
    { type: 'sftp', enabled: false, host: '', port: 22, username: '', password: '', remotePath: '', privateKeyPath: '' },
    { type: 'share', enabled: false, path: '' },
  ],
};

function App() {
  const [files, setFiles] = useState([]);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [gpuInfo, setGpuInfo] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [converting, setConverting] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [progress, setProgress] = useState(null);
  const [transferProgress, setTransferProgress] = useState(null);
  const [results, setResults] = useState([]);
  const [errors, setErrors] = useState([]);
  const jobIdRef = useRef(null);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  useEffect(() => {
    fetch('/api/gpu-check')
      .then((r) => r.json())
      .then((info) => {
        setGpuInfo(info);
        if (info.available) {
          setSettings((s) => ({ ...s, gpuEncoder: info.recommended }));
        }
      })
      .catch(() => {});
  }, []);

  const cleanupListeners = useCallback(() => {
    const id = jobIdRef.current;
    if (id) {
      socket.off(`progress:${id}`);
      socket.off(`transfer:${id}`);
      socket.off(`done:${id}`);
      socket.off(`error:${id}`);
    }
  }, []);

  useEffect(() => cleanupListeners, [cleanupListeners]);

  const handleUpload = async (selectedFiles) => {
    const formData = new FormData();
    const fileList = Array.from(selectedFiles);
    fileList.forEach((f) => formData.append('files', f));
    setFiles(fileList.map((f) => ({ name: f.name, size: f.size })));
    setResults([]);
    setErrors([]);
    setUploading(true);

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      setUploadedFiles(data.files);
    } catch (err) {
      setErrors(['파일 업로드 실패: ' + err.message]);
    } finally {
      setUploading(false);
    }
  };

  const handleConvert = async () => {
    if (uploadedFiles.length === 0) return;
    cleanupListeners();

    setConverting(true);
    setProgress(null);
    setTransferProgress(null);
    setResults([]);
    setErrors([]);

    const res = await fetch('/api/convert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: uploadedFiles, settings }),
    });
    const { jobId } = await res.json();
    jobIdRef.current = jobId;

    socket.on(`progress:${jobId}`, (data) => setProgress(data));
    socket.on(`transfer:${jobId}`, (data) => setTransferProgress(data));
    socket.on(`done:${jobId}`, (data) => {
      setResults(data.results);
      setConverting(false);
      setProgress(null);
      setTransferProgress(null);
    });
    socket.on(`error:${jobId}`, (data) => {
      setErrors((prev) => [...prev, data.message]);
      if (!data.fileName) setConverting(false);
    });
  };

  const uploadAsset = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/upload-asset', { method: 'POST', body: formData });
    const data = await res.json();
    return { name: data.originalName, serverFilename: data.serverFilename };
  };

  const applyPreset = (preset) => {
    const presets = {
      high: { outputs: ['high'], resolution: 'original', bitrateMode: 'crf', crf: 18, audioBitrate: 256, codec: 'h264', profile: 'high' },
      low: { outputs: ['low'], resolution: '720p', bitrateMode: 'crf', crf: 28, audioBitrate: 128, codec: 'h264', profile: 'main' },
    };
    if (presets[preset]) setSettings((s) => ({ ...s, ...presets[preset] }));
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>VideoMaker</h1>
        <span className="subtitle">FFmpeg 영상 변환 도구</span>
      </header>

      <main className="app-main">
        <FileUpload onUpload={handleUpload} files={files} uploading={uploading} />

        {uploadedFiles.length > 0 && (
          <>
            <section className="section">
              <h2>프리셋</h2>
              <div className="preset-buttons">
                <button className="btn preset" onClick={() => applyPreset('high')}>고화질</button>
                <button className="btn preset" onClick={() => applyPreset('low')}>저화질</button>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={settings.outputs.includes('mp3')}
                    onChange={(e) => {
                      setSettings((s) => ({
                        ...s,
                        outputs: e.target.checked
                          ? [...s.outputs.filter((o) => o !== 'mp3'), 'mp3']
                          : s.outputs.filter((o) => o !== 'mp3'),
                      }));
                    }}
                  />
                  MP3 추출
                </label>
              </div>
            </section>

            <section className="section">
              <div className="settings-summary">
                <div className="summary-items">
                  <span className="summary-tag">{settings.codec.toUpperCase()}</span>
                  <span className="summary-tag">{settings.container.toUpperCase()}</span>
                  <span className="summary-tag">{settings.resolution === 'original' ? '원본' : settings.resolution}</span>
                  {settings.fps && <span className="summary-tag">{settings.fps}fps</span>}
                  <span className="summary-tag">{settings.bitrateMode === 'crf' ? `CRF ${settings.crf}` : `${settings.videoBitrate}k`}</span>
                  <span className="summary-tag">{settings.audioCodec.toUpperCase()}</span>
                  {settings.trimStart && <span className="summary-tag">트림</span>}
                  {settings.subtitleFile && <span className="summary-tag">자막</span>}
                  {settings.watermarkFile && <span className="summary-tag">워터마크</span>}
                  {settings.cropEnabled && <span className="summary-tag">크롭</span>}
                  {settings.deinterlace && <span className="summary-tag">디인터레이스</span>}
                  {settings.noiseReduction && <span className="summary-tag">노이즈 제거</span>}
                </div>
                <button className="btn settings-btn" onClick={() => setShowSettings(true)}>상세 설정</button>
              </div>
            </section>

            <SettingsModal
              open={showSettings}
              onClose={() => setShowSettings(false)}
              settings={settings}
              setSettings={setSettings}
              gpuInfo={gpuInfo}
              uploadAsset={uploadAsset}
            />

            <OutputTargets settings={settings} setSettings={setSettings} />

            <section className="section">
              <button className="btn convert" onClick={handleConvert} disabled={converting}>
                {converting ? '변환 중...' : '변환 시작'}
              </button>
            </section>

            {progress && (
              <ProgressBar
                label={`${progress.fileName} - ${progress.taskType === 'video' ? '영상 변환' : 'MP3 추출'}`}
                percent={progress.filePercent}
                overall={progress.overallPercent}
              />
            )}

            {transferProgress && (
              <ProgressBar
                label={`전송: ${transferProgress.fileName} (${transferProgress.targetType})`}
                percent={transferProgress.percent}
              />
            )}

            {errors.length > 0 && (
              <div className="error-msg">
                {errors.map((e, i) => <div key={i}>{e}</div>)}
              </div>
            )}

            {results.length > 0 && (
              <section className="section results">
                <h2>완료</h2>
                <ul>
                  {results.map((r, i) => (
                    <li key={i}>
                      <span>{r.originalName} → {r.outputFilename}</span>
                      <a href={`/api/output/${r.outputFilename}`} download className="btn download">다운로드</a>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default App;
