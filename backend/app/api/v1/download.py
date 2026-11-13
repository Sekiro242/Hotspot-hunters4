"""CSV download endpoint for exporting filtered observations."""

from __future__ import annotations

import csv
import io
from typing import List
from fastapi import APIRouter, Query, HTTPException
from fastapi.responses import StreamingResponse

from app.models.spatial import AOISpecification
from app.spatial.geometry import GeometryEngine
from app.services.analysis_service import analysis_service
from app.core.exceptions import BurnCalendarException

router = APIRouter(prefix="", tags=["Export"])


@router.get(
    "/download/csv",
    summary="Export filtered thermal observations as CSV",
)
def download_csv(
    region: str = Query(default="global", description="Region preset name"),
    start_date: str = Query(description="Start date (YYYY-MM-DD)"),
    end_date: str = Query(description="End date (YYYY-MM-DD)"),
    sensors: List[str] = Query(default=["MODIS", "VIIRS"], description="Target sensors"),
    limit: int = Query(default=20000, le=50000, description="Maximum rows to export"),
):
    """Stream filtered observation records directly as a CSV file for scientific analysis."""
    try:
        aoi_spec = AOISpecification(region_preset=region)
        geom_shape, effective_bbox = GeometryEngine.build_aoi_geometry(aoi_spec)

        raw_records = analysis_service.engine.query_observations(
            west=effective_bbox.west,
            south=effective_bbox.south,
            east=effective_bbox.east,
            north=effective_bbox.north,
            start_date=start_date,
            end_date=end_date,
            sensors=sensors,
            limit=limit,
        )

        filtered = GeometryEngine.filter_records_by_geometry(
            records=raw_records,
            geom_shape=geom_shape,
            is_exact_polygon=aoi_spec.geometry is not None,
        )

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "id", "latitude", "longitude", "acquisition_date", "acquisition_time",
            "sensor", "satellite", "confidence", "confidence_level", "frp_mw",
            "daynight", "processing_type", "grid_id", "region"
        ])

        for r in filtered:
            writer.writerow([
                r.id, r.latitude, r.longitude, r.acq_date, r.acq_time,
                r.sensor, r.satellite, r.confidence, r.confidence_level, r.frp,
                r.daynight, r.processing_type, r.grid_id or "", r.region or "global"
            ])

        output.seek(0)
        filename = f"burn_calendar_{region}_{start_date}_to_{end_date}.csv"

        return StreamingResponse(
            output,
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )
    except BurnCalendarException as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
