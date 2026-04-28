from dataclasses import dataclass
from app.services.inference import ROIResult


@dataclass
class OccupancySummary:
    total_spaces: int
    occupied_count: int
    available_count: int
    occupation_percentage: float


def compute_occupancy_summary(roi_results: list[ROIResult]) -> OccupancySummary:
    total = len(roi_results)
    occupied = sum(1 for r in roi_results if r.status == "ocupado")
    available = total - occupied
    percentage = round(occupied / total * 100, 1) if total > 0 else 0.0

    return OccupancySummary(
        total_spaces=total,
        occupied_count=occupied,
        available_count=available,
        occupation_percentage=percentage,
    )
