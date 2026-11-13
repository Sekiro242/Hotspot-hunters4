"""DuckDB analytical query engine for partitioned Parquet observations.

Provides high-speed columnar filtering by:
- Spatial bounds (west, south, east, north)
- Date range (start_date, end_date)
- Sensor and satellite platforms
- Spatial grid cells (0.1 degree)
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import List, Optional, Dict, Any, Tuple
import duckdb

from app.config import settings
from app.models.observation import ObservationRecord
from app.storage.parquet_store import ParquetStore

logger = logging.getLogger(__name__)


class DuckDBEngine:
    """Manages embedded DuckDB queries across partitioned Parquet analytical datasets."""

    def __init__(self, store: Optional[ParquetStore] = None):
        self.store = store or ParquetStore()
        self._con = duckdb.connect(database=":memory:")

    def _get_parquet_pattern(self) -> Optional[str]:
        """Return glob pattern for Parquet files if any exist."""
        paths = self.store.get_all_parquet_paths()
        if not paths:
            return None
        # Normalize Windows path separators for DuckDB
        posix_dir = self.store.processed_dir.as_posix()
        return f"{posix_dir}/**/data.parquet"

    def query_observations(
        self,
        west: float,
        south: float,
        east: float,
        north: float,
        start_date: str,
        end_date: str,
        sensors: Optional[List[str]] = None,
        limit: int = 10000,
    ) -> List[ObservationRecord]:
        """Fetch raw observations within a bounding box and date range."""
        pattern = self._get_parquet_pattern()
        if not pattern:
            return []

        where_clauses = [
            f"latitude >= {south}",
            f"latitude <= {north}",
            f"longitude >= {west}",
            f"longitude <= {east}",
            f"acq_date >= '{start_date}'",
            f"acq_date <= '{end_date}'",
        ]

        if sensors:
            sensor_str = ", ".join(f"'{s}'" for s in sensors)
            where_clauses.append(f"sensor IN ({sensor_str})")

        query = f"""
            SELECT * FROM read_parquet('{pattern}', hive_partitioning=1)
            WHERE {' AND '.join(where_clauses)}
            ORDER BY acq_date ASC, acq_time ASC
            LIMIT {limit}
        """

        try:
            df = self._con.cursor().execute(query).fetchdf()
            records: List[ObservationRecord] = []
            for _, row in df.iterrows():
                # Reconstruct native confidence
                sensor = row["sensor"]
                conf_val = row["confidence"]
                if sensor == "MODIS":
                    try:
                        conf_val = int(conf_val)
                    except (ValueError, TypeError):
                        pass

                records.append(
                    ObservationRecord(
                        id=row["id"],
                        latitude=float(row["latitude"]),
                        longitude=float(row["longitude"]),
                        acq_date=str(row["acq_date"]),
                        acq_time=str(row["acq_time"]),
                        sensor=sensor,
                        satellite=str(row["satellite"]),
                        confidence=conf_val,
                        confidence_level=row["confidence_level"],
                        frp=float(row["frp"]),
                        daynight=row["daynight"],
                        processing_type=row["processing_type"],
                        source_product=row["source_product"],
                        grid_id=row["grid_id"],
                        region=row["region"],
                    )
                )
            return records
        except Exception as e:
            logger.error(f"DuckDB query error: {e}")
            return []

    def get_summary_metrics(
        self,
        west: float,
        south: float,
        east: float,
        north: float,
        start_date: str,
        end_date: str,
        sensors: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Compute aggregate summary metrics directly in DuckDB."""
        pattern = self._get_parquet_pattern()
        if not pattern:
            return {
                "total_detections": 0,
                "total_active_cell_days": 0,
                "modis_detections": 0,
                "viirs_detections": 0,
                "total_frp_mw": 0.0,
                "mean_daily_detections": 0.0,
                "peak_date": None,
                "peak_detections": 0,
            }

        where_clauses = [
            f"latitude >= {south}",
            f"latitude <= {north}",
            f"longitude >= {west}",
            f"longitude <= {east}",
            f"acq_date >= '{start_date}'",
            f"acq_date <= '{end_date}'",
        ]
        if sensors:
            sensor_str = ", ".join(f"'{s}'" for s in sensors)
            where_clauses.append(f"sensor IN ({sensor_str})")

        where_str = " AND ".join(where_clauses)

        query = f"""
            WITH base AS (
                SELECT * FROM read_parquet('{pattern}', hive_partitioning=1)
                WHERE {where_str}
            ),
            aggregates AS (
                SELECT
                    count(*) as total_detections,
                    count(DISTINCT (grid_id || '_' || acq_date)) as active_cell_days,
                    coalesce(sum(CASE WHEN sensor = 'MODIS' THEN 1 ELSE 0 END), 0) as modis_detections,
                    coalesce(sum(CASE WHEN sensor = 'VIIRS' THEN 1 ELSE 0 END), 0) as viirs_detections,
                    coalesce(sum(frp), 0.0) as total_frp_mw,
                    count(DISTINCT acq_date) as active_dates_count
                FROM base
            ),
            daily AS (
                SELECT acq_date, count(*) as day_count
                FROM base
                GROUP BY acq_date
                ORDER BY day_count DESC
                LIMIT 1
            )
            SELECT
                a.*,
                d.acq_date as peak_date,
                coalesce(d.day_count, 0) as peak_detections
            FROM aggregates a
            LEFT JOIN daily d ON 1=1
        """

        try:
            row = self._con.cursor().execute(query).fetchone()
            if not row or row[0] == 0:
                return {
                    "total_detections": 0,
                    "total_active_cell_days": 0,
                    "modis_detections": 0,
                    "viirs_detections": 0,
                    "total_frp_mw": 0.0,
                    "mean_daily_detections": 0.0,
                    "peak_date": None,
                    "peak_detections": 0,
                }

            total_det = int(row[0])
            active_cell_days = int(row[1])
            modis_det = int(row[2])
            viirs_det = int(row[3])
            frp_sum = float(row[4])
            active_dates_count = int(row[5])
            peak_date = str(row[6]) if row[6] else None
            peak_det = int(row[7]) if row[7] else 0

            from datetime import date
            d_start = date.fromisoformat(start_date)
            d_end = date.fromisoformat(end_date)
            total_days = max(1, (d_end - d_start).days + 1)
            mean_daily = round(total_det / total_days, 2)

            return {
                "total_detections": total_det,
                "total_active_cell_days": active_cell_days,
                "modis_detections": modis_det,
                "viirs_detections": viirs_det,
                "total_frp_mw": round(frp_sum, 2),
                "mean_daily_detections": mean_daily,
                "peak_date": peak_date,
                "peak_detections": peak_det,
            }
        except Exception as e:
            logger.error(f"DuckDB summary query failed: {e}")
            return {
                "total_detections": 0,
                "total_active_cell_days": 0,
                "modis_detections": 0,
                "viirs_detections": 0,
                "total_frp_mw": 0.0,
                "mean_daily_detections": 0.0,
                "peak_date": None,
                "peak_detections": 0,
            }

    def get_daily_time_series(
        self,
        west: float,
        south: float,
        east: float,
        north: float,
        start_date: str,
        end_date: str,
        sensors: Optional[List[str]] = None,
    ) -> List[Dict[str, Any]]:
        """Return daily detection counts, active cell-days, and FRP."""
        pattern = self._get_parquet_pattern()
        if not pattern:
            return []

        where_clauses = [
            f"latitude >= {south}",
            f"latitude <= {north}",
            f"longitude >= {west}",
            f"longitude <= {east}",
            f"acq_date >= '{start_date}'",
            f"acq_date <= '{end_date}'",
        ]
        if sensors:
            sensor_str = ", ".join(f"'{s}'" for s in sensors)
            where_clauses.append(f"sensor IN ({sensor_str})")

        query = f"""
            SELECT
                acq_date,
                sum(CASE WHEN sensor = 'MODIS' THEN 1 ELSE 0 END) as modis_count,
                sum(CASE WHEN sensor = 'VIIRS' THEN 1 ELSE 0 END) as viirs_count,
                count(*) as total_count,
                count(DISTINCT grid_id) as active_cell_days,
                coalesce(sum(frp), 0.0) as frp_sum
            FROM read_parquet('{pattern}', hive_partitioning=1)
            WHERE {' AND '.join(where_clauses)}
            GROUP BY acq_date
            ORDER BY acq_date ASC
        """
        try:
            df = self._con.cursor().execute(query).fetchdf()
            return df.to_dict(orient="records")
        except Exception as e:
            logger.error(f"DuckDB daily time series query failed: {e}")
            return []

    def get_grid_cell_aggregates(
        self,
        west: float,
        south: float,
        east: float,
        north: float,
        start_date: str,
        end_date: str,
        sensors: Optional[List[str]] = None,
        top_k: int = 50,
    ) -> List[Dict[str, Any]]:
        """Aggregate detections by 0.1 degree grid cell."""
        pattern = self._get_parquet_pattern()
        if not pattern:
            return []

        where_clauses = [
            f"latitude >= {south}",
            f"latitude <= {north}",
            f"longitude >= {west}",
            f"longitude <= {east}",
            f"acq_date >= '{start_date}'",
            f"acq_date <= '{end_date}'",
        ]
        if sensors:
            sensor_str = ", ".join(f"'{s}'" for s in sensors)
            where_clauses.append(f"sensor IN ({sensor_str})")

        query = f"""
            SELECT
                grid_id,
                count(*) as total_detections,
                count(DISTINCT acq_date) as active_days,
                sum(CASE WHEN sensor = 'MODIS' THEN 1 ELSE 0 END) as modis_detections,
                sum(CASE WHEN sensor = 'VIIRS' THEN 1 ELSE 0 END) as viirs_detections,
                coalesce(avg(frp), 0.0) as mean_frp_mw
            FROM read_parquet('{pattern}', hive_partitioning=1)
            WHERE {' AND '.join(where_clauses)}
            GROUP BY grid_id
            ORDER BY total_detections DESC
            LIMIT {top_k}
        """
        try:
            df = self._con.cursor().execute(query).fetchdf()
            return df.to_dict(orient="records")
        except Exception as e:
            logger.error(f"DuckDB grid cell query failed: {e}")
            return []
