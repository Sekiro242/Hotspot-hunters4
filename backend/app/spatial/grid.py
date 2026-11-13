"""Spatial grid operations for 0.1-degree cell aggregation."""

from __future__ import annotations

import math
from typing import Tuple, List, Dict, Any


class SpatialGrid:
    """Configurable equal-angle spatial grid (default 0.1 degree ~ 11 km at equator)."""

    def __init__(self, resolution_deg: float = 0.1):
        self.resolution = resolution_deg

    def get_cell_id(self, latitude: float, longitude: float) -> str:
        """Derive grid cell string ID from coordinates."""
        lat_bin = math.floor(latitude / self.resolution) * self.resolution
        lon_bin = math.floor(longitude / self.resolution) * self.resolution
        return f"{lat_bin:.2f}_{lon_bin:.2f}"

    def get_cell_bounds(self, grid_id: str) -> List[float]:
        """Convert a grid ID 'lat_lon' into [west, south, east, north] bounding box."""
        parts = grid_id.split("_")
        if len(parts) != 2:
            return [0.0, 0.0, self.resolution, self.resolution]
        south = float(parts[0])
        west = float(parts[1])
        north = round(south + self.resolution, 4)
        east = round(west + self.resolution, 4)
        return [west, south, east, north]

    def get_cell_center(self, grid_id: str) -> Tuple[float, float]:
        """Convert a grid ID into (center_lat, center_lon)."""
        west, south, east, north = self.get_cell_bounds(grid_id)
        center_lat = round((south + north) / 2.0, 4)
        center_lon = round((west + east) / 2.0, 4)
        return center_lat, center_lon

    def cell_to_geojson_polygon(self, grid_id: str, properties: Dict[str, Any] = None) -> Dict[str, Any]:
        """Generate GeoJSON Polygon feature for a grid cell."""
        west, south, east, north = self.get_cell_bounds(grid_id)
        coords = [
            [
                [west, south],
                [east, south],
                [east, north],
                [west, north],
                [west, south],
            ]
        ]
        return {
            "type": "Feature",
            "id": grid_id,
            "geometry": {
                "type": "Polygon",
                "coordinates": coords,
            },
            "properties": properties or {"grid_id": grid_id},
        }
