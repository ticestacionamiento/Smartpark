import json
import logging

from flask import Blueprint, jsonify, request

from app.services import inference as inference_svc
from app.services import metrics as metrics_svc
from app.services import preprocessing as prep_svc
from app.utils.validation import validate_image_file, validate_rois

logger = logging.getLogger(__name__)

inference_bp = Blueprint("inference", __name__, url_prefix="/api")

_COCO_VEHICLE_NAMES = {2: "car", 3: "motorcycle", 5: "bus", 7: "truck"} ###########


@inference_bp.route("/analyze", methods=["POST"])
def analyze():
    # --- Validate image ---
    image_file = request.files.get("image")
    if not image_file:
        return _error(400, "MISSING_IMAGE", "El campo 'image' es obligatorio.")

    ok, msg = validate_image_file(image_file)
    if not ok:
        code = "UNSUPPORTED_FORMAT" if "Formato" in msg or "Tipo" in msg else "MISSING_IMAGE"
        return _error(400, code, msg)

    # --- Validate ROIs ---
    rois_raw = request.form.get("rois", "").strip()
    if not rois_raw:
        return _error(400, "MISSING_ROIS", "El campo 'rois' es obligatorio.")

    try:
        rois = json.loads(rois_raw)
    except json.JSONDecodeError:
        return _error(400, "INVALID_ROI_FORMAT", "El campo 'rois' no es JSON válido.")

    ok, msg = validate_rois(rois)
    if not ok:
        return _error(400, "INVALID_ROI_FORMAT", msg)

    # --- Validate canvas dimensions ---
    try:
        canvas_width = int(request.form.get("canvas_width", 0))
        canvas_height = int(request.form.get("canvas_height", 0))
        if canvas_width <= 0 or canvas_height <= 0:
            raise ValueError
    except (ValueError, TypeError):
        return _error(400, "INVALID_CANVAS_SIZE", "canvas_width y canvas_height deben ser enteros positivos.")

    # --- Optional confidence override ---
    yolo_conf: float | None = None
    raw_conf = request.form.get("yolo_conf")
    if raw_conf is not None:
        try:
            yolo_conf = float(raw_conf)
            if not (0.0 < yolo_conf < 1.0):
                raise ValueError
        except (ValueError, TypeError):
            return _error(400, "INVALID_CONFIDENCE", "yolo_conf debe ser un número entre 0.0 y 1.0.")

    # --- Pipeline ---
    try:
        image_bytes = image_file.read()
        processed_img, meta = prep_svc.preprocess_image(image_bytes)
    except ValueError as exc:
        code = "BELOW_MINIMUM_RESOLUTION" if "Resolución" in str(exc) else "CORRUPT_IMAGE"
        return _error(400, code, str(exc))
    except Exception as exc:
        logger.exception("Preprocessing error")
        return _error(500, "PREPROCESSING_ERROR", "Error durante el preprocesamiento de la imagen.")

    try:
        detections, inference_time_ms = inference_svc.run_inference(processed_img, yolo_conf)
        roi_results = inference_svc.evaluate_rois(detections, rois, canvas_width, canvas_height, meta)
    except Exception as exc:
        logger.exception("Inference error")
        return _error(500, "INFERENCE_ERROR", "Error durante la inferencia del modelo.")

    summary = metrics_svc.compute_occupancy_summary(roi_results)

    from app.core.config import Config
    used_conf = yolo_conf if yolo_conf is not None else Config.YOLO_CONF_THRESHOLD
    return jsonify({
        "success": True,
        "inference_time_ms": round(inference_time_ms, 1),
        "model_info": {
            "name": "YOLOv11",
            "confidence_threshold": used_conf,
            "classes_detected": [_COCO_VEHICLE_NAMES[c] for c in Config.YOLO_VEHICLE_CLASSES],
        },
        "summary": {
            "total_spaces": summary.total_spaces,
            "occupied_count": summary.occupied_count,
            "available_count": summary.available_count,
            "occupation_percentage": summary.occupation_percentage,
        },
        "spaces": [
            {
                "id": r.roi_id,
                "status": r.status,
                "confidence": r.confidence,
                "occupied_by_count": r.occupied_by_count,
            }
            for r in roi_results
        ],
    }), 200


@inference_bp.route("/health", methods=["GET"])
def health():
    from app.core.model_loader import _model
    return jsonify({"status": "ok", "model_loaded": _model is not None}), 200


def _error(status: int, code: str, message: str):
    return jsonify({"success": False, "error": {"code": code, "message": message}}), status

_COCO_VEHICLE_NAMES = {2: "car", 3: "motorcycle", 5: "bus", 7: "truck"}