const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');

// 개발 모드 여부
const isDev = !app.isPackaged;

let mainWindow;
let serverModule;

function startServer() {
  // FFmpeg 번들 경로 설정 (패키징된 앱에서 사용)
  if (!isDev) {
    const resourcesPath = process.resourcesPath;
    const ffmpegPath = path.join(resourcesPath, 'ffmpeg', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
    const ffprobePath = path.join(resourcesPath, 'ffmpeg', process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe');
    process.env.FFMPEG_PATH = ffmpegPath;
    process.env.FFPROBE_PATH = ffprobePath;
  }

  // 서버 시작
  process.env.ELECTRON_MODE = 'true';
  const serverPath = isDev
    ? path.join(__dirname, '..', 'server', 'index.js')
    : path.join(process.resourcesPath, 'server', 'index.js');
  serverModule = require(serverPath);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'VideoMaker',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: false,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Electron 기본 드래그앤드롭 동작 방지 (파일 열기 방지)
  mainWindow.webContents.on('will-navigate', (e) => e.preventDefault());

  // 서버가 준비될 때까지 약간 대기 후 로드
  const PORT = process.env.PORT || 4000;
  const loadApp = () => {
    mainWindow.loadURL(`http://localhost:${PORT}`).catch(() => {
      // 서버가 아직 준비되지 않았으면 재시도
      setTimeout(loadApp, 500);
    });
  };
  setTimeout(loadApp, 1000);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC: 파일 경로 가져오기 (드래그앤드롭 대체)
ipcMain.handle('get-file-paths', async (event, filePaths) => {
  return filePaths;
});

// IPC: 폴더 선택 다이얼로그
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

// IPC: 파일 선택 다이얼로그
ipcMain.handle('select-files', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: '영상 파일', extensions: ['mp4', 'mov', 'avi', 'mkv', 'wmv', 'flv', 'webm', 'm4v', 'mpg', 'mpeg', 'ts'] },
    ],
  });
  if (result.canceled) return [];
  return result.filePaths;
});

app.whenReady().then(() => {
  startServer();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  app.quit();
});
