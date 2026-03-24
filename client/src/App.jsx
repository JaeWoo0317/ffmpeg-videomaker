import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import FileUpload from './components/FileUpload';
import VideoSettings from './components/VideoSettings';
import AudioSettings from './components/AudioSettings';
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
  const [converting, setConverting] = useState(false);
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

    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    const data = await res.json();
    setUploadedFiles(data.files);
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

  const applyPreset = (preset) => {
    const presets = {
      high: { outputs: ['high'], resolution: 'original', bitrateMode: 'crf', crf: 18, audioBitrate: 256 },
      low: { outputs: ['low'], resolution: '720p', bitrateMode: 'crf', crf: 28, audioBitrate: 128 },
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
        <FileUpload onUpload={handleUpload} files={files} />

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

            <VideoSettings settings={settings} setSettings={setSettings} gpuInfo={gpuInfo} />
            <AudioSettings settings={settings} setSettings={setSettings} />
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
