import { useState, useEffect } from 'react';
import VideoSettings from './VideoSettings';
import AudioSettings from './AudioSettings';
import TrimSettings from './TrimSettings';
import SubtitleSettings from './SubtitleSettings';
import WatermarkSettings from './WatermarkSettings';
import CropSettings from './CropSettings';

const TABS = [
  { id: 'video', label: '영상' },
  { id: 'audio', label: '오디오' },
  { id: 'trim', label: '구간' },
  { id: 'subtitle', label: '자막' },
  { id: 'watermark', label: '워터마크' },
  { id: 'crop', label: '크롭' },
];

export default function SettingsModal({ open, onClose, settings, setSettings, gpuInfo, uploadAsset }) {
  const [activeTab, setActiveTab] = useState('video');

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>상세 설정</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`modal-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="modal-body">
          {activeTab === 'video' && <VideoSettings settings={settings} setSettings={setSettings} gpuInfo={gpuInfo} />}
          {activeTab === 'audio' && <AudioSettings settings={settings} setSettings={setSettings} />}
          {activeTab === 'trim' && <TrimSettings settings={settings} setSettings={setSettings} />}
          {activeTab === 'subtitle' && <SubtitleSettings settings={settings} setSettings={setSettings} uploadAsset={uploadAsset} />}
          {activeTab === 'watermark' && <WatermarkSettings settings={settings} setSettings={setSettings} uploadAsset={uploadAsset} />}
          {activeTab === 'crop' && <CropSettings settings={settings} setSettings={setSettings} />}
        </div>

        <div className="modal-footer">
          <button className="btn convert" onClick={onClose} style={{ maxWidth: 200 }}>확인</button>
        </div>
      </div>
    </div>
  );
}
