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
pip install -r requirements.txt
cd ..

echo ==============================================
echo  Setup Complete! 
echo ==============================================
echo To start developing:
echo   - Separately run: 'npm run dev:frontend', 'npm run dev:api', 'npm run dev:ml'
echo ==============================================
pause
