"""Data quality and provenance evaluation endpoint."""

from __future__ import annotations

from typing import List
from fastapi import APIRouter, Query, HTTPException

from app.models.quality import DataQualityReport
from app.models.spatial import AOISpecification
from app.models.analysis import AnalysisRequest
from app.services.analysis_service import analysis_service
from app.core.exceptions import BurnCalendarException

router = APIRouter(prefix="", tags=["Quality"])


@router.get(
    "/quality",
    response_model=DataQualityReport,
    summary="Get data quality, completeness, and sensor footprint metrics",
)
def get_quality(
    region: str = Query(default="global", description="Region preset name"),
    start_date: str = Query(description="Start date (YYYY-MM-DD)"),
    end_date: str = Query(description="End date (YYYY-MM-DD)"),
    sensors: List[str] = Query(default=["MODIS", "VIIRS"], description="Target sensors"),
):
    """Evaluate observation completeness:
    - Distinguish dates with zero detections from missing/unobserved dates
    - Report sensor confidence breakdowns
    - List scientific constraints and limitations
    """
    try:
        req = AnalysisRequest(
            aoi=AOISpecification(region_preset=region),
            start_date=start_date,
            end_date=end_date,
            sensors=sensors,  # type: ignore
        )
        res = analysis_service.execute_analysis(req)
        return res.quality_report
    except BurnCalendarException as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
