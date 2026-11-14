import type { DataMode, Sensor } from '../../shared/types/observation';
import { validDate } from '../../shared/dates';
import { regions } from '../../shared/geography';
import {
  defaultExplorerFilters,
  validateExplorerFilters,
  type ExplorerFilters,
} from '../data-explorer/model';

export type ResearchComparison = {
  mode: 'MODIS' | 'VIIRS' | 'split';
  split: number;
  globe: boolean;
  layer: 'points' | 'clusters' | 'density';
};

export type ResearchSelection = {
  region: string;
  startDate: string;
  endDate: string;
  sensors: Sensor[];
  dataMode: DataMode;
  filters: ExplorerFilters;
  comparison: ResearchComparison;
};

export type ResearchConfig = ResearchSelection & {
  version: 1;
  id: string;
  title: string;
  description: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type ResearchStorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export type ResearchStorageResult<T> = {
  ok: boolean;
  value?: T;
  error?: string;
};
export type ResearchReadResult = ResearchStorageResult<ResearchConfig[]> & {
  recoverable: boolean;
};

export const RESEARCH_STORAGE_KEY = 'hotspot-hunters.research-configs.v1';
export const RESEARCH_SHARE_PARAM = 'research';
export const RESEARCH_SHARE_MAX_LENGTH = 16_384;
export const RESEARCH_STORAGE_VERSION = 1 as const;

const MAX = {
  id: 128,
  title: 160,
  description: 2_000,
  notes: 10_000,
  search: 160,
  processingType: 32,
  filterNumber: 24,
};
const allSensors: Sensor[] = ['MODIS', 'VIIRS'];
const allRegions = new Set(['global', ...regions.map((region) => region.id)]);
const validLayers = new Set<ResearchComparison['layer']>(['points', 'clusters', 'density']);
const validComparisonModes = new Set<ResearchComparison['mode']>(['MODIS', 'VIIRS', 'split']);
const validProcessingTypes = new Set(['', 'NRT', 'STANDARD', 'SYNTHETIC', 'ARCHIVE']);
const validViirsConfidence = new Set(['', 'low', 'nominal', 'high']);

export const defaultResearchSelection: ResearchSelection = {
  region: 'global',
  startDate: '2024-01-01',
  endDate: '2024-01-31',
  sensors: [...allSensors],
  dataMode: 'demo',
  filters: { ...defaultExplorerFilters },
  comparison: { mode: 'split', split: 50, globe: true, layer: 'points' },
};

export type ResearchDraft = {
  title: string;
  description: string;
  notes: string;
  selection: ResearchSelection;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isString = (value: unknown, max = Infinity): value is string =>
  typeof value === 'string' && value.length <= max;
const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';
const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const hasOwn = (value: Record<string, unknown>, key: string) => Object.prototype.hasOwnProperty.call(value, key);

function isoTimestamp(value: unknown): value is string {
  if (!isString(value, 40) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === value;
}

function filterError(filters: unknown): string | null {
  if (!isRecord(filters)) return 'Filters must be an object.';
  const keys = Object.keys(defaultExplorerFilters) as Array<keyof ExplorerFilters>;
  if (keys.some((key) => !hasOwn(filters, key))) return 'Filters are missing a required field.';
  if (Object.keys(filters).some((key) => !keys.includes(key as keyof ExplorerFilters))) {
    return 'Filters contain an unsupported field.';
  }
  for (const key of keys) {
    const value = filters[key];
    if (!isString(value, key === 'search' ? MAX.search : key === 'processingType' ? MAX.processingType : MAX.filterNumber)) {
      return `Filter ${key} must be a bounded string.`;
    }
  }
  if (filters.daynight !== '' && filters.daynight !== 'D' && filters.daynight !== 'N') {
    return 'Day/night filter is invalid.';
  }
  if (typeof filters.viirsConfidence !== 'string' || !validViirsConfidence.has(filters.viirsConfidence)) return 'VIIRS confidence filter is invalid.';
  if (typeof filters.processingType !== 'string' || !validProcessingTypes.has(filters.processingType)) return 'Processing filter is invalid.';
  const explorerError = validateExplorerFilters(filters as ExplorerFilters);
  return explorerError;
}

export function validateResearchSelection(value: unknown): string[] {
  const errors: string[] = [];
  if (!isRecord(value)) return ['Research selection must be an object.'];
  if (!isString(value.region, 80) || !allRegions.has(value.region)) errors.push('Region is not supported.');
  const startDate = value.startDate;
  const endDate = value.endDate;
  if (!isString(startDate, 10) || !validDate(startDate)) errors.push('Start date must be a valid ISO date.');
  if (!isString(endDate, 10) || !validDate(endDate)) errors.push('End date must be a valid ISO date.');
  if (isString(startDate, 10) && isString(endDate, 10) && startDate > endDate) {
    errors.push('Start date must be on or before end date.');
  }
  if (!Array.isArray(value.sensors) || value.sensors.length < 1 || value.sensors.length > allSensors.length) {
    errors.push('Select one or two sensors.');
  } else if (
    value.sensors.some((sensor) => !allSensors.includes(sensor as Sensor)) ||
    new Set(value.sensors).size !== value.sensors.length
  ) {
    errors.push('Sensors must be unique MODIS/VIIRS values.');
  }
  if (value.dataMode !== 'demo' && value.dataMode !== 'real') errors.push('Data source must be demo or real.');
  const filtersMessage = filterError(value.filters);
  if (filtersMessage) errors.push(filtersMessage);
  if (!isRecord(value.comparison)) {
    errors.push('Comparison settings are required.');
  } else {
    if (!validComparisonModes.has(value.comparison.mode as ResearchComparison['mode'])) errors.push('Comparison mode is invalid.');
    if (!isFiniteNumber(value.comparison.split) || value.comparison.split < 0 || value.comparison.split > 100) {
      errors.push('Comparison split must be between 0 and 100.');
    }
    if (!isBoolean(value.comparison.globe)) errors.push('Globe setting must be boolean.');
    if (!validLayers.has(value.comparison.layer as ResearchComparison['layer'])) errors.push('Map layer is invalid.');
  }
  return errors;
}

export function validateResearchConfig(value: unknown): string[] {
  const errors: string[] = [];
  if (!isRecord(value)) return ['Research config must be an object.'];
  if (value.version !== RESEARCH_STORAGE_VERSION) errors.push('Research config version is unsupported.');
  if (!isString(value.id, MAX.id) || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value.id)) errors.push('Research config ID is invalid.');
  if (!isString(value.title, MAX.title) || value.title.trim().length < 1) errors.push('Title is required and must be 1–160 characters.');
  if (!isString(value.description, MAX.description)) errors.push('Description is too long.');
  if (!isString(value.notes, MAX.notes)) errors.push('Notes are too long.');
  if (!isoTimestamp(value.createdAt)) errors.push('Creation timestamp must be canonical ISO UTC.');
  if (!isoTimestamp(value.updatedAt)) errors.push('Update timestamp must be canonical ISO UTC.');
  errors.push(...validateResearchSelection(value));
  return [...new Set(errors)];
}

export function isResearchConfig(value: unknown): value is ResearchConfig {
  return validateResearchConfig(value).length === 0;
}

function getRandomId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch {
    // A non-cryptographic fallback is only used for a local identifier.
  }
  return `research-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function createResearchConfig(
  selection: ResearchSelection,
  metadata: Partial<Pick<ResearchConfig, 'title' | 'description' | 'notes'>> = {},
  now = new Date(),
): ResearchConfig {
  const timestamp = now.toISOString();
  const config: ResearchConfig = {
    version: 1,
    id: getRandomId(),
    title: metadata.title?.trim() || 'Untitled research study',
    description: metadata.description ?? '',
    notes: metadata.notes ?? '',
    createdAt: timestamp,
    updatedAt: timestamp,
    ...cloneSelection(selection),
  };
  const errors = validateResearchConfig(config);
  if (errors.length) throw new Error(errors.join(' '));
  return config;
}

export function updateResearchConfig(
  config: ResearchConfig,
  patch: Partial<Pick<ResearchConfig, 'title' | 'description' | 'notes'>> & Partial<ResearchSelection>,
  now = new Date(),
): ResearchConfig {
  const next: ResearchConfig = {
    ...config,
    ...cloneSelection({ ...config, ...patch }),
    ...(patch.title === undefined ? {} : { title: patch.title.trim() }),
    ...(patch.description === undefined ? {} : { description: patch.description }),
    ...(patch.notes === undefined ? {} : { notes: patch.notes }),
    updatedAt: now.toISOString(),
  };
  const errors = validateResearchConfig(next);
  if (errors.length) throw new Error(errors.join(' '));
  return next;
}

export function duplicateResearchConfig(config: ResearchConfig, now = new Date()): ResearchConfig {
  return createResearchConfig(cloneSelection(config), {
    title: `${config.title} copy`.slice(0, MAX.title),
    description: config.description,
    notes: config.notes,
  }, now);
}

export function cloneSelection(selection: ResearchSelection): ResearchSelection {
  return {
    region: selection.region,
    startDate: selection.startDate,
    endDate: selection.endDate,
    sensors: [...selection.sensors],
    dataMode: selection.dataMode,
    filters: { ...selection.filters },
    comparison: { ...selection.comparison },
  };
}

export function createDraftFromConfig(config: ResearchConfig): ResearchDraft {
  return {
    title: config.title,
    description: config.description,
    notes: config.notes,
    selection: cloneSelection(config),
  };
}

function storageAvailable(storage: ResearchStorageLike | undefined): storage is ResearchStorageLike {
  return Boolean(storage && typeof storage.getItem === 'function' && typeof storage.setItem === 'function' && typeof storage.removeItem === 'function');
}

function defaultStorage(): ResearchStorageLike | undefined {
  try {
    return typeof window !== 'undefined' && storageAvailable(window.localStorage) ? window.localStorage : undefined;
  } catch {
    return undefined;
  }
}

type StoredResearchPayload = { version: 1; configs: ResearchConfig[] };

function readPayload(storage: ResearchStorageLike | undefined): ResearchReadResult {
  if (!storageAvailable(storage)) return { ok: false, value: [], recoverable: true, error: 'Local browser storage is unavailable or blocked.' };
  let raw: string | null;
  try {
    raw = storage.getItem(RESEARCH_STORAGE_KEY);
  } catch {
    return { ok: false, value: [], recoverable: true, error: 'Local browser storage could not be read.' };
  }
  if (raw === null) return { ok: true, value: [], recoverable: true };
  if (raw.length > 1_000_000) {
    return { ok: false, value: [], recoverable: false, error: 'Saved research storage is too large to read safely.' };
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== 1 || !Array.isArray(parsed.configs)) {
      return { ok: false, value: [], recoverable: false, error: 'Saved research storage is malformed; existing entries were left untouched.' };
    }
    const configs = parsed.configs.filter(isResearchConfig);
    if (configs.length !== parsed.configs.length) {
      return { ok: false, value: configs, recoverable: false, error: 'Saved research storage contains an invalid entry; existing entries were left untouched.' };
    }
    return { ok: true, value: configs, recoverable: true };
  } catch {
    return { ok: false, value: [], recoverable: false, error: 'Saved research storage is corrupt; existing entries were left untouched.' };
  }
}

export function createResearchStorageAdapter(storage: ResearchStorageLike | undefined = defaultStorage()) {
  const read = (): ResearchReadResult => readPayload(storage);
  const write = (configs: ResearchConfig[]): ResearchStorageResult<ResearchConfig[]> => {
    const current = read();
    if (!current.ok) return { ok: false, error: current.error };
    try {
      const payload: StoredResearchPayload = { version: 1, configs };
      storage?.setItem(RESEARCH_STORAGE_KEY, JSON.stringify(payload));
      return { ok: true, value: configs };
    } catch {
      return { ok: false, error: 'Research could not be saved. Browser storage may be full or blocked.' };
    }
  };
  return {
    read,
    list: () => read(),
    save(config: ResearchConfig): ResearchStorageResult<ResearchConfig[]> {
      const validation = validateResearchConfig(config);
      if (validation.length) return { ok: false, error: validation.join(' ') };
      const current = read();
      if (!current.ok) return { ok: false, error: current.error };
      const withoutSameId = (current.value ?? []).filter((item) => item.id !== config.id);
      return write([...withoutSameId, config]);
    },
    remove(id: string): ResearchStorageResult<ResearchConfig[]> {
      if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(id)) return { ok: false, error: 'Research config ID is invalid.' };
      const current = read();
      if (!current.ok) return { ok: false, error: current.error };
      return write((current.value ?? []).filter((item) => item.id !== id));
    },
  };
}

export function loadResearchConfigs(storage?: ResearchStorageLike): ResearchReadResult {
  return createResearchStorageAdapter(storage).read();
}
export function saveResearchConfig(config: ResearchConfig, storage?: ResearchStorageLike): ResearchStorageResult<ResearchConfig[]> {
  return createResearchStorageAdapter(storage).save(config);
}
export function deleteResearchConfig(id: string, storage?: ResearchStorageLike): ResearchStorageResult<ResearchConfig[]> {
  return createResearchStorageAdapter(storage).remove(id);
}

function encodeSnapshot(config: ResearchConfig): string {
  return encodeURIComponent(JSON.stringify(config));
}

function safeBaseUrl(baseUrl: string): URL {
  if (!isString(baseUrl, 4_096) || /^\s*javascript:/i.test(baseUrl)) throw new Error('Share URL base must be an HTTP(S) URL.');
  let url: URL;
  try {
    url = new URL(baseUrl, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
  } catch {
    throw new Error('Share URL base is invalid.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('Share URL base must use HTTP(S).');
  return url;
}

export function createShareUrl(config: ResearchConfig, baseUrl = typeof window !== 'undefined' ? window.location.href : 'http://localhost/'): string {
  const errors = validateResearchConfig(config);
  if (errors.length) throw new Error(`Cannot share invalid research config: ${errors.join(' ')}`);
  const url = safeBaseUrl(baseUrl);
  const encoded = encodeSnapshot(config);
  const hash = `#${RESEARCH_SHARE_PARAM}=${encoded}`;
  if (hash.length > RESEARCH_SHARE_MAX_LENGTH) throw new Error('Share URL is too long. Shorten the description or notes.');
  url.hash = hash.slice(1);
  return url.toString();
}

export function parseSharedConfigDetailed(hash: string): ResearchStorageResult<ResearchConfig> {
  if (!isString(hash, RESEARCH_SHARE_MAX_LENGTH + 64) || !hash.startsWith(`#${RESEARCH_SHARE_PARAM}=`)) {
    return { ok: false, error: 'No supported research snapshot was found in this link.' };
  }
  const encoded = hash.slice(`#${RESEARCH_SHARE_PARAM}=`.length);
  if (!encoded || encoded.length > RESEARCH_SHARE_MAX_LENGTH) return { ok: false, error: 'The research snapshot link is too long or empty.' };
  try {
    const decoded = decodeURIComponent(encoded);
    if (decoded.length > RESEARCH_SHARE_MAX_LENGTH) return { ok: false, error: 'The research snapshot is too large.' };
    const parsed: unknown = JSON.parse(decoded);
    const errors = validateResearchConfig(parsed);
    if (errors.length) return { ok: false, error: `Shared research snapshot is invalid: ${errors.join(' ')}` };
    return { ok: true, value: parsed as ResearchConfig };
  } catch {
    return { ok: false, error: 'Shared research snapshot is malformed or could not be decoded.' };
  }
}

export function parseSharedConfig(hash: string): ResearchConfig | null {
  return parseSharedConfigDetailed(hash).value ?? null;
}

export function appendMethodologyNotes(current: string, methodologyNotes?: string): string {
  const addition = methodologyNotes?.trim() ?? '';
  if (!addition || current.includes(addition)) return current;
  return current.trim() ? `${current.trim()}\n\n${addition}` : addition;
}
