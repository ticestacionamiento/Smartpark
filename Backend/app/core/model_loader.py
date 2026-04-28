import logging
import numpy as np

logger = logging.getLogger(__name__)

_model = None


def load_model() -> None:
    global _model
    from app.core.config import Config
    from ultralytics import YOLO

    logger.info(f"Loading YOLO weights from: {Config.YOLO_MODEL_PATH}")
    _model = YOLO(Config.YOLO_MODEL_PATH)

    # Warm-up pass forces PyTorch to compile the computation graph before
    # the first real request arrives, avoiding the JIT overhead on that call.
    dummy = np.zeros((640, 640, 3), dtype=np.uint8)
    _model.predict(dummy, conf=Config.YOLO_CONF_THRESHOLD, verbose=False)
    logger.info("Model loaded and warmed up successfully.")


def get_model():
    if _model is None:
        raise RuntimeError("Model has not been loaded. Call load_model() first.")
    return _model
