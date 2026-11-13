"""Tests for FastAPI API v1 endpoints and contracts."""

import pytest
from starlette.testclient import TestClient


def test_health_endpoint(client: TestClient):
    """GET /health returns 200 OK and diagnostic metadata."""
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert "storage" in data
    assert "cache" in data


def test_sensors_endpoint(client: TestClient):
    """GET /api/v1/sensors returns supported sensors."""
    res = client.get("/api/v1/sensors")
    assert res.status_code == 200
    data = res.json()
    assert "sensors" in data
    sensor_names = [s["id"] for s in data["sensors"]]
    assert "MODIS" in sensor_names
    assert "VIIRS" in sensor_names


def test_methodology_endpoint(client: TestClient):
    """GET /api/v1/methodology returns methodology metadata."""
    res = client.get("/api/v1/methodology")
    assert res.status_code == 200
    data = res.json()
    assert "spatial_framework" in data
    assert "harmonization_roadmap" in data


def test_sync_analyze_endpoint(client: TestClient):
    """POST /api/v1/analyze returns valid analysis response."""
    payload = {
        "aoi": {"region_preset": "amazon"},
        "start_date": "2026-11-06",
        "end_date": "2026-11-13",
        "sensors": ["MODIS", "VIIRS"],
        "metric": "detections",
    }
    res = client.post("/api/v1/analyze", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "summary" in data
    assert "daily_time_series" in data
    assert "monthly_rhythm" in data
    assert "quality_report" in data
    assert data["is_cached"] is False

    # Second call should be cached
    res2 = client.post("/api/v1/analyze", json=payload)
    assert res2.status_code == 200
    assert res2.json()["is_cached"] is True


def test_async_analyze_job_workflow(client: TestClient):
    """POST /api/v1/analyze?async_mode=true returns 202 and tracks job to completion."""
    import time

    payload = {
        "aoi": {"region_preset": "med"},
        "start_date": "2026-11-06",
        "end_date": "2026-11-13",
    }
    res = client.post("/api/v1/analyze?async_mode=true", json=payload)
    assert res.status_code == 202
    data = res.json()
    assert "job_id" in data
    job_id = data["job_id"]

    # Poll status endpoint
    time.sleep(0.5)
    status_res = client.get(f"/api/v1/analysis/{job_id}")
    assert status_res.status_code == 200
    status_data = status_res.json()
    assert status_data["status"] in ("running", "completed")
    if status_data["status"] == "completed":
        assert status_data["result"] is not None


def test_calendar_endpoint(client: TestClient):
    """GET /api/v1/calendar returns 12-month rhythm and historical trends."""
    res = client.get("/api/v1/calendar?year=2026&month=10&region=amazon")
    assert res.status_code == 200
    data = res.json()
    assert len(data["monthly_rhythm"]) == 12
    assert len(data["historical_trends"]) == 6
    assert data["selected_month"] == 10


def test_summary_endpoint(client: TestClient):
    """GET /api/v1/summary returns summary counts."""
    res = client.get("/api/v1/summary?region=amazon&start_date=2026-11-06&end_date=2026-11-13")
    assert res.status_code == 200
    data = res.json()
    assert "total_detections" in data
    assert "total_active_cell_days" in data


def test_quality_endpoint(client: TestClient):
    """GET /api/v1/quality returns data quality metrics."""
    res = client.get("/api/v1/quality?region=amazon&start_date=2026-11-06&end_date=2026-11-13")
    assert res.status_code == 200
    data = res.json()
    assert "total_days_in_range" in data
    assert "known_limitations" in data


def test_map_geojson_endpoint(client: TestClient):
    """GET /api/v1/map/geojson returns GeoJSON FeatureCollection."""
    res = client.get("/api/v1/map/geojson?region=amazon&year=2026&month=10&limit=10")
    assert res.status_code == 200
    data = res.json()
    assert data["type"] == "FeatureCollection"
    assert "features" in data


def test_download_csv_endpoint(client: TestClient):
    """GET /api/v1/download/csv streams CSV content."""
    res = client.get("/api/v1/download/csv?region=amazon&start_date=2026-11-06&end_date=2026-11-13&limit=5")
    assert res.status_code == 200
    assert "text/csv" in res.headers["content-type"]
    assert "latitude,longitude" in res.text


def test_invalid_date_range_validation(client: TestClient):
    """Start date after end date returns 422 Unprocessable Entity."""
    payload = {
        "aoi": {"region_preset": "amazon"},
        "start_date": "2026-11-20",
        "end_date": "2026-11-10",
    }
    res = client.post("/api/v1/analyze", json=payload)
    assert res.status_code == 422


def test_nonexistent_job_id_returns_404(client: TestClient):
    """Querying an unknown job ID returns 404."""
    res = client.get("/api/v1/analysis/nonexistent-id-999")
    assert res.status_code == 404
