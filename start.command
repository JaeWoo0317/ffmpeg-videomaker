#!/bin/bash
cd "$(dirname "$0")"

echo "VideoMaker 시작 중..."

# 빌드 파일 확인
if [ ! -d "client/dist" ]; then
    echo "[!] 클라이언트가 빌드되지 않았습니다. setup.command를 먼저 실행하세요."
    echo ""
    read -n 1 -s -r -p "아무 키나 누르면 창이 닫힙니다..."
    exit 1
fi

echo "서버 시작: http://localhost:4000"
echo "브라우저에서 위 주소로 접속하세요."
echo "종료하려면 Ctrl+C를 누르세요."
echo ""

# 브라우저 자동 열기 (2초 후)
(sleep 2 && open "http://localhost:4000") &

node server/index.js
