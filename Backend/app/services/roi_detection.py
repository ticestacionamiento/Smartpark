import base64
import json
import logging
import urllib.error
import urllib.parse
import urllib.request

import cv2
import numpy as np

logger = logging.getLogger(__name__)


def detect_rois(image_bytes: bytes, canvas_width: int, canvas_height: int, confidence: int | None = None) -> list[dict]:
    from app.core.config import Config

    if not Config.ROBOFLOW_API_KEY:
        raise ValueError(
            "La variable de entorno ROBOFLOW_API_KEY no está configurada. "
            "Obten tu clave gratuita en https://roboflow.com y agrégala al entorno."
        )

    buf = np.frombuffer(image_bytes, dtype=np.uint8)
    img = cv2.imdecode(buf, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("No se pudo decodificar la imagen.")
    orig_h, orig_w = img.shape[:2]

    conf = confidence if confidence is not None else Config.ROBOFLOW_CONF_THRESHOLD
    predictions = _call_roboflow_api(
        image_bytes,
        Config.ROBOFLOW_API_KEY,
        Config.ROBOFLOW_MODEL_ID,
        conf,
    )

    rois = []
    for i, pred in enumerate(predictions):
        x_c = pred["x"]
        y_c = pred["y"]
        pw = pred["width"]
        ph = pred["height"]

        # Bounding box in image pixel space → canvas pixel space
        x1 = (x_c - pw / 2) / orig_w * canvas_width
        y1 = (y_c - ph / 2) / orig_h * canvas_height
        x2 = (x_c + pw / 2) / orig_w * canvas_width
        y2 = (y_c + ph / 2) / orig_h * canvas_height

        rois.append({
            "id": f"P-{str(i + 1).zfill(2)}",
            "points": [[x1, y1], [x2, y1], [x2, y2], [x1, y2]],
        })

    return rois


def _call_roboflow_api(
    image_bytes: bytes,
    api_key: str,
    model_id: str,
    confidence: int,
) -> list[dict]:
    parts = model_id.split("/")
    if len(parts) < 2:
        raise ValueError(
            f"ROBOFLOW_MODEL_ID debe tener el formato 'project/version', recibido: '{model_id}'"
        )
    project, version = parts[0], parts[1]

    params = urllib.parse.urlencode({"api_key": api_key, "confidence": confidence})
    url = f"https://detect.roboflow.com/{project}/{version}?{params}"

    img_b64 = base64.b64encode(image_bytes)
    req = urllib.request.Request(
        url,
        data=img_b64,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        logger.error("Roboflow API HTTP %s: %s", exc.code, body)
        if exc.code == 403:
            raise RuntimeError(
                f"Acceso denegado al modelo '{model_id}' (403). "
                "Asegúrate de que el modelo existe en tu workspace y que ROBOFLOW_MODEL_ID "
                "tenga el formato correcto: 'workspace/proyecto/version'."
            ) from exc
        raise RuntimeError(
            f"Error de la API de Roboflow ({exc.code}). Verifica tu API key y el modelo configurado."
        ) from exc
    except urllib.error.URLError as exc:
        logger.error("Roboflow connection error: %s", exc)
        raise RuntimeError(
            "No se pudo conectar con la API de Roboflow. Verifica tu conexión a internet."
        ) from exc

    return result.get("predictions", [])
