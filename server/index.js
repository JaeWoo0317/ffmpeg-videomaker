const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { v4: uuidv4 } = require('uuid');
const { convertVideo, convertVideoParallel, extractAudio, checkGpuSupport } = require('./ffmpeg');
const { transferFile } = require('./transfer');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  maxHttpBufferSize: 1e9,
});

app.use(cors());
app.use(express.json());

const CLIENT_DIST = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
}

const UPLOAD_DIR = path.join(__dirname, 'uploads');
const OUTPUT_DIR = path.join(__dirname, 'output');
const ASSET_DIR = path.join(__dirname, 'assets');
const PRESET_FILE = path.join(__dirname, 'presets.json');
// 서버 시작 시 이전 임시 파일 정리
for (const dir of [UPLOAD_DIR, OUTPUT_DIR]) {
  if (fs.existsSync(dir)) {
    fs.readdirSync(dir).forEach(f => { try { fs.unlinkSync(path.join(dir, f)); } catch {} });
  }
}
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(OUTPUT_DIR, { recursive: true });
fs.mkdirSync(ASSET_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => {
    cb(null, `${uuidv4()}${path.extname(file.originalname)}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 * 1024 },
});

// 작업 관리 (1시간 후 자동 정리)
const jobs = new Map();
const JOB_TTL = 60 * 60 * 1000;

function cleanupJob(jobId) {
  setTimeout(() => jobs.delete(jobId), JOB_TTL);
}

// GPU 체크 결과 캐싱 (매 요청마다 인코더 테스트 방지)
let gpuCache = null;

// 에셋 업로드 (자막, 워터마크 등)
const assetStorage = multer.diskStorage({
  destination: ASSET_DIR,
  filename: (req, file, cb) => {
    cb(null, `${uuidv4()}${path.extname(file.originalname)}`);
  },
});
const assetUpload = multer({ storage: assetStorage, limits: { fileSize: 100 * 1024 * 1024 } });

app.post('/api/upload-asset', assetUpload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file provided' });
  res.json({
    originalName: req.file.originalname,
    serverFilename: req.file.filename,
    path: req.file.path,
  });
});

app.post('/api/upload', upload.array('files', 20), (req, res) => {
  const files = req.files.map((f) => ({
    id: uuidv4(),
    originalName: f.originalname,
    filename: f.filename,
    path: f.path,
    size: f.size,
  }));
  res.json({ files });
});

app.get('/api/gpu-check', async (req, res) => {
  if (!gpuCache) gpuCache = await checkGpuSupport();
  res.json({ ...gpuCache, cpuCores: os.cpus().length });
});

// === 프리셋 API ===
const loadPresets = () => {
  try {
    if (fs.existsSync(PRESET_FILE)) return JSON.parse(fs.readFileSync(PRESET_FILE, 'utf8'));
  } catch {}
  return {};
};
const savePresets = (presets) => fs.writeFileSync(PRESET_FILE, JSON.stringify(presets, null, 2), 'utf8');

app.get('/api/presets', (req, res) => {
  res.json(loadPresets());
});

app.post('/api/presets', (req, res) => {
  const { name, settings } = req.body;
  if (!name || !settings) return res.status(400).json({ error: 'name and settings required' });
  const presets = loadPresets();
  presets[name] = { settings, createdAt: new Date().toISOString() };
  savePresets(presets);
  res.json({ success: true, presets });
});

app.delete('/api/presets/:name', (req, res) => {
  const presets = loadPresets();
  delete presets[req.params.name];
  savePresets(presets);
  res.json({ success: true, presets });
});

app.post('/api/convert', async (req, res) => {
  const { files, settings } = req.body;
  if (!files || files.length === 0) {
    return res.status(400).json({ error: 'No files provided' });
  }

  const jobId = uuidv4();
  jobs.set(jobId, { status: 'processing', progress: 0, results: [] });
  res.json({ jobId });

  try {
    const results = [];
    const hasVideoOutput = settings.outputs?.some((o) => ['high', 'low', 'custom'].includes(o));
    const hasMp3 = settings.outputs?.includes('mp3');

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const inputPath = path.join(UPLOAD_DIR, file.filename);

      if (!fs.existsSync(inputPath)) {
        throw new Error(`입력 파일을 찾을 수 없습니다: ${file.originalName}`);
      }

      const baseName = path.parse(file.originalName).name;
      const ts = Date.now();
      const tasks = [];

      if (hasVideoOutput) {
        const extMap = { mp4: '.mp4', mkv: '.mkv', webm: '.webm', mov: '.mov', avi: '.avi' };
        const ext = extMap[settings.container] || '.mp4';
        const outputFilename = `${baseName}_converted_${ts}${ext}`;
        tasks.push({ type: 'video', outputPath: path.join(OUTPUT_DIR, outputFilename), outputFilename });
      }
      if (hasMp3) {
        const mp3Filename = `${baseName}_${ts}.mp3`;
        tasks.push({ type: 'audio', outputPath: path.join(OUTPUT_DIR, mp3Filename), outputFilename: mp3Filename });
      }

      for (const task of tasks) {
        const onProgress = (percent) => {
          const overall = ((i + percent / 100) / files.length) * 100;
          jobs.get(jobId).progress = overall;
          io.emit(`progress:${jobId}`, {
            fileIndex: i,
            fileName: file.originalName,
            taskType: task.type,
            filePercent: percent,
            overallPercent: overall,
          });
        };

        if (task.type === 'video') {
          if (settings.parallelEncode && !settings.gpuEncoder) {
            await convertVideoParallel(inputPath, task.outputPath, settings, onProgress);
          } else {
            await convertVideo(inputPath, task.outputPath, settings, onProgress);
          }
        } else {
          await extractAudio(inputPath, task.outputPath, settings, onProgress);
        }
        results.push({ originalName: file.originalName, outputFilename: task.outputFilename, type: task.type });
      }

      // 임시 업로드 파일은 유지 (재변환 가능하도록)
    }

    // 전송 처리
    const enabledTargets = (settings.targets || []).filter((t) => t.enabled);
    for (const result of results) {
      const outputPath = path.join(OUTPUT_DIR, result.outputFilename);
      for (const target of enabledTargets) {
        try {
          const savedPath = await transferFile(outputPath, result.outputFilename, target, (percent) => {
            io.emit(`transfer:${jobId}`, {
              fileName: result.outputFilename,
              targetType: target.type,
              percent,
            });
          });
          if (target.type === 'local' && savedPath) {
            result.savedPath = savedPath;
          }
        } catch (err) {
          io.emit(`error:${jobId}`, {
            message: `전송 실패 (${target.type}): ${err.message}`,
            fileName: result.outputFilename,
          });
        }
      }
    }

    const job = jobs.get(jobId);
    job.status = 'done';
    job.results = results;
    io.emit(`done:${jobId}`, { results });
  } catch (err) {
    jobs.get(jobId).status = 'error';
    io.emit(`error:${jobId}`, { message: err.message });
  } finally {
    cleanupJob(jobId);
  }
});

app.get('/api/status/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
});

app.get('/api/output/:filename', (req, res) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(OUTPUT_DIR, filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
  res.download(filePath);
});

// 파일명 변경 API
app.post('/api/rename-output', (req, res) => {
  const { oldFilename, newName } = req.body;
  if (!oldFilename || !newName) {
    return res.status(400).json({ error: 'oldFilename and newName required' });
  }

  try {
    const oldBase = path.basename(oldFilename);
    const ext = path.extname(oldBase);
    // 새 이름에서 위험 문자 제거
    const cleanName = newName.replace(/[<>:"/\\|?*]/g, '_').trim();
    if (!cleanName) return res.status(400).json({ error: 'Invalid filename' });

    const newBase = cleanName + ext;
    const oldPath = path.join(OUTPUT_DIR, oldBase);
    const newPath = path.join(OUTPUT_DIR, newBase);

    if (!fs.existsSync(oldPath)) {
      return res.status(404).json({ error: 'File not found: ' + oldBase });
    }

    fs.renameSync(oldPath, newPath);

    // 로컬 저장 경로 파일도 변경
    const { savedPath } = req.body;
    let newSavedPath = '';
    if (savedPath && fs.existsSync(savedPath)) {
      newSavedPath = path.join(path.dirname(savedPath), newBase);
      fs.renameSync(savedPath, newSavedPath);
    }

    res.json({ success: true, newFilename: newBase, newSavedPath: newSavedPath || '' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 폴더 탐색 API
app.get('/api/browse-folders', (req, res) => {
  const reqPath = req.query.path || '';
  try {
    // 루트: 드라이브/볼륨 목록 반환
    if (!reqPath) {
      const home = require('os').homedir();
      const isWin = process.platform === 'win32';
      const rootDrives = [];

      if (isWin) {
        for (let i = 65; i <= 90; i++) {
          const drive = String.fromCharCode(i) + ':\\';
          try { fs.accessSync(drive); rootDrives.push({ name: drive, path: drive, type: 'drive' }); } catch {}
        }
      } else {
        rootDrives.push({ name: '/', path: '/', type: 'drive' });
        const volumes = '/Volumes';
        if (fs.existsSync(volumes)) {
          try {
            fs.readdirSync(volumes, { withFileTypes: true })
              .filter(e => e.isDirectory() || e.isSymbolicLink())
              .forEach(e => rootDrives.push({ name: e.name, path: path.join(volumes, e.name), type: 'drive' }));
          } catch {}
        }
      }

      // 바탕화면, 다운로드 등 빠른 접근
      const quickAccess = [
        { name: '바탕화면', path: path.join(home, 'Desktop') },
        { name: '다운로드', path: path.join(home, 'Downloads') },
        { name: '문서', path: path.join(home, 'Documents') },
        { name: isWin ? '비디오' : '동영상', path: path.join(home, isWin ? 'Videos' : 'Movies') },
      ].filter((q) => { try { fs.accessSync(q.path); return true; } catch { return false; } })
       .map((q) => ({ ...q, type: 'quick' }));
      return res.json({ current: '', folders: [...quickAccess, ...rootDrives] });
    }

    const absPath = path.resolve(reqPath);
    const entries = fs.readdirSync(absPath, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith('.') && !['$Recycle.Bin', 'System Volume Information', '.Trash', '.Spotlight-V100', '.fseventsd'].includes(e.name))
      .map((e) => ({ name: e.name, path: path.join(absPath, e.name), type: 'folder' }))
      .sort((a, b) => a.name.localeCompare(b.name));
    const parent = path.dirname(absPath);
    res.json({ current: absPath, parent: parent !== absPath ? parent : '', folders: entries });
  } catch (err) {
    res.status(400).json({ error: err.message, folders: [] });
  }
});

// 네이티브 폴더 선택 대화상자 (Windows/Mac)
app.get('/api/pick-folder', (req, res) => {
  const { execSync } = require('child_process');
  const isWin = process.platform === 'win32';
  try {
    let result = '';
    if (isWin) {
      const ps = `
        Add-Type -AssemblyName System.Windows.Forms
        $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
        $dialog.Description = '출력 폴더를 선택하세요'
        $dialog.ShowNewFolderButton = $true
        if ($dialog.ShowDialog() -eq 'OK') { $dialog.SelectedPath } else { '' }
      `;
      result = execSync(`powershell -Command "${ps.replace(/\n/g, ' ')}"`, { encoding: 'utf8', timeout: 60000 }).trim();
    } else {
      const script = 'osascript -e \'tell application "Finder" to activate\' -e \'POSIX path of (choose folder with prompt "출력 폴더를 선택하세요")\'';
      result = execSync(script, { encoding: 'utf8', timeout: 60000 }).trim();
    }
    if (result) {
      res.json({ path: result });
    } else {
      res.json({ path: '', cancelled: true });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 기본 다운로드 경로 반환
app.get('/api/default-path', (req, res) => {
  const home = require('os').homedir();
  const downloads = path.join(home, 'Downloads');
  res.json({ path: fs.existsSync(downloads) ? downloads : home });
});

if (fs.existsSync(CLIENT_DIST)) {
  app.get('*', (req, res) => {
    res.sendFile(path.join(CLIENT_DIST, 'index.html'));
  });
}

// 브라우저 연결 감지 - 모든 연결이 끊기면 5초 후 서버 종료
let shutdownTimer = null;
let hasConnectedOnce = false;

io.on('connection', (socket) => {
  hasConnectedOnce = true;
  console.log('Client connected:', socket.id);
  if (shutdownTimer) {
    clearTimeout(shutdownTimer);
    shutdownTimer = null;
    console.log('재연결 감지. 서버 종료 취소.');
  }
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    if (hasConnectedOnce && io.engine.clientsCount === 0) {
      console.log('모든 브라우저 연결 종료됨. 5초 후 서버를 종료합니다...');
      shutdownTimer = setTimeout(() => {
        console.log('서버를 종료합니다.');
        process.exit(0);
      }, 5000);
    }
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
