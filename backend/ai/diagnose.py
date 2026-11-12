import os, csv, cv2
from ultralytics import YOLO
from process_detector import PROCESS_STEPS, MODELS_DIR

models = {p["key"]: YOLO(os.path.join(MODELS_DIR, p["model_file"])) for p in PROCESS_STEPS}
for k, m in models.items():
    print(k, m.names)          # what each model was trained to detect

VIDEO = r"C:\Final Year Project Model Train Dataset\CCTV\foundry_process_2min.mp4"   # keep the r before the quotes
cap = cv2.VideoCapture(VIDEO)
if not cap.isOpened():
    raise SystemExit(f"Cannot open video: {VIDEO}")
fps = int(cap.get(cv2.CAP_PROP_FPS) or 25)
with open("diag.csv", "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["second"] + [p["key"] for p in PROCESS_STEPS])
    n = 0
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        n += 1
        if n % fps:            # one frame per second
            continue
        row = [n // fps]
        for p in PROCESS_STEPS:
            r = models[p["key"]](frame, conf=0.05, verbose=False)[0]
            row.append(round(float(r.boxes.conf.max()), 2) if len(r.boxes) else 0)
        w.writerow(row)
print("done -> diag.csv")