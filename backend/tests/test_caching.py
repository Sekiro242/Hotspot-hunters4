"""Tests for deterministic query caching and invalidation."""

from app.services.cache_service import QueryCacheService


def test_deterministic_cache_key_generation():
    """Identical parameters generate identical SHA-256 keys; different parameters generate distinct keys."""
    key1 = QueryCacheService.compute_cache_key(
        aoi_key="amazon",
        start_date="2026-11-01",
        end_date="2026-11-13",
        sensors=["MODIS", "VIIRS"],
        metric="detections",
        mode="raw",
    )
    # Sensor order should not affect key
    key2 = QueryCacheService.compute_cache_key(
        aoi_key="amazon",
        start_date="2026-11-01",
        end_date="2026-11-13",
        sensors=["VIIRS", "MODIS"],
        metric="detections",
        mode="raw",
    )
    assert key1 == key2

    # Different date produces different key
    key3 = QueryCacheService.compute_cache_key(
        aoi_key="amazon",
        start_date="2026-11-02",
        end_date="2026-11-13",
        sensors=["MODIS", "VIIRS"],
        metric="detections",
        mode="raw",
    )
    assert key1 != key3

    # Different AOI produces different key
    key4 = QueryCacheService.compute_cache_key(
        aoi_key="africa",
        start_date="2026-11-01",
        end_date="2026-11-13",
        sensors=["MODIS", "VIIRS"],
        metric="detections",
        mode="raw",
    )
    assert key1 != key4


def test_cache_set_get_and_invalidation():
    """Cache correctly stores, retrieves, and invalidates entries."""
    cache = QueryCacheService(default_ttl_seconds=3600)
    key = "test_key_123"

    assert cache.get(key) is None
    assert cache.stats["misses"] == 1

    cache.set(key, {"result": 42})
    assert cache.get(key) == {"result": 42}
    assert cache.stats["hits"] == 1

    cleared = cache.invalidate_all()
    assert cleared == 1
    assert cache.get(key) is None
