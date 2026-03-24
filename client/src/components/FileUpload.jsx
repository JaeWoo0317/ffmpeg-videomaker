import { useRef, useState } from 'react';

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function FileUpload({ onUpload, files }) {
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
        className={`upload-zone ${dragging ? 'dragging' : ''}`}
        onClick={() => inputRef.current.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <div className="icon">+</div>
        <p>클릭하거나 파일을 여기에 드래그앤드롭</p>
        <p style={{ marginTop: 4, fontSize: 12, color: '#666' }}>MOV, MP4, AVI, MKV 지원</p>
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
