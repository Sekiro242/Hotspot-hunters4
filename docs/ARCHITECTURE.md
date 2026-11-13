# Burn Calendar Backend Architecture

**Project:** Burn Calendar (NASA Space Apps Challenge 2026)  
**Architecture Style:** Modular Monolith with Decoupled Layers  
**Primary Language & Frameworks:** Python 3.14, FastAPI, DuckDB, Apache Parquet, Shapely, Pydantic v2  

---

## 1. System Overview

Burn Calendar is an Earth observation and historical fire-activity analysis platform. It processes satellite thermal anomaly data from NASA's Moderate Resolution Imaging Spectroradiometer (**MODIS**) aboard Terra and Aqua, and the Visible Infrared Imaging Radiometer Suite (**VIIRS**) aboard Suomi-NPP, NOAA-20, and NOAA-21.

The backend serves both high-speed interactive map rendering (MapLibre GL) and analytical spatial-temporal aggregations over arbitrary geographic areas on Earth.

```
+-------------------------------------------------------------------------+
|                        Frontend (Vite / React 19)                       |
|             MapLibre GL Globe / Calendar / Compare / Science            |
+------------------------------------+------------------------------------+
                                     |  HTTP REST /api/v1/*
                                     v
+-------------------------------------------------------------------------+
|                              FastAPI Layer                              |
|           /analyze | /calendar | /summary | /quality | /map/geojson     |
+------------------------------------+------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|                         Analysis Orchestrator                           |
|        - Deterministic SHA-256 Query Cache                              |
|        - Background Async Job Service (UUIDs & Progress)                |
+-------------------+--------------------------------+--------------------+
                    |                                |
                    v                                v
+------------------------------------+  +---------------------------------+
|          Spatial Layer             |  |       Aggregation Engine        |
| - Shapely Geometry & Polygons      |  | - 0.1° Active Cell-Days         |
| - Point-in-Polygon Filtering       |  | - 12-Month Seasonal Rhythm      |
| - 0.1° Spatial Grid Binning        |  | - Data Quality & Gaps Evaluator |
+-------------------+----------------+  +----------------+----------------+
                    |                                    |
                    +----------------+-------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|                         Analytical Storage Layer                        |
|  - Embedded DuckDB Query Engine (Columnar SQL over Parquet)             |
|  - Partitioned Parquet: data/processed/sensor={s}/year={y}/data.parquet |
|  - Deduplication on Ingestion by (latitude, longitude, date, time, sat) |
+------------------------------------+------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|                             Ingestion Layer                             |
|  - NASA FIRMS REST API Client (MAP_KEY, exponential backoff, rate limits)|
|  - Open NRT Streaming Downloader (MODIS 24h/7d, VIIRS NOAA-20/21)       |
|  - Schema Normalizer (Confidence scales, coordinate validation)         |
+-------------------------------------------------------------------------+
```

---

## 2. Core Architectural Principles

1. **Simplicity and Modularity:**  
   Implemented as a self-contained modular monolith without distributed messaging queues or complex microservices. Components communicate through typed interfaces.

2. **Columnar Performance over DuckDB and Parquet:**  
   Analytical storage is organized into partitioned Parquet files (`sensor={sensor}/year={year}/data.parquet`). DuckDB queries Parquet directly using columnar vectorization, eliminating intermediate in-memory database loads.

3. **Deterministic Query Caching:**  
   Query results are indexed by SHA-256 hashes of `(AOI + date_range + sorted_sensors + metric + mode + methodology_version)`. Identical queries return in sub-10ms without hitting storage.

4. **Honest Data Quality & Gap Tracking:**  
   Missing satellite observation dates are explicitly differentiated from dates with confirmed zero detections.

5. **Harmonization Readiness:**  
   MODIS (1 km) and VIIRS (375 m) observations are preserved at sensor resolution. Calibration models have explicit versioning and uncertainty fields, preventing fabricated synthetic multipliers.

---

## 3. Directory & Module Responsibilities

| Path | Purpose |
| :--- | :--- |
| `backend/app/config.py` | Pydantic Settings managing environment variables and storage paths. Masks credentials. |
| `backend/app/core/constants.py` | Satellite specifications, resolutions, confidence scales, and preset geographic regions. |
| `backend/app/core/exceptions.py` | Custom domain exceptions with sanitized error formatting. |
| `backend/app/models/` | Pydantic data schemas: Observation, Spatial AOI, Analysis, Quality, Calendar. |
| `backend/app/ingestion/` | NASA FIRMS REST client, Open NRT downloader, and pipeline orchestrator. |
| `backend/app/normalization/` | Schema validation, coordinate checks, confidence mapping, 0.1° grid ID assignment. |
| `backend/app/storage/` | Partitioned Parquet writer (`ParquetStore`) and DuckDB query engine (`DuckDBEngine`). |
| `backend/app/spatial/` | Shapely polygon geometry and 0.1° spatial grid calculations. |
| `backend/app/aggregation/` | Active cell-days computation, 12-month rhythm, historical trends, quality assessment. |
| `backend/app/harmonization/` | Calibration model interfaces, baseline uncalibrated harmonizer, uncertainty parameters. |
| `backend/app/services/` | Analysis orchestrator (`AnalysisService`), query cache (`QueryCacheService`), job runner (`JobService`). |
| `backend/app/api/v1/` | FastAPI versioned REST endpoints. |
| `backend/tests/` | Pytest automated test suite (unit, integration, error paths). |
| `backend/benchmarks/` | Performance benchmark scripts. |
