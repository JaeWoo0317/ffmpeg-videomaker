const { ipcRenderer, webUtils } = require('electron');

// contextIsolation: false이므로 window에 직접 할당
window.electronAPI = {
  selectFiles: () => ipcRenderer.invoke('select-files'),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  isElectron: true,
};

// 드래그앤드롭 파일 경로를 캡처 (webUtils.getPathForFile 사용)
window._electronDroppedPaths = [];

document.addEventListener('drop', (e) => {
  const files = e.dataTransfer?.files;
  if (files && files.length > 0) {
    window._electronDroppedPaths = [];
    for (let i = 0; i < files.length; i++) {
      try {
        const filePath = webUtils.getPathForFile(files[i]);
        if (filePath) window._electronDroppedPaths.push(filePath);
      } catch (err) {
        console.error('[preload] getPathForFile error:', err);
      }
    }
    console.log('[preload drop] paths:', window._electronDroppedPaths);
  }
}, true);

document.addEventListener('dragover', (e) => {
  e.preventDefault();
}, true);
