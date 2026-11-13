"""Geometry operations using Shapely.

Handles arbitrary polygons, multi-polygons, bounding boxes,
and precise point-in-polygon spatial filtering.
"""

from __future__ import annotations

from typing import List, Dict, Any, Optional
from shapely.geometry import box, shape, Point, Polygon, MultiPolygon
from shapely.prepared import prep
from shapely.validation import make_valid

from app.core.exceptions import InvalidGeometryError
from app.models.spatial import BoundingBox, AOISpecification
from app.models.observation import ObservationRecord


class GeometryEngine:
    """Manages Shapely spatial geometries for AOI filtering."""

    @staticmethod
    def bbox_to_polygon(bbox: BoundingBox) -> Polygon:
        """Create a Shapely Polygon from a BoundingBox."""
        return box(bbox.west, bbox.south, bbox.east, bbox.north)

    @staticmethod
    def parse_geojson_to_shape(geom_dict: Dict[str, Any]) -> Any:
        """Parse a GeoJSON geometry dict into a valid Shapely shape."""
        try:
            geom = shape(geom_dict)
            if not geom.is_valid:
                geom = make_valid(geom)
            if not isinstance(geom, (Polygon, MultiPolygon)):
                raise InvalidGeometryError(f"Expected Polygon or MultiPolygon, got {geom.geom_type}")
            return geom
        except Exception as e:
            raise InvalidGeometryError(f"Failed to parse GeoJSON geometry: {e}")

    @staticmethod
    def build_aoi_geometry(aoi: AOISpecification) -> Tuple[Any, BoundingBox]:
        """Build a prepared Shapely geometry and its bounding box envelope."""
        effective_bbox = aoi.get_effective_bbox()

        if aoi.geometry:
            geom_dict = aoi.geometry if isinstance(aoi.geometry, dict) else aoi.geometry.model_dump()
            geom_shape = GeometryEngine.parse_geojson_to_shape(geom_dict)
        else:
            geom_shape = GeometryEngine.bbox_to_polygon(effective_bbox)

        return geom_shape, effective_bbox

    @staticmethod
    def filter_records_by_geometry(
        records: List[ObservationRecord],
        geom_shape: Any,
        is_exact_polygon: bool = False,
    ) -> List[ObservationRecord]:
        """Filter observations using exact point-in-polygon containment."""
        if not is_exact_polygon:
            return records

        prepared_shape = prep(geom_shape)
        filtered: List[ObservationRecord] = []
        for r in records:
            pt = Point(r.longitude, r.latitude)
            if prepared_shape.contains(pt) or prepared_shape.covers(pt):
                filtered.append(r)

        return filtered
