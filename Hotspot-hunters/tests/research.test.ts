import assert from 'node:assert/strict';
import {
  RESEARCH_STORAGE_KEY,
  appendMethodologyNotes,
  createResearchConfig,
  createResearchStorageAdapter,
  createShareUrl,
  defaultResearchSelection,
  duplicateResearchConfig,
  parseSharedConfig,
  parseSharedConfigDetailed,
  updateResearchConfig,
  validateResearchConfig,
  validateResearchSelection,
  type ResearchConfig,
  type ResearchStorageLike,
} from '../src/features/research/model';

class MemoryStorage implements ResearchStorageLike {
  private values = new Map<string, string>();
  constructor(private readonly mode: 'normal' | 'quota' | 'blocked' = 'normal') {}
  getItem(key: string) {
    if (this.mode === 'blocked') throw new Error('blocked');
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    if (this.mode === 'blocked') throw new Error('blocked');
    if (this.mode === 'quota') throw new Error('quota');
    this.values.set(key, value);
  }
  removeItem(key: string) {
    if (this.mode === 'blocked') throw new Error('blocked');
    this.values.delete(key);
  }
  raw(key = RESEARCH_STORAGE_KEY) {
    return this.values.get(key) ?? null;
  }
  seed(value: string) {
    this.values.set(RESEARCH_STORAGE_KEY, value);
  }
}

const selection = {
  ...defaultResearchSelection,
  startDate: '2025-02-01',
  endDate: '2025-02-28',
  sensors: ['MODIS', 'VIIRS'] as const,
  dataMode: 'real' as const,
  filters: {
    ...defaultResearchSelection.filters,
    minFrp: '10',
    maxFrp: '900',
    modisConfidenceMin: '30',
    viirsConfidence: 'nominal' as const,
    processingType: 'STANDARD',
  },
  comparison: { mode: 'split' as const, split: 42, globe: false, layer: 'clusters' as const },
};

const fixedNow = new Date('2026-11-14T00:00:00.000Z');
const makeConfig = (overrides: Partial<ResearchConfig> = {}) =>
  createResearchConfig(selection, {
    title: 'Unicode study – Δ火',
    description: 'A local description with Unicode: 東京',
    notes: 'Private notes – do not post',
  }, fixedNow,);

const config = makeConfig();

assert.equal(validateResearchSelection(selection).length, 0, 'valid source and native filters should pass');
assert.equal(config.dataMode, 'real');
assert.equal(config.filters.modisConfidenceMin, '30');
assert.equal(config.filters.viirsConfidence, 'nominal');
assert.ok(validateResearchConfig(config).length === 0);

assert.ok(validateResearchSelection({ ...selection, startDate: '2025-02-30' }).some((error) => error.includes('Start date')));
assert.ok(validateResearchSelection({ ...selection, startDate: '2025-03-01', endDate: '2025-02-28' }).some((error) => error.includes('on or before')));
assert.ok(validateResearchSelection({ ...selection, region: 'not-a-region' }).some((error) => error.includes('Region')));
assert.ok(validateResearchSelection({ ...selection, comparison: { ...selection.comparison, split: 101 } }).some((error) => error.includes('split')));
assert.ok(validateResearchSelection({ ...selection, comparison: { ...selection.comparison, layer: 'unsupported' } }).some((error) => error.includes('layer')));
assert.ok(validateResearchSelection({ ...selection, filters: { ...selection.filters, minFrp: '-1' } }).some((error) => error.includes('FRP')));
assert.ok(validateResearchSelection({ ...selection, filters: { ...selection.filters, modisConfidenceMin: 'not-number' } }).some((error) => error.includes('MODIS')));
assert.ok(validateResearchConfig({ ...config, version: 2 }).some((error) => error.includes('version')));

const storage = new MemoryStorage();
const adapter = createResearchStorageAdapter(storage);
assert.deepEqual(adapter.read().value, []);
assert.equal(adapter.save(config).ok, true);
assert.equal(adapter.read().value?.length, 1);
const edited = updateResearchConfig(config, { notes: 'Updated note – 日本語' }, new Date('2026-11-14T00:01:00.000Z'));
assert.equal(adapter.save(edited).ok, true);
assert.equal(adapter.read().value?.[0].notes, 'Updated note – 日本語');
const duplicate = duplicateResearchConfig(edited, new Date('2026-11-14T00:02:00.000Z'));
assert.notEqual(duplicate.id, edited.id, 'duplicate must get a new stable ID');
assert.notEqual(duplicate.createdAt, edited.createdAt, 'duplicate must get fresh timestamps');
assert.equal(duplicate.filters.viirsConfidence, 'nominal');
assert.equal(adapter.save(duplicate).ok, true);
assert.equal(adapter.read().value?.length, 2);
assert.equal(adapter.remove(edited.id).ok, true);
assert.equal(adapter.read().value?.length, 1);
assert.equal(adapter.read().value?.[0].id, duplicate.id);

const corruptStorage = new MemoryStorage();
corruptStorage.seed('{"version":1,"configs":[{"broken":true}]}');
const corruptAdapter = createResearchStorageAdapter(corruptStorage);
const corruptRead = corruptAdapter.read();
assert.equal(corruptRead.ok, false, 'malformed saved entries must be surfaced');
const rawBefore = corruptStorage.raw();
assert.equal(corruptAdapter.save(config).ok, false, 'corrupt storage must not be overwritten');
assert.equal(corruptStorage.raw(), rawBefore, 'corrupt payload must remain untouched');

const quotaAdapter = createResearchStorageAdapter(new MemoryStorage('quota'));
assert.equal(quotaAdapter.save(config).ok, false, 'quota errors must be guarded');
const blockedAdapter = createResearchStorageAdapter(new MemoryStorage('blocked'));
assert.equal(blockedAdapter.read().ok, false, 'blocked storage must be guarded');

const shared = createShareUrl(config, 'https://example.test/research?view=workspace');
assert.match(shared, /^https:\/\/example\.test\/research\?view=workspace#research=/);
const parsedShared = parseSharedConfig(new URL(shared).hash);
assert.deepEqual(parsedShared, config, 'share snapshots must round-trip Unicode and all selection details');
assert.equal(parseSharedConfig('#research=%7Bbad'), null);
assert.equal(parseSharedConfigDetailed('#research=%7Bbad').ok, false);
assert.throws(() => createShareUrl(config, 'javascript:alert(1)'), /HTTP\(S\)/);
assert.throws(() => createShareUrl({ ...config, notes: 'x'.repeat(20_000) }, 'https://example.test/'), /too long|invalid/i);

assert.equal(appendMethodologyNotes('Existing note', 'Methodology note'), 'Existing note\n\nMethodology note');
assert.equal(appendMethodologyNotes('Existing note\n\nMethodology note', 'Methodology note'), 'Existing note\n\nMethodology note');
console.log('research.test.ts passed');
