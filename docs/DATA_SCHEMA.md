# Burn Calendar Data Schema & Storage Layout

## 1. Storage Layout

The analytical storage is partitioned hierarchically by sensor and year:

```
data/
├── raw/                               # Unprocessed source CSV downloads
│   ├── MODIS_C6_1_Global_24h.csv
│   ├── MODIS_C6_1_Global_7d.csv
│   ├── J1_VIIRS_C2_Global_24h.csv
│   └── J1_VIIRS_C2_Global_7d.csv
├── processed/                         # Partitioned Parquet analytical files
│   ├── sensor=MODIS/
│   │   ├── year=2026/
│   │   │   └── data.parquet
│   └── sensor=VIIRS/
│       ├── year=2026/
│       │   └── data.parquet
└── cache/                             # Query cache store
```

---

## 2. Parquet Observation Schema

Every row stored in `data.parquet` conforms to the following schema:

| Column | Type | Nullable | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `STRING` | No | Unique observation identifier | `MODIS-Ter-2026-11-12-0034-13.2503-123.6897` |
| `latitude` | `FLOAT64` | No | WGS84 latitude (-90.0 to 90.0) | `13.25028` |
| `longitude` | `FLOAT64` | No | WGS84 longitude (-180.0 to 180.0) | `123.68965` |
| `acq_date` | `STRING` | No | Acquisition date in ISO format | `2026-11-12` |
| `acq_time` | `STRING` | No | Acquisition time (HH:MM UTC) | `00:34` |
| `sensor` | `STRING` | No | Instrument family: `'MODIS'` or `'VIIRS'` | `MODIS` |
| `satellite` | `STRING` | No | Satellite platform | `Terra`, `Aqua`, `Suomi-NPP`, `NOAA-20`, `NOAA-21` |
| `confidence` | `STRING` | No | Native sensor confidence | `'60'` (MODIS) or `'nominal'` (VIIRS) |
| `confidence_level` | `STRING` | No | Harmonized confidence category | `'low'`, `'nominal'`, `'high'` |
| `frp` | `FLOAT64` | No | Fire Radiative Power in Megawatts | `8.33` |
| `daynight` | `STRING` | No | Daytime (`'D'`) or Nighttime (`'N'`) | `'D'` |
| `processing_type` | `STRING` | No | Processing tier: `'NRT'`, `'STANDARD'` | `'NRT'` |
| `source_product` | `STRING` | No | Source stream provenance | `FIRMS_NRT_MODIS_24h` |
| `grid_id` | `STRING` | No | 0.1° spatial grid cell ID (`lat_lon`) | `13.20_123.60` |
| `region` | `STRING` | No | Associated geographic region | `global` |

---

## 3. Schema Normalization Rules

### Confidence Categorization
* **MODIS:** Native scale is an integer from `0` to `100`.
  * `< 30`: classified as `'low'`
  * `30` to `79`: classified as `'nominal'`
  * `>= 80`: classified as `'high'`
* **VIIRS:** Native scale is categorical string (`'low'`, `'nominal'`, `'high'`). Preserved as native string and mapped directly to confidence level.

### Time Normalization
* FIRMS raw formats (e.g. `0034`, `435`, `1245`) are zero-padded and formatted into standard `HH:MM` UTC strings.

### Spatial Grid Assignment (0.1 Degree)
* Spatial grid ID is computed via:
  $$\text{grid\_id} = \lfloor \text{lat} / 0.1 \rfloor \times 0.1 \_ \lfloor \text{lon} / 0.1 \rfloor \times 0.1$$
  *(e.g., latitude `13.25028`, longitude `123.68965` maps to cell `13.20_123.60`)*.

---

## 4. Deduplication Logic

Records are deduplicated on ingestion across partitions using the composite key:
$$\text{Key} = (\text{sensor}, \text{satellite}, \text{acq\_date}, \text{acq\_time}, \text{latitude}, \text{longitude})$$
Repeated downloads or overlapping rolling windows (e.g., 24h vs 7d feeds) update existing partitions without creating duplicate entries.
