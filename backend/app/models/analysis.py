"""Analysis request and response models supporting synchronous queries and background jobs."""

from __future__ import annotations

from typing import List, Optional, Dict, Any, Literal
from pydantic import BaseModel, Field
from app.models.spatial import AOISpecification
from app.models.quality import DataQualityReport
from app.models.calendar import MonthlyRhythmItem


MetricType = Literal["detections", "active_cell_days", "frp_sum", "frp_mean"]
HarmonizationMode = Literal["raw", "harmonized"]


class AnalysisRequest(BaseModel):
    """Unified analysis query request."""
    aoi: AOISpecification = Field(default_factory=AOISpecification, description="Geographic area of interest")
    start_date: str = Field(description="Start date (YYYY-MM-DD)")
    end_date: str = Field(description="End date (YYYY-MM-DD)")
    sensors: List[Literal["MODIS", "VIIRS"]] = Field(default=["MODIS", "VIIRS"], description="Target sensors")
    metric: MetricType = Field(default="detections", description="Primary analysis metric")
    mode: HarmonizationMode = Field(default="raw", description="Analysis mode: raw uncalibrated or harmonized")
    grid_resolution_deg: Optional[float] = Field(default=0.1, description="Spatial aggregation resolution in degrees")


class DailyTimeSeriesPoint(BaseModel):
    date: str
    modis_detections: int = 0
    viirs_detections: int = 0
    total_detections: int = 0
    active_cell_days: int = 0
    total_frp_mw: float = 0.0
    is_missing_data: bool = False
    harmonized_estimate: Optional[float] = None
    uncertainty_lower: Optional[float] = None
    uncertainty_upper: Optional[float] = None
    calibration_status: Optional[str] = None
    provenance_note: Optional[str] = None


class GridCellAggregate(BaseModel):
    grid_id: str
    center_lat: float
    center_lon: float
    bbox: List[float] = Field(description="[west, south, east, north]")
    total_detections: int
    active_days: int
    sensor_breakdown: Dict[str, int]
    mean_frp_mw: Optional[float] = None


class AnalysisSummary(BaseModel):
    total_detections: int
    total_active_cell_days: int
    modis_detections: int
    viirs_detections: int
    total_frp_mw: float
    mean_daily_detections: float
    peak_date: Optional[str] = None
    peak_detections: int = 0


class AnalysisResponse(BaseModel):
    """Complete analysis response."""
    analysis_id: str
    request: AnalysisRequest
    summary: AnalysisSummary
    daily_time_series: List[DailyTimeSeriesPoint]
    monthly_rhythm: List[MonthlyRhythmItem]
    top_active_cells: List[GridCellAggregate] = Field(default_factory=list, description="Top active 0.1 deg cells")
    quality_report: DataQualityReport
    methodology_version: str
    harmonization_metrics: Optional[Dict[str, Any]] = None
    computation_time_ms: float
    is_cached: bool = False


class JobStatusResponse(BaseModel):
    """Status tracking for asynchronous background analysis or ingestion jobs."""
    job_id: str
    status: Literal["pending", "running", "completed", "failed"]
    progress: float = Field(ge=0.0, le=1.0, description="Progress fraction 0.0 to 1.0")
    created_at: str
    updated_at: str
    completed_at: Optional[str] = None
    error: Optional[str] = None
    result: Optional[AnalysisResponse] = None
