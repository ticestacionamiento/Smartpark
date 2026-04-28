from dataclasses import dataclass, field
import cv2
import numpy as np


@dataclass
class Detection:
    x_min: float
    y_min: float
    x_max: float
    y_max: float
    confidence: float
    class_id: int
    centroid_x: float = field(init=False)
    centroid_y: float = field(init=False)

    def __post_init__(self):
        self.centroid_x = (self.x_min + self.x_max) / 2
        self.centroid_y = (self.y_min + self.y_max) / 2


@dataclass
class ROIResult:
    roi_id: str
    status: str            # "ocupado" | "libre"
    confidence: float      # max confidence among detections inside, or 0.0
    occupied_by_count: int


# COCO class names for the 4 vehicle classes
_COCO_VEHICLE_NAMES = {2: "car", 3: "motorcycle", 5: "bus", 7: "truck"}


def run_inference(processed_img: np.ndarray, conf_threshold: float | None = None) -> tuple[list[Detection], float]:
    from app.core.config import Config
    from app.core.model_loader import get_model

    threshold = conf_threshold if conf_threshold is not None else Config.YOLO_CONF_THRESHOLD
    model = get_model()
    results = model.predict(processed_img, conf=threshold, verbose=False)

    inference_time_ms: float = 0.0
    detections: list[Detection] = []

    if not results:
        return detections, inference_time_ms

    result = results[0]
    inference_time_ms = result.speed.get("inference", 0.0)

    if result.boxes is None:
        return detections, inference_time_ms

    for box in result.boxes:
        class_id = int(box.cls[0])
        if class_id not in Config.YOLO_VEHICLE_CLASSES:
            continue

        x_min, y_min, x_max, y_max = box.xyxy[0].tolist()
        confidence = float(box.conf[0])
        detections.append(Detection(
            x_min=x_min, y_min=y_min,
            x_max=x_max, y_max=y_max,
            confidence=confidence,
            class_id=class_id,
        ))

    return detections, inference_time_ms


def evaluate_rois(
    detections: list[Detection],
    rois: list[dict],
    canvas_width: int,
    canvas_height: int,
    meta: dict,
) -> list[ROIResult]:
    orig_w: float = meta["original_width"]
    orig_h: float = meta["original_height"]
    scale: float = meta["scale"]
    pad_left: float = meta["pad_left"]
    pad_top: float = meta["pad_top"]

    results: list[ROIResult] = []

    for roi in rois:
        # Scale ROI points: canvas pixels → original image pixels → letterboxed 640×640
        scaled_points = []
        for px, py in roi["points"]:
            img_x = px / canvas_width * orig_w
            img_y = py / canvas_height * orig_h
            lbox_x = img_x * scale + pad_left
            lbox_y = img_y * scale + pad_top
            scaled_points.append([lbox_x, lbox_y])

        contour = np.array(scaled_points, dtype=np.float32).reshape((-1, 1, 2))

        best_confidence = 0.0
        count_inside = 0

        for det in detections:
            result = cv2.pointPolygonTest(contour, (det.centroid_x, det.centroid_y), measureDist=False)
            if result >= 0:
                count_inside += 1
                if det.confidence > best_confidence:
                    best_confidence = det.confidence

        results.append(ROIResult(
            roi_id=roi["id"],
            status="ocupado" if count_inside > 0 else "libre",
            confidence=round(best_confidence, 4),
            occupied_by_count=count_inside,
        ))

    return results
