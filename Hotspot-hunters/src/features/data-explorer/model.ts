import type {Observation,Sensor} from '../../shared/types/observation';

export type ExplorerFilters={
 search:string;
 minFrp:string;
 maxFrp:string;
 daynight:''|'D'|'N';
 modisConfidenceMin:string;
 modisConfidenceMax:string;
 viirsConfidence:''|'low'|'nominal'|'high';
 processingType:string;
};

export const defaultExplorerFilters:ExplorerFilters={
 search:'',minFrp:'',maxFrp:'',daynight:'',modisConfidenceMin:'',modisConfidenceMax:'',viirsConfidence:'',processingType:''
};

export type ExplorerSortKey='id'|'acquisition'|'sensor'|'satellite'|'latitude'|'longitude'|'frp'|'confidence'|'daynight'|'source'|'processing';
export type SortDirection='asc'|'desc';
export type ExplorerSort={key:ExplorerSortKey;direction:SortDirection};
export const defaultExplorerSort:ExplorerSort={key:'acquisition',direction:'asc'};
export const pageSizes=[25,50,100] as const;

const missing=(value:unknown)=>value===null||value===undefined||value===' '||value==='';
const finiteNumber=(value:string)=>{const parsed=Number(value);return value.trim()!==''&&Number.isFinite(parsed)?parsed:null;};
const nativeConfidence=(record:Observation):number|string|null=>{
 if(record.sensor==='MODIS')return typeof record.confidence==='number'&&Number.isFinite(record.confidence)?record.confidence:null;
 if(typeof record.confidence==='string')return record.confidence.toLowerCase();
 return null;
};
const searchCache=new WeakMap<Observation,string>();
const searchableRecord=(record:Observation)=>{
 const cached=searchCache.get(record);if(cached!==undefined)return cached;
 let metadata='';
 try{metadata=JSON.stringify(record.originalProperties??'');}catch{metadata='';}
 const index=[record.id,record.acquisitionDate,record.acquisitionTime,record.sensor,record.satellite,record.latitude,record.longitude,record.frp,record.confidence,record.confidenceLevel,record.daynight,record.region,record.sourceProduct,record.processingType,record.gridId,record.dataSource,metadata].map(value=>String(value??'')).join(' ').toLowerCase();searchCache.set(record,index);return index;
};

export function matchesExplorerFilters(record:Observation,filters:ExplorerFilters):boolean{
 const search=filters.search.trim().toLowerCase();
 if(search&&!searchableRecord(record).includes(search))return false;
 const minFrp=finiteNumber(filters.minFrp),maxFrp=finiteNumber(filters.maxFrp);
 if(minFrp!==null&&(record.frp===null||record.frp<minFrp))return false;
 if(maxFrp!==null&&(record.frp===null||record.frp>maxFrp))return false;
 if(filters.daynight&&record.daynight!==filters.daynight)return false;
 if(filters.processingType&&record.processingType!==filters.processingType)return false;
 if(record.sensor==='MODIS'){
  const min=finiteNumber(filters.modisConfidenceMin),max=finiteNumber(filters.modisConfidenceMax);
  const confidence=typeof record.confidence==='number'&&Number.isFinite(record.confidence)?record.confidence:null;
  if(min!==null&&(confidence===null||confidence<min))return false;
  if(max!==null&&(confidence===null||confidence>max))return false;
 }else if(filters.viirsConfidence&&nativeConfidence(record)!==filters.viirsConfidence)return false;
 return true;
}

export function filterRecords(records:Observation[],filters:ExplorerFilters):Observation[]{return records.filter(record=>matchesExplorerFilters(record,filters));}

function sortValue(record:Observation,key:ExplorerSortKey):unknown{
 switch(key){
  case 'acquisition':return `${record.acquisitionDate}T${record.acquisitionTime.replace(':','')}`;
  case 'satellite':return record.satellite;
  case 'latitude':return record.latitude;
  case 'longitude':return record.longitude;
  case 'frp':return record.frp;
  case 'confidence':return nativeConfidence(record);
  case 'daynight':return record.daynight;
  case 'source':return record.sourceProduct??record.dataSource;
  case 'processing':return record.processingType;
  default:return record[key];
 }
}
function comparePresent(a:unknown,b:unknown):number{
 if(typeof a==='number'&&typeof b==='number')return a-b;
 return String(a).localeCompare(String(b),undefined,{numeric:true,sensitivity:'base'});
}

/** Stable sort with unavailable values always last and ID/index as deterministic ties. */
export function sortRecords(records:Observation[],sort:ExplorerSort=defaultExplorerSort):Observation[]{
 return records.map((record,index)=>({record,index,value:sortValue(record,sort.key)})).sort((a,b)=>{
  if(sort.key==='confidence'&&a.record.sensor!==b.record.sensor)return a.record.sensor.localeCompare(b.record.sensor);
  const aMissing=missing(a.value)|| (typeof a.value==='number'&&!Number.isFinite(a.value));
  const bMissing=missing(b.value)|| (typeof b.value==='number'&&!Number.isFinite(b.value));
  if(aMissing!==bMissing)return aMissing?1:-1;
  if(!aMissing){const compared=comparePresent(a.value,b.value);if(compared!==0)return sort.direction==='asc'?compared:-compared;}
  const idTie=a.record.id.localeCompare(b.record.id,undefined,{numeric:true,sensitivity:'base'});
  return idTie||a.index-b.index;
 }).map(item=>item.record);
}

export function paginateRecords(records:Observation[],page:number,pageSize:number){
 const safeSize=Math.max(1,Math.min(100,Math.floor(pageSize)||25));
 const pageCount=Math.max(1,Math.ceil(records.length/safeSize));
 const safePage=Math.max(0,Math.min(Math.floor(page)||0,pageCount-1));
 return {rows:records.slice(safePage*safeSize,(safePage+1)*safeSize),page:safePage,pageCount,pageSize:safeSize};
}

export function nativeConfidenceLabel(record:Observation):string|number|null{return nativeConfidence(record);}

export function validateExplorerFilters(filters:ExplorerFilters):string|null{
 const pairs=[['minFrp','maxFrp',0,Infinity],['modisConfidenceMin','modisConfidenceMax',0,100]] as const;
 for(const [low,high,min,max] of pairs){const a=filters[low].trim(),b=filters[high].trim();for(const v of [a,b])if(v!==''&&(!Number.isFinite(Number(v))||Number(v)<min||Number(v)>max))return low==='minFrp'?'FRP filters require non-negative MW values.':'MODIS native confidence must be a number from 0 to 100.';if(a!==''&&b!==''&&Number(a)>Number(b))return 'Minimum filter value cannot exceed maximum.';}
 return null;
}
