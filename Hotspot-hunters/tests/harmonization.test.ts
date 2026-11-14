import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HARMONIZATION_STAGES,
  parseMetadataBundle,
  parseMethodologyMetadata,
  parseSensorsMetadata,
  sourceRequestPolicy
} from '../src/features/harmonization/model';

test('Harmonization Lab defines exactly seven ordered stages with explicit statuses',()=>{
  assert.equal(HARMONIZATION_STAGES.length,7);
  assert.deepEqual(HARMONIZATION_STAGES.map(stage=>stage.number),[1,2,3,4,5,6,7]);
  assert.deepEqual(HARMONIZATION_STAGES.map(stage=>stage.status),['implemented','conceptual','conceptual','implemented','planned','conceptual','planned']);
  for(const stage of HARMONIZATION_STAGES){
    assert.ok(stage.input.length>20);
    assert.ok(stage.processing.length>20);
    assert.ok(stage.output.length>20);
    assert.ok(stage.assumptions.length>0);
    assert.ok(stage.limitations.length>0);
  }
});

test('workflow retains the required scientific distinctions and non-claims',()=>{
  const text=HARMONIZATION_STAGES.map(stage=>[stage.title,stage.input,stage.processing,stage.output,...stage.limitations].join(' ')).join(' ').toLowerCase();
  for(const phrase of ['1 km','375 m','native confidence','missing','nrt','sensor bias','not a confirmed fire','harmonized index','independent validation'])assert.match(text,new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.match(HARMONIZATION_STAGES.find(stage=>stage.id==='spatial')?.limitations.join(' ')??'',/does not remove sensor bias/);
  assert.match(HARMONIZATION_STAGES.find(stage=>stage.id==='calibration')?.output??'',/none/);
  assert.match(HARMONIZATION_STAGES.find(stage=>stage.id==='validation')?.output??'',/not a pass\/fail result/);
});

test('metadata parser safely normalizes the verified response shape',()=>{
  const parsed=parseMetadataBundle({version:'0.1.0-uncalibrated',harmonization_status:'uncalibrated_raw',spatial_framework:{aggregation_grid:'0.1 degree equal-angle'},harmonization_roadmap:{current_phase:'Phase 1',next_phase:'Phase 2'},scientific_caveats:['Missing is not zero']},{sensors:[{id:'MODIS',platforms:['Terra','Aqua'],nominal_pixel_resolution_meters:1000,earliest_data:'2000-11-01',confidence_metric:'numeric (0 - 100)'}]},'backend');
  assert.equal(parsed.source,'backend');
  assert.equal(parsed.methodology.version,'0.1.0-uncalibrated');
  assert.equal(parsed.methodology.harmonizationStatus,'uncalibrated_raw');
  assert.equal(parsed.sensors[0]?.id,'MODIS');
  assert.equal(parsed.sensors[0]?.resolution,'1000');
});

test('malformed metadata is safe and never throws or invents sensor rows',()=>{
  assert.doesNotThrow(()=>parseMethodologyMetadata(null));
  assert.doesNotThrow(()=>parseSensorsMetadata({sensors:[null,42,'bad',{}]}));
  const parsed=parseMetadataBundle(null,{sensors:'not-an-array'},'backend');
  assert.equal(parsed.methodology.version,'Unavailable');
  assert.equal(parsed.methodology.harmonizationStatus,'Unavailable');
  assert.deepEqual(parsed.sensors,[]);
});

test('source behavior distinguishes real read-only metadata from demo mode',()=>{
  assert.equal(sourceRequestPolicy('real'),'GET metadata only');
  assert.equal(sourceRequestPolicy('demo'),'No backend request in demo mode');
  assert.equal(parseMetadataBundle({}, {}, 'demo').source,'demo');
});
