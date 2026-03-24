@echo off
echo VideoMaker 서버를 시작합니다...
echo http://localhost:4000 에서 접속하세요
echo.
cd /d "%~dp0server"
node index.js
pause
