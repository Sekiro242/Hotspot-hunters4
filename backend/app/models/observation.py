"""Observation schemas and GeoJSON serialization models.

Compatible with the frontend's Observation type while preserving scientific
provenance, native sensor confidence, and satellite platform distinctions.
"""

from __future__ import annotations

from typing import Union, Optional, Literal, Dict, Any, List
from pydantic import BaseModel, Field, ConfigDict


SensorType = Literal["MODIS", "VIIRS"]
DayNightType = Literal["D", "N"]
ProcessingType = Literal["NRT", "STANDARD", "SYNTHETIC", "ARCHIVE"]


class ObservationRecord(BaseModel):
    """Internal canonical observation record representing a single thermal anomaly detection."""
    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(description="Unique observation identifier")
    latitude: float = Field(ge=-90.0, le=90.0, description="WGS84 latitude")
    longitude: float = Field(ge=-180.0, le=180.0, description="WGS84 longitude")
    acq_date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$", description="Acquisition date (YYYY-MM-DD)")
    acq_time: str = Field(description="Acquisition time (HH:MM or HHMM in UTC)")
    sensor: SensorType = Field(description="Instrument: MODIS or VIIRS")
    satellite: str = Field(description="Platform: Terra, Aqua, Suomi-NPP, NOAA-20, NOAA-21")
    confidence: Union[int, str] = Field(description="Native sensor confidence: 0-100 for MODIS, low/nominal/high for VIIRS")
    confidence_level: Literal["low", "nominal", "high"] = Field(description="Harmonized categorical confidence classification")
    frp: float = Field(ge=0.0, description="Fire Radiative Power in Megawatts (MW)")
    daynight: DayNightType = Field(description="Day (D) or Night (N) overpass")
    processing_type: ProcessingType = Field(default="NRT", description="Processing quality tier")
    source_product: str = Field(default="FIRMS_API", description="Originating product stream")
    grid_id: Optional[str] = Field(default=None, description="0.1 degree spatial grid cell identifier")
    region: Optional[str] = Field(default="global", description="Associated region identifier")

    def to_frontend_dict(self) -> Dict[str, Any]:
        """Serialize into exact camelCase structure expected by frontend components."""
        return {
            "id": self.id,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "acquisitionDate": self.acq_date,
            "acquisitionTime": self.acq_time,
            "sensor": self.sensor,
            "satellite": self.satellite,
            "confidence": self.confidence,
            "frp": self.frp,
            "daynight": self.daynight,
            "processingType": self.processing_type,
            "region": self.region or "global",
            # Additional scientific attributes
            "confidenceLevel": self.confidence_level,
            "gridId": self.grid_id,
            "sourceProduct": self.source_product,
        }

    def to_geojson_feature(self) -> Dict[str, Any]:
        """Convert into a GeoJSON Feature suitable for MapLibre GL rendering."""
        return {
            "type": "Feature",
            "id": self.id,
            "geometry": {
                "type": "Point",
                "coordinates": [self.longitude, self.latitude],
            },
            "properties": self.to_frontend_dict(),
        }


class GeoJSONPoint(BaseModel):
    type: Literal["Point"] = "Point"
    coordinates: List[float] = Field(description="[longitude, latitude]")


class GeoJSONFeature(BaseModel):
    type: Literal["Feature"] = "Feature"
    id: str
    geometry: GeoJSONPoint
    properties: Dict[str, Any]


class GeoJSONFeatureCollection(BaseModel):
    type: Literal["FeatureCollection"] = "FeatureCollection"
    features: List[GeoJSONFeature]
    metadata: Optional[Dict[str, Any]] = None
