import cv2
import numpy as np


def preprocess_image(image_bytes: bytes) -> tuple[np.ndarray, dict]:
    from app.core.config import Config

    img = decode_image(image_bytes)
    h, w = img.shape[:2]

    if w < Config.MIN_IMAGE_WIDTH or h < Config.MIN_IMAGE_HEIGHT:
        raise ValueError(
            f"Resolución mínima requerida: {Config.MIN_IMAGE_WIDTH}×{Config.MIN_IMAGE_HEIGHT} px. "
            f"La imagen es {w}×{h} px."
        )

    padded, scale, pad_top, pad_left = letterbox(img, Config.TARGET_SIZE)
    enhanced = apply_clahe(padded)
    smoothed = apply_gaussian(enhanced)

    meta = {
        "original_width": w,
        "original_height": h,
        "scale": scale,
        "pad_top": pad_top,
        "pad_left": pad_left,
    }
    return smoothed, meta


def decode_image(image_bytes: bytes) -> np.ndarray:
    buf = np.frombuffer(image_bytes, dtype=np.uint8)
    img = cv2.imdecode(buf, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("No se pudo decodificar la imagen. El archivo puede estar corrupto.")
    return img


def letterbox(img: np.ndarray, target: int = 640) -> tuple[np.ndarray, float, int, int]:
    h, w = img.shape[:2]
    scale = target / max(h, w)
    new_w = int(round(w * scale))
    new_h = int(round(h * scale))
    resized = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_LINEAR)

    pad_top = (target - new_h) // 2
    pad_bottom = target - new_h - pad_top
    pad_left = (target - new_w) // 2
    pad_right = target - new_w - pad_left

    padded = cv2.copyMakeBorder(
        resized,
        pad_top, pad_bottom, pad_left, pad_right,
        cv2.BORDER_CONSTANT,
        value=(114, 114, 114),
    )
    return padded, scale, pad_top, pad_left


def apply_clahe(img: np.ndarray) -> np.ndarray:
    from app.core.config import Config

    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l_channel, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(
        clipLimit=Config.CLAHE_CLIP_LIMIT,
        tileGridSize=Config.CLAHE_TILE_GRID_SIZE,
    )
    l_enhanced = clahe.apply(l_channel)
    lab_enhanced = cv2.merge([l_enhanced, a, b])
    return cv2.cvtColor(lab_enhanced, cv2.COLOR_LAB2BGR)


def apply_gaussian(img: np.ndarray) -> np.ndarray:
    from app.core.config import Config

    return cv2.GaussianBlur(
        img,
        Config.GAUSSIAN_KERNEL_SIZE,
        Config.GAUSSIAN_SIGMA,
    )
