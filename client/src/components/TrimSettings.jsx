export default function TrimSettings({ settings, setSettings }) {
  const update = (key, value) => setSettings((s) => ({ ...s, [key]: value }));

  return (
    <section className="section">
      <h2>구간 자르기</h2>
      <div className="form-row">
        <label>시작 시간</label>
        <input
          type="text"
          placeholder="00:00:00"
          value={settings.trimStart}
          onChange={(e) => update('trimStart', e.target.value)}
          style={{ width: 120, flex: 'none' }}
        />
        <label style={{ minWidth: 'auto' }}>끝 시간</label>
        <input
          type="text"
          placeholder="00:00:00"
          value={settings.trimEnd}
          onChange={(e) => update('trimEnd', e.target.value)}
          style={{ width: 120, flex: 'none' }}
        />
      </div>
      <p style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
        비워두면 전체 영상을 변환합니다. 형식: HH:MM:SS (예: 00:01:30)
      </p>
    </section>
  );
}
