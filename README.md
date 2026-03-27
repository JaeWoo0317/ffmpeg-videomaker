# 🎬 FFmpeg VideoMaker

> 영상 파일을 쉽게 변환하는 웹 프로그램입니다.
> FFmpeg을 CLI subprocess로 호출하므로 **라이선스 제약 없이** 자유롭게 사용할 수 있습니다.

---

## ✨ 이런 것들을 할 수 있어요

| 기능 | 설명 |
|------|------|
| 영상 변환 | MOV, MP4, AVI, MKV → 다양한 해상도/코덱으로 변환 |
| 코덱 선택 | H.264, H.265(HEVC), VP9, AV1, MPEG-4 등 |
| 오디오 추출 | 영상에서 MP3 오디오만 뽑기 |
| 오디오 코덱 | AAC, MP3, Opus, FLAC, AC3 등 선택 |
| 자막 삽입 | SRT/ASS 자막 파일을 영상에 합치기 |
| 워터마크 | 로고/이미지를 영상 위에 올리기 (위치/크기 조절) |
| 구간 자르기 | 시작~끝 시간 설정으로 원하는 부분만 추출 |
| 크롭 | 영상의 원하는 영역만 잘라내기 |
| GPU 가속 | NVIDIA NVENC / Intel QSV / AMD AMF 자동 감지 |
| 다중 전송 | 로컬 저장 / FTP / SFTP / 공유 폴더 동시 전송 |
| 프로파일 | Baseline / Main / High / High 10 선택 |
| 리사이즈 필터 | Bilinear / Bicubic / Lanczos / Spline 등 |
| FPS 설정 | 24fps(영화) / 30fps / 60fps / 사용자 정의 |
| 여러 파일 동시 변환 | 최대 20개 파일 순차 변환 + 진행률 표시 |
| 파일 관리 | 업로드한 파일 개별 삭제 / 전체 초기화 |
| 폴더 탐색기 | 저장 경로를 PC 폴더 트리에서 직접 선택 |
| 변환 팝업 | 변환 시작 시 진행률 팝업 + 완료 표시 |
| 멀티스레드 | CPU 전체 코어 활용으로 빠른 변환 |
| 하드웨어 디코딩 | GPU 사용 시 입력 파일도 하드웨어 디코딩 |

---

## 🖥️ 설치하기 (처음부터 차근차근)

> **지원 OS**: Windows, macOS
>
> **필요한 것**: 컴퓨터, 인터넷 연결
>
> 아래 순서대로 따라하면 됩니다. 어렵지 않아요!
>
> 👉 **Mac 사용자**는 [Mac 설치 가이드](#-mac-설치-가이드)로 이동하세요

---

### 📌 STEP 1. Node.js 설치하기

Node.js는 이 프로그램을 실행하는 데 필요합니다.

1. 크롬이나 엣지 브라우저를 엽니다
2. 주소창에 아래 주소를 입력하고 Enter를 누릅니다
   ```
   https://nodejs.org/
   ```
3. 화면에 초록색 버튼 2개가 보입니다 → **왼쪽 LTS 버튼**을 클릭합니다
4. 다운로드된 파일(예: `node-v22.x.x-x64.msi`)을 **더블클릭**합니다
5. 설치 창이 뜨면 계속 **Next** → **Next** → **Install** → **Finish** 클릭합니다
   - 아무것도 바꾸지 말고 그냥 다음만 누르면 됩니다!

#### ✅ 설치 확인하기

6. 키보드에서 **Windows키 + R**을 동시에 누릅니다
7. 작은 창이 뜨면 `powershell` 이라고 입력하고 **확인** 클릭
8. 파란색 창(PowerShell)이 뜨면 아래를 입력하고 Enter:
   ```
   node -v
   ```
9. `v22.x.x` 같은 숫자가 나오면 **성공!** 🎉

---

### 📌 STEP 2. FFmpeg 설치하기

FFmpeg은 영상을 변환하는 도구입니다.

1. STEP 1에서 열었던 **PowerShell 파란 창**을 그대로 사용합니다
   - 닫았다면 **Windows키 + R** → `powershell` → 확인
2. 아래 명령어를 **복사**해서 PowerShell에 **붙여넣기**(마우스 우클릭)하고 Enter:
   ```
   winget install Gyan.FFmpeg
   ```
3. 약관 동의를 물어보면 `Y` 입력하고 Enter
4. 설치가 끝나면 **PowerShell을 닫고** → 다시 열기 (Windows키 + R → powershell → 확인)
5. 아래를 입력하고 Enter:
   ```
   ffmpeg -version
   ```
6. `ffmpeg version 7.x.x` 같은 글자가 나오면 **성공!** 🎉

> **winget이 안 되는 경우 (수동 설치)**
>
> 1. 브라우저에서 `https://www.gyan.dev/ffmpeg/builds/` 접속
> 2. **ffmpeg-release-essentials.zip** 다운로드
> 3. 압축 풀고 `bin` 폴더 위치 확인 (예: `C:\ffmpeg\bin`)
> 4. **Windows키** → "환경 변수" 검색 → "시스템 환경 변수 편집" 클릭
> 5. "환경 변수" 버튼 → **Path** 선택 → "편집" → "새로 만들기"
> 6. `bin` 폴더 경로를 붙여넣기 → 확인 → 확인

---

### 📌 STEP 3. 프로그램 다운로드하기

#### 방법 A: ZIP으로 다운로드 (가장 쉬움)

1. 브라우저에서 아래 주소로 접속합니다:
   ```
   https://github.com/JaeWoo0317/ffmpeg-videomaker
   ```
2. 초록색 **Code** 버튼 클릭 → **Download ZIP** 클릭
3. 다운로드된 ZIP 파일을 **바탕화면**에 압축 해제합니다
4. 압축 해제된 폴더 이름을 `ffmpeg-videomaker`로 바꿉니다

#### 방법 B: Git으로 다운로드 (Git 설치 필요)

1. Git이 없다면 `https://git-scm.com/` 에서 설치 (Next만 계속 클릭)
2. PowerShell에서:
   ```
   cd ~/Desktop
   git clone https://github.com/JaeWoo0317/ffmpeg-videomaker.git
   ```

---

### 📌 STEP 4. 프로그램 설치하기

1. 파일 탐색기에서 `ffmpeg-videomaker` 폴더를 엽니다
2. **`setup.bat`** 파일을 찾아서 **더블클릭**합니다
3. 검은 창이 뜨고 자동으로 설치가 진행됩니다:
   - ✅ Node.js 확인
   - ✅ FFmpeg 확인
   - ✅ 서버 파일 다운로드
   - ✅ 클라이언트 파일 다운로드
   - ✅ 화면 빌드
4. **"설치 완료!"** 메시지가 나올 때까지 기다립니다 (1~3분 소요)

> **setup.bat 없이 직접 설치하기 (PowerShell에서):**
> ```
> cd ~/Desktop/ffmpeg-videomaker
> cd server
> npm install
> cd ../client
> npm install
> npx vite build
> cd ..
> ```

---

### 📌 STEP 5. 프로그램 실행하기

1. `ffmpeg-videomaker` 폴더에서 **`start.bat`**을 **더블클릭**합니다
2. 검은 창이 뜨고 `Server running on http://localhost:4000` 이 보입니다
3. 브라우저를 열고 주소창에 입력합니다:
   ```
   http://localhost:4000
   ```
4. **VideoMaker** 화면이 나오면 **성공!** 🎉

> ⚠️ **중요**: 검은 창(터미널)을 닫으면 프로그램도 꺼집니다! 사용하는 동안 열어두세요.

---

## 📖 사용 방법

1. 브라우저에서 `http://localhost:4000` 접속
2. 영상 파일을 **드래그앤드롭** 하거나 **클릭해서 선택**
3. **상세 설정** 버튼을 클릭하면 팝업창이 열립니다
   - **영상**: 코덱, 해상도, FPS, 비트레이트, 프로파일, 리사이즈 필터
   - **오디오**: 오디오 코덱, 비트레이트, 샘플레이트, 채널
   - **구간**: 시작/끝 시간 설정
   - **자막**: SRT/ASS 자막 파일 업로드
   - **워터마크**: 로고 이미지 업로드 + 위치/크기 조절
   - **크롭**: 영상 잘라내기 영역 설정
4. **출력 대상** 선택 (로컬 저장 / FTP / SFTP / 공유 폴더)
5. **변환 시작** 클릭 → 진행률 팝업이 나타납니다
6. 진행률 바로 실시간 확인 (파일별 + 전체)
7. 완료 시 **변환 완료!** 표시 + 저장 경로 확인
8. 파일을 제거하려면 파일 옆 **✕** 버튼, 전체 초기화는 **초기화** 버튼

---

## 📁 프로젝트 구조

```
ffmpeg-videomaker/
├── setup.bat                  # Windows 원클릭 설치
├── start.bat                  # Windows 원클릭 실행
├── update.bat                 # Windows 원클릭 업데이트
├── setup.command              # Mac 더블클릭 설치
├── start.command              # Mac 더블클릭 실행
├── update.command             # Mac 더블클릭 업데이트
├── setup.sh                   # Mac 터미널 설치
├── start.sh                   # Mac 터미널 실행
├── update.sh                  # Mac 터미널 업데이트
├── server/
│   ├── index.js               # Express 서버 + Socket.IO
│   ├── ffmpeg.js              # FFmpeg 변환/GPU 감지
│   └── transfer.js            # 파일 전송 (로컬/FTP/SFTP)
└── client/
    └── src/
        ├── App.jsx            # 메인 앱
        └── components/
            ├── FileUpload.jsx      # 파일 업로드
            ├── SettingsModal.jsx   # 상세 설정 팝업
            ├── VideoSettings.jsx   # 영상 설정
            ├── AudioSettings.jsx   # 오디오 설정
            ├── TrimSettings.jsx    # 구간 설정
            ├── SubtitleSettings.jsx # 자막 설정
            ├── WatermarkSettings.jsx # 워터마크 설정
            ├── CropSettings.jsx    # 크롭 설정
            ├── OutputTargets.jsx   # 출력 대상
            └── ProgressBar.jsx     # 진행률 표시
```

---

## 🛠️ 기술 스택

| 구분 | 기술 |
|------|------|
| 백엔드 | Node.js, Express, Socket.IO |
| 프론트엔드 | React, Vite |
| 영상 처리 | FFmpeg (CLI subprocess) |
| 파일 업로드 | multer |
| FTP 전송 | basic-ftp |
| SFTP 전송 | ssh2-sftp-client |

---

## 🍎 Mac 설치 가이드

### STEP 1. Homebrew 설치하기

Homebrew는 Mac에서 프로그램을 설치하는 도구입니다.

1. **Spotlight** (Cmd + Space) 를 열고 `터미널` 입력 → Enter
2. 터미널에 아래를 복사-붙여넣기하고 Enter:
   ```
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```
3. 비밀번호를 물어보면 Mac 로그인 비밀번호 입력 (화면에 안 보여도 정상)
4. 설치 완료 메시지가 나올 때까지 기다립니다

> ⚠️ **Apple Silicon (M1/M2/M3/M4) Mac 사용자 필수!**
>
> Homebrew 설치 후 `brew` 명령어가 안 될 수 있습니다. 아래 두 줄을 터미널에 붙여넣기하세요:
> ```
> echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
> eval "$(/opt/homebrew/bin/brew shellenv)"
> ```
> Intel Mac은 이 단계가 필요 없습니다.

### STEP 2. Node.js, FFmpeg 설치하기

터미널에서:
```
brew install node ffmpeg
```

확인:
```
node -v
ffmpeg -version
```

### STEP 3. 프로그램 다운로드 및 설치

#### 방법 A: 더블클릭으로 설치 (터미널 몰라도 OK!)

1. GitHub에서 ZIP 다운로드 후 압축 해제 (또는 git clone)
2. Finder에서 `ffmpeg-videomaker` 폴더 열기
3. **`setup.command`** 파일을 **더블클릭**
4. "개발자를 확인할 수 없습니다" 경고가 뜨면: 우클릭 → 열기 → 열기 클릭
5. 설치가 완료될 때까지 기다리기

#### 방법 B: 터미널에서 설치

```
cd ~/Desktop
git clone https://github.com/JaeWoo0317/ffmpeg-videomaker.git
cd ffmpeg-videomaker
chmod +x setup.sh start.sh update.sh
./setup.sh
```

### STEP 4. 실행하기

#### 더블클릭으로 실행

Finder에서 **`start.command`** 파일을 **더블클릭**하면 자동으로 서버가 시작되고 브라우저가 열립니다.

#### 터미널에서 실행

```
./start.sh
```

브라우저가 자동으로 `http://localhost:4000` 을 엽니다.

> 종료하려면 터미널에서 **Ctrl + C**

### Mac 업데이트

Finder에서 **`update.command`** 더블클릭, 또는 터미널에서:

```
./update.sh
```

---

## 🔄 업데이트하기

1. `ffmpeg-videomaker` 폴더에서 **`update.bat`**을 **더블클릭**합니다
2. 자동으로 최신 버전 다운로드 + 빌드가 진행됩니다
3. **"업데이트 완료!"** 메시지가 나오면 `start.bat`으로 실행하세요

> **ZIP으로 설치한 경우**: GitHub에서 다시 ZIP 다운로드 → 덮어쓰기 → `setup.bat` 실행

---

## ❓ 문제가 생겼을 때

| 문제 | 해결 방법 |
|------|-----------|
| `node -v` 가 안 됨 | Node.js를 다시 설치하세요 |
| `ffmpeg` 을 찾을 수 없음 | PowerShell을 **닫고 다시 열고** `ffmpeg -version` 확인 |
| GPU 가속이 안 됨 | NVIDIA 드라이버 업데이트 필요. 없어도 CPU로 정상 작동합니다 |
| Mac에서 `./start.sh` 실행 안 됨 | `chmod +x start.sh` 실행 후 다시 시도 |
| Mac에서 `brew`가 안 됨 (Intel) | Homebrew 설치 후 터미널을 껐다 켜세요 |
| Mac에서 `brew`가 안 됨 (M칩) | `echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile` 실행 후 터미널 재시작 |
| 브라우저에서 접속 안 됨 | `start.bat` 검은 창이 열려있는지 확인 + 주소 `http://localhost:4000` 정확히 입력 |
| setup.bat 실행 오류 | PowerShell을 **관리자 권한**으로 실행 (우클릭 → 관리자 권한으로 실행) |
| 변환 중 에러 | 영상 파일이 손상되지 않았는지 확인. 다른 코덱으로 시도해보세요 |
| libx264 Invalid argument | 영상 해상도가 홀수일 수 있습니다. 해상도를 짝수로 설정하세요 |
| 파일이 다운로드에 없음 | 출력 대상에서 로컬 저장 경로를 확인하세요. 경로가 비어있으면 다운로드 폴더에 저장됩니다 |

---

## 📜 라이선스

MIT License - 자유롭게 사용, 수정, 배포할 수 있습니다.
