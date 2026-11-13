"""Harmonization architecture and interface contracts.

SCIENTIFIC PRINCIPLE:
Reconciling MODIS 1 km and VIIRS 375 m thermal anomaly records requires
rigorous empirical calibration against overlapping overpass observations.
We define typed interfaces, metadata, and uncertainty structures without
inventing unvalidated calibration coefficients.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, List, Tuple
from pydantic import BaseModel, Field


class CalibrationParameters(BaseModel):
    """Explicit parameters defining a harmonization calibration model."""
    version: str = Field(description="Methodology and calibration parameter version")
    reference_sensor: str = Field(default="MODIS_AQUA", description="Baseline reference platform")
    target_sensor: str = Field(default="VIIRS_SNPP", description="Platform being normalized")
    overlap_start_year: int = Field(default=2012, description="Start year of sensor overlap period")
    overlap_end_year: int = Field(default=2024, description="End year of sensor overlap period")
    spatial_tile_degrees: float = Field(default=1.0, description="Spatial resolution for regional calibration")
    temporal_window: str = Field(default="calendar_month", description="Temporal grouping unit")
    statistic: str = Field(default="median_ratio", description="Primary scaling metric")
    uncertainty_percentiles: Tuple[float, float] = Field(default=(10.0, 90.0), description="Lower and upper error bounds")
    is_validated: bool = Field(default=False, description="True only after empirical leave-one-year-out validation")


class HarmonizedActivityValue(BaseModel):
    """Activity value with explicit provenance and uncertainty bounds."""
    date: str
    observed_modis_detections: int
    observed_viirs_detections: int
    harmonized_estimate: Optional[float] = None
    uncertainty_lower: Optional[float] = None
    uncertainty_upper: Optional[float] = None
    calibration_status: str = Field(
        default="uncalibrated_raw",
        description="'uncalibrated_raw', 'preliminary_calibrated', 'validated'"
    )
    provenance_note: str


class HarmonizationModel(ABC):
    """Abstract interface for sensor-to-sensor thermal anomaly harmonization."""

    @abstractmethod
    def get_metadata(self) -> CalibrationParameters:
        """Return explicit calibration model metadata and versioning."""
        pass

    @abstractmethod
    def harmonize_series(
        self,
        date_records: List[Dict[str, Any]],
        region: str,
    ) -> List[HarmonizedActivityValue]:
        """Transform raw sensor counts into harmonized series with uncertainty ranges."""
        pass
