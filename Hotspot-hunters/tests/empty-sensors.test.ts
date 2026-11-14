import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createApiRepository} from '../src/data/repositories/api';
import {burnCalendarApi} from '../src/data/apiClient';
import {demoRepository} from '../src/data/repositories/demo';
test('real map no-sensor selection is empty and calendar does not request default all sensors',async()=>{
 const q={year:2026,month:10,region:'global',sensors:[]};
 const repository=createApiRepository();
 assert.deepEqual((await repository.load(q)).records,[]);
 await assert.rejects(repository.calendar(q),/Select at least one sensor/);
});
test('summary, quality and raw analysis do not submit empty sensor arrays as all sensors',async()=>{
 for(const method of [burnCalendarApi.getSummary,burnCalendarApi.getQuality,burnCalendarApi.analyze])await assert.rejects(method('global','2026-11-01','2026-11-30',[]),/Select at least one sensor/);
});
test('demo no-sensor calendar has an explicit all-zero selection',async()=>{
 const c=await demoRepository.calendar({year:2026,month:10,region:'global',sensors:[]});
 assert.equal(c.annual_total_detections,0);assert.ok(c.monthly_rhythm.every(m=>m.detection_count===0));
});
