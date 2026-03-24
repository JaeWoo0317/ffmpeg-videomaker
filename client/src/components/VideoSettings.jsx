export default function VideoSettings({ settings, setSettings, gpuInfo }) {
  const update = (key, value) => setSettings((s) => ({ ...s, [key]: value }));

  return (
    <section className="section">
      <h2>영상 설정</h2>

      <div className="form-row">
        <label>해상도</label>
        <select value={settings.resolution} onChange={(e) => update('resolution', e.target.value)}>
          <option value="original">원본 유지</option>
          <option value="4k">4K (3840x2160)</option>
          <option value="1080p">1080p (1920x1080)</option>
          <option value="720p">720p (1280x720)</option>
          <option value="480p">480p (854x480)</option>
          <option value="custom">사용자 정의</option>
        </select>
      </div>

      {settings.resolution === 'custom' && (
        <div className="form-row">
          <label>사용자 정의</label>
          <div className="custom-res">
            <input
              type="number"
              placeholder="가로"
              value={settings.customWidth}
              onChange={(e) => update('customWidth', e.target.value)}
            />
            <span>x</span>
            <input
              type="number"
              placeholder="세로"
              value={settings.customHeight}
              onChange={(e) => update('customHeight', e.target.value)}
            />
          </div>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={settings.keepAspectRatio}
              onChange={(e) => update('keepAspectRatio', e.target.checked)}
            />
            종횡비 유지
          </label>
        </div>
      )}

      <div className="form-row">
        <label>비트레이트 모드</label>
        <select value={settings.bitrateMode} onChange={(e) => update('bitrateMode', e.target.value)}>
          <option value="crf">CRF (품질 우선)</option>
          <option value="cbr">CBR (고정 비트레이트)</option>
          <option value="vbr">VBR (가변 비트레이트)</option>
        </select>
      </div>

      {settings.bitrateMode === 'crf' ? (
        <div className="form-row">
          <label>CRF 값</label>
          <input
            type="range"
            min="0"
            max="51"
            value={settings.crf}
            onChange={(e) => update('crf', parseInt(e.target.value))}
          />
          <span className="range-value">{settings.crf}</span>
          <span style={{ fontSize: 12, color: '#888' }}>
            {settings.crf <= 18 ? '(고품질)' : settings.crf <= 28 ? '(보통)' : '(저품질)'}
          </span>
        </div>
      ) : (
        <div className="form-row">
          <label>영상 비트레이트</label>
          <input
            type="number"
            value={settings.videoBitrate}
            onChange={(e) => update('videoBitrate', parseInt(e.target.value) || 0)}
            min="100"
            max="50000"
          />
          <span style={{ fontSize: 14, color: '#888' }}>kbps</span>
        </div>
      )}

      <div className="form-row">
        <label>인코딩 속도</label>
        <select value={settings.preset} onChange={(e) => update('preset', e.target.value)}>
          <option value="ultrafast">ultrafast (빠름, 큰 파일)</option>
          <option value="fast">fast</option>
          <option value="medium">medium (균형)</option>
          <option value="slow">slow</option>
          <option value="veryslow">veryslow (느림, 작은 파일)</option>
        </select>
      </div>

      <div className="form-row">
        <label>GPU 가속</label>
        <select
          value={settings.gpuAccel}
          onChange={(e) => {
            update('gpuAccel', e.target.value);
            if (e.target.value === 'cpu') update('gpuEncoder', '');
            else if (gpuInfo) update('gpuEncoder', gpuInfo.recommended);
          }}
        >
          <option value="auto">자동 감지 {gpuInfo?.available ? '(GPU 사용 가능)' : '(GPU 없음)'}</option>
          <option value="cpu">CPU만 사용</option>
          {gpuInfo?.nvenc && <option value="nvenc">NVIDIA NVENC</option>}
          {gpuInfo?.qsv && <option value="qsv">Intel QSV</option>}
          {gpuInfo?.amf && <option value="amf">AMD AMF</option>}
        </select>
      </div>

      <div className="form-row">
        <label>파일 크기 제한</label>
        <input
          type="number"
          placeholder="제한 없음"
          value={settings.maxFileSizeMB}
          onChange={(e) => update('maxFileSizeMB', e.target.value ? parseInt(e.target.value) : '')}
          min="1"
        />
        <span style={{ fontSize: 14, color: '#888' }}>MB (비워두면 제한 없음)</span>
      </div>
    </section>
  );
}
