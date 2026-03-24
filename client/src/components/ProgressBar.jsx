export default function ProgressBar({ label, percent, overall }) {
  return (
    <div className="progress-section">
      <div className="progress-label">{label}</div>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${percent}%` }} />
      </div>
      <div className="progress-percent">{Math.round(percent)}%</div>
      {overall !== undefined && (
        <>
          <div className="progress-label" style={{ marginTop: 8 }}>전체 진행률</div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${overall}%` }} />
          </div>
          <div className="progress-percent">{Math.round(overall)}%</div>
        </>
      )}
    </div>
  );
}
