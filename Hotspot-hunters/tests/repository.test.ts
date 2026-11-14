import {test} from 'node:test';
import assert from 'node:assert/strict';
import {demoRepository} from '../src/data/repositories/demo';
import {demoAdapter} from '../src/data/observations';
import {createApiRepository} from '../src/data/repositories/api';
test('demo repository preserves existing observations, provenance and calendar',async()=>{
 const q={year:2024,month:8,region:'amazon',sensors:['MODIS','VIIRS'] as ('MODIS'|'VIIRS')[]};
 const result=await demoRepository.load(q);
 assert.deepEqual(result.records.map(o=>o.id),demoAdapter.select(q.year,q.month,q.region,q.sensors).map(o=>o.id));assert.ok(result.records.every(o=>o.dataSource==='demo'));
 assert.equal(result.source,'demo');assert.equal(result.partial,false);
 assert.deepEqual(await demoRepository.monthly(q),demoAdapter.monthly(q.year,q.region,q.sensors));
});
test('repository supports empty sensors and pre-VIIRS periods',async()=>{
 assert.equal((await demoRepository.load({year:2024,month:1,region:'global',sensors:[]})).records.length,0);
 assert.equal((await demoRepository.load({year:2011,month:1,region:'global',sensors:['VIIRS']})).records.length,0);
});
test('API repository exposes verified real mode',()=>{assert.equal(createApiRepository().mode,'real');});
