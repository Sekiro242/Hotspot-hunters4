"""Data quality and provenance models.

Enforces clear scientific distinction:
- A missing observation date does NOT equal zero fire activity.
- Hotspot count != confirmed fire event or burned area.
- MODIS 1 km vs VIIRS 375 m confidence values are not interchangeable.
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class SensorQualityMetrics(BaseModel):
    sensor: str = Field(description="Sensor name (MODIS, VIIRS)")
    satellite: str = Field(description="Satellite platform")
    nominal_resolution_meters: int = Field(description="Nadir spatial resolution in meters")
    total_detections: int = Field(default=0, description="Total hotspot pixel detections")
    active_cell_days: int = Field(default=0, description="Distinct (0.1 deg cell, date) pairs with detections")
    total_active_days: int = Field(default=0, description="Dates with >= 1 detection")
    low_confidence_count: int = Field(default=0)
    nominal_confidence_count: int = Field(default=0)
    high_confidence_count: int = Field(default=0)
    mean_frp_mw: Optional[float] = Field(default=None, description="Average Fire Radiative Power (MW)")
    max_frp_mw: Optional[float] = Field(default=None, description="Maximum Fire Radiative Power (MW)")


class DataQualityReport(BaseModel):
    """Scientific quality, completeness, and limitation assessment for an analysis."""
    requested_start_date: str
    requested_end_date: str
    total_days_in_range: int
    days_with_data_present: int
    days_with_zero_detections: int
    days_missing_or_unobserved: int
    missing_dates: List[str] = Field(default_factory=list, description="Dates where data stream was missing or not yet ingested")
    zero_activity_dates: List[str] = Field(default_factory=list, description="Dates with confirmed satellite coverage but 0 detections")
    sensors_analyzed: List[str]
    sensor_metrics: Dict[str, SensorQualityMetrics] = Field(default_factory=dict)
    processing_tiers_present: List[str] = Field(default_factory=list, description="e.g. ['NRT', 'STANDARD']")
    known_limitations: List[str] = Field(
        default_factory=lambda: [
            "Hotspot detections represent thermally anomalous satellite pixels, not confirmed fire incidents or burned area.",
            "Heavy cloud cover, dense smoke, and heavy canopy cover can obscure surface thermal anomalies.",
            "MODIS active-fire pixels are nominally 1 km at nadir; VIIRS active-fire pixels are nominally 375 m at nadir.",
            "Native confidence scales (MODIS 0-100 numeric vs VIIRS low/nominal/high) reflect different detection algorithms.",
            "Missing observation dates indicate gaps in data availability and must not be interpreted as zero fire activity.",
        ]
    )
    harmonization_status: str = Field(
        default="uncalibrated_raw",
        description="Indicates whether observations are raw, normalized, or empirically calibrated.",
    )
