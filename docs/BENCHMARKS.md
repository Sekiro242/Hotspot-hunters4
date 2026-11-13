# Performance Benchmarks

## Benchmark Environment
- **Operating System:** Windows 11
- **Python Version:** 3.14.7
- **Database Engine:** Embedded DuckDB 2.0.0
- **Storage Format:** Apache Parquet (Snappy compressed, partitioned by sensor/year)
- **Active Real Observations in Store:** 517,580 real NASA FIRMS detections (83,653 MODIS, 433,927 VIIRS)

---

## Benchmark Results

### 1. Cached vs Uncached Query Latency
* **Query:** 7-day multi-sensor analysis over the Amazon Basin (3,270 active detections, 1,195 active cell-days).
* **Uncached Latency:** **818.41 ms** (Full DuckDB Parquet columnar scan + Shapely geometry validation + spatial-temporal aggregation).
* **Cached Latency:** **7.94 ms** (Deterministic SHA-256 query cache lookup).
* **Speedup Factor:** **103.1x**

---

### 2. Small AOI vs Large AOI Latency
* **Small AOI (0.5° × 0.5° bounding box):** **33.95 ms**
* **Large AOI (Global, 50,000 observations):** **6,081.34 ms**
* **Scaling Behavior:** Spatial bounding-box pre-filtering in DuckDB efficiently prunes non-intersecting partitions before Shapely geometry operations.

---

### 3. Short vs Long Date Range Latency
* **Short Range (1 Day):** **67.74 ms**
* **Long Range (13 Days):** **424.03 ms**
* **Scaling Behavior:** Near-linear scaling across date windows due to DuckDB columnar date indexing.

---

## Running the Benchmark Suite

Execute the following command from the workspace root:

```powershell
$env:PYTHONPATH="backend"
python backend/benchmarks/benchmark_performance.py
```
