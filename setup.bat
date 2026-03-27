@echo off
echo ==============================================
echo  NeuroLearn — Automated Setup Script
echo ==============================================

echo [1/4] Installing Root Workspace Dependencies...
call npm install

echo [2/4] Installing Frontend Dependencies...
cd neurolearn
call npm install
cd ..

echo [3/4] Installing API Dependencies...
cd neurolearn-api
call npm install
cd ..

echo [4/4] Installing ML Service Dependencies...
cd neurolearn-ml
if not exist .deps mkdir .deps
py -3 -m pip install --upgrade --target .deps -r requirements.txt
cd ..

echo ==============================================
echo  Setup Complete! 
echo ==============================================
echo To start developing:
echo   - Frontend: cd neurolearn ^&^& npm run dev
echo   - API: cd neurolearn-api ^&^& npm run serve
echo   - ML: cd neurolearn-ml ^&^& set PYTHONPATH=.deps ^&^& py -3 -m uvicorn main:app --host 127.0.0.1 --port 8000
echo ==============================================
pause
