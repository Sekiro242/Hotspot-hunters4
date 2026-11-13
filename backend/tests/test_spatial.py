"""Tests for spatial processing, Shapely geometry operations, and arbitrary AOIs."""

import pytest
from app.models.spatial import BoundingBox, AOISpecification
from app.spatial.geometry import GeometryEngine
from app.core.exceptions import InvalidGeometryError
from app.models.observation import ObservationRecord


def test_bounding_box_validation():
    """South > North must raise InvalidGeometryError."""
    with pytest.raises(InvalidGeometryError):
        BoundingBox(west=-60, south=10, east=-50, north=-5)

    valid_bbox = BoundingBox(west=-60, south=-10, east=-50, north=5)
    assert valid_bbox.west == -60
    assert valid_bbox.to_list() == [-60, -10, -50, 5]


def test_polygon_containment_and_exclusion():
    """Shapely point-in-polygon correctly separates interior from exterior points."""
    # Triangular AOI in Southern Hemisphere
    poly_geom = {
        "type": "Polygon",
        "coordinates": [
            [[10.0, -10.0], [20.0, -10.0], [15.0, 0.0], [10.0, -10.0]]
        ],
    }
    shape_obj = GeometryEngine.parse_geojson_to_shape(poly_geom)

    # Point clearly inside: [15.0, -5.0]
    rec_inside = ObservationRecord(
        id="inside_1",
        latitude=-5.0,
        longitude=15.0,
        acq_date="2026-11-12",
        acq_time="12:00",
        sensor="MODIS",
        satellite="Terra",
        confidence=80,
        confidence_level="high",
        frp=20.0,
        daynight="D",
        processing_type="NRT",
    )

    # Point outside triangle but inside bounding box: [11.0, -2.0]
    rec_outside = ObservationRecord(
        id="outside_1",
        latitude=-2.0,
        longitude=11.0,
        acq_date="2026-11-12",
        acq_time="12:00",
        sensor="MODIS",
        satellite="Terra",
        confidence=80,
        confidence_level="high",
        frp=15.0,
        daynight="D",
        processing_type="NRT",
    )

    records = [rec_inside, rec_outside]
    filtered = GeometryEngine.filter_records_by_geometry(
        records=records,
        geom_shape=shape_obj,
        is_exact_polygon=True,
    )

    assert len(filtered) == 1
    assert filtered[0].id == "inside_1"


def test_aoi_effective_bbox_derivation():
    """AOISpecification derives correct bounding envelope from Polygon coordinates."""
    poly_geom = {
        "type": "Polygon",
        "coordinates": [
            [[-70.0, -15.0], [-50.0, -15.0], [-50.0, -5.0], [-70.0, -5.0], [-70.0, -15.0]]
        ],
    }
    aoi = AOISpecification(geometry=poly_geom)
    bbox = aoi.get_effective_bbox()

    assert bbox.west == -70.0
    assert bbox.south == -15.0
    assert bbox.east == -50.0
    assert bbox.north == -5.0
