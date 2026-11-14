import type {DataMode,Observation,Sensor} from '../../shared/types/observation';
import type {ExplorerFilters} from './model';

export const DEFAULT_EXPORT_MAX_BYTES=10*1024*1024;
export const CSV_EXPORT_FILENAME='hotspot-hunters-filtered-observations.csv';
export const GEOJSON_EXPORT_FILENAME='hotspot-hunters-filtered-observations.geojson';
export type ExplorerExportSelection={year:number;month:number;region:string;startDate:string;endDate:string;sensors:Sensor[]};
export type ExplorerExportContext={source:DataMode;selection:ExplorerExportSelection;filters:ExplorerFilters;partial:boolean;boundedCap:number;exportedAt?:string};
export type GeoJsonExport={type:'FeatureCollection';features:Array<{type:'Feature';id:string;geometry:{type:'Point';coordinates:[number,number]};properties:Record<string,unknown>}>;metadata:Record<string,unknown>};

const csvHeaders=['id','acquisitionDate','acquisitionTimeUTC','sensor','satellite','latitude','longitude','frp','frpUnit','confidence','daynight','dataSource','region','sourceProduct','processingType','confidenceLevel','gridId','originalProperties'];
const safeJson=(value:unknown)=>{try{return JSON.stringify(value??null);}catch{return 'null';}};
const csvValue=(value:unknown)=>value===null||value===undefined?'null':typeof value==='string'?value:String(value);
/** Spreadsheet formula-like text receives an apostrophe escape; numeric negatives remain numeric. */
export function escapeCsvCell(value:unknown):string{
 let text=csvValue(value);
 if(typeof value==='string'&&/^[\u0000-\u0020]*[=+\-@]|^[\t\r\n]/.test(text))text=`'${text}`;
 return /[",\n\r]/.test(text)?`"${text.replace(/"/g,'""')}"`:text;
}
export function recordsToCsv(records:Observation[]):string{
 const rows=[csvHeaders, ...records.map(record=>[
  record.id,record.acquisitionDate,record.acquisitionTime,record.sensor,record.satellite,record.latitude,record.longitude,record.frp,record.frpUnit??'MW',record.confidence,record.daynight,record.dataSource,record.region,record.sourceProduct,record.processingType,record.confidenceLevel,record.gridId,safeJson(record.originalProperties)
 ])];
 return rows.map(row=>row.map(escapeCsvCell).join(',')).join('\r\n')+'\r\n';
}
export const buildCsv=recordsToCsv;

export function buildGeoJson(records:Observation[],context:ExplorerExportContext):GeoJsonExport{
 const exportedAt=context.exportedAt??new Date().toISOString();
 return {type:'FeatureCollection',features:records.map(record=>({
  type:'Feature',id:record.id,geometry:{type:'Point',coordinates:[record.longitude,record.latitude]},properties:{
   id:record.id,acquisitionDate:record.acquisitionDate,acquisitionTime:record.acquisitionTime,timezone:record.timezone??'UTC',sensor:record.sensor,satellite:record.satellite,latitude:record.latitude,longitude:record.longitude,frp:record.frp,frpUnit:record.frpUnit??'MW',confidence:record.confidence,daynight:record.daynight,dataSource:record.dataSource??context.source,region:record.region,sourceProduct:record.sourceProduct,processingType:record.processingType,confidenceLevel:record.confidenceLevel,gridId:record.gridId,originalProperties:record.originalProperties??null
  }
 })),metadata:{source:context.source,selection:{...context.selection,sensors:[...context.selection.sensors]},filter:{...context.filters},partial:context.partial,boundedCap:context.boundedCap,scope:'all currently filtered loaded records; not only the current page',exportedAt}};
}
export const recordsToGeoJson=buildGeoJson;
export const buildGeoJSON=buildGeoJson;

function byteLength(text:string){return typeof TextEncoder!=='undefined'?new TextEncoder().encode(text).byteLength:text.length;}
export function assertExportSize(text:string,maxBytes=DEFAULT_EXPORT_MAX_BYTES):void{if(byteLength(text)>maxBytes)throw new Error(`Export exceeds the safe ${Math.round(maxBytes/1024/1024)} MB browser limit; narrow filters before downloading.`);}
function safeFilename(filename:string){const sanitized=filename.replace(/[^a-zA-Z0-9._-]+/g,'-');return sanitized||'hotspot-hunters-export.txt';}
export function downloadText(text:string,filename:string,mime:string,maxBytes=DEFAULT_EXPORT_MAX_BYTES):void{
 assertExportSize(text,maxBytes);
 if(typeof document==='undefined'||typeof URL==='undefined'||typeof URL.createObjectURL!=='function')throw new Error('Browser download is unavailable in this environment.');
 const url=URL.createObjectURL(new Blob([text],{type:mime}));
 const anchor=document.createElement('a');anchor.href=url;anchor.download=safeFilename(filename);anchor.rel='noopener';anchor.style.display='none';document.body.appendChild(anchor);
 try{anchor.click();}finally{anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
}
export function downloadCsv(records:Observation[],maxBytes=DEFAULT_EXPORT_MAX_BYTES){const text=recordsToCsv(records);downloadText(text,CSV_EXPORT_FILENAME,'text/csv;charset=utf-8',maxBytes);return text.length;}
export function downloadGeoJson(records:Observation[],context:ExplorerExportContext,maxBytes=DEFAULT_EXPORT_MAX_BYTES){const text=JSON.stringify(buildGeoJson(records,context),null,2);downloadText(text,GEOJSON_EXPORT_FILENAME,'application/geo+json;charset=utf-8',maxBytes);return text.length;}
export const downloadGeoJSON=downloadGeoJson;
