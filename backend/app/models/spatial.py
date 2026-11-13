"""Spatial models and geometry validators for Area of Interest (AOI) specifications."""

from __future__ import annotations

from typing import List, Optional, Union, Dict, Any, Literal
from pydantic import BaseModel, Field, model_validator
from app.core.exceptions import InvalidGeometryError
from app.core.constants import PRESET_REGIONS


class BoundingBox(BaseModel):
    """Bounding box defined as [west, south, east, north] in decimal degrees."""
    west: float = Field(ge=-180.0, le=180.0, description="Minimum longitude")
    south: float = Field(ge=-90.0, le=90.0, description="Minimum latitude")
    east: float = Field(ge=-180.0, le=180.0, description="Maximum longitude")
    north: float = Field(ge=-90.0, le=90.0, description="Maximum latitude")

    @model_validator(mode="after")
    def validate_bounds(self) -> BoundingBox:
        if self.south > self.north:
            raise InvalidGeometryError(f"South latitude ({self.south}) cannot exceed North latitude ({self.north}).")
        return self

    def to_list(self) -> List[float]:
        return [self.west, self.south, self.east, self.north]

    def to_firms_str(self) -> str:
        """Format as west,south,east,north string for FIRMS API."""
        return f"{self.west},{self.south},{self.east},{self.north}"

    @classmethod
    def from_list(cls, coords: List[float]) -> BoundingBox:
        if len(coords) != 4:
            raise InvalidGeometryError("Bounding box must contain exactly 4 coordinates [west, south, east, north].")
        return cls(west=coords[0], south=coords[1], east=coords[2], north=coords[3])


class GeoJSONPolygonGeometry(BaseModel):
    """GeoJSON Polygon geometry structure."""
    type: Literal["Polygon", "MultiPolygon"]
    coordinates: List[Any]


class AOISpecification(BaseModel):
    """Area of interest input: preset region, bounding box, or GeoJSON polygon."""
    region_preset: Optional[str] = Field(default=None, description="Preset name: amazon, africa, asia, australia, med, global")
    bbox: Optional[Union[BoundingBox, List[float]]] = Field(default=None, description="[west, south, east, north]")
    geometry: Optional[Union[GeoJSONPolygonGeometry, Dict[str, Any]]] = Field(default=None, description="GeoJSON Polygon geometry")

    @model_validator(mode="after")
    def resolve_and_validate(self) -> AOISpecification:
        # If bbox is given as a list of floats, parse it into BoundingBox
        if isinstance(self.bbox, list):
            self.bbox = BoundingBox.from_list(self.bbox)

        # If region preset is provided, validate and load bbox if not set
        if self.region_preset:
            reg_id = self.region_preset.lower().strip()
            if reg_id not in PRESET_REGIONS:
                available = ", ".join(PRESET_REGIONS.keys())
                raise InvalidGeometryError(f"Unknown region preset '{self.region_preset}'. Available: {available}")
            if not self.bbox and not self.geometry:
                self.bbox = BoundingBox.from_list(PRESET_REGIONS[reg_id]["bbox"])

        # Ensure at least one AOI definition exists
        if not self.region_preset and not self.bbox and not self.geometry:
            # Default to global if none specified
            self.region_preset = "global"
            self.bbox = BoundingBox.from_list(PRESET_REGIONS["global"]["bbox"])

        return self

    def get_effective_bbox(self) -> BoundingBox:
        """Derive the bounding envelope for spatial pre-filtering."""
        if self.bbox:
            if isinstance(self.bbox, list):
                return BoundingBox.from_list(self.bbox)
            return self.bbox

        if self.geometry:
            coords = self.geometry.get("coordinates") if isinstance(self.geometry, dict) else self.geometry.coordinates
            all_lons: List[float] = []
            all_lats: List[float] = []

            def _extract(c: Any) -> None:
                if isinstance(c, (list, tuple)) and len(c) == 2 and isinstance(c[0], (int, float)):
                    all_lons.append(float(c[0]))
                    all_lats.append(float(c[1]))
                elif isinstance(c, (list, tuple)):
                    for item in c:
                        _extract(item)

            _extract(coords)
            if not all_lons or not all_lats:
                raise InvalidGeometryError("Unable to extract valid coordinates from GeoJSON polygon.")
            return BoundingBox(
                west=min(all_lons),
                south=min(all_lats),
                east=max(all_lons),
                north=max(all_lats)
            )

        return BoundingBox.from_list(PRESET_REGIONS["global"]["bbox"])
