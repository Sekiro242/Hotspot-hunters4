"""Scientific aggregation engine.

Calculates:
- Daily hotspot detection counts
- Active cell-days (unique [grid cell, date] pairs)
- 12-month seasonal rhythm
- Multi-year historical trends
- Date continuity tracking (distinguishing zero detections from missing data)
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import List, Dict, Any, Optional
import numpy as np

from app.core.constants import MONTH_NAMES
from app.models.observation import ObservationRecord
from app.models.calendar import MonthlyRhythmItem, HistoricalTrendItem
from app.models.quality import DataQualityReport, SensorQualityMetrics


class AggregationEngine:
    """Scientific aggregation calculations on normalized observations."""

    @staticmethod
    def build_monthly_rhythm(
        records: List[ObservationRecord],
        target_year: int,
    ) -> List[MonthlyRhythmItem]:
        """Aggregate observations into a 12-month annual rhythm with anomaly baselines."""
        # Initialize 12 months
        counts = [0] * 12
        cell_date_sets = [set() for _ in range(12)]
        active_dates_sets = [set() for _ in range(12)]

        for r in records:
            try:
                y = int(r.acq_date[:4])
                m = int(r.acq_date[5:7]) - 1  # 0 to 11
                if y == target_year and 0 <= m < 12:
                    counts[m] += 1
                    cell_date_sets[m].add((r.grid_id or f"{r.latitude}_{r.longitude}", r.acq_date))
                    active_dates_sets[m].add(r.acq_date)
            except (ValueError, IndexError):
                continue

        mean_val = float(np.mean(counts)) if any(counts) else 0.0
        # Unusual threshold: 1.3x annual monthly mean (aligned with scientific UI rules)
        unusual_threshold = mean_val * 1.3

        rhythm: List[MonthlyRhythmItem] = []
        for i in range(12):
            cnt = counts[i]
            ratio = round(cnt / mean_val, 2) if mean_val > 0 else 0.0
            rhythm.append(
                MonthlyRhythmItem(
                    month_index=i,
                    month_number=i + 1,
                    month_name=MONTH_NAMES[i],
                    month_abbr=MONTH_NAMES[i][:3].upper(),
                    detection_count=cnt,
                    active_cell_days=len(cell_date_sets[i]),
                    active_days=len(active_dates_sets[i]),
                    is_unusual=cnt > unusual_threshold and cnt > 5,
                    baseline_ratio=ratio,
                )
            )

        return rhythm

    @staticmethod
    def build_historical_trends(
        records: List[ObservationRecord],
        target_month: int,  # 1 to 12
        target_year: int,
        window_years: int = 6,
    ) -> List[HistoricalTrendItem]:
        """Build multi-year comparison for target month across preceding years."""
        years = [target_year - (window_years - 1) + i for i in range(window_years)]
        year_data: Dict[int, Dict[str, Any]] = {
            y: {"total": 0, "modis": 0, "viirs": 0, "cells": set()}
            for y in years
        }

        for r in records:
            try:
                y = int(r.acq_date[:4])
                m = int(r.acq_date[5:7])
                if y in year_data and m == target_month:
                    year_data[y]["total"] += 1
                    if r.sensor == "MODIS":
                        year_data[y]["modis"] += 1
                    elif r.sensor == "VIIRS":
                        year_data[y]["viirs"] += 1
                    year_data[y]["cells"].add((r.grid_id or f"{r.latitude}_{r.longitude}", r.acq_date))
            except (ValueError, IndexError):
                continue

        trends: List[HistoricalTrendItem] = []
        for y in years:
            data = year_data[y]
            # Determine data status based on sensor availability
            status = "available"
            if y < 2012:
                status = "modis_only (VIIRS begins 2012)"
            elif data["total"] == 0:
                status = "zero_or_unobserved"

            trends.append(
                HistoricalTrendItem(
                    year=y,
                    month=target_month,
                    detection_count=data["total"],
                    active_cell_days=len(data["cells"]),
                    modis_count=data["modis"],
                    viirs_count=data["viirs"],
                    data_status=status,
                )
            )

        return trends

    @staticmethod
    def evaluate_quality_and_gaps(
        records: List[ObservationRecord],
        start_date: str,
        end_date: str,
        sensors: List[str],
        known_ingested_dates: Optional[set[str]] = None,
    ) -> DataQualityReport:
        """Evaluate observation continuity, distinguishing missing dates from zero detections."""
        d_start = date.fromisoformat(start_date)
        d_end = date.fromisoformat(end_date)
        total_days = max(1, (d_end - d_start).days + 1)

        dates_with_data: set[str] = {r.acq_date for r in records}

        # Build sensor-specific breakdown
        sensor_metrics_map: Dict[str, SensorQualityMetrics] = {}
        for s in sensors:
            s_records = [r for r in records if r.sensor == s]
            s_dates = {r.acq_date for r in s_records}
            s_cells = {(r.grid_id, r.acq_date) for r in s_records}
            low_c = sum(1 for r in s_records if r.confidence_level == "low")
            nom_c = sum(1 for r in s_records if r.confidence_level == "nominal")
            high_c = sum(1 for r in s_records if r.confidence_level == "high")
            frps = [r.frp for r in s_records if r.frp > 0]

            nominal_res = 1000 if s == "MODIS" else 375
            sat_names = sorted(list({r.satellite for r in s_records})) or [s]

            sensor_metrics_map[s] = SensorQualityMetrics(
                sensor=s,
                satellite="/".join(sat_names),
                nominal_resolution_meters=nominal_res,
                total_detections=len(s_records),
                active_cell_days=len(s_cells),
                total_active_days=len(s_dates),
                low_confidence_count=low_c,
                nominal_confidence_count=nom_c,
                high_confidence_count=high_c,
                mean_frp_mw=round(float(np.mean(frps)), 2) if frps else None,
                max_frp_mw=round(float(np.max(frps)), 2) if frps else None,
            )

        # Distinguish missing days vs confirmed zero detections
        missing_dates: List[str] = []
        zero_activity_dates: List[str] = []

        curr = d_start
        while curr <= d_end:
            curr_str = curr.isoformat()
            if curr_str in dates_with_data:
                pass
            else:
                # If we know this date was ingested into the database, it's a confirmed zero.
                # Otherwise, it represents missing or unobserved data.
                if known_ingested_dates and curr_str in known_ingested_dates:
                    zero_activity_dates.append(curr_str)
                else:
                    missing_dates.append(curr_str)
            curr += timedelta(days=1)

        tiers = sorted(list({r.processing_type for r in records})) or ["NRT"]

        return DataQualityReport(
            requested_start_date=start_date,
            requested_end_date=end_date,
            total_days_in_range=total_days,
            days_with_data_present=len(dates_with_data),
            days_with_zero_detections=len(zero_activity_dates),
            days_missing_or_unobserved=len(missing_dates),
            missing_dates=missing_dates[:30],  # cap list length for readability
            zero_activity_dates=zero_activity_dates[:30],
            sensors_analyzed=sensors,
            sensor_metrics=sensor_metrics_map,
            processing_tiers_present=tiers,
            harmonization_status="uncalibrated_raw",
        )
