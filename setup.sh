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
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt || true

echo "=============================================="
echo " Setup Complete! "
echo "=============================================="
echo "To start developing:"
echo "  - Separately run: 'npm run dev:frontend', 'npm run dev:api', 'npm run dev:ml'"
echo "=============================================="
