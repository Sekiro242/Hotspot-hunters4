"""Sensors metadata endpoint."""

from typing import Dict, Any, List
from fastapi import APIRouter

from app.core.constants import SENSOR_PLATFORMS

router = APIRouter(prefix="", tags=["Sensors"])


@router.get(
    "/sensors",
    summary="List supported satellite sensors and platform capabilities",
)
def get_sensors() -> Dict[str, Any]:
    """Retrieve detailed metadata for all supported satellite platforms.

    Includes:
    - MODIS Aqua & Terra
    - VIIRS Suomi-NPP, NOAA-20, NOAA-21
    - Nominal resolutions (1 km vs 375 m)
    - Available temporal archives
    - Native confidence representations
    """
    return {
        "sensors": [
            {
                "id": "MODIS",
                "name": "Moderate Resolution Imaging Spectroradiometer",
                "platforms": ["Terra", "Aqua"],
                "nominal_pixel_resolution_meters": 1000,
                "earliest_data": "2000-11-01",
                "confidence_metric": "numeric (0 - 100)",
                "description": "Historical 1 km thermal baseline operating aboard Terra and Aqua satellites.",
            },
            {
                "id": "VIIRS",
                "name": "Visible Infrared Imaging Radiometer Suite",
                "platforms": ["Suomi-NPP", "NOAA-20", "NOAA-21"],
                "nominal_pixel_resolution_meters": 375,
                "earliest_data": "2012-01-20",
                "confidence_metric": "categorical ('low', 'nominal', 'high')",
                "description": "High-resolution 375 m thermal sensor with enhanced small-fire sensitivity.",
            },
        ],
        "detailed_platforms": SENSOR_PLATFORMS,
        "harmonization_notice": (
            "MODIS and VIIRS have different pixel resolutions, detection algorithms, and overpass times. "
            "Raw detection counts cannot be directly compared without empirical calibration."
        ),
    }
