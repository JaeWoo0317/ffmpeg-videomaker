const fs = require('fs');
const path = require('path');
const { Client: FtpClient } = require('basic-ftp');
const SftpClient = require('ssh2-sftp-client');

function sanitizePath(p) {
  return (p || '').replace(/"/g, '').trim();
}

function copyWithProgress(filePath, destPath, onProgress) {
  const totalSize = fs.statSync(filePath).size;
  let copied = 0;

  return new Promise((resolve, reject) => {
    const read = fs.createReadStream(filePath);
    const write = fs.createWriteStream(destPath);
    read.on('data', (chunk) => {
      copied += chunk.length;
      onProgress(Math.round((copied / totalSize) * 100));
    });
    read.on('error', reject);
    write.on('error', reject);
    write.on('finish', resolve);
    read.pipe(write);
  });
}

async function transferToLocal(filePath, filename, target, onProgress) {
  const home = require('os').homedir();
  const defaultDownloads = path.join(home, 'Downloads');
  const destDir = sanitizePath(target.path) || (fs.existsSync(defaultDownloads) ? defaultDownloads : path.join(process.cwd(), 'output'));
  fs.mkdirSync(destDir, { recursive: true });
  const destPath = path.resolve(destDir, filename);
  await copyWithProgress(filePath, destPath, onProgress);
  return destPath;
}

async function transferToFtp(filePath, filename, target, onProgress) {
  const client = new FtpClient();
  try {
    await client.access({
      host: target.host,
      port: target.port || 21,
      user: target.username,
      password: target.password,
      secure: target.secure || false,
    });

    const totalSize = fs.statSync(filePath).size;
    client.trackProgress((info) => {
      if (totalSize > 0) onProgress(Math.round((info.bytes / totalSize) * 100));
    });

    const remotePath = target.remotePath ? `${target.remotePath}/${filename}` : filename;
    await client.uploadFrom(filePath, remotePath);
    client.trackProgress();
  } finally {
    client.close();
  }
}

async function transferToSftp(filePath, filename, target, onProgress) {
  const sftp = new SftpClient();
  try {
    const config = {
      host: target.host,
      port: target.port || 22,
      username: target.username,
    };
    if (target.privateKeyPath) {
      config.privateKey = fs.readFileSync(target.privateKeyPath);
    } else {
      config.password = target.password;
    }

    await sftp.connect(config);
    const totalSize = fs.statSync(filePath).size;
    const remotePath = target.remotePath
      ? `${target.remotePath}/${filename}`
      : `/home/${target.username}/${filename}`;

    await sftp.fastPut(filePath, remotePath, {
      step: (transferred) => {
        if (totalSize > 0) onProgress(Math.round((transferred / totalSize) * 100));
      },
    });
  } finally {
    await sftp.end();
  }
}

async function transferToShare(filePath, filename, target, onProgress) {
  const sharePath = sanitizePath(target.path);
  if (!sharePath) throw new Error('공유 폴더 경로가 지정되지 않았습니다');
  fs.mkdirSync(sharePath, { recursive: true });
  await copyWithProgress(filePath, path.resolve(sharePath, filename), onProgress);
}

async function transferFile(filePath, filename, target, onProgress) {
  const handlers = { local: transferToLocal, ftp: transferToFtp, sftp: transferToSftp, share: transferToShare };
  const handler = handlers[target.type];
  if (!handler) throw new Error(`Unknown transfer type: ${target.type}`);
  const result = await handler(filePath, filename, target, onProgress);
  return result; // local returns saved path
}

module.exports = { transferFile };
