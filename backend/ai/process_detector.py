import os
import cv2
import subprocess
from collections import defaultdict, deque
from ultralytics import YOLO
import imageio_ffmpeg

# =========================================================
# SOP Process Definitions  (order is LAW)
# =========================================================

PROCESS_STEPS = [
    {
        "step":      1,
        "key":       "scrap_weighing",
        "label":     "Scrap Weighing",
        "model_file":"scrap_weighing_best.pt",
        "mandatory": False,
        "color":     (0, 200, 0),
    },
    {
        "step":      2,
        "key":       "furnace_charging",
        "label":     "Furnace Charging",
        "model_file":"furnace_charging_best.pt",
        "mandatory": False,
        "color":     (0, 140, 255),
    },
    {
        "step":      3,
        "key":       "magnesium_process",
        "label":     "Magnesium Process",
        "model_file":"magnesium_process_best.pt",
        "mandatory": True,
        "color":     (0, 0, 220),
    },
]

CONF_THRESHOLD   = 0.40
TEMPORAL_FRAMES  = 8       # smoothing window

BASE_DIR     = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR   = os.path.join(BASE_DIR, "process_models")
RESULT_DIR   = os.path.join(BASE_DIR, "video_results")
os.makedirs(RESULT_DIR, exist_ok=True)

# =========================================================
# Lazy-load all models once at module level
# =========================================================

_models = {}

def _get_models():
    global _models
    if not _models:
        for proc in PROCESS_STEPS:
            path = os.path.join(MODELS_DIR, proc["model_file"])
            if os.path.exists(path):
                _models[proc["key"]] = YOLO(path)
            else:
                print(f"[WARN] Model not found: {path}")
    return _models


# =========================================================
# SOP Tracker
# =========================================================

class SOPTracker:
    def __init__(self):
        self.steps_done  = []        # list of step numbers completed
        self.alerts      = []        # {"severity": ..., "message": ...}

    def record(self, step_key: str):
        proc = next((p for p in PROCESS_STEPS if p["key"] == step_key), None)
        if proc is None:
            return

        n = proc["step"]
        if n in self.steps_done:
            return

        highest = max(self.steps_done, default=0)
        if n < highest:
            self._add_alert("error", f"OUT OF ORDER — {proc['label']} detected after Step {highest}")
        elif n > highest + 1:
            # Don't show STEP SKIPPED - the missing steps might come later
            # Only show OUT OF ORDER if steps are not following SOP
            self._add_alert("error", f"OUT OF ORDER — {proc['label']} detected before completing previous steps")

        self.steps_done.append(n)

        if n == 3:  # Magnesium Process is now step 3
            self._add_alert("success", "Batch COMPLETE — All mandatory steps including Magnesium done!")

    def _add_alert(self, severity: str, message: str):
        self.alerts.append({"severity": severity, "message": message})

    def summary(self) -> dict:
        steps_out = []
        for p in PROCESS_STEPS:
            steps_out.append({
                "step":      p["step"],
                "key":       p["key"],
                "label":     p["label"],
                "mandatory": p["mandatory"],
                "done":      p["step"] in self.steps_done,
            })

        magnesium_done   = 3 in self.steps_done
        mandatory_missed = any(
            p["mandatory"] and p["step"] not in self.steps_done
            for p in PROCESS_STEPS
        )

        # Add alert for skipped magnesium process (mandatory step)
        if not magnesium_done:
            self._add_alert("error", "MAGNESIUM PROCESS SKIPPED — Mandatory step 3 (Magnesium Process) was not detected in the video")

        return {
            "steps":            steps_out,
            "steps_done":       self.steps_done,
            "magnesium_done":   magnesium_done,
            "mandatory_missed": mandatory_missed,
            "alerts":           self.alerts,
        }


# =========================================================
# Main Detection Function
# =========================================================

def detect_process_video(video_path: str) -> dict:
    models  = _get_models()
    tracker = SOPTracker()
    buffer  = deque(maxlen=TEMPORAL_FRAMES)

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise RuntimeError("Cannot open video file.")

    fps    = cap.get(cv2.CAP_PROP_FPS) or 25
    width  = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total  = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    base         = os.path.splitext(os.path.basename(video_path))[0]
    raw_path     = os.path.join(RESULT_DIR, f"raw_process_{base}.mp4")
    final_path   = os.path.join(RESULT_DIR, f"process_{base}.mp4")

    for p in [raw_path, final_path]:
        if os.path.exists(p):
            os.remove(p)

    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(raw_path, fourcc, fps, (width, height))
    if not writer.isOpened():
        cap.release()
        raise RuntimeError("Cannot create output video.")

    frame_log          = []   # per-frame detection record
    frame_n            = 0
    detection_counts   = defaultdict(int)

    while True:
        ok, frame = cap.read()
        if not ok:
            break
        frame_n += 1

        # ── Run every model, pick best ──────────────────────
        best_key  = None
        best_conf = 0.0
        annotated = frame.copy()

        for proc in PROCESS_STEPS:
            key = proc["key"]
            if key not in models:
                continue
            results = models[key](frame, conf=CONF_THRESHOLD, verbose=False)[0]
            if results.boxes and len(results.boxes):
                conf = float(results.boxes.conf.max())
                if conf > best_conf:
                    best_conf = conf
                    best_key  = key
                # draw boxes
                for box in results.boxes:
                    c = float(box.conf[0])
                    if c >= CONF_THRESHOLD:
                        x1, y1, x2, y2 = map(int, box.xyxy[0])
                        cv2.rectangle(annotated, (x1, y1), (x2, y2), proc["color"], 2)
                        cv2.putText(
                            annotated,
                            f"{proc['label']} {c:.2f}",
                            (x1, max(y1 - 8, 12)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.55,
                            proc["color"], 2,
                        )

        # ── Temporal smoothing ──────────────────────────────
        buffer.append(best_key)
        votes = defaultdict(int)
        for v in buffer:
            if v:
                votes[v] += 1
        smoothed = max(votes, key=votes.get) if votes else None

        if smoothed:
            tracker.record(smoothed)
            detection_counts[smoothed] += 1

        # ── Overlay: current step label ─────────────────────
        if smoothed:
            proc_info = next((p for p in PROCESS_STEPS if p["key"] == smoothed), None)
            if proc_info:
                overlay_label = f"Step {proc_info['step']}: {proc_info['label']}"
                cv2.rectangle(annotated, (0, 0), (width, 38), (20, 20, 20), -1)
                cv2.putText(
                    annotated, overlay_label,
                    (10, 26), cv2.FONT_HERSHEY_SIMPLEX,
                    0.75, proc_info["color"], 2,
                )

        # ── Overlay: SOP progress bar ───────────────────────
        bar_y = height - 40
        cv2.rectangle(annotated, (0, bar_y - 5), (width, height), (20, 20, 20), -1)
        segment_w = width // len(PROCESS_STEPS)
        for i, proc in enumerate(PROCESS_STEPS):
            done  = proc["step"] in tracker.steps_done
            color = proc["color"] if done else (80, 80, 80)
            x0    = i * segment_w
            x1    = x0 + segment_w - 2
            cv2.rectangle(annotated, (x0, bar_y), (x1, height - 5), color, -1)
            label = f"{proc['step']}"
            cv2.putText(
                annotated, label,
                (x0 + 4, height - 10),
                cv2.FONT_HERSHEY_SIMPLEX, 0.45,
                (255, 255, 255), 1,
            )

        frame_log.append({
            "frame":   frame_n,
            "process": smoothed,
            "conf":    round(best_conf, 3),
        })

        writer.write(annotated)

    cap.release()
    writer.release()

    # ── FFmpeg → H.264 ──────────────────────────────────────
    try:
        ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
        subprocess.run(
            [ffmpeg, "-y", "-i", raw_path,
             "-c:v", "libx264", "-preset", "fast",
             "-crf", "23", "-pix_fmt", "yuv420p",
             "-movflags", "+faststart", "-an",
             final_path],
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"FFmpeg failed: {e.stderr.decode(errors='ignore')}")
    finally:
        if os.path.exists(raw_path):
            os.remove(raw_path)

    sop = tracker.summary()

    return {
        "result_path":       final_path,
        "frames_processed":  frame_n,
        "total_frames":      total,
        "fps":               round(fps, 2),
        "duration_seconds":  round(total / fps, 2) if fps > 0 else 0,
        "detection_counts":  dict(detection_counts),
        "sop_summary":       sop,
    }
