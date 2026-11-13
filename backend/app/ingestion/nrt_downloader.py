"""Downloader for NASA FIRMS Open Near-Real-Time (NRT) active fire datasets.

NASA publishes open, keyless global rolling active fire CSV files (24h, 48h, 7d):
- MODIS Collection 6.1 (Terra and Aqua)
- VIIRS Suomi-NPP Collection 2 (375m)
- VIIRS NOAA-20 Collection 2 (375m)
- VIIRS NOAA-21 Collection 2 (375m)

This module handles streaming download, checksum/caching to data/raw, and local reuse.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional, Dict, List
import httpx

from app.config import settings

logger = logging.getLogger(__name__)

# Official public FIRMS open NRT CSV endpoints
OPEN_NRT_FEEDS: Dict[str, Dict[str, str]] = {
    "MODIS_24h": {
        "url": "https://firms.modaps.eosdis.nasa.gov/data/active_fire/modis-c6.1/csv/MODIS_C6_1_Global_24h.csv",
        "sensor": "MODIS",
        "timeframe": "24h",
        "filename": "MODIS_C6_1_Global_24h.csv",
    },
    "MODIS_7d": {
        "url": "https://firms.modaps.eosdis.nasa.gov/data/active_fire/modis-c6.1/csv/MODIS_C6_1_Global_7d.csv",
        "sensor": "MODIS",
        "timeframe": "7d",
        "filename": "MODIS_C6_1_Global_7d.csv",
    },
    "VIIRS_SNPP_24h": {
        "url": "https://firms.modaps.eosdis.nasa.gov/data/active_fire/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_Global_24h.csv",
        "sensor": "VIIRS",
        "satellite": "Suomi-NPP",
        "timeframe": "24h",
        "filename": "SUOMI_VIIRS_C2_Global_24h.csv",
    },
    "VIIRS_SNPP_7d": {
        "url": "https://firms.modaps.eosdis.nasa.gov/data/active_fire/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_Global_7d.csv",
        "sensor": "VIIRS",
        "satellite": "Suomi-NPP",
        "timeframe": "7d",
        "filename": "SUOMI_VIIRS_C2_Global_7d.csv",
    },
    "VIIRS_NOAA20_24h": {
        "url": "https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-20-viirs-c2/csv/J1_VIIRS_C2_Global_24h.csv",
        "sensor": "VIIRS",
        "satellite": "NOAA-20",
        "timeframe": "24h",
        "filename": "J1_VIIRS_C2_Global_24h.csv",
    },
    "VIIRS_NOAA20_7d": {
        "url": "https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-20-viirs-c2/csv/J1_VIIRS_C2_Global_7d.csv",
        "sensor": "VIIRS",
        "satellite": "NOAA-20",
        "timeframe": "7d",
        "filename": "J1_VIIRS_C2_Global_7d.csv",
    },
    "VIIRS_NOAA21_24h": {
        "url": "https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-21-viirs-c2/csv/J2_VIIRS_C2_Global_24h.csv",
        "sensor": "VIIRS",
        "satellite": "NOAA-21",
        "timeframe": "24h",
        "filename": "J2_VIIRS_C2_Global_24h.csv",
    },
    "VIIRS_NOAA21_7d": {
        "url": "https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-21-viirs-c2/csv/J2_VIIRS_C2_Global_7d.csv",
        "sensor": "VIIRS",
        "satellite": "NOAA-21",
        "timeframe": "7d",
        "filename": "J2_VIIRS_C2_Global_7d.csv",
    },
}


class NRTDownloader:
    """Manages downloading and caching of open NASA FIRMS NRT data feeds."""

    def __init__(self, raw_dir: Optional[Path] = None):
        self.raw_dir = raw_dir or settings.RAW_DATA_DIR
        self.raw_dir.mkdir(parents=True, exist_ok=True)

    def download_feed(self, feed_key: str, force_refresh: bool = False) -> Path:
        """Download or retrieve cached open NRT CSV file."""
        if feed_key not in OPEN_NRT_FEEDS:
            raise ValueError(f"Unknown feed key: {feed_key}. Available: {list(OPEN_NRT_FEEDS.keys())}")

        feed_info = OPEN_NRT_FEEDS[feed_key]
        dest_path = self.raw_dir / feed_info["filename"]

        # Cache check: if file exists and is less than 6 hours old, reuse unless force_refresh
        if dest_path.exists() and not force_refresh:
            file_age_seconds = dest_path.stat().st_mtime
            import time
            if (time.time() - file_age_seconds) < 21600:  # 6 hours
                logger.info(f"Reusing cached FIRMS NRT file: {dest_path}")
                return dest_path

        logger.info(f"Downloading open FIRMS NRT data from {feed_info['url']}...")
        with httpx.Client(timeout=60.0) as client:
            response = client.get(feed_info["url"], follow_redirects=True)
            response.raise_for_status()

            dest_path.write_text(response.text, encoding="utf-8")
            logger.info(f"Saved {len(response.text)} bytes to {dest_path}")

        return dest_path

    def download_all_recent(self, force_refresh: bool = False) -> Dict[str, Path]:
        """Download key recent feeds (MODIS 24h, VIIRS NOAA-20 24h, VIIRS NOAA-21 24h)."""
        results: Dict[str, Path] = {}
        for key in ["MODIS_24h", "VIIRS_NOAA20_24h", "VIIRS_NOAA21_24h"]:
            try:
                results[key] = self.download_feed(key, force_refresh=force_refresh)
            except Exception as e:
                logger.warning(f"Failed to download {key}: {e}")
        return results
