import { useRef } from 'react';

export default function WatermarkSettings({ settings, setSettings, uploadAsset }) {
  const inputRef = useRef();
  const update = (key, value) => setSettings((s) => ({ ...s, [key]: value }));

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const asset = await uploadAsset(file);
      update('watermarkFile', asset);
    } catch {
      alert('워터마크 이미지 업로드 실패');
    }
  };

  return (
    <section className="section">
      <h2>워터마크 / 로고</h2>
      <div className="form-row">
        <label>이미지 파일</label>
        {settings.watermarkFile ? (
          <div className="asset-info">
            <span className="asset-name">{settings.watermarkFile.name}</span>
            <button className="btn-remove" onClick={() => update('watermarkFile', null)}>삭제</button>
          </div>
        ) : (
          <button className="btn asset-btn" onClick={() => inputRef.current.click()}>
            이미지 선택 (PNG, JPG)
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFile}
        />
      </div>
      {settings.watermarkFile && (
        <>
          <div className="form-row">
            <label>위치</label>
            <select value={settings.watermarkPosition} onChange={(e) => update('watermarkPosition', e.target.value)}>
              <option value="top-left">좌측 상단</option>
              <option value="top-right">우측 상단</option>
              <option value="bottom-left">좌측 하단</option>
              <option value="bottom-right">우측 하단</option>
              <option value="center">중앙</option>
            </select>
          </div>
          <div className="form-row">
            <label>투명도</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={settings.watermarkOpacity}
              onChange={(e) => update('watermarkOpacity', parseFloat(e.target.value))}
            />
            <span className="range-value">{Math.round(settings.watermarkOpacity * 100)}%</span>
          </div>
        </>
      )}
    </section>
  );
}
