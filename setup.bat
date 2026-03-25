@echo off
chcp 65001 >nul
echo ============================================
echo   VideoMaker 설치 스크립트
echo ============================================
echo.

:: Node.js 확인
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [오류] Node.js가 설치되어 있지 않습니다.
    echo https://nodejs.org/ 에서 Node.js v18 이상을 설치해주세요.
    echo.
    pause
    exit /b 1
)
echo [OK] Node.js 발견:
node -v

:: FFmpeg 확인
where ffmpeg >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo [경고] FFmpeg이 설치되어 있지 않습니다.
    echo 자동 설치를 시도합니다...
    echo.
    winget install Gyan.FFmpeg --accept-source-agreements --accept-package-agreements
    if %errorlevel% neq 0 (
        echo.
        echo [오류] FFmpeg 자동 설치에 실패했습니다.
        echo https://www.gyan.dev/ffmpeg/builds/ 에서 수동 설치 후 PATH에 추가해주세요.
        pause
        exit /b 1
    )
    echo [OK] FFmpeg 설치 완료. 터미널을 재시작해야 할 수 있습니다.
) else (
    echo [OK] FFmpeg 발견:
    ffmpeg -version 2>&1 | findstr /c:"ffmpeg version"
)

echo.
echo ============================================
echo   의존성 설치 중...
echo ============================================

:: 서버 의존성
echo.
echo [1/3] 서버 의존성 설치...
cd /d "%~dp0server"
call npm install --production
if %errorlevel% neq 0 (
    echo [오류] 서버 의존성 설치 실패
    pause
    exit /b 1
)

:: 클라이언트 의존성
echo.
echo [2/3] 클라이언트 의존성 설치...
cd /d "%~dp0client"
call npm install
if %errorlevel% neq 0 (
    echo [오류] 클라이언트 의존성 설치 실패
    pause
    exit /b 1
)

:: 클라이언트 빌드
echo.
echo [3/3] 클라이언트 빌드 중...
call npx vite build
if %errorlevel% neq 0 (
    echo [오류] 클라이언트 빌드 실패
    pause
    exit /b 1
)

cd /d "%~dp0"

echo.
echo ============================================
echo   설치 완료!
echo ============================================
echo.
echo   start.bat 을 더블클릭하여 실행하세요.
echo   브라우저에서 http://localhost:4000 접속
echo.
pause
