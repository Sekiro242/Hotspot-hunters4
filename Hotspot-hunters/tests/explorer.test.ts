import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {Observation} from '../src/shared/types/observation';
import {buildGeoJson,recordsToCsv,escapeCsvCell} from '../src/features/data-explorer/export';
import {defaultExplorerFilters,filterRecords,paginateRecords,sortRecords} from '../src/features/data-explorer/model';

const base=(overrides:Partial<Observation>={}):Observation=>({id:'a',latitude:1,longitude:2,acquisitionDate:'2026-11-01',acquisitionTime:'01:02',sensor:'MODIS',satellite:'Terra',confidence:80,frp:10,daynight:'D',processingType:'NRT',region:'global',confidenceLevel:null,gridId:null,sourceProduct:'FIRMS_NRT',dataSource:'real',frpUnit:'MW',timezone:'UTC',originalProperties:{raw:'yes'},...overrides});

test('native confidence filters do not exclude the opposite sensor',()=>{
 const rows=[base({id:'m-high',confidence:90}),base({id:'m-low',confidence:20}),base({id:'v-high',sensor:'VIIRS',confidence:'high',confidenceLevel:'high'}),base({id:'v-low',sensor:'VIIRS',confidence:'low',confidenceLevel:'low'})];
 assert.deepEqual(filterRecords(rows,{...defaultExplorerFilters,modisConfidenceMin:'80'}).map(row=>row.id),['m-high','v-high','v-low']);
 assert.deepEqual(filterRecords(rows,{...defaultExplorerFilters,viirsConfidence:'high'}).map(row=>row.id),['m-high','m-low','v-high']);
});

test('FRP, day/night, processing, text search, and nulls are handled without fabricated values',()=>{
 const rows=[base({id:'target',frp:null,daynight:null,processingType:null,satellite:null}),base({id:'other',frp:50,sourceProduct:'SPECIAL'})];
 assert.deepEqual(filterRecords(rows,{...defaultExplorerFilters,minFrp:'1'}).map(row=>row.id),['other']);
 assert.deepEqual(filterRecords(rows,{...defaultExplorerFilters,search:'special'}).map(row=>row.id),['other']);
 assert.deepEqual(filterRecords(rows,{...defaultExplorerFilters,daynight:'D'}).map(row=>row.id),['other']);
});

test('sorting puts missing values last, reverses present values, and ties by stable ID',()=>{
 const rows=[base({id:'z',frp:null}),base({id:'b',frp:10}),base({id:'a',frp:10}),base({id:'c',frp:3})];
 assert.deepEqual(sortRecords(rows,{key:'frp',direction:'asc'}).map(row=>row.id),['c','a','b','z']);
 assert.deepEqual(sortRecords(rows,{key:'frp',direction:'desc'}).map(row=>row.id),['a','b','c','z']);
});

test('pagination caps page size at 100 and clamps edge pages',()=>{
 const rows=Array.from({length:205},(_,index)=>base({id:String(index).padStart(3,'0')}));
 const page=paginateRecords(rows,99,100);assert.equal(page.page,2);assert.equal(page.pageCount,3);assert.equal(page.rows.length,5);
 assert.equal(paginateRecords(rows,-1,100).page,0);assert.equal(paginateRecords(rows,0,1000).pageSize,100);
});

test('CSV escapes commas newlines quotes and formula-like strings while preserving null',()=>{
 assert.equal(escapeCsvCell('a,b'), '"a,b"');
 assert.equal(escapeCsvCell('line\n"quoted"'), '"line\n""quoted"""');
 assert.equal(escapeCsvCell('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"');
 const csv=recordsToCsv([base({id:'=BAD',satellite:'line\nvalue',frp:null,originalProperties:{note:'metadata newline'}})]);
 assert.match(csv,/null/);assert.match(csv,/\'=BAD/);assert.match(csv,/"line\nvalue"/);
});

test('GeoJSON preserves lon-lat geometry, native fields, selection metadata, and all records',()=>{
 const rows=[base({id:'one',latitude:-10,longitude:-60,confidence:99}),base({id:'two',sensor:'VIIRS',confidence:'nominal'})];
 const output=buildGeoJson(rows,{source:'real',selection:{year:2026,month:10,region:'amazon',startDate:'2026-11-01',endDate:'2026-11-30',sensors:['MODIS','VIIRS']},filters:defaultExplorerFilters,partial:true,boundedCap:2,exportedAt:'2026-11-14T00:00:00.000Z'});
 assert.equal(output.features.length,2);assert.deepEqual(output.features[0]?.geometry.coordinates,[-60,-10]);assert.equal(output.features[0]?.properties.confidence,99);assert.equal(output.features[1]?.properties.confidence,'nominal');assert.equal(output.metadata.scope,'all currently filtered loaded records; not only the current page');assert.equal(output.metadata.partial,true);assert.deepEqual((output.metadata.selection as {sensors:string[]}).sensors,['MODIS','VIIRS']);
});
