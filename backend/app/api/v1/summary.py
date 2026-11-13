"""Summary endpoint for rapid high-level fire activity metrics."""

from __future__ import annotations

from typing import List, Optional
from fastapi import APIRouter, Query, HTTPException

from app.models.analysis import AnalysisSummary, AnalysisRequest
from app.models.spatial import AOISpecification
from app.services.analysis_service import analysis_service
from app.core.exceptions import BurnCalendarException

router = APIRouter(prefix="", tags=["Summary"])


@router.get(
    "/summary",
    response_model=AnalysisSummary,
    summary="Get aggregated summary metrics for an AOI",
)
def get_summary(
    region: str = Query(default="global", description="Region preset name"),
    start_date: str = Query(description="Start date (YYYY-MM-DD)"),
    end_date: str = Query(description="End date (YYYY-MM-DD)"),
    sensors: List[str] = Query(default=["MODIS", "VIIRS"], description="Target sensors"),
):
    """Retrieve summary metrics: total detections, active cell-days, MODIS/VIIRS split, FRP, peak date."""
    try:
        req = AnalysisRequest(
            aoi=AOISpecification(region_preset=region),
            start_date=start_date,
            end_date=end_date,
            sensors=sensors,  # type: ignore
        )
        res = analysis_service.execute_analysis(req)
        return res.summary
    except BurnCalendarException as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
