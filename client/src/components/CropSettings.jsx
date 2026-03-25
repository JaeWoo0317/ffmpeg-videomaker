export default function CropSettings({ settings, setSettings }) {
  const update = (key, value) => setSettings((s) => ({ ...s, [key]: value }));

  return (
    <section className="section">
      <h2>크롭 (영역 자르기)</h2>
      <div className="form-row">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={settings.cropEnabled}
            onChange={(e) => update('cropEnabled', e.target.checked)}
          />
          크롭 활성화
        </label>
      </div>
      {settings.cropEnabled && (
        <>
          <div className="form-row">
            <label>크기</label>
            <input
              type="number"
              placeholder="가로"
              value={settings.cropWidth}
              onChange={(e) => update('cropWidth', e.target.value)}
              style={{ width: 80 }}
            />
            <span style={{ color: '#666' }}>x</span>
            <input
              type="number"
              placeholder="세로"
              value={settings.cropHeight}
              onChange={(e) => update('cropHeight', e.target.value)}
              style={{ width: 80 }}
            />
          </div>
          <div className="form-row">
            <label>시작 위치</label>
            <span style={{ fontSize: 13, color: '#888' }}>X:</span>
            <input
              type="number"
              placeholder="0"
              value={settings.cropX}
              onChange={(e) => update('cropX', e.target.value)}
              style={{ width: 80 }}
            />
            <span style={{ fontSize: 13, color: '#888' }}>Y:</span>
            <input
              type="number"
              placeholder="0"
              value={settings.cropY}
              onChange={(e) => update('cropY', e.target.value)}
              style={{ width: 80 }}
            />
          </div>
          <p style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
            좌측 상단 기준 좌표 (픽셀 단위)
          </p>
        </>
      )}
    </section>
  );
}
