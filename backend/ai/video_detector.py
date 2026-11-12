import os
import cv2
import subprocess

from collections import defaultdict
from ultralytics import YOLO
import imageio_ffmpeg


# =========================================================
# Paths
# =========================================================

BASE_DIR = os.path.dirname(
    os.path.dirname(os.path.abspath(__file__))
)

MODEL_PATH = os.path.join(
    BASE_DIR,
    "ai",
    "best.pt"
)

RESULT_DIR = os.path.join(
    BASE_DIR,
    "ai",
    "video_results"
)

os.makedirs(
    RESULT_DIR,
    exist_ok=True
)


# =========================================================
# Load YOLO Model
# =========================================================

model = YOLO(MODEL_PATH)


# =========================================================
# Process Video
# =========================================================

def detect_ppe_video(video_path):

    cap = cv2.VideoCapture(video_path)

    if not cap.isOpened():
        raise RuntimeError(
            "Unable to open the uploaded video."
        )

    fps = cap.get(
        cv2.CAP_PROP_FPS
    )

    if not fps or fps <= 0:
        fps = 25

    width = int(
        cap.get(
            cv2.CAP_PROP_FRAME_WIDTH
        )
    )

    height = int(
        cap.get(
            cv2.CAP_PROP_FRAME_HEIGHT
        )
    )

    total_frames = int(
        cap.get(
            cv2.CAP_PROP_FRAME_COUNT
        )
    )


    # =====================================================
    # Output filenames
    # =====================================================

    base_name = os.path.splitext(
        os.path.basename(video_path)
    )[0]

    raw_output_name = (
        "raw_"
        + base_name
        + ".mp4"
    )

    final_output_name = (
        "processed_"
        + base_name
        + ".mp4"
    )

    raw_output_path = os.path.join(
        RESULT_DIR,
        raw_output_name
    )

    final_output_path = os.path.join(
        RESULT_DIR,
        final_output_name
    )


    # =====================================================
    # Remove old files if they exist
    # =====================================================

    if os.path.exists(raw_output_path):
        os.remove(raw_output_path)

    if os.path.exists(final_output_path):
        os.remove(final_output_path)


    # =====================================================
    # OpenCV temporary video writer
    # =====================================================

    fourcc = cv2.VideoWriter_fourcc(
        *"mp4v"
    )

    writer = cv2.VideoWriter(
        raw_output_path,
        fourcc,
        fps,
        (width, height)
    )

    if not writer.isOpened():

        cap.release()

        raise RuntimeError(
            "Unable to create temporary video."
        )


    # =====================================================
    # Statistics
    # =====================================================

    class_counts = defaultdict(set)

    confidence_values = defaultdict(list)

    processed_frames = 0


    # =====================================================
    # Process Frames
    # =====================================================

    while True:

        success, frame = cap.read()

        if not success:
            break

        processed_frames += 1


        # -------------------------------------------------
        # YOLO + ByteTrack
        # -------------------------------------------------

        results = model.track(
            frame,
            persist=True,
            tracker="bytetrack.yaml",
            verbose=False
        )

        result = results[0]


        # -------------------------------------------------
        # Draw detections
        # -------------------------------------------------

        annotated_frame = result.plot()


        # -------------------------------------------------
        # Collect statistics
        # -------------------------------------------------

        if result.boxes is not None:

            boxes = result.boxes

            for i in range(len(boxes)):

                class_id = int(
                    boxes.cls[i].item()
                )

                class_name = model.names[
                    class_id
                ]

                confidence = float(
                    boxes.conf[i].item()
                )


                # -----------------------------------------
                # Track ID
                # -----------------------------------------

                track_id = None

                if boxes.id is not None:

                    track_id = int(
                        boxes.id[i].item()
                    )


                # -----------------------------------------
                # Use track ID when available
                # -----------------------------------------

                if track_id is not None:

                    class_counts[
                        class_name
                    ].add(track_id)

                else:

                    class_counts[
                        class_name
                    ].add(
                        f"frame_{processed_frames}_{i}"
                    )


                confidence_values[
                    class_name
                ].append(
                    confidence
                )


        # -------------------------------------------------
        # Write frame
        # -------------------------------------------------

        writer.write(
            annotated_frame
        )


    # =====================================================
    # Release OpenCV resources
    # =====================================================

    cap.release()
    writer.release()


    # =====================================================
    # Convert MP4V → H.264
    # =====================================================

    try:

        ffmpeg_exe = (
            imageio_ffmpeg.get_ffmpeg_exe()
        )

        command = [
            ffmpeg_exe,

            "-y",

            "-i",
            raw_output_path,

            "-c:v",
            "libx264",

            "-preset",
            "medium",

            "-crf",
            "23",

            "-pix_fmt",
            "yuv420p",

            "-movflags",
            "+faststart",

            "-an",

            final_output_path
        ]


        subprocess.run(
            command,
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )


    except subprocess.CalledProcessError as error:

        print(
            "FFmpeg conversion failed:"
        )

        print(
            error.stderr.decode(
                errors="ignore"
            )
        )

        raise RuntimeError(
            "Unable to convert processed video to browser-compatible format."
        )


    finally:

        if os.path.exists(
            raw_output_path
        ):

            os.remove(
                raw_output_path
            )


    # =====================================================
    # Create Summary
    # =====================================================

    summary = {}

    for class_name in class_counts:

        confidences = confidence_values[
            class_name
        ]

        average_confidence = (
            sum(confidences)
            /
            len(confidences)
            if confidences
            else 0
        )

        summary[class_name] = {

            "count":
                len(
                    class_counts[
                        class_name
                    ]
                ),

            "average_confidence":
                round(
                    average_confidence,
                    4
                )
        }


    # =====================================================
    # Return Result
    # =====================================================

    return {

        "result_path":
            final_output_path,

        "frames_processed":
            processed_frames,

        "total_frames":
            total_frames,

        "fps":
            round(
                fps,
                2
            ),

        "duration_seconds":
            round(
                total_frames / fps,
                2
            )
            if fps > 0
            else 0,

        "detections":
            summary
    }