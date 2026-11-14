import {useEffect,useMemo,useState} from 'react';
import type {FormEvent} from 'react';
import {burnCalendarApi} from '../../data/apiClient';
import type {DataMode} from '../../shared/types/observation';
import {
  HARMONIZATION_STAGES,
  parseMetadataBundle,
  sourceRequestPolicy,
  type HarmonizationMetadata,
  type HarmonizationStage,
  type StageStatus
} from './model';
import '../../styles/harmonization.css';

export type HarmonizationLabProps={dataMode:DataMode;onResearch:(notes:string)=>void};
type LoadStatus='loading'|'ready'|'error';
type LoadState={key:string;status:LoadStatus;metadata?:HarmonizationMetadata;error?:string};

const demoMetadata=parseMetadataBundle({}, {}, 'demo');
const statusLabel:Record<StageStatus,string>={implemented:'Implemented',conceptual:'Conceptual',planned:'Planned'};
const policyText=(mode:DataMode)=>mode==='real'?'Read-only GET /api/v1/methodology + GET /api/v1/sensors':'No backend request; explanatory content only';

function MetadataValue({children}:{children:string}){
  return <dd>{children==='Unavailable'?<span className="lab-unavailable">Unavailable</span>:children}</dd>;
}

function StageStatusBadge({status}:{status:StageStatus}){
  return <span className={`lab-status lab-status-${status}`} aria-label={`Stage status: ${statusLabel[status]}`}>{statusLabel[status]}</span>;
}

function StageSelector({stages,selected,onSelect}:{stages:readonly HarmonizationStage[];selected:string;onSelect:(id:string)=>void}){
  return <nav className="lab-stage-selector" aria-label="Harmonization workflow stages">
    <p className="lab-panel-kicker">WORKFLOW MAP</p>
    <ol>
      {stages.map(stage=><li key={stage.id}>
        <button type="button" className={selected===stage.id?'is-selected':''} aria-current={selected===stage.id?'step':undefined} onClick={()=>onSelect(stage.id)}>
          <span className="lab-stage-number" aria-hidden="true">{String(stage.number).padStart(2,'0')}</span>
          <span className="lab-stage-button-copy"><strong>{stage.shortTitle}</strong><small>{statusLabel[stage.status]}</small></span>
        </button>
      </li>)}
    </ol>
  </nav>;
}

function StageCard({stage,active,onSelect}:{stage:HarmonizationStage;active:boolean;onSelect:()=>void}){
  return <article className={`lab-stage-card ${active?'is-active':''}`} aria-labelledby={`${stage.id}-title`}>
    <div className="lab-stage-card-heading">
      <div className="lab-stage-title-wrap">
        <span className="lab-stage-index">STAGE {String(stage.number).padStart(2,'0')}</span>
        <h3 id={`${stage.id}-title`}>{stage.title}</h3>
      </div>
      <div className="lab-stage-heading-actions"><StageStatusBadge status={stage.status}/><button type="button" className="lab-jump-button" onClick={onSelect} aria-label={`Select ${stage.title}`}>{active?'Selected':'Select stage'}</button></div>
    </div>
    <div className="lab-distinction"><strong>{stage.statusLabel}</strong><span>{stage.evidence}</span></div>
    <div className="lab-stage-grid">
      <section><h4>Input</h4><p>{stage.input}</p></section>
      <section><h4>Processing concept</h4><p>{stage.processing}</p></section>
      <section><h4>Expected output</h4><p>{stage.output}</p></section>
      <section><h4>Assumptions</h4><ul>{stage.assumptions.map(item=><li key={item}>{item}</li>)}</ul></section>
      <section><h4>Limitations</h4><ul>{stage.limitations.map(item=><li key={item}>{item}</li>)}</ul></section>
    </div>
  </article>;
}

function SourceTable({metadata}:{metadata:HarmonizationMetadata}){
  const method=metadata.methodology;
  return <section className="lab-panel lab-source-panel" aria-labelledby="lab-source-title">
    <div className="lab-section-heading"><div><span className="lab-eyebrow">SOURCE TABLE</span><h2 id="lab-source-title">What this lab can actually observe</h2></div><span className={`lab-source-badge ${metadata.source}`}>{metadata.source==='backend'?'BACKEND METADATA':'DEMO / NO REQUEST'}</span></div>
    <p className="lab-panel-intro">Metadata is read-only and descriptive. It does not certify source records, calibrate sensor values, or create harmonized output.</p>
    {metadata.sensors.length>0?<div className="lab-table-wrap"><table className="lab-table"><caption>Sensor metadata returned by the verified sensors endpoint</caption><thead><tr><th scope="col">Sensor</th><th scope="col">Platforms</th><th scope="col">Nominal resolution</th><th scope="col">Earliest data</th><th scope="col">Native confidence</th></tr></thead><tbody>{metadata.sensors.map(sensor=><tr key={sensor.id}><th scope="row">{sensor.id}</th><td>{sensor.platforms.join(', ')||'Unavailable'}</td><td>{sensor.resolution==='Unavailable'?'Unavailable':`${sensor.resolution} m at nadir`}</td><td>{sensor.earliestData}</td><td>{sensor.confidenceMetric}</td></tr>)}</tbody></table></div>:<p className="lab-empty">No sensor rows are available in this response. No source values are inferred.</p>}
    <dl className="lab-metadata-grid">
      <div><dt>Source version</dt><MetadataValue>{method.version}</MetadataValue></div>
      <div><dt>Harmonization status</dt><MetadataValue>{method.harmonizationStatus}</MetadataValue></div>
      <div><dt>Spatial framework</dt><MetadataValue>{method.aggregationGrid}</MetadataValue></div>
      <div><dt>Request policy</dt><MetadataValue>{sourceRequestPolicy(metadata.source==='backend'?'real':'demo')}</MetadataValue></div>
    </dl>
  </section>;
}

function MethodologyPanel({metadata}:{metadata:HarmonizationMetadata}){
  const method=metadata.methodology;
  return <section className="lab-panel" aria-labelledby="lab-methodology-title">
    <div className="lab-section-heading"><div><span className="lab-eyebrow">METHODOLOGY</span><h2 id="lab-methodology-title">A documented frame, not a calibrated product</h2></div></div>
    <div className="lab-methodology-grid">
      <div><h3>Area and cell context</h3><p>{method.aoiSupport}</p><p>{method.activeCellDayDefinition}</p></div>
      <div><h3>Roadmap context</h3><p><strong>Reference:</strong> {method.referenceStandard}</p><p><strong>Current:</strong> {method.roadmapCurrent}</p><p><strong>Next:</strong> {method.roadmapNext}</p></div>
      <div><h3>Reported caveats</h3>{method.caveats.length?<ul>{method.caveats.map(caveat=><li key={caveat}>{caveat}</li>)}</ul>:<p>No caveats were returned by this response.</p>}</div>
    </div>
  </section>;
}

function AssumptionChecklist(){
  const checks=[
    'MODIS numeric confidence and VIIRS categorical confidence stay separate.',
    'MODIS ~1 km and VIIRS ~375 m are nominal resolutions, not a conversion rule.',
    'A hotspot is a satellite thermal anomaly record, not a confirmed fire.',
    'Missing or unobserved is not zero activity.',
    'NRT records have coverage and timeliness limitations.',
    'Spatial or temporal alignment does not remove sensor bias.'
  ];
  return <section className="lab-panel" aria-labelledby="lab-assumptions-title"><div className="lab-section-heading"><div><span className="lab-eyebrow">ASSUMPTION CHECKLIST</span><h2 id="lab-assumptions-title">Interpretation guardrails</h2></div></div><ul className="lab-checklist">{checks.map(check=><li key={check}><span aria-hidden="true">✓</span>{check}</li>)}</ul></section>;
}

function ResearchNote({stage,onResearch}:{stage:HarmonizationStage;onResearch:(notes:string)=>void}){
  const [methodologySelection,setMethodologySelection]=useState('Read-only provenance and limitations');
  const [note,setNote]=useState('');
  const submit=(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();const trimmed=note.trim();if(!trimmed)return;onResearch(`Harmonization Lab stage: ${stage.title}\nMethodology selection: ${methodologySelection}\nUser note: ${trimmed}`);setNote('');};
  return <section className="lab-panel lab-research-panel" aria-labelledby="lab-research-title"><div className="lab-section-heading"><div><span className="lab-eyebrow">RESEARCH HANDOFF</span><h2 id="lab-research-title">Open a question in Research</h2><p>The parent workspace can attach this note to the current global source and filter snapshot.</p></div></div><form className="lab-research-form" onSubmit={submit}><div><label htmlFor="lab-methodology-select">Methodology selection</label><select id="lab-methodology-select" value={methodologySelection} onChange={event=>setMethodologySelection(event.target.value)}><option>Read-only provenance and limitations</option><option>Spatial and temporal alignment concept</option><option>Calibration requirements</option><option>Uncertainty and missingness</option><option>Independent validation requirements</option></select></div><div><label htmlFor="lab-note">Research note</label><textarea id="lab-note" value={note} onChange={event=>setNote(event.target.value)} placeholder={`Question about ${stage.title.toLowerCase()}…`} rows={4}/></div><div className="lab-research-actions"><span>Selected stage: <strong>{stage.title}</strong></span><button type="submit" disabled={!note.trim()}>Open in Research</button></div></form></section>;
}

function LabLoading(){return <div className="lab-feedback lab-loading" role="status" aria-live="polite"><span className="lab-loading-mark" aria-hidden="true"/>Reading verified metadata; no observations are being ingested.</div>;}
function LabError({message,onRetry}:{message:string;onRetry:()=>void}){return <div className="lab-feedback lab-error" role="alert"><strong>Metadata request failed.</strong><span>{message}</span><button type="button" onClick={onRetry}>Retry metadata</button></div>;}

export default function HarmonizationLab({dataMode,onResearch}:HarmonizationLabProps){
  const [selectedId,setSelectedId]=useState(HARMONIZATION_STAGES[0].id);
  const [retryToken,setRetryToken]=useState(0);
  const requestKey=`${dataMode}:${retryToken}`;
  const [state,setState]=useState<LoadState>({key:requestKey,status:'loading'});
  const selectedStage=useMemo(()=>HARMONIZATION_STAGES.find(stage=>stage.id===selectedId)??HARMONIZATION_STAGES[0],[selectedId]);

  useEffect(()=>{
    const controller=new AbortController();
    let active=true;
    setState({key:requestKey,status:'loading'});
    if(dataMode==='demo'){
      setState({key:requestKey,status:'ready',metadata:demoMetadata});
      return ()=>{active=false;controller.abort();};
    }
    Promise.all([
      burnCalendarApi.getMetadata('/api/v1/methodology',controller.signal),
      burnCalendarApi.getMetadata('/api/v1/sensors',controller.signal)
    ]).then(([methodology,sensors])=>{
      if(active&&!controller.signal.aborted)setState({key:requestKey,status:'ready',metadata:parseMetadataBundle(methodology,sensors,'backend')});
    }).catch(error=>{
      if(active&&!controller.signal.aborted)setState({key:requestKey,status:'error',error:error instanceof Error?error.message:'Unknown metadata error'});
    });
    return ()=>{active=false;controller.abort();};
  },[dataMode,requestKey]);

  const visibleState=state.key===requestKey?state:{key:requestKey,status:'loading' as const};
  const metadata=visibleState.metadata;
  return <section className="workspace-page lab-page" aria-labelledby="lab-page-title">
    <header className="lab-page-header"><div><span className="lab-eyebrow">HOTSPOT HUNTERS / RESEARCH WORKSPACE</span><h1 id="lab-page-title">Harmonization<br/><em>Lab</em></h1><p>Trace what can be aligned, what must stay native, and what is still research—not a finished harmonized measurement.</p></div><div className={`lab-mode-badge ${dataMode}`}><i aria-hidden="true"/>{dataMode==='real'?'REAL / READ-ONLY METADATA':'DEMO / EDUCATIONAL ONLY'}</div></header>
    <aside className="lab-disclaimer" role="note"><strong>Important scientific boundary.</strong><span>This lab does not produce a harmonized index, calibrated estimate, validation score, or confirmed-fire count. Backend source metadata may be read; observations remain raw, sensor-specific, and uncalibrated.</span></aside>
    <div className="lab-run-context" aria-label="Lab data source context"><span><strong>Data mode</strong>{dataMode==='real'?'Backend metadata':'Demo explanatory content'}</span><span><strong>Request behavior</strong>{policyText(dataMode)}</span><span><strong>Pipeline behavior</strong>No simulated progress or output</span></div>
    {visibleState.status==='loading'&&<LabLoading/>}
    {visibleState.status==='error'&&<LabError message={visibleState.error??'Please retry the read-only metadata request.'} onRetry={()=>setRetryToken(token=>token+1)}/>} 
    {visibleState.status==='ready'&&metadata&&<>
      <SourceTable metadata={metadata}/>
      <MethodologyPanel metadata={metadata}/>
      <div className="lab-workflow-layout"><StageSelector stages={HARMONIZATION_STAGES} selected={selectedStage.id} onSelect={setSelectedId}/><div className="lab-stage-list" aria-label="Detailed harmonization stages">{HARMONIZATION_STAGES.map(stage=><StageCard key={stage.id} stage={stage} active={stage.id===selectedStage.id} onSelect={()=>setSelectedId(stage.id)}/>)}</div></div>
      <AssumptionChecklist/>
      <ResearchNote stage={selectedStage} onResearch={onResearch}/>
    </>}
  </section>;
}

export {HARMONIZATION_STAGES};
