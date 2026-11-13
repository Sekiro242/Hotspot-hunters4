"""Performance benchmark suite for Burn Calendar backend.

Benchmarks:
1. Repeated identical AOI queries (evaluating deterministic cache performance)
2. Cached versus uncached execution latency
3. Small AOI vs Large AOI spatial query throughput
4. Short date range vs Long date range analytical scaling
"""

from __future__ import annotations

import time
from typing import Dict, Any, List
from starlette.testclient import TestClient

from app.main import app
from app.services.cache_service import cache_service


def run_benchmarks() -> Dict[str, Any]:
    client = TestClient(app)
    results: Dict[str, Any] = {}

    print("=" * 60)
    print("BURN CALENDAR PERFORMANCE BENCHMARKS")
    print("=" * 60)

    # 1 & 2: Cached vs Uncached Queries
    cache_service.invalidate_all()
    payload = {
        "aoi": {"region_preset": "amazon"},
        "start_date": "2026-11-06",
        "end_date": "2026-11-13",
        "sensors": ["MODIS", "VIIRS"],
        "metric": "detections",
    }

    # Run uncached query
    t0 = time.perf_counter()
    res1 = client.post("/api/v1/analyze", json=payload)
    t_uncached_ms = (time.perf_counter() - t0) * 1000

    # Run cached query
    t1 = time.perf_counter()
    res2 = client.post("/api/v1/analyze", json=payload)
    t_cached_ms = (time.perf_counter() - t1) * 1000

    speedup = round(t_uncached_ms / max(0.01, t_cached_ms), 1)
    results["cached_vs_uncached"] = {
        "uncached_ms": round(t_uncached_ms, 2),
        "cached_ms": round(t_cached_ms, 2),
        "speedup_factor": f"{speedup}x",
    }
    print(f"\n[1 & 2] CACHED VS UNCACHED LATENCY:")
    print(f"  Uncached: {t_uncached_ms:.2f} ms")
    print(f"  Cached:   {t_cached_ms:.2f} ms")
    print(f"  Speedup:  {speedup}x")

    # 3: Small AOI vs Large AOI
    cache_service.invalidate_all()
    # Small AOI (0.5 degree box in Amazon)
    small_payload = {
        "aoi": {"bbox": [-60.5, -10.5, -60.0, -10.0]},
        "start_date": "2026-11-06",
        "end_date": "2026-11-13",
    }
    t0 = time.perf_counter()
    r_small = client.post("/api/v1/analyze", json=small_payload)
    t_small_ms = (time.perf_counter() - t0) * 1000

    cache_service.invalidate_all()
    # Large AOI (Entire South America / Global)
    large_payload = {
        "aoi": {"region_preset": "global"},
        "start_date": "2026-11-06",
        "end_date": "2026-11-13",
    }
    t0 = time.perf_counter()
    r_large = client.post("/api/v1/analyze", json=large_payload)
    t_large_ms = (time.perf_counter() - t0) * 1000

    results["small_vs_large_aoi"] = {
        "small_aoi_ms": round(t_small_ms, 2),
        "small_aoi_detections": r_small.json()["summary"]["total_detections"],
        "large_aoi_ms": round(t_large_ms, 2),
        "large_aoi_detections": r_large.json()["summary"]["total_detections"],
    }
    print(f"\n[3] SMALL VS LARGE AOI:")
    print(f"  Small AOI (0.5 deg):  {t_small_ms:.2f} ms ({r_small.json()['summary']['total_detections']} detections)")
    print(f"  Large AOI (Global):   {t_large_ms:.2f} ms ({r_large.json()['summary']['total_detections']} detections)")

    # 4: Short vs Long Date Range
    cache_service.invalidate_all()
    short_payload = {
        "aoi": {"region_preset": "amazon"},
        "start_date": "2026-11-12",
        "end_date": "2026-11-12",  # 1 day
    }
    t0 = time.perf_counter()
    r_short = client.post("/api/v1/analyze", json=short_payload)
    t_short_ms = (time.perf_counter() - t0) * 1000

    cache_service.invalidate_all()
    long_payload = {
        "aoi": {"region_preset": "amazon"},
        "start_date": "2026-11-01",
        "end_date": "2026-11-13",  # 13 days
    }
    t0 = time.perf_counter()
    r_long = client.post("/api/v1/analyze", json=long_payload)
    t_long_ms = (time.perf_counter() - t0) * 1000

    results["short_vs_long_date_range"] = {
        "short_range_1day_ms": round(t_short_ms, 2),
        "long_range_13days_ms": round(t_long_ms, 2),
    }
    print(f"\n[4] SHORT VS LONG DATE RANGE:")
    print(f"  Short (1 day):   {t_short_ms:.2f} ms")
    print(f"  Long (13 days):  {t_long_ms:.2f} ms")
    print("=" * 60)

    return results


if __name__ == "__main__":
    run_benchmarks()
