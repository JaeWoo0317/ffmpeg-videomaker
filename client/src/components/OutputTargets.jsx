import { useState, useEffect } from 'react';

function TreeNode({ node, onSelect, onClose }) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState(null);
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    if (expanded) { setExpanded(false); return; }
    if (children === null) {
      setLoading(true);
      try {
        const res = await fetch(`/api/browse-folders?path=${encodeURIComponent(node.path)}`);
        const data = await res.json();
        setChildren((data.folders || []).filter((f) => f.type === 'folder'));
      } catch { setChildren([]); }
      setLoading(false);
    }
    setExpanded(true);
  };

  return (
    <div className="tree-node">
      <div className="tree-row" onClick={toggle}>
        <span className="tree-arrow">{loading ? '⏳' : expanded ? '▼' : '▶'}</span>
        <span className={`tree-icon-box ${expanded ? 'open' : ''} ${node.type}`}>
          {node.type === 'drive' ? '🖴' : ''}
        </span>
        <span className="tree-label">{node.type === 'quick' ? node.name : node.name}</span>
        <button className="btn tree-select-btn" onClick={(e) => { e.stopPropagation(); onSelect(node.path); onClose(); }}>선택</button>
      </div>
      {expanded && children && children.length > 0 && (
        <div className="tree-children">
          {children.map((child, i) => (
            <TreeNode key={i} node={child} onSelect={onSelect} onClose={onClose} />
          ))}
        </div>
      )}
      {expanded && children && children.length === 0 && (
        <div className="tree-children"><div className="tree-empty">하위 폴더 없음</div></div>
      )}
    </div>
  );
}

function FolderBrowser({ currentPath, onSelect, onClose }) {
  const [roots, setRoots] = useState([]);
  const [selected, setSelected] = useState(currentPath || '');

  useEffect(() => {
    fetch('/api/browse-folders?path=').then((r) => r.json()).then((data) => {
      setRoots(data.folders || []);
    }).catch(() => {});
  }, []);

  const handleSelect = (p) => { setSelected(p); onSelect(p); };

  return (
    <div className="folder-browser-overlay" onClick={onClose}>
      <div className="folder-browser" onClick={(e) => e.stopPropagation()}>
        <div className="folder-browser-header">
          <h3>📂 폴더 선택</h3>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>

        {selected && (
          <div className="folder-browser-path">
            <span className="path-text" title={selected}>선택: {selected}</span>
          </div>
        )}

        <div className="folder-tree">
          {roots.length === 0 && <div className="folder-loading">로딩 중...</div>}
          {roots.map((node, i) => (
            <TreeNode key={i} node={node} onSelect={handleSelect} onClose={onClose} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function OutputTargets({ settings, setSettings }) {
  const [showBrowser, setShowBrowser] = useState(null);

  useEffect(() => {
    // 로컬 경로 기본값을 다운로드 폴더로 설정
    const localTarget = settings.targets.find((t) => t.type === 'local');
    if (localTarget && !localTarget.path) {
      fetch('/api/default-path').then((r) => r.json()).then((data) => {
        const idx = settings.targets.findIndex((t) => t.type === 'local');
        if (idx >= 0) {
          setSettings((s) => {
            const targets = [...s.targets];
            targets[idx] = { ...targets[idx], path: data.path };
            return { ...s, targets };
          });
        }
      }).catch(() => {});
    }
  }, []);

  const [picking, setPicking] = useState(false);

  const pickNativeFolder = async (targetIndex) => {
    setPicking(true);
    try {
      const res = await fetch('/api/pick-folder');
      const data = await res.json();
      if (data.path) {
        updateTarget(targetIndex, 'path', data.path);
      }
    } catch {}
    setPicking(false);
  };

  const updateTarget = (index, key, value) => {
    setSettings((s) => {
      const targets = [...s.targets];
      targets[index] = { ...targets[index], [key]: value };
      return { ...s, targets };
    });
  };

  const labels = {
    local: '로컬 저장',
    ftp: 'FTP',
    sftp: 'SFTP',
    share: '공유 폴더',
  };

  return (
    <section className="section">
      <h2>출력 대상</h2>

      <div className="target-checks">
        {settings.targets.map((target, i) => (
          <label className="checkbox-label" key={target.type}>
            <input
              type="checkbox"
              checked={target.enabled}
              onChange={(e) => updateTarget(i, 'enabled', e.target.checked)}
            />
            {labels[target.type]}
          </label>
        ))}
      </div>

      {settings.targets.map((target, i) => (
        target.enabled && (
          <div className="target-group" key={target.type}>
            <div className="target-header">
              <span style={{ fontWeight: 600, fontSize: 14 }}>{labels[target.type]}</span>
            </div>

            <div className="target-fields">
              {target.type === 'local' && (
                <>
                  <div className="form-row">
                    <label>출력 경로</label>
                    <div style={{ display: 'flex', gap: 8, flex: 1 }}>
                      <input
                        type="text"
                        placeholder="경로를 입력하거나 폴더 찾기를 누르세요"
                        value={target.path}
                        onChange={(e) => updateTarget(i, 'path', e.target.value)}
                        style={{ flex: 1 }}
                      />
                      <button className="btn preset" onClick={() => setShowBrowser(i)}>📂 폴더 찾기</button>
                    </div>
                  </div>
                </>
              )}

              {target.type === 'ftp' && (
                <>
                  <div className="form-row">
                    <label>호스트</label>
                    <input type="text" placeholder="ftp.example.com" value={target.host} onChange={(e) => updateTarget(i, 'host', e.target.value)} />
                  </div>
                  <div className="form-row">
                    <label>포트</label>
                    <input type="number" value={target.port} onChange={(e) => updateTarget(i, 'port', parseInt(e.target.value) || 21)} />
                  </div>
                  <div className="form-row">
                    <label>사용자</label>
                    <input type="text" value={target.username} onChange={(e) => updateTarget(i, 'username', e.target.value)} />
                  </div>
                  <div className="form-row">
                    <label>비밀번호</label>
                    <input type="password" value={target.password} onChange={(e) => updateTarget(i, 'password', e.target.value)} />
                  </div>
                  <div className="form-row">
                    <label>원격 경로</label>
                    <input type="text" placeholder="/upload" value={target.remotePath} onChange={(e) => updateTarget(i, 'remotePath', e.target.value)} />
                  </div>
                  <div className="form-row">
                    <label className="checkbox-label">
                      <input type="checkbox" checked={target.secure} onChange={(e) => updateTarget(i, 'secure', e.target.checked)} />
                      FTPS (TLS)
                    </label>
                  </div>
                </>
              )}

              {target.type === 'sftp' && (
                <>
                  <div className="form-row">
                    <label>호스트</label>
                    <input type="text" placeholder="sftp.example.com" value={target.host} onChange={(e) => updateTarget(i, 'host', e.target.value)} />
                  </div>
                  <div className="form-row">
                    <label>포트</label>
                    <input type="number" value={target.port} onChange={(e) => updateTarget(i, 'port', parseInt(e.target.value) || 22)} />
                  </div>
                  <div className="form-row">
                    <label>사용자</label>
                    <input type="text" value={target.username} onChange={(e) => updateTarget(i, 'username', e.target.value)} />
                  </div>
                  <div className="form-row">
                    <label>비밀번호</label>
                    <input type="password" value={target.password} onChange={(e) => updateTarget(i, 'password', e.target.value)} />
                  </div>
                  <div className="form-row">
                    <label>키 파일 경로</label>
                    <input type="text" placeholder="(선택) ~/.ssh/id_rsa" value={target.privateKeyPath} onChange={(e) => updateTarget(i, 'privateKeyPath', e.target.value)} />
                  </div>
                  <div className="form-row">
                    <label>원격 경로</label>
                    <input type="text" placeholder="/upload" value={target.remotePath} onChange={(e) => updateTarget(i, 'remotePath', e.target.value)} />
                  </div>
                </>
              )}

              {target.type === 'share' && (
                <div className="form-row">
                  <label>공유 폴더 경로</label>
                  <div style={{ display: 'flex', gap: 8, flex: 1 }}>
                    <input
                      type="text"
                      placeholder="\\server\share\folder"
                      value={target.path}
                      onChange={(e) => updateTarget(i, 'path', e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <button className="btn preset" onClick={() => setShowBrowser(i)}>📂 폴더 찾기</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      ))}

      {showBrowser !== null && (
        <FolderBrowser
          currentPath={settings.targets[showBrowser]?.path || ''}
          onSelect={(p) => updateTarget(showBrowser, 'path', p)}
          onClose={() => setShowBrowser(null)}
        />
      )}
    </section>
  );
}
