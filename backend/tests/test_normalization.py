"""Tests for schema normalization, sensor categorization, and validation."""

import pytest
from app.normalization.normalizer import (
    FIRMSNormalizer,
    normalize_confidence,
    normalize_satellite,
    normalize_acq_time,
    compute_grid_id,
)


def test_modis_confidence_normalization():
    """MODIS 0-100 numeric confidence maps to low, nominal, high."""
    val, level = normalize_confidence("15", "MODIS")
    assert val == 15 and level == "low"

    val, level = normalize_confidence("65", "MODIS")
    assert val == 65 and level == "nominal"

    val, level = normalize_confidence("95", "MODIS")
    assert val == 95 and level == "high"


def test_viirs_confidence_normalization():
    """VIIRS categorical confidence strings are preserved and categorized."""
    val, level = normalize_confidence("l", "VIIRS")
    assert val == "low" and level == "low"

    val, level = normalize_confidence("nominal", "VIIRS")
    assert val == "nominal" and level == "nominal"

    val, level = normalize_confidence("h", "VIIRS")
    assert val == "high" and level == "high"


def test_time_normalization():
    """Time string '0435' normalizes to '04:35'."""
    assert normalize_acq_time("0435") == "04:35"
    assert normalize_acq_time("435") == "04:35"
    assert normalize_acq_time("12:45") == "12:45"
    assert normalize_acq_time("0") == "00:00"


def test_satellite_normalization():
    """Platform codes map to standard names."""
    assert normalize_satellite("T", "MODIS") == "Terra"
    assert normalize_satellite("A", "MODIS") == "Aqua"
    assert normalize_satellite("N", "VIIRS") == "Suomi-NPP"
    assert normalize_satellite("N20", "VIIRS") == "NOAA-20"
    assert normalize_satellite("N21", "VIIRS") == "NOAA-21"


def test_invalid_coordinates_rejected():
    """Rows with coordinates outside [-90, 90] and [-180, 180] are rejected."""
    csv_data = """latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,confidence,version,bright_t31,frp,daynight
95.0,120.0,300.0,1.0,1.0,2026-11-12,0034,T,60,6.1,280.0,10.0,D
-10.0,200.0,300.0,1.0,1.0,2026-11-12,0034,T,60,6.1,280.0,10.0,D
-10.0,50.0,300.0,1.0,1.0,2026-11-12,0034,T,60,6.1,280.0,10.0,D
"""
    records = FIRMSNormalizer.parse_csv_stream(csv_data, default_sensor="MODIS")
    assert len(records) == 1
    assert records[0].latitude == -10.0
    assert records[0].longitude == 50.0


def test_deduplication_in_normalizer():
    """Duplicate rows in CSV stream produce only one unique ObservationRecord."""
    csv_data = """latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,confidence,version,bright_t31,frp,daynight
-10.5,50.5,300.0,1.0,1.0,2026-11-12,0034,T,60,6.1,280.0,10.0,D
-10.5,50.5,300.0,1.0,1.0,2026-11-12,0034,T,60,6.1,280.0,10.0,D
"""
    records = FIRMSNormalizer.parse_csv_stream(csv_data, default_sensor="MODIS")
    assert len(records) == 1


def test_grid_id_computation():
    """0.1-degree grid ID binning."""
    gid1 = compute_grid_id(-12.345, 54.678, resolution=0.1)
    assert gid1 == "-12.40_54.60"

    gid2 = compute_grid_id(0.05, 0.05, resolution=0.1)
    assert gid2 == "0.00_0.00"
