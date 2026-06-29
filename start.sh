#!/bin/bash
# Run both backend and frontend concurrently

echo "🏎  Starting F1 Dashboard..."

# Backend
cd backend
if [ ! -d "venv" ]; then
  echo "📦 Creating Python virtualenv..."
  python3 -m venv venv
fi
source venv/bin/activate
pip install -r requirements.txt -q
uvicorn main:app --reload --port 8000 &
BACKEND_PID=$!
echo "✅ Backend running at http://localhost:8000"

# Frontend
cd ../frontend
if [ ! -d "node_modules" ]; then
  echo "📦 Installing npm packages..."
  npm install
fi
npm run dev &
FRONTEND_PID=$!
echo "✅ Frontend running at http://localhost:5173"

echo ""
echo "🏁 F1 Dashboard ready!"
echo "   Frontend → http://localhost:5173"
echo "   API docs → http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop both servers"

trap "kill $BACKEND_PID $FRONTEND_PID" INT
wait
