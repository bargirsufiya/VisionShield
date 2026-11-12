# VisionShield – AI-Based Foundry Monitoring System

Real-time sensor monitoring, AI PPE safety detection (YOLOv8) and SOP process-step verification for foundries.

- **Frontend:** React + Vite (`frontend/`)
- **Backend:** FastAPI + MongoDB + Ultralytics YOLO (`backend/`, models in `backend/ai/`)

## Run
```bash
# backend
cd backend
python -m venv .venv && .venv/Scripts/activate   # Windows
pip install fastapi uvicorn pymongo python-dotenv ultralytics opencv-python imageio-ffmpeg pwdlib twilio
cp .env.example .env    # then fill in your own values
uvicorn main:app --host 127.0.0.1 --port 8000

# frontend
cd frontend && npm install && npm run dev
```
Open http://localhost:5173 (API docs: http://127.0.0.1:8000/docs).

## Demo
`Demo_Output/recording/VisionShield_Demo_Narrated.mp4` – narrated walkthrough. Test report: `Demo_Output/reports/TEST_REPORT.md`.
Large test videos (`Test_Data/`) and secrets (`.env`) are intentionally not in the repo.
