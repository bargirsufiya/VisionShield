<div align="center">

# 🛡️ VisionShield

### AI-Based Foundry Monitoring System

**Real-time sensor monitoring · AI PPE safety detection · SOP process verification**

![React](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-61DAFB?logo=react&logoColor=white)
![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?logo=fastapi&logoColor=white)
![MongoDB](https://img.shields.io/badge/Database-MongoDB%20Atlas-47A248?logo=mongodb&logoColor=white)
![YOLO11](https://img.shields.io/badge/AI-YOLO11%20(Ultralytics)-00FFFF?logo=yolo&logoColor=black)
![OpenCV](https://img.shields.io/badge/Vision-OpenCV-5C3EE8?logo=opencv&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.13-3776AB?logo=python&logoColor=white)

![VisionShield dashboard](docs/screenshots/02-dashboard.jpg)

</div>

---

## ✨ Key Features

| Area | What it does |
|---|---|
| 🔐 **Authentication & roles** | Secure login with three roles — **Administrator**, **Supervisor**, **Operator** — and a menu that adapts to the role |
| 📊 **Dashboard** | System status, monitoring status, stored readings, active alerts, current temperature / weight against their limits, and an embedded CCTV stream |
| 🚨 **Alert management** | Automatic *High / Low Temperature* and *High / Low Weight* alerts, active and resolved tabs, status and resolved-date filters, one-click resolve with the resolver recorded |
| 🦺 **AI Safety Monitoring** | Upload an image or video; the YOLO11 model detects persons, helmets, vests, boots, gloves, goggles and caps with confidence scores and returns an annotated result |
| 📈 **Sensor Analytics** | Every stored temperature / weight reading with its status and timestamp |
| 📡 **Live Monitoring** | Service health (sensor, camera, API, database), multi-camera video panels, process stage, and real-time trend charts with the configured limits |
| 🏭 **Process Detection** | Upload a casting-process video; three trained models run as a background job and the system validates the **SOP step order**, flags out-of-order or missing steps and produces an annotated output video and a downloadable report |
| ⚙️ **Settings** | Temperature / weight thresholds, data-refresh interval, start/stop monitoring, e-mail / SMS alert configuration |
| 🛠️ **Maintenance management** | Equipment maintenance records with due-soon and overdue tracking |
| 👥 **User management** | Create users, change roles and status, reset passwords |

## 🧠 How the AI Works

1. **Video input** — CCTV or recorded MP4 → frames are extracted and pre-processed with OpenCV.
2. **PPE detection** — a custom-trained YOLO11 model (`backend/ai/best.pt`) detects `person, helmet, vest, boots, gloves, goggles, cap`; Ultralytics' multi-object tracker keeps object IDs across frames when processing video.
3. **Process recognition** — three further YOLO11 models (in `backend/ai/process_models/`) recognise the manufacturing steps:

   | SOP step | Model | Mandatory |
   |---|---|---|
   | 1. Scrap weighing | `scrap_weighing_best.pt` | – |
   | 2. Furnace charging | `furnace_charging_best.pt` | – |
   | 3. Magnesium process | `magnesium_process_best.pt` | **Yes** |

   Detections are smoothed over a window of 8 frames so single-frame noise does not trigger false steps.
4. **SOP validation** — the order of steps is checked; *out-of-order* steps and a *missing magnesium step* raise alerts (a missing mandatory step is saved as a **Critical** alert in MongoDB and can trigger an e-mail).
5. **Output** — an annotated video with SOP progress, per-step frame counts / coverage, and a downloadable report.

## 🏗️ System Architecture

![System architecture](docs/architecture.jpg)

## 🚀 Getting Started

### Prerequisites
- **Python 3.13** (3.10+ should work) and **Node.js 20+**
- A **MongoDB Atlas** cluster (free tier is enough) and a database user
- Optional: an NVIDIA GPU (CPU works, but processing a 1-minute video takes a few minutes)

### 1. Backend
```bash
cd backend
python -m venv .venv
# Windows:  .venv\Scripts\activate        macOS/Linux:  source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # then put your own MongoDB user / password (and optional alert settings)
```
Point `database.py` at **your** cluster (the `MONGODB_URL` host) — the database name is `VisionShieldDB`. Then:
```bash
uvicorn main:app --host 127.0.0.1 --port 8000
```
Interactive API docs: <http://127.0.0.1:8000/docs> · health check: `GET /api/test`, `GET /api/database-test`.

Create the first administrator with the setup endpoint (`POST /api/auth/setup`, visible in the API docs) and then log in from the web app.

### 2. Frontend
```bash
cd frontend
npm install
npm run dev                  # http://localhost:5173
```
The API address is set in `frontend/src/config/api.js` (default `http://127.0.0.1:8000`).

### 3. Try Process Detection
Open **Process Detection**, choose `Demo_Output/video/VisionShield_foundry_demo_1min.mp4` and click **Run Process Detection**. The job runs in the background; when it finishes you will see the SOP step sequence, SOP alerts, video statistics and the annotated output video.

### Notes
- **Sensor data:** the *Live Sensor Feed* switch in **Settings** generates simulated temperature / weight readings at the chosen interval (ESP32 hardware integration is planned). `backend/simulator/csv_simulator.py` can replay readings from a CSV.
- **Video panels:** the dashboard and Live Monitoring play the clips listed in `frontend/src/config/videos.js`. Two small clips are included in `frontend/public/videos/`; add your own MP4s there (H.264 / AAC recommended — see `REENCODE_VIDEOS.md`).
- **Large test videos** are intentionally not in the repository.

## 🔮 Future Work
- Connect live RTSP / CCTV cameras and real ESP32 weight and temperature sensors
- Evaluate model accuracy (mAP, precision, recall) on a labelled test set and retrain on more factory footage
- Buzzer / push-notification integration and deployment to the plant network

---

<div align="center"><sub>⚠️ Never commit your <code>.env</code> file — it holds database and alert credentials. Only <code>.env.example</code> belongs in the repository.</sub></div>
