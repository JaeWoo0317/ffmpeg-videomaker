export default function AudioSettings({ settings, setSettings }) {
  const update = (key, value) => setSettings((s) => ({ ...s, [key]: value }));

  return (
    <section className="section">
      <h2>오디오 설정</h2>

      <div className="form-row">
        <label>오디오 코덱</label>
        <select
          value={settings.audioCodec}
          onChange={(e) => update('audioCodec', e.target.value)}
        >
          <option value="aac">AAC (권장)</option>
          <option value="mp3">MP3</option>
          <option value="opus">Opus</option>
          <option value="flac">FLAC (무손실)</option>
          <option value="ac3">AC3 (돌비)</option>
          <option value="pcm">PCM (무압축)</option>
          <option value="copy">복사 (재인코딩 없음)</option>
        </select>
      </div>

      {settings.audioCodec !== 'copy' && settings.audioCodec !== 'flac' && settings.audioCodec !== 'pcm' && (
        <div className="form-row">
          <label>오디오 비트레이트</label>
          <select
            value={settings.audioBitrate}
            onChange={(e) => update('audioBitrate', parseInt(e.target.value))}
          >
            <option value={64}>64 kbps (저품질)</option>
            <option value={128}>128 kbps</option>
            <option value={192}>192 kbps (권장)</option>
            <option value={256}>256 kbps</option>
            <option value={320}>320 kbps (고품질)</option>
          </select>
        </div>
      )}

      <div className="form-row">
        <label>채널</label>
        <select
          value={settings.audioChannels}
          onChange={(e) => update('audioChannels', e.target.value)}
        >
          <option value="mono">모노 (1ch)</option>
          <option value="stereo">스테레오 (2ch)</option>
          <option value="5.1">5.1 서라운드 (6ch)</option>
        </select>
      </div>

      <div className="form-row">
        <label>샘플레이트</label>
        <select
          value={settings.audioSampleRate}
          onChange={(e) => update('audioSampleRate', parseInt(e.target.value))}
        >
          <option value={22050}>22050 Hz</option>
          <option value={44100}>44100 Hz (CD 품질)</option>
          <option value={48000}>48000 Hz (권장)</option>
        </select>
      </div>
    </section>
  );
}
