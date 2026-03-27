#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"
mkdir -p .deps
python3 -m pip install --upgrade --target .deps -r requirements.txt
PYTHONPATH=.deps python3 -m uvicorn main:app --host 127.0.0.1 --port 8000
