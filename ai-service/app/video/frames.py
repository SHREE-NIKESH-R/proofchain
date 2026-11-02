"""
Video originality analysis (spec Section 4.5 / 30).

Deliberately reuses the image pipeline rather than building a separate video model,
per the spec's explicit instruction: "DO NOT build an unnecessarily complicated
separate video AI model."

Pipeline: video -> extract representative frames (configurable interval) -> each frame
through the image similarity pipeline -> aggregate frame-level scores -> overall score.
"""
import tempfile
import os
import cv2

from app.config import settings


def extract_representative_frames(video_bytes: bytes) -> list[bytes]:
    """
    Samples frames at a configurable interval (settings.video_frame_sample_interval_seconds),
    capped at settings.video_max_frames, and returns them as JPEG-encoded bytes so they can
    be fed straight into the existing image pipeline (compute_perceptual_hash, etc.).
    """
    # OpenCV's VideoCapture needs a real file path, not an in-memory buffer.
    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
        tmp.write(video_bytes)
        tmp_path = tmp.name

    frames: list[bytes] = []
    try:
        cap = cv2.VideoCapture(tmp_path)
        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        frame_interval = max(1, int(fps * settings.video_frame_sample_interval_seconds))

        frame_index = 0
        while len(frames) < settings.video_max_frames:
            ret, frame = cap.read()
            if not ret:
                break
            if frame_index % frame_interval == 0:
                success, buffer = cv2.imencode(".jpg", frame)
                if success:
                    frames.append(buffer.tobytes())
            frame_index += 1
        cap.release()
    finally:
        os.unlink(tmp_path)

    return frames
