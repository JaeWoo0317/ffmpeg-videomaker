const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { convertVideo, extractAudio, checkGpuSupport } = require('./ffmpeg');
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
  res.json(gpuCache);
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
          await convertVideo(inputPath, task.outputPath, settings, onProgress);
        } else {
          await extractAudio(inputPath, task.outputPath, settings, onProgress);
        }
        results.push({ originalName: file.originalName, outputFilename: task.outputFilename, type: task.type });
      }

      // 변환 완료 후 임시 업로드 파일 삭제
      fs.unlink(inputPath, () => {});
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

// 폴더 탐색 API
app.get('/api/browse-folders', (req, res) => {
  const reqPath = req.query.path || '';
  try {
    // 루트: 드라이브 목록 반환
    if (!reqPath) {
      const drives = [];
      for (let i = 65; i <= 90; i++) {
        const drive = String.fromCharCode(i) + ':\\';
        try { fs.accessSync(drive); drives.push({ name: drive, path: drive, type: 'drive' }); } catch {}
      }
      // 바탕화면, 다운로드 등 빠른 접근
      const home = require('os').homedir();
      const quickAccess = [
        { name: '바탕화면', path: path.join(home, 'Desktop') },
        { name: '다운로드', path: path.join(home, 'Downloads') },
        { name: '문서', path: path.join(home, 'Documents') },
        { name: '비디오', path: path.join(home, 'Videos') },
      ].filter((q) => { try { fs.accessSync(q.path); return true; } catch { return false; } })
       .map((q) => ({ ...q, type: 'quick' }));
      return res.json({ current: '', folders: [...quickAccess, ...drives] });
    }

    const absPath = path.resolve(reqPath);
    const entries = fs.readdirSync(absPath, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith('.') && e.name !== '$Recycle.Bin' && e.name !== 'System Volume Information')
      .map((e) => ({ name: e.name, path: path.join(absPath, e.name), type: 'folder' }))
      .sort((a, b) => a.name.localeCompare(b.name));
    const parent = path.dirname(absPath);
    res.json({ current: absPath, parent: parent !== absPath ? parent : '', folders: entries });
  } catch (err) {
    res.status(400).json({ error: err.message, folders: [] });
  }
});

// Windows 네이티브 폴더 선택 대화상자
app.get('/api/pick-folder', (req, res) => {
  const { execSync } = require('child_process');
  try {
    const ps = `
      Add-Type -AssemblyName System.Windows.Forms
      $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
      $dialog.Description = '출력 폴더를 선택하세요'
      $dialog.ShowNewFolderButton = $true
      if ($dialog.ShowDialog() -eq 'OK') { $dialog.SelectedPath } else { '' }
    `;
    const result = execSync(`powershell -Command "${ps.replace(/\n/g, ' ')}"`, { encoding: 'utf8', timeout: 60000 }).trim();
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

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.on('disconnect', () => console.log('Client disconnected:', socket.id));
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
