#!/bin/bash
echo "========================================"
echo "  VideoMaker 업데이트"
echo "========================================"
echo ""

cd "$(dirname "$0")"

echo "[1/4] 최신 버전 다운로드..."
git pull
if [ $? -ne 0 ]; then
    echo "[오류] git pull 실패. Git이 설치되어 있는지 확인하세요."
    exit 1
fi

echo ""
echo "[2/4] 서버 패키지 업데이트..."
cd server && npm install && cd ..

echo ""
echo "[3/4] 클라이언트 패키지 업데이트..."
cd client && npm install

echo ""
echo "[4/4] 클라이언트 빌드..."
npx vite build
cd ..

echo ""
echo "========================================"
echo "  업데이트 완료!"
echo "  ./start.sh 로 실행하세요."
echo "========================================"
