import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { regions } from '../../shared/geography';
import type { DataMode, Sensor } from '../../shared/types/observation';
import {
  appendMethodologyNotes,
  cloneSelection,
  createDraftFromConfig,
  createResearchConfig,
  createResearchStorageAdapter,
  createShareUrl,
  defaultResearchSelection,
  duplicateResearchConfig,
  parseSharedConfigDetailed,
  updateResearchConfig,
  validateResearchSelection,
  type ResearchConfig,
  type ResearchDraft,
  type ResearchSelection,
  type ResearchStorageLike,
} from './model';
import '../../styles/research.css';

export type ResearchWorkspaceProps = {
  selection: ResearchSelection;
  onApply: (selection: ResearchSelection) => void;
  methodologyNotes?: string;
  onLab: () => void;
  onAnalytics: () => void;
  onData: () => void;
  storage?: ResearchStorageLike;
};

type DraftMeta = Pick<ResearchDraft, 'title' | 'description' | 'notes'>;
const sensors: Sensor[] = ['MODIS', 'VIIRS'];
const formatDateTime = (value: string) => new Date(value).toLocaleString();

function FieldError({ message,id }: { message?: string;id?:string }) {
  return message ? <span id={id} className="research-field-error" role="alert">{message}</span> : null;
}

function statusText(error: string | null, status: string) {
  if (error) return <span className="research-status-error" role="alert">{error}</span>;
  return <span role="status" aria-live="polite">{status}</span>;
}

export default function ResearchWorkspace(props: ResearchWorkspaceProps) {
  const adapter = useMemo(() => createResearchStorageAdapter(props.storage), [props.storage]);
  const initialDraft: ResearchDraft = {
    title: 'Untitled research study',
    description: '',
    notes: appendMethodologyNotes('', props.methodologyNotes),
    selection: cloneSelection(props.selection ?? defaultResearchSelection),
  };
  const [draft, setDraft] = useState<ResearchDraft>(initialDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [configs, setConfigs] = useState<ResearchConfig[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('Draft is not saved.');
  const [shareUrl, setShareUrl] = useState('');
  const [shareWarning, setShareWarning] = useState('');
  const [selectionErrors, setSelectionErrors] = useState<string[]>([]);
  const [importMessage, setImportMessage] = useState('');

  useEffect(() => {
    const result = adapter.read();
    setConfigs(result.value ?? []);
    if (!result.ok) setError(result.error ?? 'Local browser storage is unavailable.');
    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    if (hash) {
      const imported = parseSharedConfigDetailed(hash);
      if (imported.ok && imported.value) {
        const next = createDraftFromConfig(imported.value);
        setDraft(next);
        setEditingId(null);
        setShareUrl('');
        setImportMessage('Shared snapshot loaded as an unsaved draft. Review it, then apply or save explicitly.');
        setStatus('Imported draft ready for review.');
        window.history.replaceState(null,'',window.location.pathname+window.location.search);
      } else if (!imported.ok && hash.startsWith('#research=')) {
        setError(imported.error ?? 'Shared snapshot could not be loaded.');
      }
    }
  }, [adapter]);

  useEffect(() => {
    if (!editingId && props.methodologyNotes) {
      setDraft((current) => ({ ...current, notes: appendMethodologyNotes(current.notes, props.methodologyNotes) }));
    }
  }, [props.methodologyNotes, editingId]);

  const updateSelection = <K extends keyof ResearchSelection>(key: K, value: ResearchSelection[K]) => {
    setDraft((current) => ({ ...current, selection: { ...current.selection, [key]: value } }));
    setSelectionErrors([]);
    setShareUrl('');
  };
  const updateFilter = (key: keyof ResearchSelection['filters'], value: string) => {
    updateSelection('filters', { ...draft.selection.filters, [key]: value });
  };
  const updateComparison = <K extends keyof ResearchSelection['comparison']>(key: K, value: ResearchSelection['comparison'][K]) => {
    updateSelection('comparison', { ...draft.selection.comparison, [key]: value });
  };
  const setMeta = (key: keyof DraftMeta, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setShareUrl('');
  };

  const validateDraft = () => {
    const errors = validateResearchSelection(draft.selection);
    setSelectionErrors(errors);
    return errors;
  };

  const persist = (config: ResearchConfig) => {
    const result = adapter.save(config);
    if (!result.ok) {
      setError(result.error ?? 'Research could not be saved.');
      setStatus('Draft preserved; no saved entry was changed.');
      return false;
    }
    setConfigs(result.value ?? []);
    setError(null);
    setStatus(`Saved locally at ${formatDateTime(config.updatedAt)}.`);
    return true;
  };

  const saveDraft = (event?: FormEvent) => {
    event?.preventDefault();
    if (validateDraft().length) {
      setError('Review the highlighted research fields before saving.');
      return;
    }
    try {
      const saved = editingId
        ? updateResearchConfig(
            configs.find((config) => config.id === editingId) ?? createResearchConfig(draft.selection, draft),
            { ...draft.selection, title: draft.title, description: draft.description, notes: draft.notes },
          )
        : createResearchConfig(draft.selection, draft);
      if (persist(saved)) {
        setEditingId(saved.id);
        setDraft(createDraftFromConfig(saved));
        setShareUrl('');
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Research could not be saved.');
    }
  };

  const reopen = (config: ResearchConfig) => {
    setDraft(createDraftFromConfig(config));
    setEditingId(config.id);
    setSelectionErrors([]);
    setShareUrl('');
    setImportMessage('');
    setError(null);
    setStatus(`Reopened “${config.title}”. Editing remains local until you save.`);
  };

  const duplicate = (config: ResearchConfig) => {
    try {
      const copy = duplicateResearchConfig(config);
      if (persist(copy)) {
        setDraft(createDraftFromConfig(copy));
        setEditingId(copy.id);
        setShareUrl('');
      }
    } catch (duplicateError) {
      setError(duplicateError instanceof Error ? duplicateError.message : 'Research could not be duplicated.');
    }
  };

  const remove = (config: ResearchConfig) => {
    const result = adapter.remove(config.id);
    if (!result.ok) {
      setError(result.error ?? 'Research could not be deleted.');
      return;
    }
    setConfigs(result.value ?? []);
    if (editingId === config.id) {
      setEditingId(null);
      setDraft(initialDraft);
    }
    setShareUrl('');
    setError(null);
    setStatus(`Deleted “${config.title}” from this browser.`);
  };

  const snapshotParent = () => {
    setDraft((current) => ({
      ...current,
      selection: cloneSelection(props.selection),
      notes: editingId ? current.notes : appendMethodologyNotes(current.notes, props.methodologyNotes),
    }));
    setSelectionErrors([]);
    setShareUrl('');
    setStatus(editingId ? 'Parent selection copied; saved study notes were preserved.' : 'Current parent selection copied into the unsaved draft.');
  };

  const applyDraft = () => {
    if (validateDraft().length) {
      setError('Review the highlighted research fields before applying.');
      return;
    }
    props.onApply(cloneSelection(draft.selection));
    setError(null);
    setStatus('Selection applied to the parent view.');
  };

  const generateShare = () => {
    try {
      if (validateDraft().length) {
        setError('Fix validation errors before generating a share link.');
        return;
      }
      const snapshot = editingId
        ? updateResearchConfig(
            configs.find((config) => config.id === editingId) ?? createResearchConfig(draft.selection, draft),
            { ...draft.selection, title: draft.title, description: draft.description, notes: draft.notes },
          )
        : createResearchConfig(draft.selection, draft);
      const base = typeof window !== 'undefined' ? window.location.href.split('#')[0] : 'http://localhost/';
      setShareUrl(createShareUrl(snapshot, base));
      setShareWarning('This link contains the study notes and can be read by anyone who receives it. Nothing was posted or sent automatically.');
      setError(null);
      setStatus('Portable share snapshot generated; it is not a server-saved study.');
    } catch (shareError) {
      setShareUrl('');
      setShareWarning('');
      setError(shareError instanceof Error ? shareError.message : 'Share link could not be generated.');
    }
  };

  const selectionError = selectionErrors[0];
  const inputError = (text: string) => selectionErrors.find((item) => item.toLowerCase().includes(text));

  return (
    <section className="workspace-page research-page" aria-labelledby="research-page-title">
      <header className="research-header">
        <div>
          <span className="research-eyebrow">HOTSPOT HUNTERS / RESEARCH WORKSPACE</span>
          <h1 id="research-page-title">Frame the question.</h1>
          <p>Create a local, reproducible view of the current parent selection. Research snapshots preserve native sensor values and make no harmonization or certification claim.</p>
        </div>
        <span className="research-local-badge">LOCAL / BROWSER ONLY</span>
      </header>

      <div className="research-notice" role="note">
        <strong>Local study configurations.</strong> Saved entries stay in this browser under a versioned local-storage key. They are not server-persisted, authenticated, shared with other users, or automatically posted anywhere.
      </div>
      {(error || importMessage) && <div className={error ? 'research-message research-message-error' : 'research-message'} role={error ? 'alert' : 'status'}>{error ?? importMessage}</div>}

      <div className="research-layout">
        <form className="research-editor research-card" onSubmit={saveDraft} noValidate>
          <div className="research-card-heading"><div><span className="research-step">01 / CONFIGURE</span><h2>{editingId ? 'Edit study' : 'New study'}</h2></div><button type="button" onClick={snapshotParent}>Snapshot parent</button></div>
          <p className="research-help">Snapshot copies the parent region, dates, source, sensors, explorer filters, and comparison controls. It never changes the parent until you explicitly apply it.</p>
          <div className="research-form-grid">
            <label htmlFor="research-title">Research title<input id="research-title" required maxLength={160} value={draft.title} onChange={(event) => setMeta('title', event.target.value)} /></label>
            <label htmlFor="research-region">Region<select id="research-region" aria-invalid={!!inputError('region')} aria-describedby={inputError('region')?'research-region-error':undefined} value={draft.selection.region} onChange={(event) => updateSelection('region', event.target.value)}><option value="global">Global</option>{regions.map((region) => <option value={region.id} key={region.id}>{region.name}</option>)}</select><FieldError id="research-region-error" message={inputError('region')} /></label>
          </div>
          <label htmlFor="research-description">Description<textarea id="research-description" maxLength={2000} rows={2} value={draft.description} onChange={(event) => setMeta('description', event.target.value)} /></label>
          <div className="research-form-grid">
            <label htmlFor="research-start">Start date (ISO)<input id="research-start" aria-invalid={!!inputError('start date')} aria-describedby={inputError('start date')?'research-start-error':undefined} type="date" value={draft.selection.startDate} onChange={(event) => updateSelection('startDate', event.target.value)} /><FieldError id="research-start-error" message={inputError('start date')} /></label>
            <label htmlFor="research-end">End date (ISO)<input id="research-end" aria-invalid={!!inputError('end date')} aria-describedby={inputError('end date')?'research-end-error':undefined} type="date" value={draft.selection.endDate} onChange={(event) => updateSelection('endDate', event.target.value)} /><FieldError id="research-end-error" message={inputError('end date')} /></label>
          </div>
          <fieldset className="research-fieldset" aria-invalid={!!inputError('sensors')} aria-describedby={inputError('sensors')?'research-sensors-error':undefined}><legend>Selected sensors</legend><div className="research-check-row">{sensors.map((sensor) => <label key={sensor} htmlFor={`research-sensor-${sensor}`}><input id={`research-sensor-${sensor}`} type="checkbox" checked={draft.selection.sensors.includes(sensor)} onChange={() => updateSelection('sensors', draft.selection.sensors.includes(sensor) ? draft.selection.sensors.filter((item) => item !== sensor) : [...draft.selection.sensors, sensor])} />{sensor}</label>)}</div><FieldError id="research-sensors-error" message={inputError('sensors')} /></fieldset>
          <label htmlFor="research-source">Data source<select id="research-source" value={draft.selection.dataMode} onChange={(event) => updateSelection('dataMode', event.target.value as DataMode)}><option value="demo">Synthetic demo</option><option value="real">Backend / FIRMS</option></select></label>

          <details className="research-details" open><summary>Native explorer filters</summary><p className="research-help">These filters remain sensor-native: MODIS confidence is numeric; VIIRS confidence remains categorical. No common confidence score is created.</p><div className="research-filter-grid">
            <label htmlFor="research-search">Search<input id="research-search" maxLength={160} value={draft.selection.filters.search} onChange={(event) => updateFilter('search', event.target.value)} /></label>
            <label htmlFor="research-min-frp">Minimum FRP (MW)<input id="research-min-frp" inputMode="decimal" value={draft.selection.filters.minFrp} onChange={(event) => updateFilter('minFrp', event.target.value)} /></label>
            <label htmlFor="research-max-frp">Maximum FRP (MW)<input id="research-max-frp" inputMode="decimal" value={draft.selection.filters.maxFrp} onChange={(event) => updateFilter('maxFrp', event.target.value)} /></label>
            <label htmlFor="research-daynight">Day / night<select id="research-daynight" value={draft.selection.filters.daynight} onChange={(event) => updateFilter('daynight', event.target.value)}><option value="">Any</option><option value="D">Day</option><option value="N">Night</option></select></label>
            <label htmlFor="research-modis-min">MODIS confidence minimum<input id="research-modis-min" inputMode="decimal" value={draft.selection.filters.modisConfidenceMin} onChange={(event) => updateFilter('modisConfidenceMin', event.target.value)} /></label>
            <label htmlFor="research-modis-max">MODIS confidence maximum<input id="research-modis-max" inputMode="decimal" value={draft.selection.filters.modisConfidenceMax} onChange={(event) => updateFilter('modisConfidenceMax', event.target.value)} /></label>
            <label htmlFor="research-viirs-confidence">VIIRS native confidence<select id="research-viirs-confidence" value={draft.selection.filters.viirsConfidence} onChange={(event) => updateFilter('viirsConfidence', event.target.value)}><option value="">Any</option><option value="low">Low</option><option value="nominal">Nominal</option><option value="high">High</option></select></label>
            <label htmlFor="research-processing">Processing<select id="research-processing" value={draft.selection.filters.processingType} onChange={(event) => updateFilter('processingType', event.target.value)}><option value="">Any</option><option value="NRT">NRT</option><option value="STANDARD">Standard</option><option value="ARCHIVE">Archive</option><option value="SYNTHETIC">Synthetic</option></select></label>
          </div></details>

          <details className="research-details" open><summary>Comparison settings</summary><div className="research-form-grid">
            <label htmlFor="research-comparison">Comparison mode<select id="research-comparison" value={draft.selection.comparison.mode} onChange={(event) => updateComparison('mode', event.target.value as ResearchSelection['comparison']['mode'])}><option value="split">Split MODIS / VIIRS</option><option value="MODIS">MODIS only</option><option value="VIIRS">VIIRS only</option></select></label>
            <label htmlFor="research-layer">Map layer<select id="research-layer" value={draft.selection.comparison.layer} onChange={(event) => updateComparison('layer', event.target.value as ResearchSelection['comparison']['layer'])}><option value="points">Points</option><option value="clusters">Clusters</option><option value="density">Density</option></select></label>
          </div><div className="research-form-grid research-range-row"><label htmlFor="research-split">Split position ({draft.selection.comparison.split}%)<input id="research-split" type="range" min="0" max="100" step="1" value={draft.selection.comparison.split} onChange={(event) => updateComparison('split', Number(event.target.value))} /></label><label className="research-inline-check" htmlFor="research-globe"><input id="research-globe" type="checkbox" checked={draft.selection.comparison.globe} onChange={(event) => updateComparison('globe', event.target.checked)} /> Globe projection</label></div></details>

          <label htmlFor="research-notes">Notes<textarea id="research-notes" maxLength={10000} rows={5} value={draft.notes} onChange={(event) => setMeta('notes', event.target.value)} placeholder="Private notes are included in share links." /></label>
          {selectionError && <div className="research-validation" role="alert">{selectionErrors.map((item) => <div key={item}>{item}</div>)}</div>}
          <div className="research-actions"><button className="research-primary" type="submit">{editingId ? 'Save changes locally' : 'Save research locally'}</button><button type="button" onClick={applyDraft}>Apply to parent</button><button type="button" onClick={generateShare}>Generate share link</button></div>
          {shareUrl && <div className="research-share"><label htmlFor="research-share-url">Share URL <span>(length {shareUrl.length.toLocaleString()})</span><input id="research-share-url" readOnly value={shareUrl} /></label><p>{shareWarning}</p></div>}
          <div className="research-workflow-links" aria-label="Connected research workflow"><span>Continue to</span><button type="button" onClick={props.onAnalytics}>Analytics</button><button type="button" onClick={props.onData}>Data Explorer</button><button type="button" onClick={props.onLab}>Methodology Lab</button></div>
          <p className="research-status">{statusText(error, status)}</p>
        </form>

        <aside className="research-library research-card" aria-labelledby="research-library-title">
          <div className="research-card-heading"><div><span className="research-step">02 / LIBRARY</span><h2 id="research-library-title">Saved locally</h2></div><span className="research-count" aria-label={`${configs.length} saved studies`}>{configs.length}</span></div>
          <p className="research-help">Reopen restores filters, source, dates, sensors, and comparison settings. Applying is always explicit.</p>
          {configs.length === 0 ? <div className="research-empty" role="status">No saved research studies in this browser.</div> : <ul className="research-config-list">{configs.map((config) => <li key={config.id} className={editingId === config.id ? 'is-active' : ''}><div><strong>{config.title}</strong><small>{config.region} · {config.startDate} → {config.endDate}</small><small>Updated {formatDateTime(config.updatedAt)} · {config.dataMode === 'real' ? 'backend/raw' : 'synthetic/demo'}</small></div><div className="research-config-actions"><button type="button" onClick={() => reopen(config)}>Reopen / edit</button><button type="button" onClick={() => duplicate(config)}>Duplicate</button><button type="button" className="research-danger" onClick={() => remove(config)}>Delete</button></div></li>)}</ul>}
          <div className="research-integrity-note" role="note"><strong>Scientific boundary.</strong> A saved configuration is a selection recipe, not a result, certification, calibrated index, or harmonized observation set. Native confidence and provenance stay separate.</div>
        </aside>
      </div>
    </section>
  );
}

export { ResearchWorkspace };
