# VisionShield – Test Report (2026-11-12)

Environment: backend `backend\.venv` (FastAPI/uvicorn, :8000), frontend Vite (:5173), MongoDB Atlas, Microsoft Edge.
No project source files were modified. Original videos in Test_Data untouched.

## Video
- Source: Test_Data\Cam2.mp4 (598 MB, 6:05, 1600x720). Segment 02:15–03:15 used (furnace tapping, ladle treatment, pouring).
- Output: video\VisionShield_foundry_demo_1min.mp4 – 60 s, 1280x576, H.264/yuv420p, 15.7 MB, no audio. Decodes cleanly.

## Process Detection (real run, UI + API)
- 1237/1237 frames processed, 20.63 fps, 59.97 s.
- Detections: scrap_weighing 929, magnesium_process 182, furnace_charging 100.
- SOP: all 3 steps detected, Magnesium (mandatory) done. Alerts raised by the system: "OUT OF ORDER – Magnesium before previous steps", "Batch COMPLETE", "OUT OF ORDER – Furnace Charging after Step 3" (genuine model output; the clip is a mid-process excerpt, so order flags are expected).

## Modules
| Module | Result |
|---|---|
| Login/auth | PASS (admin login via UI and API; bad password rejected) |
| Dashboard | PASS (status, readings, alerts, CCTV video) |
| Alerts | PASS (list, filters, counts load) – resolve action NOT tested |
| AI Safety Monitoring | PASS (PPE.jpg: 10 detections, annotated result) – video PPE not tested |
| Sensor Analytics | PASS (303 readings table) |
| Live Monitoring | PASS (health, video, trend charts) |
| Process Detection | PASS (see above) |
| Settings | Page + connectivity PASS – saving / Test Email/SMS NOT tested |
| Maintenance Mgmt | PASS read (3 records, stats API) – add/edit/delete NOT tested |
| User Management | PASS read (6 users) – add/role/status/password changes NOT tested |
| Database | PASS (/api/database-test: connected) |
No browser console errors or HTTP >=400 responses during the recorded session.

## Issues / observations
1. The old default admin password from the project scripts no longer matches the live account (expected).
2. Dashboard/sidebar badge shows 58 "active alerts" while Alerts page shows 9 active (of 238) – count inconsistency.
3. Sensor monitoring is OFF ("Paused"), so data is the stored 303 records; the simulator was not started (would write new DB records).
4. Concurrent uploads of the same filename collide on the output file (WinError 32) – saw this when two jobs ran at once. Not changed.
5. Process job took ~3–10 min on CPU; recording speeds up that wait (~10 min -> 12 s), disclosed here.
6. Settings section shows an email/phone; blurred in the recording.
7. Recording is browser-rendered (Playwright + Edge), not a desktop capture; no audio, on-screen captions instead of narration.
