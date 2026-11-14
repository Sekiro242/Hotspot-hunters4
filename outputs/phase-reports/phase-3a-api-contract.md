# تقرير Phase 3A — عقد API الخلفي الفعلي

**المشروع:** Hotspot hunters / Burn Calendar  
**نطاق المرحلة:** اكتشاف العقد الفعلي فقط؛ لا تكامل واجهة ولا تعديل Backend  
**الخادم المقروء:** `http://127.0.0.1:8000` (كان سليماً مسبقاً)  
**تاريخ الفحص:** 2026-11-13  
**المصادر:** `backend/app/**`، `backend/tests/**`، `docs/**`، OpenAPI المحلي، وطلبات GET محدودة فقط.

> هذا التقرير يصف ما ينفذه الخادم حالياً، لا ما تقوله أسماء الدوال أو الخطط وحدها. لم أرسل POST إلى الخادم، ولم أشغّل/أوقف الخادم، ولم أنفّذ ingestion أو CSV download، ولم أقرأ أو أُخرج أي قيمة من `.env`. حُفظت fixtures منزوعة الحساسية فقط تحت `.work/phases/api-contract/`.

## 1. الخلاصة التنفيذية

العقد الحقيقي هو FastAPI/OpenAPI 3.1 تحت `/api/v1`، مع نقطة صحة خارج الإصدار `/health`. مصدر البيانات الموصوف في الكود والوثائق هو NASA FIRMS، والبيانات الحالية في الاستجابة الفعلية تحمل `sourceProduct` مثل `FIRMS_NRT_MODIS_7d` و`processingType: "NRT"`. هذا يثبت أن السجل **backend-sourced and normalized from a FIRMS-labelled product**؛ لكنه لا يثبت وحده صحة علمية مستقلة، أو أن كل صف تمت مراجعته مع NASA، أو أنه حريق مؤكد. الصياغة الآمنة للواجهة هي «رصدات شذوذ حراري من NASA FIRMS كما وصلت/خُزنت في هذا الـbackend»، وليست «حرائق مؤكدة».

الحالة العلمية الفعلية هي `uncalibrated_raw`. `AnalysisRequest.mode` يقبل `raw` و`harmonized`، لكن وجود كود `EmpiricalHarmonizer` لا يعني أن pipeline معايرة validated موجود: لا يوجد fitting تلقائي على بيانات فعلية داخل مسار التحليل، ولا مجموعة calibration محفوظة، ولا تحقق خارجي/زمني موثق. المسار `harmonized` يستخدم singleton بــfallback عالمي ثابت (`2.35`, مع حدود `1.60` و`3.40`) عند غياب tile calibration، ويضع metadata من النموذج تقول `is_validated: true` رغم أن إعداد التطبيق والـmethodology العامين يقولان `uncalibrated_raw`. لذلك يجب عدم تقديم النتائج harmonized كقياس علمي مُعاير قبل قرار/إصلاح صريح.

أهم القيود العقدية: لا pagination ولا sort حقيقي؛ معاملات query غير المعروفة تُهمل بصمت؛ لا endpoint للبحث/research؛ لا user authentication ولا authorization؛ `metric` في POST يدخل cache key لكنه لا يغير الحسابات المعادة؛ `grid_resolution_deg` يُقبل ويُعاد داخل الطلب لكنه لا يغير شبكة التحليل الثابتة 0.1°؛ custom AOI موجود في POST فقط، بينما GET summary/calendar/quality/map/download تقبل region preset لا bbox/polygon؛ و`/map/tiles` يعيد envelope حسابياً لا vector tiles.

## 2. حالة التشغيل المرصودة

من GET `/health` المحلي:

```json
{
  "status": "healthy",
  "environment": "development",
  "firms_map_key_configured": true,
  "storage": {"processed_dir": "data\\processed", "parquet_files_count": 2},
  "cache": {"entries_in_memory": 3, "stats": {"hits": 197, "misses": 3, "sets": 3, "evictions": 0}},
  "methodology_version": "0.1.0-uncalibrated"
}
```

`firms_map_key_configured` قيمة Boolean فقط وليست المفتاح. لا توجد مصادقة للمستهلكين على مسارات التطبيق. التخزين Parquet مقسّم حسب `sensor/year`، ويُقرأ عبر DuckDB. الكاش in-memory، TTL الافتراضي 24 ساعة، ولا توجد دلالة على بقاء الكاش بعد إعادة تشغيل العملية.

## 3. فهرس المسارات الفعلي

| الطريقة والمسار | المدخلات الفعلية | الاستجابة | الحالة/القيود |
|---|---|---|---|
| `GET /health` | لا شيء | object حر | صحة، إعداد مصدر FIRMS Boolean، إحصائيات التخزين والكاش |
| `POST /api/v1/analyze` | JSON `AnalysisRequest`؛ query `async_mode` | 200 `AnalysisResponse` أو 202 `JobStatusResponse` | POST موثق في OpenAPI ولم يُنفّذ في هذه المرحلة |
| `GET /api/v1/analysis/{job_id}` | path `job_id` | `JobStatusResponse` | job in-memory؛ غير الموجود 404 وفق الاختبار |
| `GET /api/v1/calendar` | `year`, `month`, `region`, `sensors` | `CalendarResponse` | month صفر-الفهرسة؛ 6 سنوات؛ query region فقط |
| `GET /api/v1/summary` | `region`, required `start_date/end_date`, `sensors` | `AnalysisSummary` | لا metric/mode/AOI مخصص |
| `GET /api/v1/seasonality` | `region`, `year`, `sensors` | object غير مُقيّد schema | متوسط/انحراف معياري لسنة واحدة، لا baseline متعدد السنوات فعلياً |
| `GET /api/v1/sensors` | لا شيء | object حر | MODIS/VIIRS والمنصات والفروق |
| `GET /api/v1/quality` | `region`, required `start_date/end_date`, `sensors` | `DataQualityReport` | `known_ingested_dates` لا يُمرّر؛ لذلك الصفر المؤكد لا يُستنتج فعلياً |
| `GET /api/v1/map/geojson` | `region`, `year`, `month`, `start_date`, `end_date`, `sensors`, `limit` | GeoJSON FeatureCollection | ترتيب date/time فقط؛ لا صفحات؛ region preset؛ polygon غير متاح هنا |
| `GET /api/v1/map/tiles/{z}/{x}/{y}` | `z/x/y` | object tile envelope | لا بيانات tile فعلية؛ `status: "ready"` ثابت تقريباً |
| `GET /api/v1/download/csv` | `region`, required dates, `sensors`, `limit` | `text/csv` | لم يُستدعَ احتراماً لقيد عدم تنزيل البيانات؛ schema OpenAPI للـ200 فارغ |
| `GET /api/v1/methodology` | لا شيء | object حر | وصف المنهج والقيود وroadmap، وليس دليلاً على validation |

OpenAPI المحلي يعلن `openapi: 3.1.0` و`info.version: 1.0.0`، بينما `methodology_version` التشغيلي `0.1.0-uncalibrated`.

## 4. عقد الإدخال التفصيلي

### 4.1 `POST /api/v1/analyze`

الجسم المدعوم فعلياً من Pydantic/OpenAPI:

```json
{
  "aoi": {
    "region_preset": "amazon",
    "bbox": [-67.0, -13.5, -51.0, -4.5],
    "geometry": {
      "type": "Polygon",
      "coordinates": [[[-60.0, -10.0], [-59.0, -10.0], [-59.0, -9.0], [-60.0, -10.0]]]
    }
  },
  "start_date": "2026-11-06",
  "end_date": "2026-11-13",
  "sensors": ["MODIS", "VIIRS"],
  "metric": "detections",
  "mode": "raw",
  "grid_resolution_deg": 0.1
}
```

المثال أعلاه يوضح union الحقول المدعوم؛ لا ينبغي إرسال `region_preset` و`bbox` و`geometry` معاً إلا إذا كان ذلك مقصوداً: validator يستخدم bbox إذا وجد، ويقبل region إذا كان اسمه من `amazon`, `africa`, `asia`, `australia`, `med`, `global`. عند عدم تحديد AOI يُفترض `global`. `bbox` إما object (`west/south/east/north`) أو array `[west,south,east,north]`. geometry يجب أن يكون Polygon أو MultiPolygon صالحاً؛ يتم الإصلاح بـShapely عند الحاجة.

القيم المقيّدة: `sensors` من `MODIS|VIIRS`، `metric` من `detections|active_cell_days|frp_sum|frp_mean`، و`mode` من `raw|harmonized`. التواريخ strings بصيغة موصوفة `YYYY-MM-DD`، لكن request model لا يفرض regex؛ التحقق الفعلي للتسلسل الزمني يتم داخل route، و`start_date > end_date` يعيد 422.

`async_mode=false` افتراضياً: حتى 366 يوماً sync؛ أكثر من 366 يوماً أو `async_mode=true` ينشئ job ويعيد 202. Progress عملياً يبدأ pending، ثم 0.2، ثم 1.0؛ لا queue خارجية ولا persistence. `metric` لا يوجد له branch حسابي في `AnalysisService`: الاستجابة تحسب detections/FRP/active-cell-days كلها دائماً، مع إدخاله في cache key فقط. `grid_resolution_deg` لا يغيّر `SpatialGrid` المنشأ من settings (0.1° ثابت).

### 4.2 حقول GET المشتركة

- `region`: string، لكنه يُحل إلى preset معروف. region غير معروف يفشل domain validation ويُعاد غالباً كـHTTPException؛ لا يوجد endpoint GET يقبل bbox/polygon بدلاً منه.
- `sensors`: FastAPI List؛ الشكل الموثوق هو تكرار المفتاح، مثل `?sensors=MODIS&sensors=VIIRS`. لا يوجد enum في معظم GETs، لكن تمرير قيمة غير صحيحة يفشل Pydantic داخل route ويظهر كـ500 بدلاً من 422.
- `start_date/end_date`: required في summary/quality/download؛ strings بلا format validation في OpenAPI. تاريخ غير ISO يسبب 500 داخلياً في المسارات الحالية.
- `year`: 2000..2030 في calendar/seasonality؛ map لا يضع range.
- `month`: صفر-الفهرسة 0..11، لا 1..12، في calendar/map.
- `limit`: map حد أعلى 20,000، export حد أعلى 50,000، ولا pagination/cursor.

## 5. عقد الاستجابات الفعلية

### 5.1 Summary وunits

طلب GET المستخدم:

```http
GET /api/v1/summary?region=amazon&start_date=2026-11-06&end_date=2026-11-13
```

الاستجابة الفعلية المنسوخة:

```json
{
  "total_detections": 3270,
  "total_active_cell_days": 1195,
  "modis_detections": 575,
  "viirs_detections": 2695,
  "total_frp_mw": 39499.93,
  "mean_daily_detections": 408.75,
  "peak_date": "2026-11-11",
  "peak_detections": 716
}
```

`total_detections` هو عدد pixel detections، وليس عدد حرائق مؤكدة. `active_cell_days` عدد الأزواج الفريدة (grid cell/date). `frp` بوحدة MW. `mean_daily_detections` محسوب على كل أيام الفترة المطلوبة، وليس أيام التغطية فقط. لا يوجد timestamp في هذا الرد.

### 5.2 Map GeoJSON

طلب GET المستخدم:

```http
GET /api/v1/map/geojson?region=amazon&year=2026&month=10&limit=2
```

`month=10` يعني نوفمبر. الرد الفعلي المختصر/الكامل لعنصرين:

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "id": "MODIS-Ter-2026-11-06-0045--13.4090--61.9212",
      "geometry": {"type": "Point", "coordinates": [-61.92122, -13.40898]},
      "properties": {
        "id": "MODIS-Ter-2026-11-06-0045--13.4090--61.9212",
        "latitude": -13.40898,
        "longitude": -61.92122,
        "acquisitionDate": "2026-11-06",
        "acquisitionTime": "00:45",
        "sensor": "MODIS",
        "satellite": "Terra",
        "confidence": 99,
        "frp": 14.45,
        "daynight": "N",
        "processingType": "NRT",
        "region": "global",
        "confidenceLevel": "high",
        "gridId": "-13.50_-62.00",
        "sourceProduct": "FIRMS_NRT_MODIS_7d"
      }
    },
    {
      "type": "Feature",
      "id": "MODIS-Ter-2026-11-06-0045--13.3910--61.9238",
      "geometry": {"type": "Point", "coordinates": [-61.92377, -13.39103]},
      "properties": {
        "id": "MODIS-Ter-2026-11-06-0045--13.3910--61.9238",
        "latitude": -13.39103,
        "longitude": -61.92377,
        "acquisitionDate": "2026-11-06",
        "acquisitionTime": "00:45",
        "sensor": "MODIS",
        "satellite": "Terra",
        "confidence": 77,
        "frp": 6.84,
        "daynight": "N",
        "processingType": "NRT",
        "region": "global",
        "confidenceLevel": "nominal",
        "gridId": "-13.40_-62.00",
        "sourceProduct": "FIRMS_NRT_MODIS_7d"
      }
    }
  ],
  "metadata": {
    "count": 2,
    "region": "amazon",
    "start_date": "2026-11-01",
    "end_date": "2026-11-30",
    "sensors": ["MODIS", "VIIRS"]
  }
}
```

الـcoordinates هي GeoJSON `[longitude, latitude]`. الوقت string UTC بصيغة `HH:MM`، ولا يوجد epoch أو timezone field منفصل. الملاحظة المهمة: metadata تقول `region=amazon` لكن property داخل السجل تقول `region=global`؛ السبب أن ingestion الافتراضي يكتب `region_hint="global"`، ولا يعاد تعيينه في query route. لا ينبغي اعتماد `properties.region` كمنطقة طلب دون قرار backend واضح.

الـquery يرتب قبل `LIMIT` حسب `acq_date ASC, acq_time ASC` فقط. لذلك `limit=2` ليس page 2 وليس top-2 حسب FRP، وcustom polygon غير متاح في هذا GET. وإذا استُخدم exact polygon في POST، فإن حد 50,000 يطبق قبل التصفية الهندسية، ما قد يعطي أقل من العدد المتوقع أو يسقط نقاطاً لاحقة.

### 5.3 Quality/missingness/provenance

طلب GET المستخدم:

```http
GET /api/v1/quality?region=amazon&start_date=2026-11-06&end_date=2026-11-13
```

الاستجابة الفعلية:

```json
{
  "requested_start_date": "2026-11-06",
  "requested_end_date": "2026-11-13",
  "total_days_in_range": 8,
  "days_with_data_present": 8,
  "days_with_zero_detections": 0,
  "days_missing_or_unobserved": 0,
  "missing_dates": [],
  "zero_activity_dates": [],
  "sensors_analyzed": ["MODIS", "VIIRS"],
  "sensor_metrics": {
    "MODIS": {
      "sensor": "MODIS", "satellite": "Aqua/Terra",
      "nominal_resolution_meters": 1000, "total_detections": 575,
      "active_cell_days": 346, "total_active_days": 8,
      "low_confidence_count": 29, "nominal_confidence_count": 393,
      "high_confidence_count": 153, "mean_frp_mw": 26.31, "max_frp_mw": 1562.13
    },
    "VIIRS": {
      "sensor": "VIIRS", "satellite": "NOAA-20",
      "nominal_resolution_meters": 375, "total_detections": 2695,
      "active_cell_days": 1009, "total_active_days": 8,
      "low_confidence_count": 312, "nominal_confidence_count": 2314,
      "high_confidence_count": 69, "mean_frp_mw": 9.04, "max_frp_mw": 457.16
    }
  },
  "processing_tiers_present": ["NRT"],
  "known_limitations": [
    "Hotspot detections represent thermally anomalous satellite pixels, not confirmed fire incidents or burned area.",
    "Heavy cloud cover, dense smoke, and heavy canopy cover can obscure surface thermal anomalies.",
    "MODIS active-fire pixels are nominally 1 km at nadir; VIIRS active-fire pixels are nominally 375 m at nadir.",
    "Native confidence scales (MODIS 0-100 numeric vs VIIRS low/nominal/high) reflect different detection algorithms.",
    "Missing observation dates indicate gaps in data availability and must not be interpreted as zero fire activity."
  ],
  "harmonization_status": "uncalibrated_raw"
}
```

التنفيذ لا يمرر `known_ingested_dates` إلى `evaluate_quality_and_gaps`، لذلك لا يستطيع تمييز «يوم معروف أنه ingested لكن فيه صفر» من «يوم غير موجود»؛ الأيام بلا records تذهب إلى `missing_dates`، و`zero_activity_dates` ستبقى فارغة في هذا المسار. قائمة dates مقيدة إلى أول 30 يوماً.

### 5.4 Calendar وSeasonality

`GET /api/v1/calendar?year=2026&month=10&region=amazon` يعيد 12 `monthly_rhythm` و6 `historical_trends`. من العينة الفعلية: نوفمبر (`month_index: 10`, `month_number: 11`) حمل `detection_count: 3270` و`baseline_ratio: 12.0`، بينما السنوات 2021–2025 حملت `data_status: "zero_or_unobserved"`. هذا status لا يفرّق فعلياً بين zero وunobserved، كما أن schema description يتحدث عن `available/partial/unavailable` لكن التنفيذ يستعمل strings أخرى مثل `modis_only (VIIRS begins 2012)`.

الـcalendar يبني تحليل سنة كاملة بــ`metric="detections"` ثم historical query بحد 50,000. `month` الذي يختاره المستهلك صفر-الفهرسة. الحد غير معتاد: `year` 2000..2030، لكن `month` 0..11.

`GET /api/v1/seasonality` يعيد object غير مُقيد في OpenAPI، حقوله الفعلية هي `year`, `region`, `sensors`, `annual_monthly_mean`, `annual_monthly_std`, `peak_month`, `peak_monthly_detections`, `unusual_period_threshold_1_3x`, و`monthly_seasonality[]` ذات `month_name`, `month_index`, `detections`, `z_score`, `is_unusual_period`, `baseline_ratio`. الحساب هو متوسط/انحراف معياري عبر أشهر السنة المطلوبة؛ ليس baseline متعدد السنوات رغم لغة «seasonal baseline».

### 5.5 Sensors وMethodology

`sensors` الفعلي يصف MODIS (Terra/Aqua، 1000 m، earliest `2000-11-01`، confidence numeric) وVIIRS (Suomi-NPP/NOAA-20/NOAA-21، 375 m، earliest `2012-01-20`، confidence categorical). يصرح صراحة أن raw counts لا تقارن مباشرة دون calibration.

`methodology` الفعلي يعيد:

```json
{
  "version": "0.1.0-uncalibrated",
  "harmonization_status": "uncalibrated_raw",
  "spatial_framework": {
    "aggregation_grid": "0.1 degree equal-angle (~11 km at equator)",
    "aoi_support": "Arbitrary polygon boundaries and bounding boxes anywhere on Earth"
  },
  "harmonization_roadmap": {
    "reference_standard": "Aqua MODIS during valid overlap periods (2012–2024)",
    "current_phase": "Phase 1: Multi-sensor raw aggregation with explicit provenance and uncertainty tracking.",
    "next_phase": "Phase 2: Leave-one-year-out empirical calibration and forward temporal validation."
  }
}
```

بعض النصوص في fixtures ظهرت بترميز UTF-8 مشوّه عند القراءة القديمة (`0.1Â°`, `1.3Ã—`)؛ هذا خلل عرض/ترميز في المسار الذي حفظ JSON وليس تغييراً في القيم الحسابية، ويجب ضمان UTF-8 عند المستهلك.

## 6. اختبارات سلوك الحدود

الطلبات GET التالية نفذت محلياً:

| الحالة | النتيجة الفعلية | الدلالة |
|---|---|---|
| summary مع `foo=bar&page=2&sort=frp&aggregation=weekly` | 200 ونفس أرقام summary العادية | unknown filters/pagination/sort/aggregation تُهمل بصمت |
| map مع `page=2&sort=frp&foo=bar` | 200؛ يعيد أول نتيجة بحسب ترتيب date/time | لا pagination أو sort |
| `sensors=LANDSAT` في summary | 500، رسالة Pydantic Literal error | يجب إصلاحه إلى 422 contract error |
| `month=12` في map | 422 مع `less_than_equal ... 11` | month صفر-الفهرسة ومقيد |
| `GET /api/v1/map/tiles/1/0/0` | 200: bbox `[-180.0,0.0,0.0,85.0511]`, status `ready` | envelope فقط؛ status ليس جاهزية بيانات |
| `GET /api/v1/research` | 404 `{"detail":"Not Found"}` | لا research endpoint |
| تاريخ `not-a-date` في summary | 500 `Invalid isoformat string` | لا date validation نظيفة في GET |

الـOpenAPI يعلن 422 فقط لكثير من هذه المسارات، لكنه لا يوثق 500 الناتج عن قيم domain غير الصالحة أو التاريخ malformed.

## 7. TypeScript type proposals (مبنية على العقد، وليست كود تكامل)

```ts
type Sensor = "MODIS" | "VIIRS";
type ConfidenceLevel = "low" | "nominal" | "high";
type ProcessingType = "NRT" | "STANDARD" | "SYNTHETIC" | "ARCHIVE";
type Metric = "detections" | "active_cell_days" | "frp_sum" | "frp_mean";
type AnalysisMode = "raw" | "harmonized";

type ObservationProperties = {
  id: string;
  latitude: number;
  longitude: number;
  acquisitionDate: string; // YYYY-MM-DD, UTC date
  acquisitionTime: string;  // HH:MM, UTC; not an epoch
  sensor: Sensor;
  satellite: string;
  confidence: number | "low" | "nominal" | "high";
  confidenceLevel: ConfidenceLevel;
  frp: number; // MW
  daynight: "D" | "N";
  processingType: ProcessingType;
  region: string | null;
  gridId: string | null;
  sourceProduct: string;
};

type GeoJSONFeature = {
  type: "Feature";
  id: string;
  geometry: { type: "Point"; coordinates: [number, number] }; // lon, lat
  properties: ObservationProperties;
};

type GeoJSONFeatureCollection = {
  type: "FeatureCollection";
  features: GeoJSONFeature[];
  metadata?: {
    count?: number;
    region?: string;
    start_date?: string;
    end_date?: string;
    sensors?: string[];
    [key: string]: unknown;
  } | null;
};

type AOI = {
  region_preset?: "amazon" | "africa" | "asia" | "australia" | "med" | "global" | string;
  bbox?: { west: number; south: number; east: number; north: number } | [number, number, number, number];
  geometry?: { type: "Polygon" | "MultiPolygon"; coordinates: unknown[] } | Record<string, unknown>;
};

type AnalysisRequest = {
  aoi?: AOI;
  start_date: string;
  end_date: string;
  sensors?: Sensor[];
  metric?: Metric;
  mode?: AnalysisMode;
  grid_resolution_deg?: number | null; // accepted; currently not an effective runtime knob
};

type AnalysisSummary = {
  total_detections: number;
  total_active_cell_days: number;
  modis_detections: number;
  viirs_detections: number;
  total_frp_mw: number;
  mean_daily_detections: number;
  peak_date?: string | null;
  peak_detections?: number;
};

type DailyTimeSeriesPoint = {
  date: string;
  modis_detections?: number;
  viirs_detections?: number;
  total_detections?: number;
  active_cell_days?: number;
  total_frp_mw?: number;
  is_missing_data?: boolean;
  harmonized_estimate?: number | null;
  uncertainty_lower?: number | null;
  uncertainty_upper?: number | null;
  calibration_status?: string | null;
  provenance_note?: string | null;
};

type SensorQualityMetrics = {
  sensor: string;
  satellite: string;
  nominal_resolution_meters: number;
  total_detections?: number;
  active_cell_days?: number;
  total_active_days?: number;
  low_confidence_count?: number;
  nominal_confidence_count?: number;
  high_confidence_count?: number;
  mean_frp_mw?: number | null;
  max_frp_mw?: number | null;
};

type DataQualityReport = {
  requested_start_date: string;
  requested_end_date: string;
  total_days_in_range: number;
  days_with_data_present: number;
  days_with_zero_detections: number;
  days_missing_or_unobserved: number;
  missing_dates?: string[];
  zero_activity_dates?: string[];
  sensors_analyzed: string[];
  sensor_metrics?: Record<string, SensorQualityMetrics>;
  processing_tiers_present?: string[];
  known_limitations?: string[];
  harmonization_status?: string;
};

type AnalysisResponse = {
  analysis_id: string;
  request: AnalysisRequest;
  summary: AnalysisSummary;
  daily_time_series: DailyTimeSeriesPoint[];
  monthly_rhythm: unknown[]; // use the exact MonthlyRhythmItem shape from OpenAPI
  top_active_cells: unknown[]; // GridCellAggregate shape in OpenAPI
  quality_report: DataQualityReport;
  methodology_version: string;
  harmonization_metrics?: Record<string, unknown> | null;
  computation_time_ms: number; // milliseconds, not seconds
  is_cached?: boolean;
};

type JobStatusResponse = {
  job_id: string;
  status: "pending" | "running" | "completed" | "failed";
  progress: number; // 0..1
  created_at: string; // ISO-8601 UTC offset string
  updated_at: string;  // ISO-8601 UTC offset string
  completed_at?: string | null;
  error?: string | null;
  result?: AnalysisResponse | null;
};
```

لا ينبغي تحويل `acquisitionDate/acquisitionTime` إلى epoch دون اتفاق إضافي؛ العقد لا يعطي timezone field لكن code/documentation يتعامل معهما كـUTC. `computation_time_ms` صريح بالميلي ثانية. `created_at/updated_at/completed_at` ISO-8601 (عادةً `+00:00`).

## 8. التنفيذ مقابل الجزئي/المخطط والتحقق العلمي

### منفذ فعلاً

- FastAPI routes وOpenAPI محلي.
- Parquet + DuckDB query منظم حسب sensor/year، ترتيب date/time وحدود row ثابتة.
- تطبيع coordinate/date/time/satellite/confidence، dedup داخلي بمعرّف deterministic.
- GeoJSON points، summary، monthly rhythm، historical trend، quality report، cache، وin-memory async jobs.
- مصدر/طبقة معالجة ظاهرة في observations: `sourceProduct`, `processingType`, native confidence و`confidenceLevel`.
- حدود علمية صريحة في quality/methodology: hotspot pixel ليس incident/burned area، والفروق 1 km/375 m، وتأثير السحب/الدخان/canopy.

### جزئي أو يحتاج قرار عقدي

- Quality يعرّف missingness لكنه لا يملك known-ingested calendar، فيخلط عملياً بين missing/unobserved ولا يثبت zero activity.
- GET map لا يدعم custom AOI رغم أن POST يفعل؛ limit قبل polygon filtering؛ region property لا يتبع region query.
- calendar/seasonality تسميان baseline/anomaly لكن baseline سنوي بسيط، وhistorical status لا يطابق الوصف المعلن.
- `/map/tiles` placeholder envelope لا tile data.
- export موجود في code، لكن OpenAPI لا يصف content schema، ولم يُختبر هنا، وCSV header لا يتضمن `source_product` رغم أن هذا أهم حقل provenance.
- errors غير موحدة: invalid sensor/date تظهر 500، وunknown filters لا تُرفض.
- CORS في `main.py` يسمح origins محددة و`"*"` مع `allow_credentials=True` وmethods/headers `*`؛ مناسب كتطوير فقط، غير مناسب كسياسة production واضحة.

### غير موجود أو planned

- لا research endpoint، ولا aggregation endpoint قابل لاختيار group-by، ولا sort/page/cursor contract.
- لا API auth للمستهلكين أو authorization، ولا rate-limit ظاهر لمسارات backend.
- لا response-level retrieval timestamp، checksum، source URL/collection version، coverage calendar، أو per-record evidence link؛ لذلك claim «real NASA» يبقى provenance label من backend لا شهادة مستقلة.
- لا pipeline معايرة validated قابلة للدفاع علمياً: `fit_calibration` موجود ككود واختبار، لكن الخدمة لا تستدعي fitting من paired real observations، وsingleton يبدأ بلا tile calibrations، والfallback ratios ثابتة ومبنية على تعليق عام. اختبارات harmonizer تستخدم عينات synthetic، وهي تحقق software behavior فقط.

اختبارات المشروع: **37 passed، 1 failed، 1 warning**. الفشل هو `test_missing_firms_key_raises_auth_error`: إنشاء `NASA_FIRMS_Client(map_key=None)` يرث المفتاح من settings بدلاً من اعتباره override غائباً، فأرسل الاختبار طلباً فعلياً إلى NASA FIRMS. هذا يكشف خللاً في test isolation/constructor semantics، وليس دليلاً على validation علمي أو على أمان المفتاح. لا تُسجّل قيمة المفتاح في هذا التقرير.

## 9. أسئلة القدرة المفقودة التي يجب حسمها قبل أي تكامل

1. هل المطلوب عرض NRT فقط أم archive/standard أيضاً؟ ما retrieval timestamp وcollection/version وchecksum الذي سيحمل provenance؟
2. هل تسمية «NASA» يجب أن تعني source FIRMS فقط، أم يلزم توثيق مستقل لكل feed/record؟ هل يجوز تسمية النتائج «hotspot detections» فقط؟
3. ما coverage calendar الرسمي لكل sensor/platform؟ كيف سيُثبت اليوم ذو zero detections مقابل اليوم غير ingested؟
4. هل `metric` مطلوب فعلياً؟ إذا نعم، ما semantics الدقيقة لـ`active_cell_days`, `frp_sum`, `frp_mean`، وهل يجب أن يغير response shape؟
5. ما العقد المعتمد للـpagination: offset/page أم cursor؟ وما stable sort والحد الأقصى؟ هل limit يطبق قبل أم بعد exact polygon؟
6. هل GET endpoints تحتاج bbox/GeoJSON مثل POST؟ وهل region property يجب أن يكون query AOI أم source region؟
7. ما سياسة validation للتواريخ، sensor values، cross-field `year/month`، وerror envelope؟ يجب منع 500 لقيم إدخال متوقعة.
8. هل `/map/tiles` سيصبح MVT حقيقياً أم يجب اعتباره endpoint envelope وإزالته من توقعات الخريطة؟
9. هل CSV export يجب أن يضم `source_product`, retrieval metadata، ومعلومات missingness؟ ما content-disposition وschema الرسمي؟
10. ما policy المصادقة، rate limit، وCORS للإنتاج؟ هل health يكشف فقط Boolean أم يجب إزالة حتى مسار البيانات النسبي وإحصائيات الكاش؟
11. ما dataset paired observations الفعلي للمعايرة؟ من يوافق على reference sensor، tile/month minimum samples، uncertainty، leave-one-year-out وforward validation؟ أين تُحفظ parameters وكيف تُversion؟
12. هل يُسمح أصلاً بـ`mode=harmonized` للمستهلك قبل وجود calibration artifact validated؟ حالياً الأفضل تعطيله/وسمه experimental بوضوح.
13. هل التاريخ/الوقت كله UTC؟ هل يحتاج العقد offset أو acquisition timestamp موحداً؟
14. هل jobs تحتاج durable queue، cancellation، TTL، ونتيجة قابلة للاسترجاع بعد restart؟
15. هل report/واجهة تحتاج route `/research` أو metadata عن limits/aggregation بدلاً من افتراضها؟

## 10. تسلسل التكامل الموصى به بعد اعتماد التقرير

1. **تثبيت عقد الإدخال والأخطاء أولاً:** date/sensor/AOI validation، 422 موحد، unknown query policy، وتعريف `metric` و`grid_resolution_deg` أو حذفهما من العقد.
2. **طبقة provenance/read-only:** اعتماد `/health`, `/sensors`, `/methodology`, ثم `/api/v1/map/geojson` مع عرض واضح لـNRT وFIRMS وقيود hotspot؛ عدم وصف observation كحريق مؤكد.
3. **الملخص والجودة:** ربط `/summary` و`/quality` فقط بعد توثيق أن `days_missing_or_unobserved` ليست zero activity، وإظهار resolution/confidence differences.
4. **الزمن:** ربط calendar/seasonality مع month zero-indexed وstatus الفعلي، وعدم تقديم 2021–2025 كصفر مؤكد عندما status هو `zero_or_unobserved`.
5. **التحليل العام:** بعد تثبيت POST contract، اعتماد raw mode فقط في المسار العلمي؛ التعامل مع 202/GET job status، cache flag، و`computation_time_ms`.
6. **custom AOI/pagination:** لا تعتمد أي UI على page/sort/aggregation قبل وجود عقد backend صريح؛ اطلب دعم bbox/polygon في GET أو استخدم POST.
7. **export:** لا تكامل CSV قبل schema/content-type/provenance رسمي، وإضافة `source_product` أو توثيق سبب غيابه.
8. **harmonization أخيراً:** لا تعرض `harmonized_estimate` كمعايرة validated قبل artifact حقيقي، fit على بيانات paired حقيقية، forward validation، versioned parameters، وموافقة علمية. حتى ذلك الحين، استخدم raw sensor-specific counts مع التحذير.
9. **الإنتاج:** حسم auth/rate-limit/CORS، durable jobs، source retrieval metadata، وobservability قبل نشر العقد خارج بيئة التطوير.

## 11. الملفات المساندة

- OpenAPI وGET fixtures المنزوعة الحساسية: `D:\Hotspot hunters2\.work\phases\api-contract\`
- التقرير المطلوب: `D:\Hotspot hunters2\outputs\phase-reports\phase-3a-api-contract.md`
