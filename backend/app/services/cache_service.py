"""Deterministic query caching service for spatial-temporal fire analysis.

Cache keys are computed using cryptographic SHA-256 hashes of:
- Canonical AOI bounds / geometry
- Date range (start_date, end_date)
- Sorted sensor list
- Metric and harmonization mode
- Methodology and calibration version
"""

from __future__ import annotations

import hashlib
import json
import logging
import time
from typing import Optional, Dict, Any
from app.config import settings

logger = logging.getLogger(__name__)


class CacheEntry:
    def __init__(self, data: Any, expires_at: float):
        self.data = data
        self.expires_at = expires_at

    @property
    def is_expired(self) -> bool:
        return time.time() > self.expires_at


class QueryCacheService:
    """In-memory and file-backed deterministic query caching."""

    def __init__(self, default_ttl_seconds: Optional[int] = None):
        self.default_ttl = default_ttl_seconds or settings.CACHE_TTL_SECONDS
        self._memory_cache: Dict[str, CacheEntry] = {}
        self.stats = {"hits": 0, "misses": 0, "sets": 0, "evictions": 0}

    @staticmethod
    def compute_cache_key(
        aoi_key: str,
        start_date: str,
        end_date: str,
        sensors: list[str],
        metric: str,
        mode: str,
        version: str = "v1",
    ) -> str:
        """Create a deterministic SHA-256 hash identifying the query."""
        payload = {
            "aoi": aoi_key,
            "start_date": start_date,
            "end_date": end_date,
            "sensors": sorted(sensors),
            "metric": metric,
            "mode": mode,
            "version": version,
        }
        serialized = json.dumps(payload, sort_keys=True)
        return hashlib.sha256(serialized.encode("utf-8")).hexdigest()

    def get(self, cache_key: str) -> Optional[Any]:
        """Retrieve cached result if present and not expired."""
        entry = self._memory_cache.get(cache_key)
        if not entry:
            self.stats["misses"] += 1
            return None

        if entry.is_expired:
            del self._memory_cache[cache_key]
            self.stats["evictions"] += 1
            self.stats["misses"] += 1
            return None

        self.stats["hits"] += 1
        return entry.data

    def set(self, cache_key: str, data: Any, ttl_seconds: Optional[int] = None) -> None:
        """Store query result in cache."""
        ttl = ttl_seconds or self.default_ttl
        expires_at = time.time() + ttl
        self._memory_cache[cache_key] = CacheEntry(data=data, expires_at=expires_at)
        self.stats["sets"] += 1

    def invalidate_all(self) -> int:
        """Clear all cached entries."""
        count = len(self._memory_cache)
        self._memory_cache.clear()
        return count


# Global cache instance
cache_service = QueryCacheService()
