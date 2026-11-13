"""Tests for empirical harmonization model, uncertainty estimation, and cross-validation."""

import pytest
from app.harmonization.empirical_harmonizer import EmpiricalHarmonizer, TileCalibrationFactor


def test_empirical_harmonizer_fallback():
    """Uncalibrated tile falls back to global monthly median with is_fallback=True."""
    harmonizer = EmpiricalHarmonizer()
    factor = harmonizer.get_calibration_factor(tile_id="unseen_tile_99", month=8)

    assert factor.is_fallback is True
    assert factor.median_ratio > 1.5  # Typical VIIRS/MODIS median ratio
    assert factor.p10_ratio <= factor.median_ratio <= factor.p90_ratio


def test_fit_calibration_from_paired_samples():
    """Harmonizer calculates empirical median and percentiles from paired data."""
    harmonizer = EmpiricalHarmonizer()
    # Synthetic paired samples: VIIRS detects exactly 2.5x MODIS with small noise
    paired = [
        {"tile_id": "tile_A", "month": 8, "modis_count": 100, "viirs_count": 250},
        {"tile_id": "tile_A", "month": 8, "modis_count": 80, "viirs_count": 200},
        {"tile_id": "tile_A", "month": 8, "modis_count": 120, "viirs_count": 300},
        {"tile_id": "tile_A", "month": 8, "modis_count": 50, "viirs_count": 125},
        {"tile_id": "tile_A", "month": 8, "modis_count": 90, "viirs_count": 225},
    ]

    count = harmonizer.fit_calibration(paired)
    assert count == 1

    factor = harmonizer.get_calibration_factor(tile_id="tile_A", month=8)
    assert factor.is_fallback is False
    assert factor.median_ratio == 2.5
    assert factor.sample_count == 5


def test_harmonize_daily_point_viirs_only():
    """VIIRS-only day produces harmonized MODIS-equivalent estimate with uncertainty bounds."""
    harmonizer = EmpiricalHarmonizer()
    res = harmonizer.harmonize_daily_point(
        date_str="2026-08-15",
        modis_count=0,
        viirs_count=235,
        tile_id="global",
    )

    assert res.observed_viirs_detections == 235
    assert res.observed_modis_detections == 0
    assert res.harmonized_estimate is not None
    assert res.uncertainty_lower is not None
    assert res.uncertainty_upper is not None
    assert res.uncertainty_lower <= res.harmonized_estimate <= res.uncertainty_upper
    assert "Harmonized from VIIRS" in res.provenance_note


def test_harmonize_daily_point_modis_only():
    """MODIS-only day directly preserves observed MODIS as reference."""
    harmonizer = EmpiricalHarmonizer()
    res = harmonizer.harmonize_daily_point(
        date_str="2026-08-15",
        modis_count=100,
        viirs_count=0,
        tile_id="global",
    )

    assert res.harmonized_estimate == 100.0
    assert "Observed reference instrument (MODIS)" in res.provenance_note


def test_leave_one_period_out_validation():
    """Harmonizer cross-validation computes MAE, RMSE, and correlation."""
    harmonizer = EmpiricalHarmonizer()
    paired = [
        {"modis_count": 100, "viirs_count": 240},
        {"modis_count": 80, "viirs_count": 190},
        {"modis_count": 120, "viirs_count": 290},
        {"modis_count": 50, "viirs_count": 120},
        {"modis_count": 90, "viirs_count": 215},
        {"modis_count": 110, "viirs_count": 265},
    ]

    metrics = harmonizer.run_cross_validation(paired)
    assert metrics.total_samples_evaluated == 6
    assert metrics.mean_absolute_error >= 0.0
    assert metrics.root_mean_square_error >= 0.0
    assert metrics.predicted_vs_observed_correlation > 0.9
