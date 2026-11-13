"""Ingestion pipeline orchestrating data retrieval, normalization, and Parquet storage."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional, Dict, Any, List
import time

from app.config import settings
from app.ingestion.nrt_downloader import NRTDownloader, OPEN_NRT_FEEDS
from app.ingestion.firms_client import NASA_FIRMS_Client
from app.normalization.normalizer import FIRMSNormalizer
from app.storage.parquet_store import ParquetStore
from app.models.observation import ObservationRecord

logger = logging.getLogger(__name__)


class IngestionPipeline:
    """Manages downloading, normalizing, and storing NASA FIRMS observations."""

    def __init__(self, store: Optional[ParquetStore] = None):
        self.store = store or ParquetStore()
        self.downloader = NRTDownloader()
        self.firms_client = NASA_FIRMS_Client()

    def ingest_nrt_feed(self, feed_key: str, force_refresh: bool = False) -> Dict[str, Any]:
        """Download and ingest a specific open NASA FIRMS NRT feed."""
        t_start = time.perf_counter()
        logger.info(f"Starting ingestion for feed: {feed_key}")

        csv_path = self.downloader.download_feed(feed_key, force_refresh=force_refresh)
        content = csv_path.read_text(encoding="utf-8")

        feed_meta = OPEN_NRT_FEEDS[feed_key]
        default_sensor = feed_meta["sensor"]

        records = FIRMSNormalizer.parse_csv_stream(
            csv_content=content,
            default_sensor=default_sensor,  # type: ignore
            processing_type="NRT",
            source_product=f"FIRMS_NRT_{feed_key}",
        )

        written_count = self.store.write_records(records)
        elapsed = round(time.perf_counter() - t_start, 2)

        summary = {
            "feed": feed_key,
            "raw_file": str(csv_path),
            "parsed_records": len(records),
            "written_records": written_count,
            "elapsed_seconds": elapsed,
        }
        logger.info(f"Ingestion complete for {feed_key}: {summary}")
        return summary

    def ingest_recent_real_data(self) -> Dict[str, Any]:
        """Ingest real NASA active fire data across MODIS and VIIRS platforms."""
        results = {}
        for feed in ["MODIS_24h", "VIIRS_NOAA20_24h"]:
            try:
                res = self.ingest_nrt_feed(feed)
                results[feed] = res
            except Exception as e:
                logger.error(f"Failed to ingest {feed}: {e}")
                results[feed] = {"error": str(e)}

        return results

    def ingest_custom_firms_query(
        self,
        source: str,
        west: float,
        south: float,
        east: float,
        north: float,
        day_range: int = 1,
        date: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Query FIRMS API using MAP_KEY and ingest resulting observations."""
        t_start = time.perf_counter()
        raw_csv = self.firms_client.get_area_csv(
            source=source,
            west=west,
            south=south,
            east=east,
            north=north,
            day_range=day_range,
            date=date,
        )

        sensor_hint = "MODIS" if "MODIS" in source else "VIIRS"
        records = FIRMSNormalizer.parse_csv_stream(
            csv_content=raw_csv,
            default_sensor=sensor_hint,  # type: ignore
            processing_type="NRT" if "NRT" in source else "STANDARD",
            source_product=f"FIRMS_API_{source}",
        )

        written_count = self.store.write_records(records)
        elapsed = round(time.perf_counter() - t_start, 2)

        return {
            "source": source,
            "records_parsed": len(records),
            "records_written": written_count,
            "elapsed_seconds": elapsed,
        }


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    pipeline = IngestionPipeline()
    pipeline.ingest_recent_real_data()
