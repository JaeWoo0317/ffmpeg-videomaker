import { useRef } from 'react';

export default function SubtitleSettings({ settings, setSettings, uploadAsset }) {
  const inputRef = useRef();
  const update = (key, value) => setSettings((s) => ({ ...s, [key]: value }));

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const asset = await uploadAsset(file);
      update('subtitleFile', asset);
    } catch {
      alert('자막 파일 업로드 실패');
    }
  };

  return (
    <section className="section">
      <h2>자막 설정</h2>
      <div className="form-row">
        <label>자막 파일</label>
        {settings.subtitleFile ? (
          <div className="asset-info">
            <span className="asset-name">{settings.subtitleFile.name}</span>
            <button className="btn-remove" onClick={() => update('subtitleFile', null)}>삭제</button>
          </div>
        ) : (
          <button className="btn asset-btn" onClick={() => inputRef.current.click()}>
            파일 선택 (.srt, .ass, .ssa)
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".srt,.ass,.ssa"
          style={{ display: 'none' }}
          onChange={handleFile}
        />
      </div>
      {settings.subtitleFile && (
        <>
          <div className="form-row">
            <label>폰트 크기</label>
            <input
              type="number"
              min="10"
              max="72"
              value={settings.subtitleFontSize}
              onChange={(e) => update('subtitleFontSize', parseInt(e.target.value) || 24)}
            />
          </div>
          <div className="form-row">
            <label>위치</label>
            <select value={settings.subtitlePosition} onChange={(e) => update('subtitlePosition', e.target.value)}>
              <option value="bottom">하단 (기본)</option>
              <option value="top">상단</option>
              <option value="center">중앙</option>
            </select>
          </div>
        </>
      )}
    </section>
  );
}
