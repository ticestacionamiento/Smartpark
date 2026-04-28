import logging

from flask import Blueprint, jsonify, request

from app.services import roi_detection as roi_svc
from app.utils.validation import validate_image_file

logger = logging.getLogger(__name__)

roi_bp = Blueprint("roi", __name__, url_prefix="/api")


@roi_bp.route("/detect-rois", methods=["POST"])
def detect_rois():
    image_file = request.files.get("image")
    if not image_file:
        return _error(400, "MISSING_IMAGE", "El campo 'image' es obligatorio.")

    ok, msg = validate_image_file(image_file)
    if not ok:
        code = "UNSUPPORTED_FORMAT" if "Formato" in msg or "Tipo" in msg else "MISSING_IMAGE"
        return _error(400, code, msg)

    try:
        canvas_width = int(request.form.get("canvas_width", 0))
        canvas_height = int(request.form.get("canvas_height", 0))
        if canvas_width <= 0 or canvas_height <= 0:
            raise ValueError
    except (ValueError, TypeError):
        return _error(400, "INVALID_CANVAS_SIZE", "canvas_width y canvas_height deben ser enteros positivos.")

    roboflow_conf: int | None = None
    raw_conf = request.form.get("confidence")
    if raw_conf is not None:
        try:
            roboflow_conf = int(raw_conf)
            if not (0 <= roboflow_conf <= 100):
                raise ValueError
        except (ValueError, TypeError):
            return _error(400, "INVALID_CONFIDENCE", "confidence debe ser un entero entre 0 y 100.")

    try:
        image_bytes = image_file.read()
        rois = roi_svc.detect_rois(image_bytes, canvas_width, canvas_height, roboflow_conf)
    except ValueError as exc:
        return _error(400, "CONFIGURATION_ERROR", str(exc))
    except RuntimeError as exc:
        logger.exception("Roboflow API error")
        return _error(502, "ROBOFLOW_ERROR", str(exc))
    except Exception:
        logger.exception("ROI detection error")
        return _error(500, "ROI_DETECTION_ERROR", "Error durante la detección automática de plazas.")

    return jsonify({
        "success": True,
        "rois": rois,
        "count": len(rois),
    }), 200


def _error(status: int, code: str, message: str):
    return jsonify({"success": False, "error": {"code": code, "message": message}}), status
