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
  parallelEncode: false,
  parallelSegments: '',
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
  const [editingIndex, setEditingIndex] = useState(-1);
  const [editName, setEditName] = useState('');
  const [errors, setErrors] = useState([]);
  const jobIdRef = useRef(null);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [userPresets, setUserPresets] = useState({});

  useEffect(() => {
    fetch('/api/presets').then(r => r.json()).then(setUserPresets).catch(() => {});
  }, []);

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
    setProgress({ fileName: '준비 중...', taskType: 'video', filePercent: 0, overallPercent: 0 });
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
      setProgress({ fileName: '완료!', taskType: 'done', filePercent: 100, overallPercent: 100 });
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

  const handleRemoveFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleClearFiles = () => {
    setFiles([]);
    setUploadedFiles([]);
    setResults([]);
    setErrors([]);
  };

  const startEditing = (index) => {
    const r = results[index];
    const ext = r.outputFilename.lastIndexOf('.');
    const nameOnly = ext > 0 ? r.outputFilename.substring(0, ext) : r.outputFilename;
    setEditingIndex(index);
    setEditName(nameOnly);
  };

  const cancelEditing = () => {
    setEditingIndex(-1);
    setEditName('');
  };

  const handleRename = async (index) => {
    const r = results[index];
    if (!editName.trim()) { cancelEditing(); return; }
    try {
      const res = await fetch('/api/rename-output', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldFilename: r.outputFilename, newName: editName.trim(), savedPath: r.savedPath || '' }),
      });
      const data = await res.json();
      if (data.success) {
        setResults((prev) => prev.map((item, i) => i === index ? { ...item, outputFilename: data.newFilename, savedPath: data.newSavedPath || item.savedPath } : item));
      } else {
        alert('이름 변경 실패: ' + (data.error || '알 수 없는 오류'));
      }
    } catch (err) {
      alert('이름 변경 실패: ' + err.message);
    }
    cancelEditing();
  };

  const applyPreset = (preset) => {
    const builtIn = {
      high: { outputs: ['high'], resolution: 'original', bitrateMode: 'crf', crf: 18, audioBitrate: 256, codec: 'h264', profile: 'high' },
      low: { outputs: ['low'], resolution: '720p', bitrateMode: 'crf', crf: 28, audioBitrate: 128, codec: 'h264', profile: 'main' },
    };
    if (builtIn[preset]) setSettings((s) => ({ ...s, ...builtIn[preset] }));
  };

  const applyUserPreset = (name) => {
    if (userPresets[name]) {
      const saved = userPresets[name].settings;
      // targets는 유지 (전송 설정은 프리셋에 포함하지 않음)
      setSettings((s) => ({ ...s, ...saved, targets: s.targets }));
    }
  };

  const deleteUserPreset = async (name) => {
    const res = await fetch(`/api/presets/${encodeURIComponent(name)}`, { method: 'DELETE' });
    const data = await res.json();
    setUserPresets(data.presets);
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>VideoMaker</h1>
        <span className="subtitle">FFmpeg 영상 변환 도구</span>
      </header>

      <main className="app-main">
        <FileUpload onUpload={handleUpload} files={files} uploading={uploading} onRemoveFile={!converting ? handleRemoveFile : null} />

        {uploadedFiles.length > 0 && (
          <>
            <section className="section">
              <h2>프리셋</h2>
              <div className="preset-buttons">
                <button className="btn preset" onClick={() => applyPreset('high')}>고화질</button>
                <button className="btn preset" onClick={() => applyPreset('low')}>저화질</button>
                {Object.keys(userPresets).map((name) => (
                  <div key={name} className="user-preset-wrapper">
                    <button className="btn preset user" onClick={() => applyUserPreset(name)}>{name}</button>
                    <button className="btn-preset-badge-delete" onClick={() => deleteUserPreset(name)} title="삭제">✕</button>
                  </div>
                ))}
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
              onSavePreset={async (name) => {
                const { targets, subtitleFile, watermarkFile, ...saveable } = settings;
                const res = await fetch('/api/presets', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ name, settings: saveable }),
                });
                const data = await res.json();
                setUserPresets(data.presets);
              }}
            />

            <OutputTargets settings={settings} setSettings={setSettings} />

            <section className="section" style={{ display: 'flex', gap: 12 }}>
              <button className="btn convert" onClick={handleConvert} disabled={converting} style={{ flex: 1 }}>
                {converting ? '변환 중...' : '변환 시작'}
              </button>
              <button className="btn" onClick={handleClearFiles} disabled={converting} style={{ background: '#555', minWidth: 80 }}>
                초기화
              </button>
            </section>

            {(progress || results.length > 0 || errors.length > 0) && (
              <div className="progress-modal-overlay">
                <div className="progress-modal">
                  <div className="progress-modal-header">
                    <h3>{results.length > 0 ? '변환 완료' : '변환 진행 중'}</h3>
                    {!converting && (
                      <button className="btn-close" onClick={() => { setProgress(null); setTransferProgress(null); setErrors([]); }}>✕</button>
                    )}
                  </div>

                  <div className="progress-modal-body">
                    {progress && (
                      <ProgressBar
                        label={`${progress.fileName} - ${progress.taskType === 'video' ? '영상 변환' : progress.taskType === 'done' ? '완료' : 'MP3 추출'}`}
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
                      <div className="results">
                        <div className="results-header">
                          <span className="results-icon">✅</span>
                          <h2>변환 완료!</h2>
                          <span className="results-count">{results.length}개 파일</span>
                        </div>
                        <ul>
                          {results.map((r, i) => (
                            <li key={i}>
                              <div className="result-info">
                                <span>{r.originalName} → {r.outputFilename}</span>
                                {r.savedPath && <span className="saved-path" title={r.savedPath}>저장 위치: {r.savedPath}</span>}
                                {editingIndex === i ? (
                                  <div className="rename-row">
                                    <input
                                      className="rename-input"
                                      value={editName}
                                      onChange={(e) => setEditName(e.target.value)}
                                      onKeyDown={(e) => { if (e.key === 'Enter') handleRename(i); if (e.key === 'Escape') cancelEditing(); }}
                                      autoFocus
                                    />
                                    <span className="rename-ext">{r.outputFilename.substring(r.outputFilename.lastIndexOf('.'))}</span>
                                    <button className="btn-rename-ok" onClick={() => handleRename(i)}>확인</button>
                                    <button className="btn-rename-cancel" onClick={cancelEditing}>취소</button>
                                  </div>
                                ) : (
                                  <button className="btn-rename" onClick={() => startEditing(i)}>이름 수정</button>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                        <button className="btn convert" style={{ marginTop: 16, width: '100%' }} onClick={() => { cleanupListeners(); setProgress(null); setTransferProgress(null); setErrors([]); setResults([]); setConverting(false); }}>확인</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default App;
