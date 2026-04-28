import math
from werkzeug.datastructures import FileStorage


def validate_image_file(file: FileStorage) -> tuple[bool, str]:
    from app.core.config import Config

    if not file or not file.filename:
        return False, "No se recibió ningún archivo de imagen."

    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in Config.ALLOWED_EXTENSIONS:
        return False, f"Formato no soportado. Use .jpg, .jpeg, .png o .webp."

    # Read bytes to check MIME type and size, then reset stream for later use
    file_bytes = file.read()
    file.seek(0)

    if len(file_bytes) > Config.MAX_CONTENT_LENGTH:
        return False, "El archivo supera el tamaño máximo de 10 MB."

    try:
        import magic
        mime = magic.from_buffer(file_bytes[:2048], mime=True)
        if mime not in Config.ALLOWED_MIME_TYPES:
            return False, f"Tipo de archivo no permitido: {mime}."
    except Exception:
        # python-magic unavailable — fall back to extension check already done above
        pass

    return True, ""


def validate_rois(rois: list) -> tuple[bool, str]:
    if not rois or not isinstance(rois, list):
        return False, "El campo 'rois' debe ser una lista no vacía."

    for i, roi in enumerate(rois):
        if not isinstance(roi, dict):
            return False, f"ROI #{i} debe ser un objeto JSON."
        if "id" not in roi or not isinstance(roi["id"], str):
            return False, f"ROI #{i} debe tener un campo 'id' de tipo string."
        if "points" not in roi or not isinstance(roi["points"], list):
            return False, f"ROI '{roi.get('id', i)}' debe tener un campo 'points' de tipo lista."
        if len(roi["points"]) < 3:
            return False, f"ROI '{roi['id']}' debe tener al menos 3 puntos."
        for j, pt in enumerate(roi["points"]):
            if (
                not isinstance(pt, (list, tuple))
                or len(pt) != 2
                or not all(isinstance(v, (int, float)) and math.isfinite(v) for v in pt)
            ):
                return False, f"ROI '{roi['id']}', punto #{j} debe ser [x, y] con valores numéricos."

    return True, ""
