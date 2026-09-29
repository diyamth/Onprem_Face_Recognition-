#!/bin/bash

GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo -e "${BLUE}Starting SMG Face OnPrem application...${NC}\n"

# ---- ACTIVATE BACKEND VENV ----
source "$SCRIPT_DIR/backend/venv/bin/activate"

# Start backend
echo -e "${GREEN}Starting backend...${NC}"
cd "$SCRIPT_DIR/backend"
python -m uvicorn app.main:app --reload &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

sleep 2

# Start frontend
echo -e "${GREEN}Starting frontend...${NC}"
cd "$SCRIPT_DIR/frontend"
npm run dev &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"

echo -e "\n${GREEN}Both services are running!${NC}"
echo -e "${BLUE}Backend: http://localhost:8000${NC}"
echo -e "${BLUE}Frontend: http://localhost:5173${NC}"
echo -e "\n${BLUE}Press Ctrl+C to stop both services${NC}\n"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" SIGINT

wait $BACKEND_PID $FRONTEND_PID
