@echo off
REM NeuroLearn Local Development Startup Script (Windows)
REM Start all three services in parallel terminals

echo.
echo ==============================================
echo  NeuroLearn Local Dev Startup
echo ==============================================
echo.
echo This will open 3 terminals:
echo  1. Backend API (localhost:3000)
echo  2. ML Service (localhost:8000)
echo  3. Frontend Dev Server (localhost:5173)
echo.
echo Press any key to start...
pause >nul

REM Start Backend API in new window
echo Starting Backend API...
start cmd /k "cd neurolearn-api && npm run serve"
timeout /t 3 >nul

REM Start ML Service in new window
echo Starting ML Service...
start cmd /k "cd neurolearn-ml && python main.py"
timeout /t 3 >nul

REM Start Frontend in new window
echo Starting Frontend...
start cmd /k "cd neurolearn && npm run dev"

echo.
echo All services started! Check the terminals above.
echo.
echo Frontend:  http://localhost:5173
echo Backend:   http://localhost:3000
echo ML Service: http://localhost:8000/docs (Swagger)
echo.
echo Press Ctrl+C in any terminal to stop its service.
pause
