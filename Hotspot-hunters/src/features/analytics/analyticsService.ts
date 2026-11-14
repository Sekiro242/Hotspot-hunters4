import {burnCalendarApi} from '../../data/apiClient';
import type {AnalysisResponse,AnalysisSummary,CalendarResponse,DataQualityReport,GridCellAggregate,HistoricalTrendItem,MonthlyRhythmItem,SensorQualityMetrics} from '../../data/contracts';
import {demoCalendar,demoRecords} from '../../data/repositories/demo';
import type {ObservationQuery} from '../../data/repositories/types';
import {previousRange,validDate} from '../../shared/dates';
import {months,regions} from '../../shared/geography';
import type {DataMode,Observation,Sensor} from '../../shared/types/observation';

export const ANALYTICS_ROW_CAP=50000;
export const ANALYTICS_SPATIAL_DAY_LIMIT=366;
export const ANALYTICS_REGIONS=regions.map(region=>region.id);

export type AnalyticsClient={
 getSummary:typeof burnCalendarApi.getSummary;
 getQuality:typeof burnCalendarApi.getQuality;
 getCalendar:typeof burnCalendarApi.getCalendar;
 analyze:typeof burnCalendarApi.analyze;
};

export type AnalyticsQuery={year:number;month:number;region:string;sensors:Sensor[];startDate:string;endDate:string};
export type ChartPoint={label:string;value:number;secondary?:number;missing?:boolean};
export type SeasonalPoint={season:string;months:string;value:number};
export type SensorFrp={sensor:Sensor;sum:number|null;mean:number|null;max:number|null;available:boolean};
export type ConfidenceDistribution={sensor:Sensor;labels:Array<{label:string;count:number|null}>;note:string};
export type RegionSummary={region:string;label:string;total:number;modis:number;viirs:number;available:boolean;error?:string};
export type SpatialCell={gridId:string;latitude:number;longitude:number;total:number;activeDays:number;meanFrp:number|null;sensors:Record<string,number>};
export type AnalyticsSnapshot={
 source:DataMode;
 fetchedAt:string;
 query:AnalyticsQuery;
 overview:{total:number;modis:number;viirs:number;selectedRange:string;region:string;sourceLabel:string;sourceUpdateAvailable:false};
 monthly:ChartPoint[];
 historical:ChartPoint[];
 yearly:ChartPoint[];
 seasonal:SeasonalPoint[];
 comparison:{current:number;previous:number|null;previousRange:{startDate:string;endDate:string};delta:number|null};
 regions:RegionSummary[];
 frp:{total:number;sensors:SensorFrp[]};
 confidence:ConfidenceDistribution[];
 quality:DataQualityReport;
 processingTiers:string[];
 knownLimitations:string[];
 spatial:SpatialCell[];
 methodologyVersion?:string;
 warnings:string[];
 partial:boolean;
};

const sensorList=(sensors:Sensor[]):Sensor[]=>{if(!sensors.length)throw new Error('Select at least one sensor for analytics.');return sensors;};
const finite=(value:unknown,fallback=0)=>typeof value==='number'&&Number.isFinite(value)?value:fallback;
const optionalFinite=(value:unknown)=>value===null||value===undefined?null:typeof value==='number'&&Number.isFinite(value)?value:undefined;
const labelForRegion=(id:string)=>regions.find(region=>region.id===id)?.name??(id==='global'?'Global':id);
const selectedRangeLabel=(query:AnalyticsQuery)=>`${query.startDate} → ${query.endDate}`;

function assertDateRange(query:AnalyticsQuery){
 if(!validDate(query.startDate)||!validDate(query.endDate)||query.startDate>query.endDate)throw new Error('Analytics date range is invalid. Use ISO dates with start on or before end.');
 if(!Number.isInteger(query.year)||query.year<2000||query.year>2030||!Number.isInteger(query.month)||query.month<0||query.month>11)throw new Error('Analytics calendar selection is invalid.');
}

export function validateSummary(value:AnalysisSummary):AnalysisSummary{
 const keys=['total_detections','total_active_cell_days','modis_detections','viirs_detections','total_frp_mw','mean_daily_detections'] as const;
 keys.forEach(key=>{if(typeof value?.[key]!=='number'||!Number.isFinite(value[key]))throw new Error(`Analytics summary field ${key} is invalid.`);});
 return value;
}

export function validateCalendar(value:CalendarResponse):CalendarResponse{
 if(!Array.isArray(value?.monthly_rhythm)||value.monthly_rhythm.length!==12||!Array.isArray(value?.historical_trends))throw new Error('Analytics calendar response is incomplete.');
 value.monthly_rhythm.forEach((item,index)=>{if(item.month_index!==index||typeof item.detection_count!=='number'||!Number.isFinite(item.detection_count))throw new Error('Analytics monthly rhythm field is invalid.');});
 value.historical_trends.forEach(item=>{if(typeof item.year!=='number'||typeof item.detection_count!=='number'||!Number.isFinite(item.detection_count))throw new Error('Analytics historical trend field is invalid.');});
 return value;
}

export function validateQuality(value:DataQualityReport):DataQualityReport{
 ['total_days_in_range','days_with_data_present','days_with_zero_detections','days_missing_or_unobserved'].forEach(key=>{const item=value[key as keyof DataQualityReport];if(typeof item!=='number'||!Number.isFinite(item))throw new Error(`Analytics quality field ${key} is invalid.`);});
 if(!Array.isArray(value.sensors_analyzed)||!value.sensors_analyzed.every(v=>typeof v==='string'))throw new Error('Analytics quality sensor list is invalid.');
 for(const list of [value.processing_tiers_present,value.known_limitations])if(list!==undefined&&(!Array.isArray(list)||!list.every(v=>typeof v==='string')))throw new Error('Invalid quality metadata.');
 for(const metric of Object.values(value.sensor_metrics??{})){if(!metric||typeof metric!=='object')throw new Error('Invalid native sensor metrics.');for(const field of ['low_confidence_count','nominal_confidence_count','high_confidence_count','mean_frp_mw','max_frp_mw']){const number=(metric as unknown as Record<string,unknown>)[field];if(number!=null&&(typeof number!=='number'||!Number.isFinite(number)||number<0))throw new Error('Invalid native sensor metric.');}}
 return value;
}

function validateAnalysis(value:AnalysisResponse):AnalysisResponse{
 if(!value||!Array.isArray(value.top_active_cells))throw new Error('Analytics spatial response is incomplete.');
 return value;
}

function seasonForMonth(index:number){return index===11||index<=1?'Winter':index<=4?'Spring':index<=7?'Summer':'Autumn';}
export function buildSeasonalDistribution(monthly:MonthlyRhythmItem[]):SeasonalPoint[]{
 const order=['Winter','Spring','Summer','Autumn'];
 return order.map(season=>{const selected=monthly.filter(item=>seasonForMonth(item.month_index)===season);return {season,months:selected.map(item=>item.month_abbr).join(' / '),value:selected.reduce((sum,item)=>sum+finite(item.detection_count),0)};});
}

function demoFrp(records:Observation[],sensors:Sensor[]):SensorFrp[]{
 return sensors.map(sensor=>{const values=records.filter(record=>record.sensor===sensor).map(record=>record.frp).filter((value):value is number=>typeof value==='number'&&Number.isFinite(value));const sum=values.reduce((total,value)=>total+value,0);return {sensor,sum:values.length?sum:0,mean:values.length?sum/values.length:0,max:values.length?Math.max(...values):0,available:true};});
}
function demoConfidence(records:Observation[],sensor:Sensor):ConfidenceDistribution{
 const selected=records.filter(record=>record.sensor===sensor);
 if(sensor==='VIIRS'){
  const labels=['low','nominal','high'].map(label=>({label,count:selected.filter(record=>record.confidence===label||record.confidenceLevel===label).length}));
  return {sensor,labels,note:'VIIRS native categorical confidence; categories are not comparable to MODIS values.'};
 }
 const labels=[['numeric <50',(value:Observation)=>typeof value.confidence==='number'&&value.confidence<50],['numeric 50–79',(value:Observation)=>typeof value.confidence==='number'&&value.confidence>=50&&value.confidence<80],['numeric 80–100',(value:Observation)=>typeof value.confidence==='number'&&value.confidence>=80]] as const;
 return {sensor,labels:labels.map(([label,test])=>({label,count:selected.filter(test).length})),note:'MODIS native numeric confidence, shown in display buckets only; no common score is calculated.'};
}

function demoSpatial(records:Observation[]):SpatialCell[]{
 const byGrid=new Map<string,Observation[]>();
 records.forEach(record=>{const key=record.gridId??`${record.latitude.toFixed(1)}_${record.longitude.toFixed(1)}`;const rows=byGrid.get(key)??[];rows.push(record);byGrid.set(key,rows);});
 return [...byGrid.entries()].map(([gridId,rows])=>{const values=rows.map(row=>row.frp).filter((value):value is number=>typeof value==='number'&&Number.isFinite(value));return {gridId,latitude:rows.reduce((sum,row)=>sum+row.latitude,0)/rows.length,longitude:rows.reduce((sum,row)=>sum+row.longitude,0)/rows.length,total:rows.length,activeDays:new Set(rows.map(row=>row.acquisitionDate)).size,meanFrp:values.length?values.reduce((sum,value)=>sum+value,0)/values.length:null,sensors:{MODIS:rows.filter(row=>row.sensor==='MODIS').length,VIIRS:rows.filter(row=>row.sensor==='VIIRS').length}};}).sort((a,b)=>b.total-a.total).slice(0,12);
}

function analysisSpatial(value:AnalysisResponse):SpatialCell[]{
 return value.top_active_cells!.map((cell:GridCellAggregate)=>{
  if(typeof cell.grid_id!=='string'||typeof cell.center_lat!=='number'||typeof cell.center_lon!=='number'||typeof cell.total_detections!=='number'||typeof cell.active_days!=='number'||!cell.sensor_breakdown||!Number.isFinite(cell.total_detections))throw new Error('Analytics spatial grid field is invalid.');
  return {gridId:cell.grid_id,latitude:cell.center_lat,longitude:cell.center_lon,total:cell.total_detections,activeDays:cell.active_days,meanFrp:cell.mean_frp_mw===null||cell.mean_frp_mw===undefined?null:finite(cell.mean_frp_mw),sensors:cell.sensor_breakdown};
 }).sort((a,b)=>b.total-a.total).slice(0,12);
}

function qualityFrp(quality:DataQualityReport,sensors:Sensor[]):SensorFrp[]{
 return sensors.map(sensor=>{const metric:SensorQualityMetrics|undefined=quality.sensor_metrics?.[sensor];const mean=optionalFinite(metric?.mean_frp_mw);const max=optionalFinite(metric?.max_frp_mw);return {sensor,sum:null,mean:mean??null,max:max??null,available:mean!==null||max!==null};});
}
function qualityConfidence(quality:DataQualityReport,sensors:Sensor[]):ConfidenceDistribution[]{
 return sensors.map(sensor=>{const metric=quality.sensor_metrics?.[sensor];const count=(value:unknown):number|null=>optionalFinite(value)??null;const labels:Array<[string,number|null]>=[['low',count(metric?.low_confidence_count)],['nominal',count(metric?.nominal_confidence_count)],['high',count(metric?.high_confidence_count)]];return {sensor,labels:labels.map(([label,value])=>({label,count:value})),note:sensor==='MODIS'?'MODIS native numeric confidence is summarized by backend-native bands; do not compare with VIIRS bands.':'VIIRS native categorical confidence; categories are not comparable to MODIS values.'};});
}

async function boundedRegionSummaries(client:AnalyticsClient,query:AnalyticsQuery,signal:AbortSignal):Promise<{items:RegionSummary[];warnings:string[];partial:boolean}>{
 const output:Array<RegionSummary|undefined>=new Array(ANALYTICS_REGIONS.length);
 const warnings:string[]=[];let cursor=0;
 const worker=async()=>{while(true){const index=cursor++;if(index>=ANALYTICS_REGIONS.length)return;const region=ANALYTICS_REGIONS[index]!;try{const summary=validateSummary(await client.getSummary(region,query.startDate,query.endDate,query.sensors,signal));output[index]={region,label:labelForRegion(region),total:summary.total_detections,modis:summary.modis_detections,viirs:summary.viirs_detections,available:true};}catch(error){if(signal.aborted)throw error;output[index]={region,label:labelForRegion(region),total:0,modis:0,viirs:0,available:false,error:error instanceof Error?error.message:'Region summary unavailable'};warnings.push(`${labelForRegion(region)} regional summary unavailable.`);}}};
 await Promise.all(Array.from({length:Math.min(3,ANALYTICS_REGIONS.length)},()=>worker()));
 return {items:output.filter((item):item is RegionSummary=>Boolean(item)),warnings,partial:warnings.length>0};
}

function baseWarnings(source:DataMode){return source==='real'?[
 'Bounded aggregation caveat: backend aggregate queries may internally inspect at most 50,000 records. This dashboard does not treat a bounded result as a complete census, even when it is below the displayed cap.',
 'Raw observation totals are record counts of thermally anomalous satellite pixels, not confirmed fires, incidents, or burned area. MODIS and VIIRS remain separate.',
 'Missing or unobserved days are not confirmed zero activity. Coverage gaps can reflect cloud, smoke, canopy, feed, or ingestion limits.',
 'Day/night distribution is unavailable from the aggregate API and is not inferred here.',
 'Source update time is unavailable; “fetched” is the client request completion time, not an upstream acquisition timestamp.',
 'Harmonized mode is intentionally not used. Results are raw, uncalibrated aggregates.'
]:['Synthetic demo data: every value on this page is generated locally for interface demonstration and is not a scientific finding or measured coverage.'];}

export function createAnalyticsService(client:AnalyticsClient=burnCalendarApi){
 return {async load(query:AnalyticsQuery,dataMode:DataMode,signal:AbortSignal):Promise<AnalyticsSnapshot>{
  assertDateRange(query);
  const sensors=sensorList(query.sensors);
  const fetchedAt=new Date().toISOString();
  const prior=previousRange(query.startDate,query.endDate);
  if(dataMode==='demo'){
   const observationQuery:ObservationQuery={...query,sensors};
   const records=demoRecords(observationQuery);
   const calendar=validateCalendar(demoCalendar(observationQuery));
   const currentTotal=records.length;
   const previousRecords=demoRecords({...observationQuery,startDate:prior.startDate,endDate:prior.endDate});
   const regionalRecords=demoRecords({...observationQuery,region:'global'});
   const regionItems=ANALYTICS_REGIONS.map(region=>{const rows=regionalRecords.filter(record=>record.region===region);return {region,label:labelForRegion(region),total:rows.length,modis:rows.filter(row=>row.sensor==='MODIS').length,viirs:rows.filter(row=>row.sensor==='VIIRS').length,available:true};});
   const summary:AnalysisSummary={total_detections:currentTotal,total_active_cell_days:new Set(records.map(record=>`${record.gridId}:${record.acquisitionDate}`)).size,modis_detections:records.filter(record=>record.sensor==='MODIS').length,viirs_detections:records.filter(record=>record.sensor==='VIIRS').length,total_frp_mw:records.reduce((sum,record)=>sum+(record.frp??0),0),mean_daily_detections:currentTotal/Math.max(1,(Date.parse(query.endDate)-Date.parse(query.startDate))/86400000+1)};
   return {source:'demo',fetchedAt,query,overview:{total:summary.total_detections,modis:summary.modis_detections,viirs:summary.viirs_detections,selectedRange:selectedRangeLabel(query),region:labelForRegion(query.region),sourceLabel:'Synthetic demo · illustrative only',sourceUpdateAvailable:false},monthly:calendar.monthly_rhythm.map(item=>({label:item.month_abbr,value:item.detection_count})),yearly:calendar.historical_trends.map(item=>({label:String(item.year),value:demoRecords({...observationQuery,year:item.year,startDate:`${item.year}-01-01`,endDate:`${item.year}-12-31`}).length})),historical:calendar.historical_trends.map(item=>({label:String(item.year),value:item.detection_count})),seasonal:buildSeasonalDistribution(calendar.monthly_rhythm),comparison:{current:currentTotal,previous:previousRecords.length,previousRange:prior,delta:currentTotal-previousRecords.length},regions:regionItems,frp:{total:summary.total_frp_mw,sensors:demoFrp(records,sensors)},confidence:sensors.map(sensor=>demoConfidence(records,sensor)),quality:{requested_start_date:query.startDate,requested_end_date:query.endDate,total_days_in_range:Math.max(1,(Date.parse(query.endDate)-Date.parse(query.startDate))/86400000+1),days_with_data_present:new Set(records.map(record=>record.acquisitionDate)).size,days_with_zero_detections:0,days_missing_or_unobserved:0,sensors_analyzed:sensors,known_limitations:['Synthetic records use deterministic local generation; coverage and confidence are illustrative.'],harmonization_status:'synthetic_demo'},processingTiers:['SYNTHETIC'],knownLimitations:['Synthetic records are not measured observations or scientific findings.'],spatial:demoSpatial(records),warnings:baseWarnings('demo'),partial:false};
  }
  const summary=validateSummary(await client.getSummary(query.region,query.startDate,query.endDate,sensors,signal));
  // Both verified GET endpoints execute the same cache-keyed backend analysis. Seed once before reading quality.
  const [quality,calendar]=await Promise.all([client.getQuality(query.region,query.startDate,query.endDate,sensors,signal),client.getCalendar(query.year,query.month,query.region,sensors,signal)]).then(values=>[validateQuality(values[0]),validateCalendar(values[1])] as const);
  const yearly:ChartPoint[]=[];
  for(const h of calendar.historical_trends){if(signal.aborted)throw new DOMException('Aborted','AbortError');try{const annual=validateSummary(await client.getSummary(query.region,`${h.year}-01-01`,`${h.year}-12-31`,sensors,signal));yearly.push({label:String(h.year),value:annual.total_detections,missing:false});}catch{yearly.push({label:String(h.year),value:0,missing:true});}}
  const optional=await Promise.allSettled([client.getSummary(query.region,prior.startDate,prior.endDate,sensors,signal),boundedRegionSummaries(client,query,signal),queryDays(query)<=ANALYTICS_SPATIAL_DAY_LIMIT?client.analyze(query.region,query.startDate,query.endDate,sensors,signal):Promise.resolve(null)]);
  const warnings=baseWarnings('real');let partial=yearly.some(y=>y.missing)||summary.total_detections>=ANALYTICS_ROW_CAP;if(summary.total_detections>=ANALYTICS_ROW_CAP)warnings.push('Aggregation limit reached: displayed totals are capped subtotals, not all matching observations.');if(yearly.some(y=>y.missing))warnings.push('Some annual summary requests failed; those periods are unavailable, not zero activity.');
  const previousResult=optional[0];let previous:AnalysisSummary|undefined;
  if(previousResult.status==='fulfilled')previous=validateSummary(previousResult.value);else{warnings.push('Previous equivalent range could not be loaded; comparison is unavailable.');partial=true;}
  const regionResult=optional[1];let regionItems:RegionSummary[]=[];
  if(regionResult.status==='fulfilled'){regionItems=regionResult.value.items;warnings.push(...regionResult.value.warnings);partial=partial||regionResult.value.partial;}else{warnings.push('Regional comparison could not be loaded.');partial=true;}
  const spatialResult=optional[2];let spatial:SpatialCell[]=[];
  if(queryDays(query)>ANALYTICS_SPATIAL_DAY_LIMIT){warnings.push('Top grid summaries are unavailable for ranges longer than 366 days because the verified analyze endpoint may create an untested async job.');partial=true;}else if(spatialResult.status==='fulfilled'&&spatialResult.value){try{spatial=analysisSpatial(validateAnalysis(spatialResult.value));}catch(error){warnings.push(error instanceof Error?error.message:'Spatial summary fields are invalid.');partial=true;}}else{warnings.push('Top grid summaries are unavailable for this selection.');partial=true;}
  return {source:'real',fetchedAt:new Date().toISOString(),yearly,query,overview:{total:summary.total_detections,modis:summary.modis_detections,viirs:summary.viirs_detections,selectedRange:selectedRangeLabel(query),region:labelForRegion(query.region),sourceLabel:'Backend / FIRMS-labelled raw observations',sourceUpdateAvailable:false},monthly:calendar.monthly_rhythm.map(item=>({label:item.month_abbr,value:item.detection_count})),historical:calendar.historical_trends.map(item=>({label:String(item.year),value:item.detection_count,secondary:item.modis_count??undefined,missing:item.data_status?.includes('unobserved')||item.data_status?.includes('unavailable')})),seasonal:buildSeasonalDistribution(calendar.monthly_rhythm),comparison:{current:summary.total_detections,previous:previous?.total_detections??null,previousRange:prior,delta:previous?summary.total_detections-previous.total_detections:null},regions:regionItems,frp:{total:summary.total_frp_mw,sensors:qualityFrp(quality,sensors)},confidence:qualityConfidence(quality,sensors),quality,processingTiers:quality.processing_tiers_present??[],knownLimitations:quality.known_limitations??[],spatial,warnings,partial};
 }};
}

function queryDays(query:AnalyticsQuery){return Math.floor((Date.parse(query.endDate)-Date.parse(query.startDate))/86400000)+1;}

export const analyticsService=createAnalyticsService();
export {months};
