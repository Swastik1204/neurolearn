#!/bin/bash
echo "=============================================="
echo " NeuroLearn — Automated Setup Script (Mac)"
echo "=============================================="

ROOT_DIR="$(pwd)"

echo "[1/4] Installing Root Workspace Dependencies..."
npm install || true

echo "[2/4] Installing Frontend Dependencies..."
cd "$ROOT_DIR/neurolearn" || exit
npm install || true

echo "[3/4] Installing API Dependencies..."
cd "$ROOT_DIR/neurolearn-api" || exit
npm install || true

echo "[4/4] Installing ML Service Dependencies..."
cd "$ROOT_DIR/neurolearn-ml" || exit
mkdir -p .deps
python3 -m pip install --upgrade --target .deps -r requirements.txt || true

echo "=============================================="
echo " Setup Complete! "
echo "=============================================="
echo "To start developing:"
echo "  - Frontend: cd neurolearn && npm run dev"
echo "  - API: cd neurolearn-api && npm run serve"
echo "  - ML: cd neurolearn-ml && PYTHONPATH=.deps python3 -m uvicorn main:app --host 127.0.0.1 --port 8000"
echo "=============================================="
