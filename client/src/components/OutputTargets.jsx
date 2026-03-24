export default function OutputTargets({ settings, setSettings }) {
  const updateTarget = (index, key, value) => {
    setSettings((s) => {
      const targets = [...s.targets];
      targets[index] = { ...targets[index], [key]: value };
      return { ...s, targets };
    });
  };

  const labels = {
    local: '로컬 저장',
    ftp: 'FTP 서버',
    sftp: 'SFTP 서버',
    share: '공유 폴더',
  };

  return (
    <section className="section">
      <h2>출력 대상</h2>

      {settings.targets.map((target, i) => (
        <div className="target-group" key={target.type}>
          <div className="target-header">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={target.enabled}
                onChange={(e) => updateTarget(i, 'enabled', e.target.checked)}
              />
              {labels[target.type]}
            </label>
          </div>

          {target.enabled && (
            <div className="target-fields">
              {target.type === 'local' && (
                <div className="form-row">
                  <label>출력 경로</label>
                  <input
                    type="text"
                    placeholder="예: C:\output 또는 ./output"
                    value={target.path}
                    onChange={(e) => updateTarget(i, 'path', e.target.value)}
                  />
                </div>
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
                  <input
                    type="text"
                    placeholder="\\server\share\folder"
                    value={target.path}
                    onChange={(e) => updateTarget(i, 'path', e.target.value)}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </section>
  );
}
