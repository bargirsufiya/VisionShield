from ultralytics import YOLO
from pathlib import Path
import cv2


# =========================================
# Load PPE Model
# =========================================

MODEL_PATH = Path(__file__).parent / "best.pt"

model = YOLO(str(MODEL_PATH))

print("✅ PPE model loaded")
print("Classes:", model.names)


# =========================================
# PPE Detection Function
# =========================================

def detect_ppe(
    image_path: str,
    confidence: float = 0.25,
    output_dir: str = "ai/results"
):
    # Run YOLO inference
    results = model.predict(
        source=image_path,
        conf=confidence,
        verbose=False,
        save=False
    )

    result = results[0]

    # Store detection information
    detections = []

    for box in result.boxes:
        class_id = int(box.cls[0])
        class_name = model.names[class_id]
        conf = float(box.conf[0])

        detections.append({
            "class": class_name,
            "confidence": round(conf, 3)
        })

    # =========================================
    # Save Annotated Image
    # =========================================

    output_path = Path(output_dir)

    output_path.mkdir(
        parents=True,
        exist_ok=True
    )

    # Create annotated image
    annotated_image = result.plot()

    # Generate output filename
    image_name = (
        Path(image_path).stem
        + "_result.jpg"
    )

    saved_image = output_path / image_name

    # Save image
    cv2.imwrite(
        str(saved_image),
        annotated_image
    )

    # Return detections + saved image path
    return detections, str(saved_image)