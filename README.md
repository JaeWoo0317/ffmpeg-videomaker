# FFmpeg VideoMaker

FFmpeg 기반 영상 변환 웹 앱. 영상 파일을 다양한 해상도/비트레이트로 변환하고, MP3 추출, 다중 대상 전송을 지원합니다.

## 기능

- 영상 변환 (MOV, MP4, AVI, MKV 입력)
- 해상도 프리셋 (4K / 1080p / 720p / 480p / 사용자 정의)
- 비트레이트 설정 (CRF / CBR / VBR)
- MP3 오디오 추출
- GPU 가속 자동 감지 (NVENC / QSV / AMF)
- 파일 크기 제한
- 다중 출력 대상 (로컬 / FTP / SFTP / 공유폴더)
- 실시간 진행률 표시 (Socket.IO)

## 설치

### 1. 사전 요구사항

- [Node.js](https://nodejs.org/) (v18 이상)
- [FFmpeg](https://ffmpeg.org/download.html) (`winget install ffmpeg` 또는 직접 설치)

### 2. 설치 및 실행

```bash
git clone https://github.com/YOUR_USERNAME/ffmpeg-videomaker.git
cd ffmpeg-videomaker

# 의존성 설치
cd server && npm install && cd ..
cd client && npm install && cd ..

# 클라이언트 빌드
cd client && npx vite build && cd ..

# 서버 실행
cd server && node index.js
```

브라우저에서 `http://localhost:4000` 접속

### 3. Windows 간편 실행

```
start.bat 더블클릭
```

## 기술 스택

- **백엔드**: Node.js + Express + Socket.IO
- **프론트엔드**: React + Vite
- **영상 처리**: FFmpeg (CLI subprocess 호출)
- **전송**: basic-ftp, ssh2-sftp-client

## 라이선스

MIT
