import {lazy,Suspense,useEffect,useMemo,useRef} from 'react';
import {ArrowRight,ArrowUpRight,ChevronDown,Compass,Globe2,Layers,Map as MapIcon,Minus,Plus,Search,SlidersHorizontal,Download} from 'lucide-react';
import Earth from './components/Earth';
import Calendar from './components/Calendar';
import Science from './components/Science';
import {regions} from './shared/geography';
import type {ResearchSelection} from './features/research/model';
import type {Sensor} from './shared/types/observation';
import {monthRange} from './shared/dates';
import {burnCalendarApi} from './data/apiClient';

import type {Scene,MapLayer} from './app/types';
import {useApplicationState} from './app/useApplicationState';
import {useSceneFocus} from './app/useSceneFocus';
import Header from './app/Header';
import Timeline from './features/timeline/Timeline';
import Comparison from './features/comparison/Comparison';
import ExploreHeading from './features/explore/ExploreHeading';
import ObservationCard from './features/observations/ObservationCard';
import {useObservationData} from './features/observations/useObservationData';

const ResearchWorkspace=lazy(()=>import('./features/research/ResearchWorkspace'));
const HarmonizationLab=lazy(()=>import('./features/harmonization/HarmonizationLab'));
const DataExplorer=lazy(()=>import('./features/data-explorer/DataExplorer'));
const Analytics=lazy(()=>import('./features/analytics/Analytics'));

export default function App(){
 const {methodologyNotes,setMethodologyNotes,explorerFilters,setExplorerFilters,focus,setFocus,dateRange,setDateRange,dataMode,setDataMode,scene,setScene,year,setYear,month,setMonth,region,setRegion,sensors,setSensors,layer,setLayer,globe,setGlobe,playing,setPlaying,speed,setSpeed,split,setSplit,compareMode,setCompareMode,search,setSearch,query,setQuery,selected,setSelected,controls,setControls,skipped,setSkipped,map,aggregated,setAggregated}=useApplicationState();

 const locationTrigger=useRef<HTMLButtonElement>(null);
 useSceneFocus(scene,!!selected);
 const previousSearch=useRef(search);useEffect(()=>{if(previousSearch.current&&!search)locationTrigger.current?.focus();previousSearch.current=search;},[search]);
 const activeRegion=regions.find(r=>r.id===region),compare=scene==='compare'&&compareMode==='split';
 const effectiveSensors=useMemo<Sensor[]>(()=>scene==='compare'?(compareMode==='split'?['MODIS','VIIRS']:[compareMode as Sensor]):sensors,[scene,compareMode,sensors]);

 const activeDates=dateRange??monthRange(year,month);
 const {data,annual,backendLive,calendar,status,error,calendarError,partial,warnings,fetchedAt,retry}=useObservationData(year,month,region,effectiveSensors,dataMode,activeDates.startDate,activeDates.endDate);

 const researchSelection=useMemo<ResearchSelection>(()=>({region,startDate:activeDates.startDate,endDate:activeDates.endDate,sensors:[...sensors],dataMode,filters:{...explorerFilters},comparison:{mode:compareMode,split,globe,layer}}),[region,activeDates.startDate,activeDates.endDate,sensors,dataMode,explorerFilters,compareMode,split,globe,layer]);
 const applyResearch=(saved:ResearchSelection)=>{setRegion(saved.region);setYear(Number(saved.startDate.slice(0,4)));setMonth(Number(saved.startDate.slice(5,7))-1);setDateRange({startDate:saved.startDate,endDate:saved.endDate});setSensors([...saved.sensors]);setDataMode(saved.dataMode);setExplorerFilters({...saved.filters});setCompareMode(saved.comparison.mode);setSplit(saved.comparison.split);setGlobe(saved.comparison.globe);setLayer(saved.comparison.layer);setPlaying(false);setSelected(null);setFocus(null);setScene('data');};
 const visibleMapData=useMemo(()=>focus&&!data.some(o=>o.id===focus.id)?[...data,focus]:data,[data,focus]);
 const modis=data.filter(o=>o.sensor==='MODIS').length,viirs=data.filter(o=>o.sensor==='VIIRS').length;

 useEffect(()=>{setSelected(current=>current&&(focus?.id===current.id||data.some(o=>o.id===current.id))?current:null);},[data,focus]);
 useEffect(()=>{setSelected(null);setFocus(null);},[year,month,region,sensors,compareMode,dataMode,activeDates.startDate,activeDates.endDate]);
 useEffect(()=>{if(!playing)return;const timer=setInterval(()=>setMonth(m=>(m+1)%12),1600/speed);return()=>clearInterval(timer);},[playing,speed]);
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){setSearch(false);setSelected(null);setControls(false);}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[]);

 const navigate=(next:Scene)=>{setScene(next);setSelected(null);setFocus(null);setSearch(false);if(next==='compare')setLayer('points');};
 const chooseRegion=(id:string)=>{setRegion(id);setSearch(false);setQuery('');setScene(s=>s==='entry'?'explore':s);};
 const toggleSensor=(sensor:Sensor)=>setSensors(s=>s.includes(sensor)?s.filter(x=>x!==sensor):[...s,sensor]);

 return <main className={`app scene-${scene} ${skipped?'skip-motion':''}`}>
  <div className="star-field"/>
  <Earth data={visibleMapData} focus={focus} globe={globe} layer={layer} region={activeRegion?.center??null} intro={scene==='entry'} onSelect={o=>{setSelected(o);if(scene==='entry')setScene('explore');}} compare={compare} split={split} selected={selected} onReady={m=>{map.current=m;}} onZoom={zoom=>setAggregated(zoom<2.5)}/>
  <div className="vignette"/>
  <Header scene={scene} backendLive={backendLive} dataMode={dataMode} navigate={navigate} onHome={()=>{setRegion('global');setGlobe(true);navigate('entry');}}/>
  {scene==='entry'?<>
   <section className="hero"><div className="eyebrow"><span className="short-rule"/> EARTH OBSERVATION, HUMAN PERSPECTIVE</div><h1>THE EARTH<br/>LEAVES<br/><em>TRACES.</em></h1><p>Explore the patterns of burning activity across our planet, through the eyes of MODIS and VIIRS.</p><button className="primary" onClick={()=>navigate('explore')}>EXPLORE THE EARTH <ArrowUpRight size={20}/></button><button className="text-action" onClick={()=>navigate('science')}>DISCOVER THE SCIENCE <ArrowRight size={15}/></button></section>
   <div className="globe-caption"><span className="crosshair">+</span><div>A LIVING PLANET.<br/><span>A story in every signal.</span></div></div>
   <div className="entry-bottom"><button onClick={()=>{setSkipped(true);navigate('explore');}}>SKIP INTRO <ArrowRight size={14}/></button><div><span>01 — THE AWAKENING</span><p>One planet. Two perspectives. Endless discoveries.</p></div><span className="drag-hint"><Compass size={17}/> DRAG TO EXPLORE</span></div>
  </>:<>
   <div className="explorer-toolbar"><button ref={locationTrigger} className="location-button" aria-expanded={search} aria-controls="region-panel" onClick={()=>setSearch(s=>!s)}><Search size={16}/>{activeRegion?.name??'Find a place on Earth'}<ChevronDown size={14}/></button><button className="mobile-controls icon-button" aria-label="Toggle layer controls" aria-expanded={controls} aria-controls="sensor-panel" onClick={()=>setControls(c=>!c)}><SlidersHorizontal size={18}/></button><div id="sensor-panel" className={`sensor-controls ${controls?'expanded':''}`}><span className="control-label">OBSERVING WITH</span>{(['MODIS','VIIRS'] as Sensor[]).map(s=><button key={s} disabled={scene==='compare'||(s==='VIIRS'&&year<2012)} aria-pressed={effectiveSensors.includes(s)} className={`${s.toLowerCase()} ${effectiveSensors.includes(s)?'enabled':''}`} onClick={()=>toggleSensor(s)}><i/>{s}{s==='VIIRS'&&year<2012?' · FROM 2012':''}</button>)}</div></div>
   {search&&<div id="region-panel" className="search-popover"><label htmlFor="region-search">GO SOMEWHERE EXTRAORDINARY</label><input autoFocus id="region-search" placeholder="Search regions…" value={query} onChange={e=>setQuery(e.target.value)}/><button onClick={()=>chooseRegion('global')}><Globe2 size={17}/>Global perspective<ArrowUpRight size={16}/></button>{regions.filter(r=>r.name.toLowerCase().includes(query.toLowerCase())).map(r=><button key={r.id} onClick={()=>chooseRegion(r.id)}>{r.name}<ArrowUpRight size={16}/></button>)}{!regions.some(r=>r.name.toLowerCase().includes(query.toLowerCase()))&&<p>Try Amazon, Africa, Asia, Australia or Mediterranean.</p>}</div>}
   {scene==='explore'&&<ExploreHeading activeRegion={activeRegion} month={month} year={year} navigate={navigate} chooseRegion={chooseRegion}/>}
   {scene==='research'&&<Suspense fallback={<section className="workspace-page" role="status">Loading Research Workspace…</section>}><ResearchWorkspace selection={researchSelection} onApply={applyResearch} methodologyNotes={methodologyNotes} onLab={()=>navigate('lab')} onAnalytics={()=>navigate('analytics')} onData={()=>navigate('data')}/></Suspense>}
   {scene==='lab'&&<Suspense fallback={<section className="workspace-page" role="status">Loading methodology…</section>}><HarmonizationLab dataMode={dataMode} onResearch={notes=>{setMethodologyNotes(notes);navigate('research');}}/></Suspense>}
   {scene==='data'&&<Suspense fallback={<section className="workspace-page" role="status">Loading Data Explorer…</section>}><DataExplorer records={data} dataMode={dataMode} year={year} month={month} region={region} sensors={effectiveSensors} startDate={activeDates.startDate} endDate={activeDates.endDate} status={status} error={error} partial={partial} warnings={warnings} fetchedAt={fetchedAt} onRetry={retry} onRange={range=>{setDateRange(range);setYear(Number(range.startDate.slice(0,4)));setMonth(Number(range.startDate.slice(5,7))-1);}} onRegion={setRegion} onSensors={setSensors} onFocus={record=>{setFocus(record);setSelected(record);setScene('explore');setSearch(false);setPlaying(false);}} filters={explorerFilters} onFilters={setExplorerFilters}/></Suspense>}
   {scene==='analytics'&&<Suspense fallback={<section className="workspace-page" role="status">Loading Analytics…</section>}><Analytics year={year} month={month} region={region} sensors={effectiveSensors} dataMode={dataMode} startDate={activeDates.startDate} endDate={activeDates.endDate} onRange={range=>{setDateRange(range);setYear(Number(range.startDate.slice(0,4)));setMonth(Number(range.startDate.slice(5,7))-1);}}/></Suspense>}
   {scene==='time'&&<Calendar year={year} month={month} region={region} sensors={effectiveSensors} onMonth={v=>{setMonth(v);setDateRange(null);}} data={calendar} dataMode={dataMode} error={calendarError} onRetry={retry}/>}
   {scene==='science'&&<Science dataMode={dataMode}/>}
   {scene==='compare'&&<Comparison year={year} compare={compare} split={split} compareMode={compareMode} onMode={setCompareMode} onSplit={setSplit} navigate={navigate}/>}
   <div className="map-tools"><button className="icon-button" aria-label={globe?'Switch to flat map':'Switch to globe'} onClick={()=>setGlobe(g=>!g)}>{globe?<Globe2 size={18}/>:<MapIcon size={18}/>}</button><span/><button className="icon-button" aria-label="Zoom in" onClick={()=>map.current?.zoomIn()}><Plus size={18}/></button><button className="icon-button" aria-label="Zoom out" onClick={()=>map.current?.zoomOut()}><Minus size={18}/></button><button className="icon-button" aria-label="Reset north" onClick={()=>map.current?.resetNorth()}><Compass size={18}/></button></div>
   {scene!=='science'&&<div className="layer-picker"><Layers size={14}/><select aria-label="Visualization layer" value={layer} onChange={e=>setLayer(e.target.value as MapLayer)}><option value="points">Detections</option><option value="clusters">Spatial clusters</option><option value="density">Thermal density</option></select></div>}
   <Timeline partial={partial} rangeLabel={dateRange?`${activeDates.startDate} → ${activeDates.endDate}`:undefined} scene={scene} year={year} month={month} annual={annual} playing={playing} speed={speed} count={data.length} activeRegion={activeRegion} navigate={navigate} onYear={v=>{setYear(v);setDateRange(null);}} onMonth={v=>{setMonth(v);setDateRange(null);}} onPlaying={setPlaying} onSpeed={setSpeed}/>
  </>}
  {selected&&<ObservationCard selected={selected} backendLive={backendLive} onClose={()=>setSelected(null)}/>}
  <div className="source-controls"><label>DATA SOURCE <select aria-label="Data source" value={dataMode} onChange={e=>setDataMode(e.target.value as 'demo'|'real')}><option value="demo">Synthetic demo</option><option value="real">Backend / FIRMS</option></select></label><span role="status">{status==='loading'?'Loading observations…':error??(dataMode==='real'?'Backend source · raw observations':'Illustrative only')}</span>{error&&<button onClick={retry}>Retry observations</button>}{partial&&<details><summary>Partial map dataset</summary>{warnings.map(w=><p key={w}>{w}</p>)}</details>}{fetchedAt&&<time dateTime={fetchedAt}>Fetched {new Date(fetchedAt).toLocaleTimeString()} · source update time unavailable</time>}</div>
  <footer><span className="demo-label"><i style={{backgroundColor:backendLive?'#00e5a3':undefined}}/> {dataMode==='real'?(status==='ready'?'BACKEND FIRMS · RAW OBSERVATIONS':'BACKEND MODE · '+status.toUpperCase()):'DEMO DATA — ILLUSTRATIVE OBSERVATIONS'}</span><a className="demo-label" style={{display:dataMode==='real'&&effectiveSensors.length>0?undefined:'none',textDecoration:'none',marginLeft:'12px',cursor:'pointer'}} href={burnCalendarApi.getCsvDownloadUrl(region,activeDates.startDate,activeDates.endDate,effectiveSensors)} target="_blank" rel="noreferrer" title="Backend CSV: date/region/sensors only; capped at 50,000 rows; source product field unavailable; additional Explorer filters are NOT applied"><Download size={12} style={{marginRight:'4px',verticalAlign:'middle'}}/> Backend CSV</a><div className="sensor-legend">{partial&&<span>LOADED SUBSET</span>}{!compare&&(layer==='clusters'||(aggregated&&layer==='points'))&&<span>AMBER = COMBINED CLUSTERS</span>}{layer==='density'?<span>THERMAL DENSITY <i className="density-scale"/> LOW → HIGH</span>:<><span><i className="amber"/>{modis.toLocaleString()} MODIS</span><span><i className="cyan"/>{viirs.toLocaleString()} VIIRS</span></>}</div><button onClick={()=>navigate('science')}>DATA & METHODOLOGY <ArrowUpRight size={12}/></button></footer>
 </main>;
}
