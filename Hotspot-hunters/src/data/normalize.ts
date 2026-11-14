import {object,ApiError} from './http';
import type {Observation} from '../shared/types/observation';
import {validDate} from '../shared/dates';
export function normalizeFeature(value:unknown):Observation{
 const f=object(value),p=object(f.properties),g=object(f.geometry);
 const coords=g.coordinates;
 if(f.type!=='Feature'||g.type!=='Point'||!Array.isArray(coords)||coords.length!==2||!coords.every(v=>typeof v==='number'&&Number.isFinite(v))||Math.abs(coords[0])>180||Math.abs(coords[1])>90)throw new ApiError('schema','Invalid observation geometry.');
 if(typeof p.id!=='string'||!p.id||f.id!==p.id||!['MODIS','VIIRS'].includes(String(p.sensor))||typeof p.acquisitionDate!=='string'||!validDate(p.acquisitionDate)||typeof p.acquisitionTime!=='string'||! /^(?:[01]\d|2[0-3]):?[0-5]\d$/.test(p.acquisitionTime))throw new ApiError('schema','Invalid observation identity or UTC acquisition time.');
 if(p.latitude!==coords[1]||p.longitude!==coords[0])throw new ApiError('schema','Observation properties and GeoJSON coordinates disagree.');
 if(p.confidence!=null&&(p.sensor==='MODIS'?(typeof p.confidence!=='number'||!Number.isInteger(p.confidence)||p.confidence<0||p.confidence>100):!['low','nominal','high'].includes(String(p.confidence))))throw new ApiError('schema','Invalid sensor-native confidence; scales are not interchangeable.');
 if(p.frp!=null&&(typeof p.frp!=='number'||!Number.isFinite(p.frp)||p.frp<0))throw new ApiError('schema','Invalid FRP in MW.');
 if(p.confidenceLevel!=null&&!['low','nominal','high'].includes(String(p.confidenceLevel)))throw new ApiError('schema','Invalid native confidence level metadata.');
 if(p.daynight!=null&&!['D','N'].includes(String(p.daynight)))throw new ApiError('schema','Invalid day/night value.');
 if(p.processingType!=null&&!['NRT','STANDARD','SYNTHETIC','ARCHIVE'].includes(String(p.processingType)))throw new ApiError('schema','Unknown processing tier.');
 // Never allow a synthetic backend record to be labeled as a real observation.
 if(p.processingType==='SYNTHETIC')throw new ApiError('schema','Backend returned synthetic records in real-data mode.');
 const optional=(name:string)=>p[name]==null?null:typeof p[name]==='string'?p[name] as string:(()=>{throw new ApiError('schema','Invalid observation metadata.');})();
 return {id:p.id,latitude:coords[1],longitude:coords[0],acquisitionDate:p.acquisitionDate,acquisitionTime:p.acquisitionTime,sensor:p.sensor as Observation['sensor'],satellite:optional('satellite'),confidence:p.confidence==null?null:p.confidence as number|string,frp:p.frp==null?null:p.frp as number,daynight:p.daynight==null?null:p.daynight as 'D'|'N',processingType:p.processingType==null?null:p.processingType as Observation['processingType'],region:optional('region'),confidenceLevel:optional('confidenceLevel'),gridId:optional('gridId'),sourceProduct:optional('sourceProduct'),dataSource:'real',timezone:'UTC',frpUnit:'MW',originalProperties:{...p}};
}
export function normalizeCollection(value:unknown,limit:number){
 const result=object(value);if(result.type!=='FeatureCollection'||!Array.isArray(result.features))throw new ApiError('schema','Expected GeoJSON FeatureCollection.');
 const records:Observation[]=[],warnings:string[]=[];let rejected=0;const ids=new Set<string>();
 for(const feature of result.features){try{const o=normalizeFeature(feature);if(ids.has(o.id))throw new Error('Duplicate ID');ids.add(o.id);records.push(o);}catch{rejected++;}}
 if(rejected&&records.length===0)throw new ApiError('schema','All returned observations failed validation. No demo data was substituted.');
 if(rejected)warnings.push(`${rejected} invalid or duplicate records excluded; dataset is partial.`);
 if(result.features.length>=limit)warnings.push(`Map response reached its ${limit.toLocaleString()}-record limit; this is a bounded subset, not the complete total. Backend has no pagination.`);
 return {records,source:'real' as const,partial:rejected>0||result.features.length>=limit,warnings,metadata:result.metadata==null?{}:object(result.metadata),fetchedAt:new Date().toISOString()};
}
