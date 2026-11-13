"""Data normalization and validation pipeline for NASA FIRMS observations.

Normalizes sensor-specific differences:
- MODIS (numeric 0-100 confidence) vs VIIRS (categorical low/nominal/high)
- Satellite platform codes ('T'/'A'/'N'/'N20'/'N21')
- Time format normalization (HHMM -> HH:MM)
- Coordinate boundary validation
- 0.1-degree spatial grid cell assignment
"""

from __future__ import annotations

import csv
import io
import math
from typing import List, Dict, Any, Optional, Tuple, Iterator
import logging

from app.models.observation import ObservationRecord, ProcessingType, SensorType

logger = logging.getLogger(__name__)


def compute_grid_id(latitude: float, longitude: float, resolution: float = 0.1) -> str:
    """Compute deterministic grid cell identifier from WGS84 coordinates."""
    lat_bin = math.floor(latitude / resolution) * resolution
    lon_bin = math.floor(longitude / resolution) * resolution
    return f"{lat_bin:.2f}_{lon_bin:.2f}"


def normalize_satellite(raw_sat: str, sensor: SensorType) -> str:
    """Map raw satellite identifier to canonical platform name."""
    s = str(raw_sat).strip().upper()
    if sensor == "MODIS":
        if s in ("T", "TERRA"):
            return "Terra"
        if s in ("A", "AQUA"):
            return "Aqua"
        return "Terra" if "T" in s else "Aqua"
    else:  # VIIRS
        if s in ("N", "SNPP", "SUOMI-NPP", "NPP"):
            return "Suomi-NPP"
        if s in ("1", "N20", "NOAA-20", "JPSS-1", "J1"):
            return "NOAA-20"
        if s in ("2", "N21", "NOAA-21", "JPSS-2", "J2"):
            return "NOAA-21"
        return "Suomi-NPP"


def normalize_confidence(raw_conf: Any, sensor: SensorType) -> Tuple[Any, str]:
    """Normalize sensor confidence, returning (native_confidence, harmonized_level).

    Harmonized level is one of: 'low', 'nominal', 'high'.
    """
    conf_str = str(raw_conf).strip().lower()

    if sensor == "MODIS":
        try:
            val = int(float(conf_str))
            val = max(0, min(100, val))
            if val < 30:
                level = "low"
            elif val < 80:
                level = "nominal"
            else:
                level = "high"
            return val, level
        except (ValueError, TypeError):
            return 50, "nominal"
    else:  # VIIRS
        if conf_str in ("h", "high"):
            return "high", "high"
        elif conf_str in ("l", "low"):
            return "low", "low"
        else:
            return "nominal", "nominal"


def normalize_acq_time(raw_time: Any) -> str:
    """Normalize acquisition time to HH:MM format."""
    t_str = str(raw_time).strip()
    if ":" in t_str and len(t_str) == 5:
        return t_str
    # Standard FIRMS 4-digit time like 0435 -> 04:35
    t_clean = t_str.replace(":", "").zfill(4)
    if len(t_clean) >= 4:
        return f"{t_clean[:2]}:{t_clean[2:4]}"
    return "00:00"


class FIRMSNormalizer:
    """Transforms raw CSV streams from MODIS or VIIRS into typed ObservationRecords."""

    @staticmethod
    def parse_csv_stream(
        csv_content: str,
        default_sensor: Optional[SensorType] = None,
        processing_type: ProcessingType = "NRT",
        source_product: str = "FIRMS",
        region_hint: str = "global",
    ) -> List[ObservationRecord]:
        """Parse raw CSV text into validated ObservationRecords."""
        if not csv_content or not csv_content.strip():
            return []

        f = io.StringIO(csv_content.strip())
        reader = csv.DictReader(f)
        records: List[ObservationRecord] = []
        seen_ids = set()

        for row in reader:
            record = FIRMSNormalizer.normalize_row(
                row=row,
                default_sensor=default_sensor,
                processing_type=processing_type,
                source_product=source_product,
                region_hint=region_hint,
            )
            if record and record.id not in seen_ids:
                seen_ids.add(record.id)
                records.append(record)

        return records

    @staticmethod
    def normalize_row(
        row: Dict[str, Any],
        default_sensor: Optional[SensorType] = None,
        processing_type: ProcessingType = "NRT",
        source_product: str = "FIRMS",
        region_hint: str = "global",
    ) -> Optional[ObservationRecord]:
        """Normalize a single raw dictionary row."""
        try:
            # 1. Coordinate validation
            lat_raw = row.get("latitude") or row.get("lat")
            lon_raw = row.get("longitude") or row.get("lon")
            if lat_raw is None or lon_raw is None:
                return None

            latitude = float(lat_raw)
            longitude = float(lon_raw)

            # Strict WGS84 range check
            if not (-90.0 <= latitude <= 90.0 and -180.0 <= longitude <= 180.0):
                return None

            # 2. Date and Time
            acq_date = str(row.get("acq_date") or row.get("acquisitionDate") or "").strip()
            if len(acq_date) != 10 or acq_date[4] != "-" or acq_date[7] != "-":
                return None

            acq_time = normalize_acq_time(row.get("acq_time") or row.get("acquisitionTime") or "0000")

            # 3. Sensor & Satellite detection
            inst = str(row.get("instrument") or "").strip().upper()
            if "VIIRS" in inst or "bright_ti4" in row or "bright_ti5" in row:
                sensor: SensorType = "VIIRS"
            elif "MODIS" in inst or "bright_t31" in row:
                sensor = "MODIS"
            elif default_sensor:
                sensor = default_sensor
            else:
                sensor = "MODIS"

            satellite = normalize_satellite(row.get("satellite") or "Terra", sensor)

            # 4. Confidence
            raw_conf = row.get("confidence")
            confidence, confidence_level = normalize_confidence(raw_conf, sensor)

            # 5. Fire Radiative Power (MW)
            frp_raw = row.get("frp")
            try:
                frp = max(0.0, float(frp_raw)) if frp_raw is not None else 0.0
            except (ValueError, TypeError):
                frp = 0.0

            # 6. Day/Night indicator
            dn_raw = str(row.get("daynight") or "D").strip().upper()
            daynight = "N" if dn_raw == "N" else "D"

            # 7. Grid ID
            grid_id = compute_grid_id(latitude, longitude, resolution=0.1)

            # 8. Deterministic unique observation ID
            obs_id = f"{sensor}-{satellite[:3]}-{acq_date}-{acq_time.replace(':', '')}-{latitude:.4f}-{longitude:.4f}"

            return ObservationRecord(
                id=obs_id,
                latitude=round(latitude, 5),
                longitude=round(longitude, 5),
                acq_date=acq_date,
                acq_time=acq_time,
                sensor=sensor,
                satellite=satellite,
                confidence=confidence,
                confidence_level=confidence_level,
                frp=round(frp, 2),
                daynight=daynight,
                processing_type=processing_type,
                source_product=source_product,
                grid_id=grid_id,
                region=region_hint,
            )

        except Exception as e:
            logger.debug(f"Row normalization failed: {e}")
            return None
