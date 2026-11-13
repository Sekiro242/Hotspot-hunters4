"""Configuration management for Burn Calendar backend.

Safely loads environment variables, ensures required directories exist,
and guarantees that sensitive credentials like FIRMS_MAP_KEY are never
printed, logged, or exposed.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    """Application settings with environment variable precedence."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # API Configuration
    PROJECT_NAME: str = "Burn Calendar Backend"
    API_V1_PREFIX: str = "/api/v1"
    ENVIRONMENT: str = "development"
    HOST: str = "127.0.0.1"
    PORT: int = 8000
    LOG_LEVEL: str = "INFO"

    # NASA FIRMS Integration
    # MAP_KEY must never be hardcoded, logged, or serialized in responses
    FIRMS_MAP_KEY: Optional[str] = Field(default=None, alias="FIRMS_MAP_KEY")
    FIRMS_BASE_URL: str = "https://firms.modaps.eosdis.nasa.gov"
    FIRMS_REQUEST_TIMEOUT_SECONDS: float = 30.0
    FIRMS_MAX_RETRIES: int = 3
    FIRMS_RETRY_BACKOFF_FACTOR: float = 1.5

    # Storage Paths
    BASE_DIR: Path = Field(default_factory=lambda: Path(__file__).resolve().parent.parent.parent)
    DATA_DIR: Path = Field(default_factory=lambda: Path("data"))
    CACHE_DIR: Path = Field(default_factory=lambda: Path("data/cache"))
    RAW_DATA_DIR: Path = Field(default_factory=lambda: Path("data/raw"))
    PROCESSED_DATA_DIR: Path = Field(default_factory=lambda: Path("data/processed"))

    # Caching
    CACHE_TTL_SECONDS: int = 86400  # 24 hours
    CACHE_MAX_ENTRIES: int = 1000

    # Scientific & Spatial Processing
    DEFAULT_GRID_RESOLUTION_DEGREE: float = 0.1  # 0.1 degree grid ~ 11 km
    MAX_SYNC_QUERY_DAYS: int = 366  # Queries longer than this run as background jobs

    # Methodology Versioning
    METHODOLOGY_VERSION: str = "0.1.0-uncalibrated"
    HARMONIZATION_STATUS: str = "uncalibrated_raw"

    def ensure_directories(self) -> None:
        """Create storage and cache directories if they do not exist."""
        self.DATA_DIR.mkdir(parents=True, exist_ok=True)
        self.CACHE_DIR.mkdir(parents=True, exist_ok=True)
        self.RAW_DATA_DIR.mkdir(parents=True, exist_ok=True)
        self.PROCESSED_DATA_DIR.mkdir(parents=True, exist_ok=True)

    @property
    def has_firms_key(self) -> bool:
        """Return True if a non-empty FIRMS_MAP_KEY is configured."""
        return bool(self.FIRMS_MAP_KEY and self.FIRMS_MAP_KEY.strip() and self.FIRMS_MAP_KEY != "your_nasa_firms_map_key_here")

    def __repr__(self) -> str:
        """Safe representation hiding secrets."""
        return f"Settings(environment={self.ENVIRONMENT}, has_firms_key={self.has_firms_key}, data_dir={self.DATA_DIR})"


# Global settings singleton
settings = Settings()
settings.ensure_directories()
