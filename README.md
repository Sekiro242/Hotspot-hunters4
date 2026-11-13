# Burn Calendar (NASA Space Apps Challenge 2026)

**Global Geospatial Fire-Activity Analysis Platform Harmonizing MODIS and VIIRS Satellite Observations**

---

## Architecture Overview

Burn Calendar consists of:
1. **Python Analytical Backend (`backend/`):**
   - **FastAPI:** Versioned REST API (`/api/v1/*`) with synchronous endpoints and asynchronous background jobs.
   - **DuckDB & Apache Parquet:** High-performance columnar storage and queries partitioned by `sensor={sensor}/year={year}/`.
   - **Shapely:** Precise spatial containment and arbitrary polygon AOI intersection.
   - **Ingestion Pipeline:** Automated ingestion of real NASA FIRMS active fire feeds (MODIS C6.1, VIIRS Suomi-NPP, NOAA-20, NOAA-21).
   - **Deterministic Query Caching:** Sub-10ms response times for repeated queries.
2. **Interactive Web Frontend (`Hotspot-hunters/`):**
   - **Vite 7, React 19, TypeScript:** Modern client interface.
   - **MapLibre GL JS:** 3D WebGL globe and Mercator map with split-screen sensor comparisons and GPU-accelerated clusters and heatmaps.
   - **Activity Calendar:** 12-month annual rhythm and 6-year historical trends.

---

## Quickstart

### 1. Prerequisites
- Python 3.10+ (tested with Python 3.14)
- Node.js 20+ (tested with Node 24)

### 2. Backend Setup & Startup

1. **Install Python dependencies:**
   ```powershell
   pip install -r backend/requirements.txt
   ```

2. **Configure Environment Variables:**
   ```powershell
   Copy-Item .env.example .env
   ```
   *(Optional: Set your `FIRMS_MAP_KEY` in `.env` if you have one from NASA FIRMS. If unset, the backend uses open NRT data feeds).*

3. **Ingest Real NASA FIRMS Active Fire Data:**
   ```powershell
   $env:PYTHONPATH="backend"
   python -m app.ingestion.ingest_pipeline
   ```

4. **Start the FastAPI Server:**
   ```powershell
   $env:PYTHONPATH="backend"
   uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
   ```
   - OpenAPI Documentation: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
   - Health Endpoint: [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health)

### 3. Frontend Startup

In a separate terminal:
```powershell
cd Hotspot-hunters
npm install
npm run dev
```
Open [http://127.0.0.1:5173](http://127.0.0.1:5173).

---

## Testing & Benchmarks

### Run Automated Backend Tests (Pytest)
```powershell
$env:PYTHONPATH="backend"
python -m pytest backend/tests -v
```
*Result: 33/33 tests passing.*

### Run Performance Benchmarks
```powershell
$env:PYTHONPATH="backend"
python backend/benchmarks/benchmark_performance.py
```
*Result: 58.7x cache speedup (489 ms uncached -> 8.35 ms cached).*

### Run Frontend Tests
```powershell
cd Hotspot-hunters
npm test
```

---

## Documentation

- [Technical Assessment](docs/TECHNICAL_ASSESSMENT.md)
- [Backend Architecture](docs/ARCHITECTURE.md)
- [Data Schema & Storage Layout](docs/DATA_SCHEMA.md)
- [NASA FIRMS Ingestion Guide](docs/INGESTION_GUIDE.md)
- [Performance Benchmarks](docs/BENCHMARKS.md)
