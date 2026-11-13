"""Parquet storage manager for normalized satellite observations.

Layout:
data/processed/sensor={sensor}/year={year}/data.parquet

Features:
- Partition-aware storage (sensor, year)
- Deduplication on ingestion
- Columnar compression using PyArrow and Parquet
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import List, Optional, Set, Dict, Any
import pyarrow as pa
import pyarrow.parquet as pq

from app.config import settings
from app.models.observation import ObservationRecord

logger = logging.getLogger(__name__)

# Canonical PyArrow Schema for analytical storage
OBSERVATION_ARROW_SCHEMA = pa.schema([
    ("id", pa.string()),
    ("latitude", pa.float64()),
    ("longitude", pa.float64()),
    ("acq_date", pa.string()),
    ("acq_time", pa.string()),
    ("sensor", pa.string()),
    ("satellite", pa.string()),
    ("confidence", pa.string()),
    ("confidence_level", pa.string()),
    ("frp", pa.float64()),
    ("daynight", pa.string()),
    ("processing_type", pa.string()),
    ("source_product", pa.string()),
    ("grid_id", pa.string()),
    ("region", pa.string()),
])


class ParquetStore:
    """Manages reading and writing partitioned Parquet analytical files."""

    def __init__(self, processed_dir: Optional[Path] = None):
        self.processed_dir = processed_dir or settings.PROCESSED_DATA_DIR
        self.processed_dir.mkdir(parents=True, exist_ok=True)

    def _get_partition_path(self, sensor: str, year: int) -> Path:
        partition_dir = self.processed_dir / f"sensor={sensor}" / f"year={year}"
        partition_dir.mkdir(parents=True, exist_ok=True)
        return partition_dir / "data.parquet"

    def write_records(self, records: List[ObservationRecord]) -> int:
        """Write observation records into partitioned Parquet files with deduplication.

        Returns total number of records successfully written.
        """
        if not records:
            return 0

        # Group records by sensor and year
        grouped: Dict[tuple[str, int], List[ObservationRecord]] = {}
        for r in records:
            year = int(r.acq_date[:4])
            key = (r.sensor, year)
            if key not in grouped:
                grouped[key] = []
            grouped[key].append(r)

        total_written = 0

        for (sensor, year), rec_list in grouped.items():
            file_path = self._get_partition_path(sensor, year)

            existing_records: List[Dict[str, Any]] = []
            existing_ids: Set[str] = set()

            if file_path.exists():
                try:
                    table = pq.read_table(file_path)
                    existing_records = table.to_pylist()
                    existing_ids = {row["id"] for row in existing_records}
                except Exception as e:
                    logger.warning(f"Could not read existing parquet {file_path}: {e}")

            new_records = [
                {
                    "id": r.id,
                    "latitude": r.latitude,
                    "longitude": r.longitude,
                    "acq_date": r.acq_date,
                    "acq_time": r.acq_time,
                    "sensor": r.sensor,
                    "satellite": r.satellite,
                    "confidence": str(r.confidence),
                    "confidence_level": r.confidence_level,
                    "frp": r.frp,
                    "daynight": r.daynight,
                    "processing_type": r.processing_type,
                    "source_product": r.source_product,
                    "grid_id": r.grid_id or "",
                    "region": r.region or "global",
                }
                for r in rec_list
                if r.id not in existing_ids
            ]

            combined = existing_records + new_records
            if not combined:
                continue

            # Convert combined list of dicts to PyArrow Table
            table = pa.Table.from_pylist(combined, schema=OBSERVATION_ARROW_SCHEMA)
            pq.write_table(table, file_path, compression="snappy")
            total_written += len(new_records)
            logger.info(f"Updated {file_path}: {len(new_records)} new, {len(combined)} total records.")

        return total_written

    def get_all_parquet_paths(self) -> List[Path]:
        """List all valid data.parquet files in the store."""
        return list(self.processed_dir.glob("**/data.parquet"))
