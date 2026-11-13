import {test} from 'node:test';
import assert from 'node:assert/strict';
import {demoAdapter,geojson,regions} from '../src/data/observations';
test('observations are deterministic, dated, bounded, and retain native sensor metadata',()=>{
 const data=demoAdapter.year(2024);assert.deepEqual(data,demoAdapter.year(2024));assert.equal(new Set(data.map(o=>o.id)).size,data.length);
 for(const o of data){assert.ok(o.longitude>=-180&&o.longitude<=180);assert.ok(o.latitude>=-90&&o.latitude<=90);assert.ok(!Number.isNaN(Date.parse(o.acquisitionDate)));assert.equal(typeof o.confidence,o.sensor==='MODIS'?'number':'string');assert.ok(o.frp>0);}
});
test('VIIRS unavailable before 2012 and filters agree with calendar and map',()=>{
 assert.equal(demoAdapter.year(1999).length,0);
 assert.equal(demoAdapter.select(2011,8,'global',['VIIRS']).length,0);
 for(const r of regions){const monthly=demoAdapter.monthly(2024,r.id,['MODIS']);for(let m=0;m<12;m++){const data=demoAdapter.select(2024,m,r.id,['MODIS']);assert.equal(monthly[m],data.length);assert.ok(data.every(o=>o.region===r.id&&o.sensor==='MODIS'));assert.equal(geojson(data).features.length,data.length);}}
 assert.equal(demoAdapter.select(2024,8,'global',[]).length,0);
});
