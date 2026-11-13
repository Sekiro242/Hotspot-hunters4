"""Scientific constants, sensor specifications, and geographical presets."""

from typing import Dict, Any, List

# Supported sensors and their satellite platforms
# Crucial scientific distinction:
# MODIS active fire pixels are nominally 1 km at nadir.
# VIIRS active fire pixels (I-band 375m) are nominally 375 m at nadir.
SENSOR_PLATFORMS: Dict[str, Dict[str, Any]] = {
    "MODIS_TERRA": {
        "sensor": "MODIS",
        "satellite": "Terra",
        "instrument": "MODIS",
        "resolution_meters": 1000,
        "earliest_date": "2000-11-01",
        "confidence_scale": "0-100",
        "confidence_type": "numeric",
        "nrt_source": "MODIS_NRT",
        "sp_source": "MODIS_SP",
    },
    "MODIS_AQUA": {
        "sensor": "MODIS",
        "satellite": "Aqua",
        "instrument": "MODIS",
        "resolution_meters": 1000,
        "earliest_date": "2002-07-04",
        "confidence_scale": "0-100",
        "confidence_type": "numeric",
        "nrt_source": "MODIS_NRT",
        "sp_source": "MODIS_SP",
    },
    "VIIRS_SNPP": {
        "sensor": "VIIRS",
        "satellite": "Suomi-NPP",
        "instrument": "VIIRS",
        "resolution_meters": 375,
        "earliest_date": "2012-01-20",
        "confidence_scale": "categorical (low, nominal, high)",
        "confidence_type": "categorical",
        "nrt_source": "VIIRS_SNPP_NRT",
        "sp_source": "VIIRS_SNPP_SP",
    },
    "VIIRS_NOAA20": {
        "sensor": "VIIRS",
        "satellite": "NOAA-20",
        "instrument": "VIIRS",
        "resolution_meters": 375,
        "earliest_date": "2018-01-05",
        "confidence_scale": "categorical (low, nominal, high)",
        "confidence_type": "categorical",
        "nrt_source": "VIIRS_NOAA20_NRT",
        "sp_source": "VIIRS_NOAA20_SP",
    },
    "VIIRS_NOAA21": {
        "sensor": "VIIRS",
        "satellite": "NOAA-21",
        "instrument": "VIIRS",
        "resolution_meters": 375,
        "earliest_date": "2023-01-01",
        "confidence_scale": "categorical (low, nominal, high)",
        "confidence_type": "categorical",
        "nrt_source": "VIIRS_NOAA21_NRT",
        "sp_source": "VIIRS_NOAA21_NRT",
    },
}

# Predefined geographical presets aligning with frontend demo regions
# Each bounding box is in standard [min_lon, min_lat, max_lon, max_lat] order
PRESET_REGIONS: Dict[str, Dict[str, Any]] = {
    "amazon": {
        "id": "amazon",
        "name": "Amazon Basin",
        "center": [-59.0, -9.0],
        "bbox": [-67.0, -13.5, -51.0, -4.5],
        "description": "Amazon Basin tropical forest and agricultural transition zone",
    },
    "africa": {
        "id": "africa",
        "name": "Central Africa",
        "center": [23.0, -5.0],
        "bbox": [17.0, -11.5, 29.0, 1.5],
        "description": "Central African savanna and tropical fire belt",
    },
    "asia": {
        "id": "asia",
        "name": "Southeast Asia",
        "center": [102.0, 18.0],
        "bbox": [98.0, 14.0, 106.0, 22.0],
        "description": "Southeast Asia seasonal agricultural burning landscape",
    },
    "australia": {
        "id": "australia",
        "name": "Australia",
        "center": [133.0, -23.0],
        "bbox": [124.5, -28.5, 141.5, -17.5],
        "description": "Northern and central Australian arid savanna burning cycle",
    },
    "med": {
        "id": "med",
        "name": "Mediterranean",
        "center": [19.0, 39.0],
        "bbox": [10.0, 37.0, 28.0, 41.0],
        "description": "Mediterranean Basin summer dry fire regime",
    },
    "global": {
        "id": "global",
        "name": "Global",
        "center": [0.0, 0.0],
        "bbox": [-180.0, -90.0, 180.0, 90.0],
        "description": "Global planet-wide thermal observations",
    },
}

# Month names matching frontend
MONTH_NAMES: List[str] = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
]
