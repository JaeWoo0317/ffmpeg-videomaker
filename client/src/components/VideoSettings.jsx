export default function VideoSettings({ settings, setSettings, gpuInfo }) {
  const update = (key, value) => setSettings((s) => ({ ...s, [key]: value }));

  const handleCodecChange = (codec) => {
    update('codec', codec);
    // GPU 인코더 자동 매핑
    if (settings.gpuAccel !== 'cpu' && gpuInfo?.available) {
      const gpuType = settings.gpuAccel === 'auto' ? (gpuInfo.nvenc ? 'nvenc' : gpuInfo.qsv ? 'qsv' : gpuInfo.amf ? 'amf' : null) : settings.gpuAccel;
      if (gpuType) {
        const encoderMap = {
          h264: { nvenc: 'h264_nvenc', qsv: 'h264_qsv', amf: 'h264_amf' },
          h265: { nvenc: 'hevc_nvenc', qsv: 'hevc_qsv', amf: 'hevc_amf' },
          av1: { nvenc: 'av1_nvenc', qsv: 'av1_qsv', amf: null },
        };
        const encoder = encoderMap[codec]?.[gpuType];
        update('gpuEncoder', encoder || '');
      }
    }
  };

  return (
    <section className="section">
      <h2>영상 설정</h2>

      <div className="form-row">
        <label>코덱</label>
        <select value={settings.codec} onChange={(e) => handleCodecChange(e.target.value)}>
          <option value="h264">H.264 (AVC)</option>
          <option value="h265">H.265 (HEVC)</option>
          <option value="av1">AV1 (SVT-AV1)</option>
          <option value="vp9">VP9</option>
          <option value="mpeg4">MPEG-4</option>
          <option value="prores">ProRes (편집용)</option>
          <option value="copy">복사 (재인코딩 없음)</option>
        </select>
      </div>

      <div className="form-row">
        <label>컨테이너</label>
        <select value={settings.container} onChange={(e) => update('container', e.target.value)}>
          <option value="mp4">MP4</option>
          <option value="mkv">MKV</option>
          <option value="webm">WebM</option>
          <option value="mov">MOV</option>
          <option value="avi">AVI</option>
        </select>
      </div>

      {(settings.codec === 'h264' || settings.codec === 'h265') && (
        <div className="form-row">
          <label>프로파일</label>
          <select value={settings.profile} onChange={(e) => update('profile', e.target.value)}>
            <option value="baseline">Baseline</option>
            <option value="main">Main</option>
            <option value="high">High</option>
            {settings.codec === 'h264' && <option value="high10">High 10</option>}
          </select>
          <span style={{ fontSize: 12, color: '#666' }}>
            {settings.profile === 'baseline' ? '(호환성 높음)' : settings.profile === 'high' ? '(고품질)' : settings.profile === 'high10' ? '(10bit)' : ''}
          </span>
        </div>
      )}

      <div className="form-row">
        <label>리사이즈 필터</label>
        <select value={settings.scaleFilter || 'bilinear'} onChange={(e) => update('scaleFilter', e.target.value)}>
          <option value="bilinear">Bilinear (기본, 빠름)</option>
          <option value="bicubic">Bicubic (균형)</option>
          <option value="lanczos">Lanczos (고품질, 느림)</option>
          <option value="neighbor">Nearest Neighbor (픽셀아트)</option>
          <option value="spline">Spline (부드러움)</option>
        </select>
      </div>

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
        <label>FPS (프레임)</label>
        <select value={settings.fps} onChange={(e) => update('fps', e.target.value)}>
          <option value="">원본 유지</option>
          <option value="24">24 fps (영화)</option>
          <option value="25">25 fps (PAL)</option>
          <option value="30">30 fps</option>
          <option value="50">50 fps</option>
          <option value="60">60 fps</option>
        </select>
      </div>

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
            else if (gpuInfo) {
              const gpuType = e.target.value === 'auto' ? (gpuInfo.nvenc ? 'nvenc' : gpuInfo.qsv ? 'qsv' : gpuInfo.amf ? 'amf' : null) : e.target.value;
              const encoderMap = {
                h264: { nvenc: 'h264_nvenc', qsv: 'h264_qsv', amf: 'h264_amf' },
                h265: { nvenc: 'hevc_nvenc', qsv: 'hevc_qsv', amf: 'hevc_amf' },
                av1: { nvenc: 'av1_nvenc', qsv: 'av1_qsv', amf: null },
              };
              const encoder = gpuType ? encoderMap[settings.codec]?.[gpuType] : null;
              update('gpuEncoder', encoder || gpuInfo.recommended);
            }
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
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={settings.parallelEncode || false}
            onChange={(e) => update('parallelEncode', e.target.checked)}
            disabled={settings.gpuAccel !== 'cpu' && gpuInfo?.available}
          />
          세그먼트 병렬 인코딩
        </label>
        {settings.gpuAccel !== 'cpu' && gpuInfo?.available && (
          <span style={{ fontSize: 12, color: '#f59e0b' }}>GPU 사용 시 비활성 (GPU가 더 빠름)</span>
        )}
      </div>

      {settings.parallelEncode && (settings.gpuAccel === 'cpu' || !gpuInfo?.available) && (
        <div className="form-row">
          <label>병렬 세그먼트 수</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <select value={settings.parallelSegments || 'auto'} onChange={(e) => update('parallelSegments', e.target.value === 'auto' ? '' : parseInt(e.target.value))} style={{ flex: 1 }}>
              <option value="auto">자동 ({gpuInfo?.cpuCores || '?'}코어)</option>
              {[2, 4, 6, 8, 12, 16].filter(n => n <= (gpuInfo?.cpuCores || 16)).map(n => (
                <option key={n} value={n}>{n}개{n === gpuInfo?.cpuCores ? ' (최대)' : ''}</option>
              ))}
            </select>
            <span style={{ color: '#888', fontSize: 12 }}>또는</span>
            <input
              type="number"
              min="2"
              max={gpuInfo?.cpuCores || 32}
              value={settings.parallelSegments || ''}
              placeholder="직접 입력"
              onChange={(e) => {
                const v = parseInt(e.target.value);
                if (v >= 2) update('parallelSegments', v);
                else if (!e.target.value) update('parallelSegments', '');
              }}
              style={{ width: 80, padding: '6px 8px', background: '#333', color: '#fff', border: '1px solid #555', borderRadius: 4 }}
            />
          </div>
          <span style={{ fontSize: 12, color: '#888' }}>CPU 코어: {gpuInfo?.cpuCores || '?'}개 | 영상을 N등분하여 동시 인코딩</span>
        </div>
      )}

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

      <div className="form-row">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={settings.deinterlace}
            onChange={(e) => update('deinterlace', e.target.checked)}
          />
          디인터레이스 (yadif)
        </label>
      </div>

      <div className="form-row">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={settings.noiseReduction}
            onChange={(e) => update('noiseReduction', e.target.checked)}
          />
          노이즈 제거
        </label>
        {settings.noiseReduction && (
          <>
            <input
              type="range"
              min="1"
              max="10"
              value={settings.noiseStrength}
              onChange={(e) => update('noiseStrength', parseInt(e.target.value))}
              style={{ flex: 1 }}
            />
            <span className="range-value">{settings.noiseStrength}</span>
            <span style={{ fontSize: 12, color: '#888' }}>
              {settings.noiseStrength <= 3 ? '(약함)' : settings.noiseStrength <= 7 ? '(보통)' : '(강함)'}
            </span>
          </>
        )}
      </div>
    </section>
  );
}
