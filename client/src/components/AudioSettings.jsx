export default function AudioSettings({ settings, setSettings }) {
  return (
    <section className="section">
      <h2>오디오 설정</h2>
      <div className="form-row">
        <label>오디오 비트레이트</label>
        <select
          value={settings.audioBitrate}
          onChange={(e) => setSettings((s) => ({ ...s, audioBitrate: parseInt(e.target.value) }))}
        >
          <option value={64}>64 kbps (저품질)</option>
          <option value={128}>128 kbps</option>
          <option value={192}>192 kbps (권장)</option>
          <option value={256}>256 kbps</option>
          <option value={320}>320 kbps (고품질)</option>
        </select>
      </div>
    </section>
  );
}
