import {createSharedLoader} from './sharedRequests';
import {apiConfig} from './config';
import {createHttpClient,object,numericFields,ApiError} from './http';
import type {Sensor} from '../shared/types/observation';
import type {CalendarResponse,AnalysisSummary,DataQualityReport,AnalysisResponse} from './contracts';
export type CalendarApiResponse=CalendarResponse;
export type SummaryApiResponse=AnalysisSummary;
export const API_BASE_URL=apiConfig.baseUrl;
const request=createHttpClient(apiConfig.baseUrl,apiConfig.timeoutMs);
const sharedCalendar=createSharedLoader(async(key,signal)=>{const result=object(await request('/api/v1/calendar',new URLSearchParams(key),{signal}));
  if(!Array.isArray(result.monthly_rhythm)||result.monthly_rhythm.length!==12||!Array.isArray(result.historical_trends))throw new ApiError('schema','Invalid calendar response.');
  result.monthly_rhythm.forEach((v,i)=>{const item=numericFields(v,['month_index','detection_count']);if(item.month_index!==i)throw new ApiError('schema','Calendar month ordering is invalid.');});
  result.historical_trends.forEach(v=>numericFields(v,['year','detection_count']));
return result;});
export function selectionParams(region:string,startDate?:string,endDate?:string,sensors:Sensor[]=[]){const p=new URLSearchParams({region});if(startDate)p.set('start_date',startDate);if(endDate)p.set('end_date',endDate);[...new Set(sensors)].sort().forEach(s=>p.append('sensors',s));return p;}
export const burnCalendarApi={
 async isHealthy(signal?:AbortSignal){try{return object(await request('/health',undefined,{signal})).status==='healthy';}catch{return false;}},
 async getObservationsGeoJSON(params:{region?:string;year?:number;month?:number;startDate?:string;endDate?:string;sensors?:Sensor[];limit?:number},signal?:AbortSignal){const p=selectionParams(params.region??'global',params.startDate,params.endDate,params.sensors);if(params.year!==undefined)p.set('year',String(params.year));if(params.month!==undefined)p.set('month',String(params.month));p.set('limit',String(params.limit??apiConfig.mapLimit));return request('/api/v1/map/geojson',p,{signal});},
 async getCalendar(year:number,month:number,region:string,sensors:Sensor[],signal?:AbortSignal):Promise<CalendarResponse>{
  const p=selectionParams(region,undefined,undefined,sensors);p.set('year',String(year));p.set('month',String(month));const result=object(await sharedCalendar(p.toString(),signal));
  return result as CalendarResponse;
 },
 async getSummary(region:string,startDate:string,endDate:string,sensors:Sensor[],signal?:AbortSignal):Promise<AnalysisSummary>{if(!sensors.length)throw new ApiError('schema','Select at least one sensor.');return numericFields(await request('/api/v1/summary',selectionParams(region,startDate,endDate,sensors),{signal}),['total_detections','total_active_cell_days','modis_detections','viirs_detections','total_frp_mw','mean_daily_detections']) as AnalysisSummary;},
 async getQuality(region:string,startDate:string,endDate:string,sensors:Sensor[],signal?:AbortSignal):Promise<DataQualityReport>{if(!sensors.length)throw new ApiError('schema','Select at least one sensor.');const r=numericFields(await request('/api/v1/quality',selectionParams(region,startDate,endDate,sensors),{signal}),['total_days_in_range','days_with_data_present','days_missing_or_unobserved']);object(r.sensor_metrics);return r as DataQualityReport;},
 async analyze(region:string,startDate:string,endDate:string,sensors:Sensor[],signal?:AbortSignal):Promise<AnalysisResponse>{if(!sensors.length)throw new ApiError('schema','Select at least one sensor.');const r=object(await request('/api/v1/analyze',undefined,{method:'POST',signal,body:{aoi:{region_preset:region},start_date:startDate,end_date:endDate,sensors,metric:'detections',mode:'raw'}}));if(!Array.isArray(r.daily_time_series)||!Array.isArray(r.top_active_cells)||!r.summary)throw new ApiError('schema','Unexpected raw analysis response (use a range of at most 366 days).');return r as AnalysisResponse;},
 async getMetadata(path:'/api/v1/sensors'|'/api/v1/methodology',signal?:AbortSignal){return object(await request(path,undefined,{signal}));},
 getCsvDownloadUrl(region:string,startDate:string,endDate:string,sensors:Sensor[]){return apiConfig.baseUrl+'/api/v1/download/csv?'+selectionParams(region,startDate,endDate,sensors)+'&limit=50000';},
};
