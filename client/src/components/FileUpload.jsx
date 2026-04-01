import { useRef, useState } from 'react';

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

const isElectron = !!window.electronAPI;

export default function FileUpload({ onAddLocalFiles, files, onRemoveFile }) {
  const inputRef = useRef();
  const [dragging, setDragging] = useState(false);
  const [showBrowser, setShowBrowser] = useState(false);
  const [browserPath, setBrowserPath] = useState('');
  const [browserFolders, setBrowserFolders] = useState([]);
  const [browserFiles, setBrowserFiles] = useState([]);
  const [browserParent, setBrowserParent] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);

  // 드래그앤드롭: Electron preload에서 webUtils.getPathForFile로 경로 획득
  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles.length === 0) return;

    // preload의 drop 이벤트(capture)가 먼저 실행되어 경로를 저장함
    // 약간의 지연을 주어 preload 핸들러가 먼저 완료되도록 함
    setTimeout(() => {
      if (window._electronDroppedPaths && window._electronDroppedPaths.length > 0) {
        const paths = [...window._electronDroppedPaths];
        window._electronDroppedPaths = [];
        onAddLocalFiles(paths);
      } else {
        alert('드래그앤드롭은 데스크톱 앱에서만 지원됩니다.\n"파일 찾아보기" 버튼을 사용해주세요.');
      }
    }, 50);
  };

  // 파일 선택: Electron 네이티브 다이얼로그 사용
  const handleSelectFiles = async () => {
    if (isElectron) {
      const paths = await window.electronAPI.selectFiles();
      if (paths.length > 0) onAddLocalFiles(paths);
    } else {
      openBrowser();
    }
  };

  // 서버 측 폴더 탐색 (Electron, 브라우저 모두 사용 가능)
  const browseFolders = async (p) => {
    const res = await fetch(`/api/browse-folders?path=${encodeURIComponent(p || '')}`);
    const data = await res.json();
    setBrowserPath(data.current || '');
    setBrowserFolders(data.folders || []);
    setBrowserParent(data.parent || '');
    if (p) {
      const fres = await fetch(`/api/browse-files?path=${encodeURIComponent(p)}`);
      const fdata = await fres.json();
      setBrowserFiles(fdata.files || []);
    } else {
      setBrowserFiles([]);
    }
    setSelectedFiles([]);
  };

  const openBrowser = () => {
    setShowBrowser(true);
    browseFolders('');
  };

  const toggleFileSelect = (filePath) => {
    setSelectedFiles(prev =>
      prev.includes(filePath) ? prev.filter(f => f !== filePath) : [...prev, filePath]
    );
  };

  const addSelectedFiles = async () => {
    if (selectedFiles.length === 0) return;
    await onAddLocalFiles(selectedFiles);
    setShowBrowser(false);
    setSelectedFiles([]);
  };

  return (
    <div>
      <div
        className={`upload-zone ${dragging ? 'dragging' : ''}`}
        onClick={handleSelectFiles}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <div className="icon">+</div>
        <p>{isElectron ? '클릭하거나 파일을 여기에 드래그앤드롭' : '클릭하여 파일 선택'}</p>
        <p style={{ marginTop: 4, fontSize: 12, color: '#666' }}>MOV, MP4, AVI, MKV 지원 · 업로드 없이 직접 변환</p>
      </div>

      {!isElectron && (
        <button className="btn-secondary" onClick={openBrowser} style={{ marginTop: 8, marginBottom: 12, width: '100%' }}>
          폴더 탐색으로 파일 찾기
        </button>
      )}

      {showBrowser && (
        <div className="modal-overlay" onClick={() => setShowBrowser(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 600, maxHeight: '70vh' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>파일 선택</h3>
              <button className="btn-close" onClick={() => setShowBrowser(false)}>✕</button>
            </div>
            {browserPath && (
              <div style={{ fontSize: 13, color: '#4af', marginBottom: 8, wordBreak: 'break-all' }}>
                현재: {browserPath}
              </div>
            )}
            <div style={{ overflowY: 'auto', maxHeight: '50vh', border: '1px solid #333', borderRadius: 6, padding: 8 }}>
              {browserParent !== '' && (
                <div className="folder-item" onClick={() => browseFolders(browserParent)} style={{ cursor: 'pointer', padding: '6px 8px', borderBottom: '1px solid #333' }}>
                  .. (상위 폴더)
                </div>
              )}
              {browserFolders.map((f, i) => (
                <div key={'d' + i} className="folder-item" onClick={() => browseFolders(f.path)}
                  style={{ cursor: 'pointer', padding: '6px 8px', borderBottom: '1px solid #222', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: '#ffd700' }}>&#128193;</span>
                  <span>{f.name}</span>
                </div>
              ))}
              {browserFiles.map((f, i) => (
                <div key={'f' + i}
                  onClick={() => toggleFileSelect(f.path)}
                  style={{
                    cursor: 'pointer', padding: '6px 8px', borderBottom: '1px solid #222',
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: selectedFiles.includes(f.path) ? '#1a3a5c' : 'transparent'
                  }}>
                  <input type="checkbox" checked={selectedFiles.includes(f.path)} readOnly style={{ accentColor: '#4af' }} />
                  <span style={{ flex: 1 }}>{f.name}</span>
                  <span style={{ fontSize: 12, color: '#888' }}>{formatSize(f.size)}</span>
                </div>
              ))}
              {browserPath && browserFolders.length === 0 && browserFiles.length === 0 && (
                <div style={{ padding: 16, textAlign: 'center', color: '#666' }}>폴더와 영상 파일이 없습니다</div>
              )}
            </div>
            {selectedFiles.length > 0 && (
              <button className="btn-primary" onClick={addSelectedFiles}
                style={{ marginTop: 12, width: '100%' }}>
                {selectedFiles.length}개 파일 추가
              </button>
            )}
          </div>
        </div>
      )}

      {files.length > 0 && (
        <ul className="file-list">
          {files.map((f, i) => (
            <li key={i}>
              <span>{f.name}</span>
              <span className="file-size">{formatSize(f.size)}</span>
              {onRemoveFile && (
                <button
                  className="btn-remove-file"
                  onClick={() => onRemoveFile(i)}
                  title="파일 제거"
                >✕</button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
