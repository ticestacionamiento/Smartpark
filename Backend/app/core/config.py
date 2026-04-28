import os


class Config:
    # Inference — YOLO
    YOLO_MODEL_PATH: str = "yolo11x.pt"
    YOLO_CONF_THRESHOLD: float = float(os.environ.get("YOLO_CONF_THRESHOLD", "0.45"))
    # COCO class IDs: car=2, motorcycle=3, bus=5, truck=7
    YOLO_VEHICLE_CLASSES: list = [2, 3, 5, 7]

    # Roboflow — automatic ROI detection
    ROBOFLOW_API_KEY: str = os.environ.get("ROBOFLOW_API_KEY", "")
    # Format: "project-slug/version"  (e.g. "parking-space-detection-ojlxu/2")
    ROBOFLOW_MODEL_ID: str = os.environ.get("ROBOFLOW_MODEL_ID", "")
    ROBOFLOW_CONF_THRESHOLD: int = int(os.environ.get("ROBOFLOW_CONF_THRESHOLD", "40"))  # percentage (0-100)

    # Preprocessing
    TARGET_SIZE: int = 640
    CLAHE_CLIP_LIMIT: float = 2.0
    CLAHE_TILE_GRID_SIZE: tuple = (8, 8)
    GAUSSIAN_KERNEL_SIZE: tuple = (3, 3)
    GAUSSIAN_SIGMA: float = 0.0

    # Upload validation — MAX_CONTENT_LENGTH is consumed natively by Flask
    MAX_CONTENT_LENGTH: int = 10 * 1024 * 1024
    ALLOWED_EXTENSIONS: frozenset = frozenset({"jpg", "jpeg", "png", "webp"})
    ALLOWED_MIME_TYPES: frozenset = frozenset({
        "image/jpeg", "image/png", "image/webp"
    })
    MIN_IMAGE_WIDTH: int = 320
    MIN_IMAGE_HEIGHT: int = 240
