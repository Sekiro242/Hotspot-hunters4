"""Tests for aggregation engine: active cell-days, daily rollups, monthly rhythm, and date gaps."""

import pytest
from app.aggregation.engine import AggregationEngine
from app.models.observation import ObservationRecord


def create_sample_observation(obs_id: str, date: str, grid_id: str, sensor: str = "MODIS"):
    return ObservationRecord(
        id=obs_id,
        latitude=-10.0,
        longitude=20.0,
        acq_date=date,
        acq_time="10:00",
        sensor=sensor,  # type: ignore
        satellite="Terra",
        confidence=75,
        confidence_level="nominal",
        frp=12.5,
        daynight="D",
        processing_type="NRT",
        grid_id=grid_id,
    )


def test_active_cell_days_multiple_detections_same_cell():
    """Multiple detections in the same grid cell on the same date count as ONE active cell-day."""
    records = [
        create_sample_observation("obs1", "2026-11-10", "cell_A"),
        create_sample_observation("obs2", "2026-11-10", "cell_A"),  # Same cell, same date
        create_sample_observation("obs3", "2026-11-10", "cell_B"),  # Different cell, same date
        create_sample_observation("obs4", "2026-11-11", "cell_A"),  # Same cell, different date
    ]

    rhythm = AggregationEngine.build_monthly_rhythm(records, target_year=2026)
    nov_item = rhythm[10]  # November (index 10)

    assert nov_item.detection_count == 4
    # Cell A on 11-10, Cell B on 11-10, Cell A on 11-11 => exactly 3 unique (cell, date) pairs
    assert nov_item.active_cell_days == 3


def test_monthly_rhythm_identifies_unusual_period():
    """Month with counts > 1.3x annual monthly mean is flagged as unusual."""
    records = []
    # 10 detections each in Jan-Nov
    for m in range(1, 12):
        for i in range(10):
            records.append(create_sample_observation(f"obs_{m}_{i}", f"2026-{m:02d}-05", "cell_1"))

    # December has 50 detections (substantially > mean)
    for i in range(50):
        records.append(create_sample_observation(f"obs_12_{i}", "2026-12-05", "cell_1"))

    rhythm = AggregationEngine.build_monthly_rhythm(records, target_year=2026)
    dec_item = rhythm[11]

    assert dec_item.detection_count == 50
    assert dec_item.is_unusual is True


def test_distinguish_missing_data_from_zero_detections():
    """Evaluation distinguishes known zero-detection dates from unobserved dates."""
    records = [
        create_sample_observation("obs1", "2026-11-01", "cell_1"),
        create_sample_observation("obs2", "2026-11-03", "cell_1"),
    ]

    # Date 2026-11-02 was ingested with zero detections
    known_dates = {"2026-11-01", "2026-11-02", "2026-11-03"}

    report = AggregationEngine.evaluate_quality_and_gaps(
        records=records,
        start_date="2026-11-01",
        end_date="2026-11-04",
        sensors=["MODIS"],
        known_ingested_dates=known_dates,
    )

    assert report.total_days_in_range == 4
    assert report.days_with_data_present == 2
    assert "2026-11-02" in report.zero_activity_dates
    assert "2026-11-04" in report.missing_dates
