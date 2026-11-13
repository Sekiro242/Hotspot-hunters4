"""Seasonality endpoint evaluating seasonal cycles, baseline ratios, and unusual burning patterns."""

from __future__ import annotations

from typing import List, Dict, Any
from fastapi import APIRouter, Query, HTTPException
import numpy as np

from app.models.spatial import AOISpecification
from app.models.analysis import AnalysisRequest
from app.services.analysis_service import analysis_service
from app.core.constants import MONTH_NAMES
from app.core.exceptions import BurnCalendarException

router = APIRouter(prefix="", tags=["Seasonality"])


@router.get(
    "/seasonality",
    summary="Get seasonal baseline statistics and anomaly markers",
)
def get_seasonality(
    region: str = Query(default="global", description="Region preset name"),
    year: int = Query(default=2024, ge=2000, le=2030, description="Calendar year"),
    sensors: List[str] = Query(default=["MODIS", "VIIRS"], description="Target sensors"),
) -> Dict[str, Any]:
    """Calculate seasonal baseline statistics (mean, std dev, peak month, anomaly status) across the year."""
    try:
        req = AnalysisRequest(
            aoi=AOISpecification(region_preset=region),
            start_date=f"{year}-01-01",
            end_date=f"{year}-12-31",
            sensors=sensors,  # type: ignore
        )
        res = analysis_service.execute_analysis(req)

        counts = [m.detection_count for m in res.monthly_rhythm]
        mean_val = float(np.mean(counts)) if any(counts) else 0.0
        std_val = float(np.std(counts)) if any(counts) else 0.0

        peak_idx = int(np.argmax(counts)) if any(counts) else 0
        peak_month = MONTH_NAMES[peak_idx]

        monthly_anomalies = [
            {
                "month_name": m.month_name,
                "month_index": m.month_index,
                "detections": m.detection_count,
                "z_score": round((m.detection_count - mean_val) / std_val, 2) if std_val > 0 else 0.0,
                "is_unusual_period": m.is_unusual,
                "baseline_ratio": m.baseline_ratio,
            }
            for m in res.monthly_rhythm
        ]

        return {
            "year": year,
            "region": region,
            "sensors": sensors,
            "annual_monthly_mean": round(mean_val, 2),
            "annual_monthly_std": round(std_val, 2),
            "peak_month": peak_month,
            "peak_monthly_detections": counts[peak_idx],
            "unusual_period_threshold_1_3x": round(mean_val * 1.3, 2),
            "monthly_seasonality": monthly_anomalies,
        }
    except BurnCalendarException as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
