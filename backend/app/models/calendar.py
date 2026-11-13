"""Calendar data structures for seasonal rhythm, historical trends, and unusual periods."""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class MonthlyRhythmItem(BaseModel):
    """Represents a single month's hotspot detection metrics in an annual cycle."""
    month_index: int = Field(ge=0, le=11, description="0-indexed month (0=Jan, 11=Dec)")
    month_number: int = Field(ge=1, le=12, description="1-indexed month (1=Jan, 12=Dec)")
    month_name: str = Field(description="Full month name (e.g. 'August')")
    month_abbr: str = Field(description="Three-letter month abbreviation (e.g. 'AUG')")
    detection_count: int = Field(ge=0, description="Total hotspot pixel detections")
    active_cell_days: int = Field(ge=0, description="Active (grid cell, day) occurrences")
    active_days: int = Field(ge=0, description="Number of days in month with >=1 detection")
    is_unusual: bool = Field(default=False, description="True if detection count exceeds statistical baseline threshold")
    baseline_ratio: Optional[float] = Field(default=None, description="Ratio relative to seasonal baseline mean")


class HistoricalTrendItem(BaseModel):
    """Represents activity for a specific month across multiple historical years."""
    year: int = Field(description="Calendar year")
    month: int = Field(ge=1, le=12, description="Month number")
    detection_count: int = Field(ge=0, description="Total hotspot pixel detections")
    active_cell_days: int = Field(ge=0, description="Active cell-days")
    modis_count: int = Field(default=0)
    viirs_count: int = Field(default=0)
    data_status: str = Field(default="available", description="'available', 'partial', 'unavailable'")


class CalendarResponse(BaseModel):
    """Complete calendar response matching frontend expectations."""
    year: int
    selected_month: int = Field(ge=0, le=11, description="0-indexed month")
    region: str
    sensors: List[str]
    monthly_rhythm: List[MonthlyRhythmItem]
    historical_trends: List[HistoricalTrendItem]
    annual_total_detections: int
    annual_active_cell_days: int
    average_monthly_detections: float
    unusual_period_threshold: float
    quality_notes: List[str] = Field(default_factory=list)
