"""Spatial map endpoints for MapLibre GL rendering."""

from __future__ import annotations

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Query, HTTPException

from app.models.observation import GeoJSONFeatureCollection
from app.models.spatial import AOISpecification
from app.spatial.geometry import GeometryEngine
from app.services.analysis_service import analysis_service
from app.core.exceptions import BurnCalendarException

router = APIRouter(prefix="", tags=["Map"])


@router.get(
    "/map/geojson",
    response_model=GeoJSONFeatureCollection,
    summary="Get GeoJSON observations or grid cells for map rendering",
)
def get_map_geojson(
    region: str = Query(default="global", description="Region preset name"),
    year: Optional[int] = Query(default=None, description="Year (e.g. 2024)"),
    month: Optional[int] = Query(default=None, ge=0, le=11, description="Month index (0-11)"),
    start_date: Optional[str] = Query(default=None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(default=None, description="End date (YYYY-MM-DD)"),
    sensors: List[str] = Query(default=["MODIS", "VIIRS"], description="Target sensors"),
    limit: int = Query(default=5000, le=20000, description="Max observations returned"),
):
    """Serve real NASA observations formatted as a GeoJSON FeatureCollection.

    Directly compatible with MapLibre GL JS `map.getSource('observations').setData(...)`.
    """
    try:
        # Resolve date boundaries
        if year is not None and month is not None:
            m_num = month + 1
            s_date = f"{year}-{m_num:02d}-01"
            import calendar
            last_day = calendar.monthrange(year, m_num)[1]
            e_date = f"{year}-{m_num:02d}-{last_day:02d}"
        elif start_date and end_date:
            s_date = start_date
            e_date = end_date
        elif year is not None:
            s_date = f"{year}-01-01"
            e_date = f"{year}-12-31"
        else:
            # Default to latest 30 days
            from datetime import date, timedelta
            today = date.today()
            s_date = (today - timedelta(days=30)).isoformat()
            e_date = today.isoformat()

        aoi_spec = AOISpecification(region_preset=region)
        geom_shape, effective_bbox = GeometryEngine.build_aoi_geometry(aoi_spec)

        raw_records = analysis_service.engine.query_observations(
            west=effective_bbox.west,
            south=effective_bbox.south,
            east=effective_bbox.east,
            north=effective_bbox.north,
            start_date=s_date,
            end_date=e_date,
            sensors=sensors,
            limit=limit,
        )

        filtered = GeometryEngine.filter_records_by_geometry(
            records=raw_records,
            geom_shape=geom_shape,
            is_exact_polygon=aoi_spec.geometry is not None,
        )

        features = [r.to_geojson_feature() for r in filtered]

        return GeoJSONFeatureCollection(
            type="FeatureCollection",
            features=features,  # type: ignore
            metadata={
                "count": len(features),
                "region": region,
                "start_date": s_date,
                "end_date": e_date,
                "sensors": sensors,
            },
        )
    except BurnCalendarException as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get(
    "/map/tiles/{z}/{x}/{y}",
    summary="Tile boundary or vector tile metadata",
)
def get_map_tile(z: int, x: int, y: int) -> Dict[str, Any]:
    """Retrieve tile bounds and aggregation status for tile coordinates (z/x/y)."""
    import math

    def num2deg(xtile, ytile, zoom):
        n = 1 << zoom
        lon_deg = xtile / n * 360.0 - 180.0
        lat_rad = math.atan(math.sinh(math.pi * (1 - 2 * ytile / n)))
        lat_deg = math.degrees(lat_rad)
        return lon_deg, lat_deg

    lon_min, lat_max = num2deg(x, y, z)
    lon_max, lat_min = num2deg(x + 1, y + 1, z)

    return {
        "tile": {"z": z, "x": x, "y": y},
        "bbox": [round(lon_min, 4), round(lat_min, 4), round(lon_max, 4), round(lat_max, 4)],
        "status": "ready",
        "description": "Standard tile envelope definition for web map client integration.",
    }
