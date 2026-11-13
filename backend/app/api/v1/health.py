"""Health check endpoint."""

from typing import Dict, Any
from fastapi import APIRouter

from app.config import settings
from app.storage.parquet_store import ParquetStore
from app.services.cache_service import cache_service

router = APIRouter(prefix="", tags=["Health"])


@router.get(
    "/health",
    summary="Health check and storage statistics",
)
def get_health() -> Dict[str, Any]:
    """Return backend status, storage diagnostics, and cache performance."""
    store = ParquetStore()
    parquet_files = store.get_all_parquet_paths()

    return {
        "status": "healthy",
        "environment": settings.ENVIRONMENT,
        "firms_map_key_configured": settings.has_firms_key,
        "storage": {
            "processed_dir": str(settings.PROCESSED_DATA_DIR),
            "parquet_files_count": len(parquet_files),
        },
        "cache": {
            "entries_in_memory": len(cache_service._memory_cache),
            "stats": cache_service.stats,
        },
        "methodology_version": settings.METHODOLOGY_VERSION,
    }
