import { useRef, useState } from 'react';

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function FileUpload({ onUpload, files, uploading }) {
  const inputRef = useRef();
  const [dragging, setDragging] = useState(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles.length > 0) onUpload(droppedFiles);
  };

  const handleSelect = (e) => {
    if (e.target.files.length > 0) onUpload(e.target.files);
  };

  return (
    <div>
      <div
        className={`upload-zone ${dragging ? 'dragging' : ''} ${uploading ? 'uploading' : ''}`}
        onClick={() => !uploading && inputRef.current.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        style={uploading ? { cursor: 'wait' } : undefined}
      >
        {uploading ? (
          <>
            <div className="upload-spinner" />
            <p style={{ marginTop: 12 }}>파일 업로드 중...</p>
            <p style={{ marginTop: 4, fontSize: 12, color: '#666' }}>잠시만 기다려주세요</p>
          </>
        ) : (
          <>
            <div className="icon">+</div>
            <p>클릭하거나 파일을 여기에 드래그앤드롭</p>
            <p style={{ marginTop: 4, fontSize: 12, color: '#666' }}>MOV, MP4, AVI, MKV 지원</p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="video/*"
          style={{ display: 'none' }}
          onChange={handleSelect}
        />
      </div>

      {files.length > 0 && (
        <ul className="file-list">
          {files.map((f, i) => (
            <li key={i}>
              <span>{f.name}</span>
              <span className="file-size">{formatSize(f.size)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
