#!/bin/bash
# ═══════════════════════════════════════════════════════════
# AgentGuard — Start All Services
# ═══════════════════════════════════════════════════════════

set -e

# Load env
if [ -f .env ]; then
  export $(grep -v '#' .env | xargs)
fi

echo "╔══════════════════════════════════════════════╗"
echo "║   🛡️  AgentGuard — Starting All Services     ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# Start backend in background
echo "1️⃣  Starting backend (port 4000)..."
cd backend && node src/index.js &
BACKEND_PID=$!
cd ..
echo "   Backend PID: $BACKEND_PID"

# Wait for backend to start
sleep 2

# Start dashboard in background
echo ""
echo "2️⃣  Starting dashboard (port 3000)..."
cd dashboard && npm run dev &
DASHBOARD_PID=$!
cd ..
echo "   Dashboard PID: $DASHBOARD_PID"

echo ""
echo "═══════════════════════════════════════════════════"
echo "✅ All services running!"
echo "   Backend:    http://localhost:4000"
echo "   Dashboard:  http://localhost:3000"
echo "   API State:  http://localhost:4000/api/state"
echo "   Health:     http://localhost:4000/api/health"
echo ""
echo "   Press Ctrl+C to stop all services."
echo "═══════════════════════════════════════════════════"

# Trap Ctrl+C
trap "echo ''; echo 'Shutting down...'; kill $BACKEND_PID $DASHBOARD_PID 2>/dev/null; exit 0" SIGINT SIGTERM

# Wait for either to exit
wait
