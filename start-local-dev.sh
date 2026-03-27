#!/bin/bash
# NeuroLearn Local Development Startup Script (macOS/Linux)
# Start all three services in parallel

echo ""
echo "=============================================="
echo "  NeuroLearn Local Dev Startup"
echo "=============================================="
echo ""
echo "This will start 3 services in new terminal tabs:"
echo "  1. Backend API (localhost:3000)"
echo "  2. ML Service (localhost:8000)"
echo "  3. Frontend Dev Server (localhost:5173)"
echo ""
read -p "Press Enter to start..."

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo -e "${BLUE}Starting Backend API...${NC}"
open -a Terminal "$SCRIPT_DIR/neurolearn-api" || (cd "$SCRIPT_DIR/neurolearn-api" && npm run serve &)
sleep 2

echo -e "${BLUE}Starting ML Service...${NC}"
open -a Terminal "$SCRIPT_DIR/neurolearn-ml" || (cd "$SCRIPT_DIR/neurolearn-ml" && python main.py &)
sleep 2

echo -e "${BLUE}Starting Frontend...${NC}"
open -a Terminal "$SCRIPT_DIR/neurolearn" || (cd "$SCRIPT_DIR/neurolearn" && npm run dev &)

echo ""
echo -e "${GREEN}✓ All services started!${NC}"
echo ""
echo "Frontend:  http://localhost:5173"
echo "Backend:   http://localhost:3000"
echo "ML Service: http://localhost:8000/docs (Swagger)"
echo ""
echo "Press Ctrl+C in any terminal to stop a service."
