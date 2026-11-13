# NASA FIRMS Ingestion Guide

This guide describes how to ingest active fire data from NASA FIRMS into the Burn Calendar backend.

---

## 1. NASA FIRMS Authentication

The backend supports authentication via a free NASA FIRMS `MAP_KEY`.

### Configuring the Map Key
1. Register for a free MAP_KEY at [NASA FIRMS API Portal](https://firms.modaps.eosdis.nasa.gov/api/).
2. Copy `.env.example` to `.env`:
   ```powershell
   Copy-Item .env.example .env
   ```
3. Set your key in `.env`:
   ```ini
   FIRMS_MAP_KEY=your_actual_32_character_map_key
   ```
4. Security Guarantee:
   The backend never logs, prints, serializes, or returns `FIRMS_MAP_KEY` in any API response or error message.

---

## 2. Ingestion Modes

### Mode A: Open Near-Real-Time (NRT) Feeds (Keyless)
NASA publishes global 24-hour and 7-day rolling CSV files that do not require an API key:
- **MODIS C6.1:** `MODIS_24h`, `MODIS_7d`
- **VIIRS NOAA-20 C2:** `VIIRS_NOAA20_24h`, `VIIRS_NOAA20_7d`
- **VIIRS NOAA-21 C2:** `VIIRS_NOAA21_24h`, `VIIRS_NOAA21_7d`
- **VIIRS Suomi-NPP C2:** `VIIRS_SNPP_24h`, `VIIRS_SNPP_7d`

#### Running NRT Ingestion via CLI:
```powershell
$env:PYTHONPATH="D:\Hotspot hunters2\backend"
python -m app.ingestion.ingest_pipeline
```

#### Running NRT Ingestion Programmatically:
```python
from app.ingestion.ingest_pipeline import IngestionPipeline

pipeline = IngestionPipeline()
# Download and ingest 7-day MODIS global observations
result = pipeline.ingest_nrt_feed("MODIS_7d")
print(result)
```

---

### Mode B: Targeted Spatial Queries via FIRMS API (Requires MAP_KEY)
For targeted bounding box queries across specific dates:

```python
from app.ingestion.ingest_pipeline import IngestionPipeline

pipeline = IngestionPipeline()
# Ingest 5 days of MODIS Near-Real-Time data over South America
result = pipeline.ingest_custom_firms_query(
    source="MODIS_NRT",
    west=-85.0,
    south=-57.0,
    east=-32.0,
    north=14.0,
    day_range=5,
    date="2026-11-10",
)
print(result)
```

---

### Mode C: Historical Archive Ingestion
For historical archives older than 7 days (downloaded via [FIRMS Archive Download Portal](https://firms.modaps.eosdis.nasa.gov/download/)):

1. Place downloaded CSV files into `data/raw/archive/`.
2. Run the archive loader:
```python
from pathlib import Path
from app.normalization.normalizer import FIRMSNormalizer
from app.storage.parquet_store import ParquetStore

store = ParquetStore()
csv_file = Path("data/raw/archive/fire_archive_M-C61_2023.csv")

# Process in chunks to prevent high memory usage
chunk_size = 50000
with open(csv_file, "r", encoding="utf-8") as f:
    header = f.readline()
    chunk_lines = []
    for line in f:
        chunk_lines.append(line)
        if len(chunk_lines) >= chunk_size:
            records = FIRMSNormalizer.parse_csv_stream(header + "".join(chunk_lines), default_sensor="MODIS", processing_type="ARCHIVE")
            store.write_records(records)
            chunk_lines = []
    if chunk_lines:
        records = FIRMSNormalizer.parse_csv_stream(header + "".join(chunk_lines), default_sensor="MODIS", processing_type="ARCHIVE")
        store.write_records(records)
```
