import type {DataMode} from '../../shared/types/observation';

export type StageStatus='implemented'|'conceptual'|'planned';
export type HarmonizationStage={
  id:string;
  number:number;
  title:string;
  shortTitle:string;
  status:StageStatus;
  statusLabel:string;
  input:string;
  processing:string;
  output:string;
  assumptions:string[];
  limitations:string[];
  evidence:string;
};

export const HARMONIZATION_STAGES:readonly HarmonizationStage[]=[
  {
    id:'ingestion',number:1,title:'Source data ingestion',shortTitle:'Ingestion',status:'implemented',statusLabel:'Implemented: raw read-only source path',
    input:'Backend-served MODIS and VIIRS observation records plus their source and processing metadata.',
    processing:'The application may read the verified GeoJSON/grid summaries and retain source-product, processing-tier, native confidence, timestamp, and missingness semantics. This lab does not ingest, mutate, or post observations.',
    output:'Raw observation records, GeoJSON points, and documented grid summaries remain sensor-specific and traceable to the backend response.',
    assumptions:['The backend response is the source of truth for the fields it returns.','A loaded subset is not a complete census of all observations.'],
    limitations:['No full-dataset ingestion, pagination, checksum, retrieval timestamp, or independent source certification is exposed by the verified contract.','NRT products have coverage, latency, cloud, smoke, canopy, and orbital-viewing limitations.'],
    evidence:'The verified API contract documents GET GeoJSON, raw summaries, sourceProduct, and processingType; this UI only reads metadata endpoints.'
  },
  {
    id:'spatial',number:2,title:'Spatial alignment',shortTitle:'Spatial',status:'conceptual',statusLabel:'Conceptual: alignment does not remove bias',
    input:'Sensor observations with native geolocation and the backend 0.1° equal-angle aggregation framework.',
    processing:'A common spatial frame can describe records in shared cells or an AOI. It is an explanatory alignment concept, not a correction for footprint, geolocation, viewing geometry, or detection sensitivity.',
    output:'Comparable spatial references and cell summaries for inspection, without a cross-sensor harmonized count or index.',
    assumptions:['The documented cell definition is applied consistently by the backend.','Spatial co-location is not equivalence of sensor measurement.'],
    limitations:['MODIS is nominally about 1 km at nadir while VIIRS is nominally about 375 m at nadir.','Spatial alignment alone does not remove sensor bias or make raw counts directly comparable.'],
    evidence:'The methodology and sensor metadata describe the 0.1° framework and the distinct nominal pixel resolutions.'
  },
  {
    id:'temporal',number:3,title:'Temporal alignment',shortTitle:'Temporal',status:'conceptual',statusLabel:'Conceptual: timing context only',
    input:'UTC acquisition date/time fields, daily summaries, and the documented sensor archive periods.',
    processing:'A shared date/time convention can organize observations into calendar periods and overlap windows. It does not infer observations during gaps or erase different overpass times and revisit patterns.',
    output:'Explicit temporal context for raw records and potential overlap analysis; no imputed values and no calibrated time series.',
    assumptions:['Acquisition date/time are interpreted using the verified UTC convention.','Missing or unobserved dates remain unknown rather than zero.'],
    limitations:['Different overpass times and archive start dates limit direct temporal comparison.','NRT timing and data gaps can make apparent differences coverage-related.'],
    evidence:'The contract reports acquisition date/time as UTC-oriented fields and the sensor metadata reports different archive periods and overpasses.'
  },
  {
    id:'metadata',number:4,title:'Sensor metadata preservation',shortTitle:'Metadata',status:'implemented',statusLabel:'Implemented: provenance stays native',
    input:'Native sensor identity, platform, resolution, confidence representation, source product, processing tier, FRP unit, and quality fields.',
    processing:'Keep MODIS numeric confidence and VIIRS categorical confidence as separate fields; preserve provenance and missingness rather than coercing them into a common score.',
    output:'A traceable metadata record and source table that distinguishes sensors, platforms, units, processing, and native confidence semantics.',
    assumptions:['Metadata returned by the backend is treated as descriptive, not as independent validation.','Unavailable fields are shown as unavailable, not as zero.'],
    limitations:['The verified contract does not provide complete retrieval metadata, checksum, collection version, or per-record evidence links.','Metadata preservation does not make the underlying measurements interchangeable.'],
    evidence:'The verified sensors, methodology, and quality inputs explicitly require native confidence and provenance preservation.'
  },
  {
    id:'calibration',number:5,title:'Calibration',shortTitle:'Calibration',status:'planned',statusLabel:'Planned: no fitted artifact available',
    input:'A future paired, documented calibration dataset with agreed reference sensor, inclusion rules, versioned parameters, and training windows.',
    processing:'A defensible calibration would fit empirical relationships on declared paired data and keep fitting separate from forward validation. This lab does not fit factors, apply fallback ratios, or request harmonized analysis.',
    output:'Currently none. No harmonized index, calibrated estimate, or calibration numbers are produced here.',
    assumptions:['Calibration requires an approved reference and valid overlap data.','Any future parameters would need versioning, provenance, and review.'],
    limitations:['The backend exposes no demonstrated real fitted calibration artifact or independent validation result.','The presence of harmonizer fallback code or an is_validated metadata flag is not evidence of a validated scientific output.'],
    evidence:'The verified Phase 3A report states that fitting on real paired observations and a defensible artifact are not demonstrated.'
  },
  {
    id:'uncertainty',number:6,title:'Uncertainty assessment',shortTitle:'Uncertainty',status:'conceptual',statusLabel:'Conceptual: sources of uncertainty documented',
    input:'Sensor differences, missingness, native confidence semantics, spatial/temporal context, and future calibration residuals.',
    processing:'Identify uncertainty sources and keep them visible in interpretation. No confidence scales are pooled, no missing day is converted to zero, and no numeric interval is invented.',
    output:'A transparent uncertainty checklist and limitations record; no fabricated bounds or harmonized uncertainty series.',
    assumptions:['Uncertainty must be tied to an explicit method and observed evidence.','Coverage gaps and detection limitations are part of interpretation.'],
    limitations:['The current metadata routes do not provide a validated uncertainty model or complete coverage calendar.','Cloud, smoke, canopy, viewing geometry, and NRT limitations can affect detectability.'],
    evidence:'The quality model and methodology list missingness, sensor resolution/confidence differences, and environmental limitations.'
  },
  {
    id:'validation',number:7,title:'Independent validation',shortTitle:'Validation',status:'planned',statusLabel:'Planned: independent holdout not available',
    input:'Future held-out years or regions, independent reference observations, a preregistered protocol, and versioned calibration outputs.',
    processing:'Evaluate calibration on data excluded from fitting, report error and coverage behavior, and retain the validation split and artifact provenance. No validation run is simulated here.',
    output:'Currently none. The lab reports the requirement, not a pass/fail result or validated harmonized product.',
    assumptions:['A validation reference and holdout design must be agreed before claims are made.','Validation must be independent of calibration fitting.'],
    limitations:['No demonstrated independent validation endpoint, artifact, metrics, or approved reference dataset is available in the supplied inputs.','Raw hotspot detections remain thermal anomaly records, not a confirmed fire.'],
    evidence:'The roadmap names leave-one-year-out calibration and forward temporal validation as a next phase, not a completed result.'
  }
] as const;

export type ParsedSensor={
  id:string;
  name:string;
  platforms:string[];
  resolution:string;
  earliestData:string;
  confidenceMetric:string;
  description:string;
};
export type MethodologyMetadata={
  version:string;
  harmonizationStatus:string;
  aggregationGrid:string;
  aoiSupport:string;
  activeCellDayDefinition:string;
  sensorDifferences:{modis:Record<string,unknown>;viirs:Record<string,unknown>};
  referenceStandard:string;
  roadmapCurrent:string;
  roadmapNext:string;
  caveats:string[];
};
export type HarmonizationMetadata={methodology:MethodologyMetadata;sensors:ParsedSensor[];source:string};

const record=(value:unknown):Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
const text=(value:unknown,fallback='Unavailable'):string=>typeof value==='string'&&value.trim()?value.trim():typeof value==='number'&&Number.isFinite(value)?String(value):fallback;
const list=(value:unknown):string[]=>Array.isArray(value)?value.filter((item):item is string=>typeof item==='string'&&item.trim().length>0).map(item=>item.trim()):[];
const nestedText=(value:unknown,key:string,fallback='Unavailable')=>text(record(value)[key],fallback);

export function parseMethodologyMetadata(value:unknown):MethodologyMetadata{
  const root=record(value);
  const spatial=record(root.spatial_framework);
  const sensorDifferences=record(root.sensor_differences);
  const roadmap=record(root.harmonization_roadmap);
  return {
    version:text(root.version),
    harmonizationStatus:text(root.harmonization_status),
    aggregationGrid:nestedText(spatial,'aggregation_grid'),
    aoiSupport:nestedText(spatial,'aoi_support'),
    activeCellDayDefinition:nestedText(spatial,'active_cell_day_definition'),
    sensorDifferences:{modis:record(sensorDifferences.modis),viirs:record(sensorDifferences.viirs)},
    referenceStandard:nestedText(roadmap,'reference_standard'),
    roadmapCurrent:nestedText(roadmap,'current_phase'),
    roadmapNext:nestedText(roadmap,'next_phase'),
    caveats:list(root.scientific_caveats)
  };
}

export function parseSensorsMetadata(value:unknown):ParsedSensor[]{
  const root=record(value);
  const sensors=Array.isArray(root.sensors)?root.sensors:[];
  return sensors.map(item=>{
    const sensor=record(item);
    return {
      id:text(sensor.id),
      name:text(sensor.name),
      platforms:list(sensor.platforms),
      resolution:text(sensor.nominal_pixel_resolution_meters),
      earliestData:text(sensor.earliest_data),
      confidenceMetric:text(sensor.confidence_metric),
      description:text(sensor.description)
    };
  }).filter(sensor=>sensor.id!=='Unavailable');
}

export function parseMetadataBundle(methodology:unknown,sensors:unknown,source:'backend'|'demo'):HarmonizationMetadata{
  return {methodology:parseMethodologyMetadata(methodology),sensors:parseSensorsMetadata(sensors),source};
}

export function sourceRequestPolicy(dataMode:DataMode):'GET metadata only'|'No backend request in demo mode'{
  return dataMode==='real'?'GET metadata only':'No backend request in demo mode';
}

export const statusClass=(status:StageStatus):string=>status;
