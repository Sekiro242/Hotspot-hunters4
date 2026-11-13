"""Analysis orchestrator service.

Coordinates:
- AOI spatial parsing and validation
- Deterministic query cache checks
- Parquet & DuckDB spatial-temporal queries
- Shapely exact polygon containment filtering
- Aggregation of summary metrics, daily time series, and monthly rhythm
- Data quality, completeness, and limitation assessment
"""

from __future__ import annotations

import logging
import time
import uuid
from typing import Optional, List, Dict, Any

from app.config import settings
from app.models.spatial import AOISpecification, BoundingBox
from app.models.analysis import (
    AnalysisRequest,
    AnalysisResponse,
    AnalysisSummary,
    DailyTimeSeriesPoint,
    GridCellAggregate,
)
from app.models.calendar import MonthlyRhythmItem
from app.spatial.geometry import GeometryEngine
from app.spatial.grid import SpatialGrid
from app.storage.duckdb_engine import DuckDBEngine
from app.aggregation.engine import AggregationEngine
from app.services.cache_service import cache_service
from app.harmonization.empirical_harmonizer import empirical_harmonizer

logger = logging.getLogger(__name__)


class AnalysisService:
    """Orchestrates end-to-end analytical query execution."""

    def __init__(self, duckdb_engine: Optional[DuckDBEngine] = None):
        self.engine = duckdb_engine or DuckDBEngine()
        self.grid = SpatialGrid(resolution_deg=settings.DEFAULT_GRID_RESOLUTION_DEGREE)

    def execute_analysis(self, req: AnalysisRequest) -> AnalysisResponse:
        """Execute a complete analysis pipeline for a validated request."""
        t_start = time.perf_counter()

        # 1. Resolve geometry and bounding box envelope
        geom_shape, effective_bbox = GeometryEngine.build_aoi_geometry(req.aoi)
        is_exact_polygon = req.aoi.geometry is not None

        # 2. Determine AOI cache key representation
        aoi_key = req.aoi.region_preset or effective_bbox.to_firms_str()
        cache_key = cache_service.compute_cache_key(
            aoi_key=aoi_key,
            start_date=req.start_date,
            end_date=req.end_date,
            sensors=req.sensors,
            metric=req.metric,
            mode=req.mode,
            version=settings.METHODOLOGY_VERSION,
        )

        # 3. Check deterministic query cache
        cached_result = cache_service.get(cache_key)
        if cached_result:
            logger.info(f"Query cache HIT for key {cache_key[:12]}")
            cached_copy = cached_result.model_copy()
            cached_copy.is_cached = True
            return cached_copy

        # 4. Fetch raw observations from DuckDB within bounding box
        raw_records = self.engine.query_observations(
            west=effective_bbox.west,
            south=effective_bbox.south,
            east=effective_bbox.east,
            north=effective_bbox.north,
            start_date=req.start_date,
            end_date=req.end_date,
            sensors=req.sensors,
            limit=50000,
        )

        # 5. Apply exact Shapely polygon containment if a polygon AOI was requested
        filtered_records = GeometryEngine.filter_records_by_geometry(
            records=raw_records,
            geom_shape=geom_shape,
            is_exact_polygon=is_exact_polygon,
        )

        # 6. Calculate summary metrics
        modis_records = [r for r in filtered_records if r.sensor == "MODIS"]
        viirs_records = [r for r in filtered_records if r.sensor == "VIIRS"]
        total_detections = len(filtered_records)
        unique_cell_days = len({(r.grid_id or f"{r.latitude}_{r.longitude}", r.acq_date) for r in filtered_records})
        total_frp = sum(r.frp for r in filtered_records)

        from datetime import date
        d_start = date.fromisoformat(req.start_date)
        d_end = date.fromisoformat(req.end_date)
        total_days = max(1, (d_end - d_start).days + 1)
        mean_daily = round(total_detections / total_days, 2)

        # Peak day detection
        date_counts: Dict[str, int] = {}
        for r in filtered_records:
            date_counts[r.acq_date] = date_counts.get(r.acq_date, 0) + 1

        peak_date = None
        peak_cnt = 0
        if date_counts:
            peak_date = max(date_counts, key=date_counts.get)
            peak_cnt = date_counts[peak_date]

        summary = AnalysisSummary(
            total_detections=total_detections,
            total_active_cell_days=unique_cell_days,
            modis_detections=len(modis_records),
            viirs_detections=len(viirs_records),
            total_frp_mw=round(total_frp, 2),
            mean_daily_detections=mean_daily,
            peak_date=peak_date,
            peak_detections=peak_cnt,
        )

        # 7. Build daily time series
        daily_series_map: Dict[str, Dict[str, Any]] = {}
        curr = d_start
        from datetime import timedelta
        while curr <= d_end:
            c_str = curr.isoformat()
            daily_series_map[c_str] = {
                "date": c_str,
                "modis_detections": 0,
                "viirs_detections": 0,
                "total_detections": 0,
                "active_cells": set(),
                "total_frp_mw": 0.0,
            }
            curr += timedelta(days=1)

        for r in filtered_records:
            if r.acq_date in daily_series_map:
                entry = daily_series_map[r.acq_date]
                entry["total_detections"] += 1
                if r.sensor == "MODIS":
                    entry["modis_detections"] += 1
                elif r.sensor == "VIIRS":
                    entry["viirs_detections"] += 1
                entry["total_frp_mw"] += r.frp
                entry["active_cells"].add(r.grid_id or f"{r.latitude}_{r.longitude}")

        daily_time_series = [
            DailyTimeSeriesPoint(
                date=d_key,
                modis_detections=data["modis_detections"],
                viirs_detections=data["viirs_detections"],
                total_detections=data["total_detections"],
                active_cell_days=len(data["active_cells"]),
                total_frp_mw=round(data["total_frp_mw"], 2),
                is_missing_data=False,
            )
            for d_key, data in sorted(daily_series_map.items())
        ]

        # Harmonization processing if requested
        harmonization_metrics = None
        if req.mode == "harmonized":
            daily_dicts = [
                {
                    "date": pt.date,
                    "modis_count": pt.modis_detections,
                    "viirs_count": pt.viirs_detections,
                    "tile_id": aoi_key,
                }
                for pt in daily_time_series
            ]
            harmonized_values = empirical_harmonizer.harmonize_series(daily_dicts, region=aoi_key)
            for pt, h in zip(daily_time_series, harmonized_values):
                pt.harmonized_estimate = h.harmonized_estimate
                pt.uncertainty_lower = h.uncertainty_lower
                pt.uncertainty_upper = h.uncertainty_upper
                pt.calibration_status = h.calibration_status
                pt.provenance_note = h.provenance_note

            overlapping = [r for r in daily_dicts if r["modis_count"] > 0 and r["viirs_count"] > 0]
            val_results = empirical_harmonizer.run_cross_validation(overlapping)
            harmonization_metrics = {
                "model_version": empirical_harmonizer.version,
                "calibration_parameters": empirical_harmonizer.get_metadata().model_dump(),
                "validation": val_results.model_dump(),
            }

        # 8. Build monthly rhythm
        target_year = int(req.start_date[:4])
        monthly_rhythm = AggregationEngine.build_monthly_rhythm(filtered_records, target_year)

        # 9. Aggregate top active 0.1 degree grid cells
        grid_counts: Dict[str, Dict[str, Any]] = {}
        for r in filtered_records:
            gid = r.grid_id or self.grid.get_cell_id(r.latitude, r.longitude)
            if gid not in grid_counts:
                grid_counts[gid] = {
                    "total": 0,
                    "dates": set(),
                    "modis": 0,
                    "viirs": 0,
                    "frp_list": [],
                }
            g = grid_counts[gid]
            g["total"] += 1
            g["dates"].add(r.acq_date)
            if r.sensor == "MODIS":
                g["modis"] += 1
            elif r.sensor == "VIIRS":
                g["viirs"] += 1
            if r.frp > 0:
                g["frp_list"].append(r.frp)

        top_cells: List[GridCellAggregate] = []
        for gid, gdata in sorted(grid_counts.items(), key=lambda x: x[1]["total"], reverse=True)[:30]:
            clat, clon = self.grid.get_cell_center(gid)
            cbounds = self.grid.get_cell_bounds(gid)
            mean_frp = round(float(sum(gdata["frp_list"]) / len(gdata["frp_list"])), 2) if gdata["frp_list"] else None
            top_cells.append(
                GridCellAggregate(
                    grid_id=gid,
                    center_lat=clat,
                    center_lon=clon,
                    bbox=cbounds,
                    total_detections=gdata["total"],
                    active_days=len(gdata["dates"]),
                    sensor_breakdown={"MODIS": gdata["modis"], "VIIRS": gdata["viirs"]},
                    mean_frp_mw=mean_frp,
                )
            )

        # 10. Data Quality Report
        quality_report = AggregationEngine.evaluate_quality_and_gaps(
            records=filtered_records,
            start_date=req.start_date,
            end_date=req.end_date,
            sensors=req.sensors,
        )

        t_elapsed_ms = round((time.perf_counter() - t_start) * 1000, 2)

        response = AnalysisResponse(
            analysis_id=str(uuid.uuid4()),
            request=req,
            summary=summary,
            daily_time_series=daily_time_series,
            monthly_rhythm=monthly_rhythm,
            top_active_cells=top_cells,
            quality_report=quality_report,
            methodology_version=settings.METHODOLOGY_VERSION,
            harmonization_metrics=harmonization_metrics,
            computation_time_ms=t_elapsed_ms,
            is_cached=False,
        )

        # Save to cache
        cache_service.set(cache_key, response)
        return response


# Global analysis service instance
analysis_service = AnalysisService()
