"""Calendar endpoint powering the 12-month rhythm and historical trend visualizations."""

from __future__ import annotations

from typing import List, Optional
from fastapi import APIRouter, Query, HTTPException

from app.models.calendar import CalendarResponse
from app.models.spatial import AOISpecification
from app.models.analysis import AnalysisRequest
from app.services.analysis_service import analysis_service
from app.aggregation.engine import AggregationEngine
from app.spatial.geometry import GeometryEngine
from app.core.exceptions import BurnCalendarException

router = APIRouter(prefix="", tags=["Calendar"])


@router.get(
    "/calendar",
    response_model=CalendarResponse,
    summary="Get annual monthly rhythm and historical multi-year trends",
)
def get_calendar(
    year: int = Query(default=2024, ge=2000, le=2030, description="Calendar year"),
    month: int = Query(default=8, ge=0, le=11, description="Selected month index (0=Jan, 11=Dec)"),
    region: str = Query(default="global", description="Region preset name (amazon, africa, etc.)"),
    sensors: List[str] = Query(default=["MODIS", "VIIRS"], description="Sensors to include"),
):
    """Retrieve 12-month seasonal rhythm ribbon and 6-year historical trends for an AOI.

    Aligned directly with the frontend Calendar component.
    """
    try:
        # Build full-year analysis request
        start_date = f"{year}-01-01"
        end_date = f"{year}-12-31"

        aoi_spec = AOISpecification(region_preset=region)
        req = AnalysisRequest(
            aoi=aoi_spec,
            start_date=start_date,
            end_date=end_date,
            sensors=sensors,  # type: ignore
            metric="detections",
        )

        analysis = analysis_service.execute_analysis(req)

        # For historical trends (previous 6 years for the target month)
        target_month_num = month + 1  # 1 to 12
        hist_start_year = year - 5
        hist_start_date = f"{hist_start_year}-01-01"

        # Query all observations across historical window to compute trends
        geom_shape, effective_bbox = GeometryEngine.build_aoi_geometry(aoi_spec)
        hist_records = analysis_service.engine.query_observations(
            west=effective_bbox.west,
            south=effective_bbox.south,
            east=effective_bbox.east,
            north=effective_bbox.north,
            start_date=hist_start_date,
            end_date=end_date,
            sensors=sensors,
            limit=50000,
        )

        trends = AggregationEngine.build_historical_trends(
            records=hist_records,
            target_month=target_month_num,
            target_year=year,
            window_years=6,
        )

        counts = [item.detection_count for item in analysis.monthly_rhythm]
        annual_total = sum(counts)
        avg_monthly = round(annual_total / 12.0, 1)
        unusual_threshold = round(avg_monthly * 1.3, 1)

        quality_notes = [
            f"Annual detections: {annual_total:,} across {year}.",
            "MODIS data available from 2000; VIIRS Suomi-NPP available from 2012.",
            "Unusual period indicator highlights months exceeding 1.3× the annual monthly mean.",
        ]

        return CalendarResponse(
            year=year,
            selected_month=month,
            region=region,
            sensors=sensors,
            monthly_rhythm=analysis.monthly_rhythm,
            historical_trends=trends,
            annual_total_detections=annual_total,
            annual_active_cell_days=analysis.summary.total_active_cell_days,
            average_monthly_detections=avg_monthly,
            unusual_period_threshold=unusual_threshold,
            quality_notes=quality_notes,
        )

    except BurnCalendarException as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to generate calendar: {exc}")
