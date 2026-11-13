# Burn Calendar: Technical Assessment & Backend Architectural Plan

**Project:** Burn Calendar (NASA Space Apps Challenge 2026)  
**Author:** Senior Backend Engineer & Software Architect  
**Date:** November 2026  

---

## 1. What Already Exists

### Frontend Application (`Hotspot-hunters/`)
* **Framework & Tooling:** Vite 7, React 19, TypeScript 5.9, MapLibre GL JS 6.17.
* **Map & 3D Visualization:** `Earth.tsx` manages a WebGL globe and Mercator canvas with GPU layers for detections (`points`), sensor halos (`halos`), spatial clusters (`cluster-points`), and thermal density (`heat`). Supports synchronized dual-map split-screen comparison between sensors.
* **Component Views:**
  * **Entry Scene:** Atmospheric hero view introducing the planetary thermal record.
  * **Explore Scene:** Interactive globe with preset regions (Amazon Basin, Central Africa, Southeast Asia, Australia, Mediterranean) and global view.
  * **Time Scene (`Calendar.tsx`):** 12-month annual rhythm ribbon, 6-year historical trend bar chart, and unusual periods (>1.3× mean) view.
  * **Compare Scene:** Side-by-side synchronized comparison of MODIS (1 km) vs VIIRS (375 m).
  * **Science Scene (`Science.tsx`):** 4-stage pedagogical walkthrough explaining pixel resolution differences, satellite sampling biases, and harmonization principles.
* **Data Layer (`src/data/observations.ts`):**
  * Client-side deterministic synthetic generator (`demoAdapter.year()`, `demoAdapter.select()`, `demoAdapter.monthly()`).
  * `Observation` interface: `id`, `latitude`, `longitude`, `acquisitionDate`, `acquisitionTime`, `sensor`, `satellite`, `confidence`, `frp`, `daynight`, `processingType`, `region`.
  * Helper `geojson(data)` converting observation arrays into GeoJSON FeatureCollections.
* **Test Suite:** Node test runner with `tests/data.test.ts` (deterministic checks, VIIRS pre-2012 absence, filter integrity) and Playwright browser visual tests.

---

## 2. What the Frontend Needs from the Backend

1. **Analytical Observation Feeds:** Real NASA FIRMS observations adhering to the `Observation` schema and GeoJSON FeatureCollection format for rendering on MapLibre GL.
2. **Temporal & Seasonal Aggregations:**
   * Monthly activity rollups for any given year, sensor selection, and geographic AOI.
   * Multi-year historical trends for any selected month across historical years (2000–2026).
   * Statistical baseline calculations (mean, standard deviation, percentile thresholds) to identify truly unusual burning periods rather than synthetic multipliers.
3. **Sensor-Specific Representation:**
   * Preservation of native confidence metrics (MODIS 0–100 integer vs VIIRS nominal/low/high).
   * Attribution of satellite platforms: MODIS (Terra, Aqua) and VIIRS (Suomi-NPP, NOAA-20, NOAA-21).
   * Handling of temporal availability (MODIS available from 2000; Suomi-NPP from 2012; NOAA-20 from 2018; NOAA-21 from 2023).
4. **Arbitrary Spatial AOI Ingestion & Analysis:** Support for custom bounding boxes and polygon boundaries beyond the 5 demo presets.
5. **Data Quality & Provenance:** Clear reporting of observation status (NRT vs Standard Processing), sensor footprint differences, and distinction between "zero detected hotspots" and "missing data / satellite gap".
6. **Data Export:** CSV export endpoint for researchers and environmental monitors.

---

## 3. What is Missing

1. **Backend Infrastructure:** No Python server, API routing, configuration management, or background task processor.
2. **NASA FIRMS Ingestion Layer:**
   * No FIRMS REST API client with `MAP_KEY` authentication, request retry with exponential backoff, rate limiting, and availability checks.
   * No open Near-Real-Time (NRT) ingestion pipeline for daily/weekly active fire feeds.
   * No bulk/archive ingestion pipeline with chunked processing for multi-year historical records.
3. **Analytical Storage & Query Engine:**
   * No Parquet partitioned storage (partitioned by sensor, year, and date).
   * No DuckDB analytical query layer for high-speed columnar filtering and aggregation.
4. **Spatial Processing Engine:**
   * No Shapely polygon intersection and point-in-polygon filtering for arbitrary AOIs.
   * No 0.1° spatial grid assignment and active cell-days computation.
5. **Performance & Caching:**
   * No deterministic query cache for AOI + date + sensor combinations.
   * No asynchronous background job manager for large ingestion or heavy spatial queries.
6. **Harmonization Architecture:**
   * No formal calibration contract, versioning schema, or uncertainty model for reconciling MODIS 1 km and VIIRS 375 m detections.

---

## 4. Proposed Backend Architecture

We adopt a modular monolith architecture built on Python 3.14, FastAPI, DuckDB, Apache Parquet, Shapely, and Pydantic:

```
backend/
├── app/
│   ├── main.py                  # FastAPI entry point, lifespan, CORS, middleware
│   ├── config.py                # Environment & settings (FIRMS_MAP_KEY, paths, limits)
│   ├── api/v1/                  # Versioned API routes
│   │   ├── analyze.py           # POST /api/v1/analyze & GET /api/v1/analysis/{id}
│   │   ├── calendar.py          # GET /api/v1/calendar
│   │   ├── summary.py           # GET /api/v1/summary
│   │   ├── seasonality.py       # GET /api/v1/seasonality
│   │   ├── sensors.py           # GET /api/v1/sensors
│   │   ├── quality.py           # GET /api/v1/quality
│   │   ├── map.py               # GET /api/v1/map/geojson & /map/tiles
│   │   ├── download.py          # GET /api/v1/download/csv
│   │   └── methodology.py       # GET /api/v1/methodology
│   ├── core/                    # Constants, exceptions, logging
│   ├── models/                  # Pydantic data schemas (requests, responses, observations)
│   ├── ingestion/               # NASA FIRMS API client, NRT downloader, archive loader
│   ├── normalization/           # Schema normalization, confidence mapping, validation
│   ├── storage/                 # Parquet partitioned store & DuckDB query engine
│   ├── spatial/                 # 0.1° grid generator, Shapely geometry operations
│   ├── aggregation/             # Hotspot counts, active cell-days, date-gap analysis
│   ├── harmonization/           # Sensor calibration interfaces, uncertainty models
│   └── services/                # Analysis orchestrator, deterministic cache, job runner
└── tests/                       # Pytest test suite (unit, integration, benchmarks)
```

---

## 5. Frontend & Backend Contract Alignment

| Dimension | Frontend Current State | Backend API Contract | Resolution |
| :--- | :--- | :--- | :--- |
| **Data Fetching** | Synchronous client-side in-memory generation via `demoAdapter` | Asynchronous REST endpoints under `/api/v1/*` | Provide a non-breaking API adapter in frontend (`src/data/apiAdapter.ts`) that fetches from backend with transparent fallback to demo adapter. |
| **Observation Schema** | Field names: `acquisitionDate`, `acquisitionTime`, `confidence`, `frp` | Normalized internal schema matches FIRMS standards (`acq_date`, `acq_time`, `frp`) | API response serializes directly into the frontend's expected camelCase interface (`acquisitionDate`, etc.) for zero-friction drop-in integration. |
| **Confidence Scale** | MODIS: 0–100 integer; VIIRS: `'low' \| 'nominal' \| 'high'` | Preserves raw sensor confidence and provides normalized category | Schema returns both native `confidence` and `confidenceLevel` so existing frontend components render unmodified. |
| **AOI Specification** | Hardcoded string region keys (`amazon`, `africa`, etc.) | GeoJSON Polygon or Bounding Box `[minX, minY, maxX, maxY]` | Backend supports both named presets (`region='amazon'`) and arbitrary GeoJSON Polygons / bounding boxes. |
| **Calendar Months** | Zero-indexed (0 = Jan, 11 = Dec) | Standard ISO 1–12 (with month names) | API returns both 1-based month numbers and zero-indexed indices to seamlessly populate frontend tabs. |
| **Harmonization** | Visual placeholder in `Science.tsx` | Raw sensor aggregation with explicit calibration interface and uncertainty bounds | Transparent metadata field `harmonizationStatus: 'uncalibrated_raw'` with no fabricated coefficients until empirical calibration is validated. |
