# FFmpeg VideoMaker

FFmpeg 기반 영상 변환 웹 앱입니다.
영상 파일을 다양한 해상도/비트레이트로 변환하고, MP3 오디오를 추출하며, 변환된 파일을 여러 대상으로 전송할 수 있습니다.

FFmpeg을 CLI subprocess로 호출하는 방식이므로 라이선스 제약 없이 자유롭게 사용할 수 있습니다.

---

## 주요 기능

### 영상 변환
- **입력 포맷**: MOV, MP4, AVI, MKV 등 FFmpeg이 지원하는 모든 영상
- **해상도 프리셋**: 원본 유지 / 4K (3840x2160) / 1080p / 720p / 480p
- **사용자 정의 해상도**: 가로/세로 직접 입력, 종횡비 잠금 옵션
- **비트레이트 모드**: CRF (품질 우선) / CBR (고정) / VBR (가변)
- **CRF 슬라이더**: 0~51 범위, 실시간 품질 레벨 표시
- **인코딩 속도**: ultrafast ~ veryslow 선택

### 프리셋 (원클릭 설정)
- **고화질**: 원본 해상도, CRF 18, 오디오 256kbps
- **저화질**: 720p, CRF 28, 오디오 128kbps
- 프리셋 적용 후 세부값 수동 조정 가능

### MP3 오디오 추출
- 영상에서 오디오만 MP3로 추출
- 오디오 비트레이트 선택: 64k / 128k / 192k / 256k / 320k

### GPU 하드웨어 가속
- 서버 시작 시 실제 인코딩 테스트로 GPU 지원 여부 자동 감지
- NVIDIA NVENC / Intel QSV / AMD AMF 지원
- GPU 미지원 시 자동으로 CPU(libx264) 폴백

### 파일 크기 제한
- 목표 파일 크기(MB) 설정 시 비트레이트 자동 계산
- 영상 길이 기반으로 최적 비트레이트 산출

### 다중 출력 대상 (동시 전송 가능)
| 대상 | 설명 |
|------|------|
| **로컬 저장** | 서버의 지정 폴더에 저장 |
| **FTP 서버** | FTP/FTPS(TLS) 업로드 |
| **SFTP 서버** | SSH 기반 파일 전송 (비밀번호/키파일 인증) |
| **공유 폴더** | Windows UNC 경로 (예: `\\server\share`) |

### 실시간 진행률
- Socket.IO로 변환/전송 진행률 실시간 표시
- 파일별 진행률 + 전체 진행률 동시 표시

---

## 아키텍처

```
브라우저 (React)  <── Socket.IO ──>  Express 서버 (Node.js)
     |                                    |
     |  파일 업로드 (multer)              |  FFmpeg 변환 (child_process)
     |  설정 전송 (REST API)              |  진행률 파싱 -> Socket.IO
     |  진행률 수신 (Socket.IO)           |  파일 전송 (FTP/SFTP/로컬/공유폴더)
```

---

## 설치 방법

### 1. 사전 요구사항

- **Node.js** v18 이상: https://nodejs.org/
- **FFmpeg**: 아래 방법 중 하나로 설치

```bash
# Windows (winget)
winget install ffmpeg

# Windows (수동 설치)
# https://www.gyan.dev/ffmpeg/builds/ 에서 다운로드 후 PATH에 추가

# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt install ffmpeg
```

### 2. 프로젝트 설치

```bash
# 저장소 클론
git clone https://github.com/JaeWoo0317/ffmpeg-videomaker.git
cd ffmpeg-videomaker

# 서버 의존성 설치
cd server
npm install
cd ..

# 클라이언트 의존성 설치
cd client
npm install
cd ..

# 클라이언트 빌드 (프로덕션용)
cd client
npx vite build
cd ..
```

### 3. 실행

```bash
# 방법 1: 직접 실행
cd server
node index.js

# 방법 2: Windows - start.bat 더블클릭
```

브라우저에서 **http://localhost:4000** 접속

---

## 사용 방법

1. 브라우저에서 `http://localhost:4000` 접속
2. 영상 파일을 **드래그앤드롭** 또는 **클릭하여 선택**
3. **프리셋** (고화질/저화질) 선택 또는 세부 설정 조정
   - 해상도, 비트레이트, CRF, 인코딩 속도 등
4. **출력 대상** 설정 (로컬/FTP/SFTP/공유폴더)
5. **변환 시작** 클릭
6. 진행률 바에서 실시간 진행 상태 확인
7. 완료 후 **다운로드** 버튼으로 파일 받기

---

## 프로젝트 구조

```
ffmpeg-videomaker/
├── package.json               # 루트 (concurrently 스크립트)
├── start.bat                  # Windows 간편 실행
├── server/
│   ├── package.json
│   ├── index.js               # Express 서버 + Socket.IO + API
│   ├── ffmpeg.js              # FFmpeg 변환/추출/GPU 감지
│   ├── transfer.js            # 파일 전송 (로컬/FTP/SFTP/공유폴더)
│   ├── uploads/               # 임시 업로드 폴더 (자동 생성)
│   └── output/                # 변환 결과 폴더 (자동 생성)
└── client/
    ├── package.json
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── App.jsx            # 메인 앱
        ├── App.css            # 스타일
        ├── main.jsx           # 엔트리포인트
        └── components/
            ├── FileUpload.jsx     # 파일 업로드 (드래그앤드롭)
            ├── VideoSettings.jsx  # 영상 설정 (해상도/비트레이트)
            ├── AudioSettings.jsx  # 오디오 설정
            ├── OutputTargets.jsx  # 출력 대상 설정
            └── ProgressBar.jsx    # 진행률 표시
```

---

## API 엔드포인트

| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/upload` | 영상 파일 업로드 (multipart/form-data) |
| POST | `/api/convert` | 변환 시작 (설정 JSON 포함) |
| GET | `/api/status/:jobId` | 작업 상태 조회 |
| GET | `/api/gpu-check` | GPU 하드웨어 가속 지원 여부 |
| GET | `/api/output/:filename` | 변환된 파일 다운로드 |

### Socket.IO 이벤트

| 이벤트 | 방향 | 설명 |
|--------|------|------|
| `progress:{jobId}` | 서버 -> 클라이언트 | 변환 진행률 |
| `transfer:{jobId}` | 서버 -> 클라이언트 | 전송 진행률 |
| `done:{jobId}` | 서버 -> 클라이언트 | 변환 완료 |
| `error:{jobId}` | 서버 -> 클라이언트 | 에러 발생 |

---

## 기술 스택

| 구분 | 기술 |
|------|------|
| 백엔드 | Node.js, Express, Socket.IO |
| 프론트엔드 | React, Vite |
| 영상 처리 | FFmpeg (CLI subprocess) |
| 파일 업로드 | multer |
| FTP 전송 | basic-ftp |
| SFTP 전송 | ssh2-sftp-client |

---

## 문제 해결

### FFmpeg을 찾을 수 없음
- `winget install ffmpeg` 실행 후 터미널 재시작
- 또는 FFmpeg 경로를 시스템 PATH에 수동 추가

### GPU 가속이 감지되지 않음
- NVIDIA GPU: 드라이버 **570.0 이상** 필요 (FFmpeg 8.x 기준)
- `nvidia-smi`로 드라이버 버전 확인
- GPU 미지원 시 자동으로 CPU 인코딩 사용 (기능에 문제 없음)

### 전송 실패 (로컬)
- 출력 경로에 따옴표(`"`)를 포함하지 마세요
- 경로 예시: `C:\Users\username\Downloads`

---

## 라이선스

MIT
