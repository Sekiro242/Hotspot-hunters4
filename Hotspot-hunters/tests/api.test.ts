import {test} from 'node:test';
import assert from 'node:assert/strict';
import mapFixture from './fixtures/map.json';
import {ApiError,createHttpClient} from '../src/data/http';
import {normalizeCollection,normalizeFeature} from '../src/data/normalize';
import {createApiRepository,validateQuery} from '../src/data/repositories/api';
import type {ObservationQuery} from '../src/data/repositories/types';
import {monthRange,validDate} from '../src/shared/dates';
import {selectionParams} from '../src/data/apiClient';

type Properties=Record<string,unknown>;
type StubClient=Parameters<typeof createApiRepository>[0];

function jsonResponse(value:unknown,status=200,headers:Record<string,string>={}):Response{
 const body=typeof value==='string'?value:JSON.stringify(value);
 return new Response(body,{status,headers:{'content-type':'application/json',...headers}});
}

function feature(propertyOverrides:Properties={},geometryOverrides:Properties={}):Properties{
 const properties:Properties={
  id:'MODIS-Ter-2024-02-29-0045--10.0000--60.0000',
  latitude:-10,
  longitude:-60,
  acquisitionDate:'2024-02-29',
  acquisitionTime:'00:45',
  sensor:'MODIS',
  satellite:'Terra',
  confidence:99,
  frp:14.45,
  daynight:'N',
  processingType:'NRT',
  region:'global',
  confidenceLevel:'high',
  gridId:'-10.00_-60.00',
  sourceProduct:'FIRMS_NRT_MODIS_7d',
  ...propertyOverrides,
 };
 const coordinates=[properties.longitude,properties.latitude];
 return {
  type:'Feature',
  id:properties.id,
  geometry:{type:'Point',coordinates,...geometryOverrides},
  properties,
 };
}

function collection(...features:Properties[]):Properties{
 return {type:'FeatureCollection',features};
}

function schemaError(action:()=>unknown):void{
 assert.throws(action,(error:unknown)=>error instanceof ApiError&&error.kind==='schema');
}

function stubClient(overrides:Record<string,unknown>):StubClient{
 return overrides as unknown as StubClient;
}

function query(overrides:Partial<ObservationQuery>={}):ObservationQuery{
 return {year:2024,month:1,region:'amazon',sensors:['MODIS','VIIRS'],...overrides};
}

test('HTTP client builds the verified map request and parses a successful JSON response',async()=>{
 let capturedUrl='';let capturedInit:RequestInit|undefined;
 const request=createHttpClient('https://backend.example/',1000,async(input,init)=>{
  capturedUrl=String(input);capturedInit=init;return jsonResponse({type:'FeatureCollection',features:[]});
 });
 const params=selectionParams('amazon','2024-02-28','2024-02-29',['MODIS','VIIRS']);
 params.set('limit','7');
 const result=await request('/api/v1/map/geojson',params);
 assert.deepEqual(result,{type:'FeatureCollection',features:[]});
 assert.equal(capturedUrl,'https://backend.example/api/v1/map/geojson?region=amazon&start_date=2024-02-28&end_date=2024-02-29&sensors=MODIS&sensors=VIIRS&limit=7');
 assert.equal(capturedInit?.method,'GET');
 assert.equal((capturedInit?.headers as Record<string,string>).Accept,'application/json');
});

test('successful fixture normalization preserves real provenance, metadata, and native values',()=>{
 const result=normalizeCollection(mapFixture,5000);
 assert.equal(result.source,'real');
 assert.equal(result.partial,false);
 assert.deepEqual(result.metadata,{count:2,region:'amazon',start_date:'2026-11-01',end_date:'2026-11-30',sensors:['MODIS','VIIRS']});
 assert.equal(result.records.length,2);
 assert.deepEqual(result.records[0]?.originalProperties,mapFixture.features[0].properties);
 assert.equal(result.records[0]?.dataSource,'real');
 assert.equal(result.records[0]?.timezone,'UTC');
 assert.equal(result.records[0]?.frpUnit,'MW');
 assert.equal(result.records[0]?.sourceProduct,'FIRMS_NRT_MODIS_7d');
 assert.equal(result.records[0]?.confidence,99);
});

test('empty FeatureCollection and no-sensor repository selection are explicit empty results',async()=>{
 const empty=normalizeCollection({type:'FeatureCollection',features:[],metadata:null},5000);
 assert.deepEqual(empty.records,[]);
 assert.equal(empty.partial,false);
 assert.deepEqual(empty.warnings,[]);
 assert.deepEqual(empty.metadata,{});
 let called=false;
 const repository=createApiRepository(stubClient({
  getObservationsGeoJSON:async()=>{called=true;return collection();},
  getCalendar:async()=>({} as never),
 }));
 const result=await repository.load(query({sensors:[]}));
 assert.deepEqual(result.records,[]);
 assert.equal(result.source,'real');
 assert.equal(result.partial,false);
 assert.deepEqual(result.warnings,['No sensors selected.']);
 assert.equal(called,false);
});

test('HTTP status errors retain server status and distinguish invalid selection from other failures',async()=>{
 for(const [status,message] of [[422,'Invalid selection. Check the dates, region and sensors.'],[503,'Backend request failed (HTTP 503). Please retry.']] as const){
  const request=createHttpClient('https://backend.example',1000,async()=>jsonResponse({detail:'ignored'},status));
  await assert.rejects(request('/api/v1/map/geojson'),(error:unknown)=>error instanceof ApiError&&error.kind==='http'&&error.status===status&&error.message===message);
 }
});

test('network, timeout, and external cancellation errors follow the HTTP client contract',async()=>{
 const network=createHttpClient('https://backend.example',1000,async()=>{throw new Error('connection refused');});
 await assert.rejects(network('/health'),(error:unknown)=>error instanceof ApiError&&error.kind==='network'&&error.message.includes('Cannot reach'));
 const timeout=createHttpClient('https://backend.example',10,async(_input,init)=>{
  const signal=init?.signal;
  if(signal?.aborted)throw new Error('aborted');
  return new Promise<Response>((_resolve,reject)=>signal?.addEventListener('abort',()=>reject(new Error('aborted')),{once:true}));
 });
 await assert.rejects(timeout('/health'),(error:unknown)=>error instanceof ApiError&&error.kind==='timeout');
 const controller=new AbortController();
 const externalError=new Error('caller cancelled');
 const cancelled=createHttpClient('https://backend.example',1000,async(_input,init)=>{
  const signal=init?.signal;
  if(signal?.aborted)throw externalError;
  return new Promise<Response>((_resolve,reject)=>signal?.addEventListener('abort',()=>reject(externalError),{once:true}));
 });
 const pending=cancelled('/health',undefined,{signal:controller.signal});
 controller.abort();
 await assert.rejects(pending,(error:unknown)=>error===externalError);
});

test('large responses are rejected by declared and streamed byte limits',async()=>{
 const declared=createHttpClient('https://backend.example',1000,async()=>jsonResponse('{}',200,{'content-length':'9'}),8);
 await assert.rejects(declared('/health'),(error:unknown)=>error instanceof ApiError&&error.kind==='size'&&error.message.includes('safe browser limit'));
 const streamed=createHttpClient('https://backend.example',1000,async()=>new Response(new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('123456789'));controller.close();}})),8);
 await assert.rejects(streamed('/health'),(error:unknown)=>error instanceof ApiError&&error.kind==='size'&&error.message.includes('safe browser limit'));
});

test('malformed JSON is a schema error and never substitutes demo data',async()=>{
 const request=createHttpClient('https://backend.example',1000,async()=>jsonResponse('{"features":',200));
 await assert.rejects(request('/api/v1/map/geojson'),(error:unknown)=>error instanceof ApiError&&error.kind==='schema'&&error.message.includes('invalid JSON'));
});

test('geometry validation rejects non-Point, out-of-range, and coordinate/property disagreement',()=>{
 schemaError(()=>normalizeFeature({...feature(),geometry:{type:'LineString',coordinates:[[-60,-10],[-61,-11]]}}));
 schemaError(()=>normalizeFeature(feature({}, {coordinates:[181,-10]})));
 schemaError(()=>normalizeFeature(feature({}, {coordinates:[-60,-9]})));
 schemaError(()=>normalizeFeature(feature({latitude:-10,longitude:-60},{coordinates:[-60,-10,0]})));
});

test('native confidence scales remain sensor-specific and scientific values may be null',()=>{
 const modis=normalizeFeature(feature({confidence:0}));
 const viirs=normalizeFeature(feature({id:'VIIRS-NOAA20-2024-02-29-0045',sensor:'VIIRS',satellite:'NOAA-20',confidence:'high'}));
 assert.equal(modis.confidence,0);
 assert.equal(viirs.confidence,'high');
 schemaError(()=>normalizeFeature(feature({confidence:'high'})));
 schemaError(()=>normalizeFeature(feature({sensor:'VIIRS',confidence:85})));
 const missing=normalizeFeature(feature({satellite:null,confidence:null,frp:null,daynight:null,processingType:null,region:null,confidenceLevel:null,gridId:null,sourceProduct:null}));
 assert.equal(missing.satellite,null);
 assert.equal(missing.confidence,null);
 assert.equal(missing.frp,null);
 assert.equal(missing.daynight,null);
 assert.equal(missing.processingType,null);
 assert.equal(missing.region,null);
 assert.equal(missing.sourceProduct,null);
 assert.deepEqual(missing.originalProperties?.sourceProduct,null);
});

test('duplicate and invalid features produce a partial result, while all-invalid data is rejected',()=>{
 const valid=feature();
 const result=normalizeCollection(collection(valid,valid,feature({id:'bad-date',acquisitionDate:'2024-02-30'})),5000);
 assert.equal(result.records.length,1);
 assert.equal(result.partial,true);
 assert.equal(result.warnings.length,1);
 assert.match(result.warnings[0]??'',/invalid or duplicate records excluded/);
 schemaError(()=>normalizeCollection(collection(feature({processingType:'SYNTHETIC'})),5000));
});

test('synthetic observations are rejected even when their other fields are valid',()=>{
 schemaError(()=>normalizeFeature(feature({processingType:'SYNTHETIC'})));
 const standard=normalizeFeature(feature({processingType:'STANDARD'}));
 assert.equal(standard.processingType,'STANDARD');
});

test('date validation handles leap days and month-derived ranges exactly',()=>{
 assert.equal(validDate('2024-02-29'),true);
 assert.equal(validDate('2023-02-29'),false);
 assert.equal(validDate('2024-02-30'),false);
 assert.deepEqual(monthRange(2024,1),{startDate:'2024-02-01',endDate:'2024-02-29'});
 assert.deepEqual(monthRange(2023,1),{startDate:'2023-02-01',endDate:'2023-02-28'});
 assert.doesNotThrow(()=>validateQuery(query({startDate:'2024-02-28',endDate:'2024-02-29'})));
 schemaError(()=>validateQuery(query({startDate:'2024-02-29'})));
 schemaError(()=>validateQuery(query({startDate:'2024-03-01',endDate:'2024-02-29'})));
});

test('query validation rejects invalid year, month, region, sensor, and limit filters',()=>{
 for(const invalid of [
  query({year:1999}),query({year:2031}),query({month:-1}),query({month:12}),
  query({region:'not-a-region'}),query({sensors:['LANDSAT' as 'MODIS']}),
  query({limit:0}),query({limit:20001}),query({limit:1.5}),
 ])schemaError(()=>validateQuery(invalid));
 assert.doesNotThrow(()=>validateQuery(query({year:2030,month:11,region:'global',limit:20000})));
});

test('repository forwards region, sensors, date range, and limit without inventing pagination',async()=>{
 let received:Record<string,unknown>|undefined;
 const repository=createApiRepository(stubClient({
  getObservationsGeoJSON:async(params:Record<string,unknown>)=>{received=params;return collection(feature());},
  getCalendar:async()=>({} as never),
 }));
 const q=query({startDate:'2024-02-28',endDate:'2024-02-29',limit:7});
 const result=await repository.load(q);
 assert.equal(result.records.length,1);
 assert.deepEqual(received,{region:'amazon',sensors:['MODIS','VIIRS'],startDate:'2024-02-28',endDate:'2024-02-29',limit:7});
 assert.equal('page' in (received??{}),false);
 assert.equal('offset' in (received??{}),false);
 assert.equal('cursor' in (received??{}),false);
});

test('repository derives a leap-month date range and uses a bounded limit rather than pagination',async()=>{
 let received:Record<string,unknown>|undefined;
 const repository=createApiRepository(stubClient({
  getObservationsGeoJSON:async(params:Record<string,unknown>)=>{received=params;return collection(feature());},
  getCalendar:async()=>({} as never),
 }));
 await repository.load(query({year:2024,month:1,sensors:['MODIS'],limit:2}));
 assert.deepEqual(received,{region:'amazon',sensors:['MODIS'],startDate:'2024-02-01',endDate:'2024-02-29',limit:2});
});

test('a response at the backend limit is marked bounded and not presented as paginated total data',()=>{
 const result=normalizeCollection(collection(feature(),feature({id:'MODIS-Ter-2024-02-29-0046--10.0000--60.0000',acquisitionTime:'00:46'})),2);
 assert.equal(result.partial,true);
 assert.ok(result.warnings.some(w=>w.includes('bounded subset')));
 assert.ok(result.warnings.some(w=>w.includes('Backend has no pagination')));
});

test('calendar and monthly repository calls preserve the verified year/month/region/sensor contract',async()=>{
 let received:{year:number;month:number;region:string;sensors:string[]}|undefined;
 const calendar={monthly_rhythm:Array.from({length:12},(_,month_index)=>({month_index,detection_count:month_index*3})),historical_trends:[]};
 const repository=createApiRepository(stubClient({
  getObservationsGeoJSON:async()=>collection(),
  getCalendar:async(year:number,month:number,region:string,sensors:string[])=>{received={year,month,region,sensors};return calendar;},
 }));
 const q=query({year:2026,month:10,region:'amazon',sensors:['MODIS']});
 assert.deepEqual(await repository.monthly(q),Array.from({length:12},(_,i)=>i*3));
 assert.deepEqual(received,{year:2026,month:10,region:'amazon',sensors:['MODIS']});
});
