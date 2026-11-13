import {useEffect,useMemo,useRef,useState} from 'react';
import {ArrowRight,ArrowUpRight,ChevronDown,Compass,Globe2,Layers,Map as MapIcon,Minus,Pause,Play,Plus,Search,SlidersHorizontal,X,ScanLine,Info,Download} from 'lucide-react';
import type {Map as GLMap} from 'maplibre-gl';
import Earth from './components/Earth';
import Calendar from './components/Calendar';
import Science from './components/Science';
import {demoAdapter,months,regions,type Observation,type Sensor} from './data/observations';
import {burnCalendarApi} from './data/apiClient';

type Scene='entry'|'explore'|'time'|'compare'|'science';

export default function App(){
 const [scene,setScene]=useState<Scene>('entry'),[year,setYear]=useState(2026),[month,setMonth]=useState(10),[region,setRegion]=useState('global');
 const [sensors,setSensors]=useState<Sensor[]>(['MODIS','VIIRS']),[layer,setLayer]=useState('points'),[globe,setGlobe]=useState(true),[playing,setPlaying]=useState(false),[speed,setSpeed]=useState(1),[split,setSplit]=useState(50),[compareMode,setCompareMode]=useState('split');
 const [search,setSearch]=useState(false),[query,setQuery]=useState(''),[selected,setSelected]=useState<Observation|null>(null),[controls,setControls]=useState(false),[skipped,setSkipped]=useState(false);
 const [backendLive,setBackendLive]=useState(false),[liveData,setLiveData]=useState<Observation[]|null>(null),[liveAnnual,setLiveAnnual]=useState<number[]|null>(null);
 const map=useRef<GLMap|null>(null);
 const [aggregated,setAggregated]=useState(true);

 const activeRegion=regions.find(r=>r.id===region),compare=scene==='compare'&&compareMode==='split';
 const effectiveSensors=useMemo<Sensor[]>(()=>scene==='compare'?(compareMode==='split'?['MODIS','VIIRS']:[compareMode as Sensor]):sensors,[scene,compareMode,sensors]);

 useEffect(()=>{
  burnCalendarApi.isHealthy().then(setBackendLive);
 },[]);

 useEffect(()=>{
  let active=true;
  burnCalendarApi.isHealthy().then(healthy=>{
   if(!active)return;
   setBackendLive(healthy);
   if(!healthy)return;

   burnCalendarApi.getObservationsGeoJSON({
    region,
    year,
    month,
    sensors:effectiveSensors,
    limit:10000,
   }).then(res=>{
    if(active&&res?.features?.length>0){
     const parsed=res.features.map(f=>f.properties as Observation);
     setLiveData(parsed);
    }else if(active){
     setLiveData(null);
    }
   }).catch(()=>{if(active)setLiveData(null);});

   burnCalendarApi.getCalendar(year,month,region,effectiveSensors)
    .then(cal=>{
     if(active&&cal?.monthly_rhythm?.length===12){
      setLiveAnnual(cal.monthly_rhythm.map(m=>m.detection_count));
     }
    }).catch(()=>{});
  });
  return()=>{active=false;};
 },[year,month,region,effectiveSensors]);

 const demoData=useMemo(()=>demoAdapter.select(year,month,region,effectiveSensors),[year,month,region,effectiveSensors]);
 const demoAnnual=useMemo(()=>demoAdapter.monthly(year,region,effectiveSensors),[year,region,effectiveSensors]);

 const data=liveData??demoData;
 const annual=liveAnnual??demoAnnual;

 const modis=data.filter(o=>o.sensor==='MODIS').length,viirs=data.filter(o=>o.sensor==='VIIRS').length;

 useEffect(()=>{setSelected(null);},[year,month,region,scene,sensors]);
 useEffect(()=>{if(!playing)return;const timer=setInterval(()=>setMonth(m=>(m+1)%12),1600/speed);return()=>clearInterval(timer);},[playing,speed]);
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){setSearch(false);setSelected(null);setControls(false);}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[]);

 const navigate=(next:Scene)=>{setScene(next);setSelected(null);setSearch(false);if(next==='compare')setLayer('points');};
 const chooseRegion=(id:string)=>{setRegion(id);setSearch(false);setQuery('');setScene('explore');};
 const toggleSensor=(sensor:Sensor)=>setSensors(s=>s.includes(sensor)?s.filter(x=>x!==sensor):[...s,sensor]);

 return <main className={`app scene-${scene} ${skipped?'skip-motion':''}`}>
  <div className="star-field"/>
  <Earth data={data} globe={globe} layer={layer} region={activeRegion?.center??null} intro={scene==='entry'} onSelect={o=>{setSelected(o);if(scene==='entry')setScene('explore');}} compare={compare} split={split} onReady={m=>{map.current=m;m.on('zoomend',()=>setAggregated(m.getZoom()<2.5));}}/>
  <div className="vignette"/>
  <header><button className="wordmark" aria-label="Hotspot Hunters home" onClick={()=>{setRegion('global');setGlobe(true);navigate('entry');}}><span className="brand-mark"><ScanLine size={25}/></span><span>HOTSPOT<br/>HUNTERS<span className="brand-dot">®</span></span></button><nav aria-label="Main navigation">{(['explore','time','compare','science'] as const).map((n,i)=><button key={n} className={scene===n?'active':''} onClick={()=>navigate(n)}><span className="nav-number">0{i+1}</span>{n==='science'?'THE SCIENCE':n.toUpperCase()}</button>)}</nav><div className="edition"><span className="status-dot" style={{backgroundColor:backendLive?'#00e5a3':undefined}}/> {backendLive?'LIVE NASA DATA':'A PLANET IN PERSPECTIVE'} <small>INDEPENDENT SPACE APPS CONCEPT / 2026</small></div></header>
  {scene==='entry'?<>
   <section className="hero"><div className="eyebrow"><span className="short-rule"/> EARTH OBSERVATION, HUMAN PERSPECTIVE</div><h1>THE EARTH<br/>LEAVES<br/><em>TRACES.</em></h1><p>Explore the patterns of burning activity across our planet, through the eyes of MODIS and VIIRS.</p><button className="primary" onClick={()=>navigate('explore')}>EXPLORE THE EARTH <ArrowUpRight size={20}/></button><button className="text-action" onClick={()=>navigate('science')}>DISCOVER THE SCIENCE <ArrowRight size={15}/></button></section>
   <div className="globe-caption"><span className="crosshair">+</span><div>A LIVING PLANET.<br/><span>A story in every signal.</span></div></div>
   <div className="entry-bottom"><button onClick={()=>{setSkipped(true);navigate('explore');}}>SKIP INTRO <ArrowRight size={14}/></button><div><span>01 — THE AWAKENING</span><p>One planet. Two perspectives. Endless discoveries.</p></div><span className="drag-hint"><Compass size={17}/> DRAG TO EXPLORE</span></div>
  </>:<>
   <div className="explorer-toolbar"><button className="location-button" onClick={()=>setSearch(s=>!s)}><Search size={16}/>{activeRegion?.name??'Find a place on Earth'}<ChevronDown size={14}/></button><button className="mobile-controls icon-button" aria-label="Toggle layer controls" onClick={()=>setControls(c=>!c)}><SlidersHorizontal size={18}/></button><div className={`sensor-controls ${controls?'expanded':''}`}><span className="control-label">OBSERVING WITH</span>{(['MODIS','VIIRS'] as Sensor[]).map(s=><button key={s} disabled={scene==='compare'||(s==='VIIRS'&&year<2012)} aria-pressed={effectiveSensors.includes(s)} className={`${s.toLowerCase()} ${effectiveSensors.includes(s)?'enabled':''}`} onClick={()=>toggleSensor(s)}><i/>{s}{s==='VIIRS'&&year<2012?' · FROM 2012':''}</button>)}</div></div>
   {search&&<div className="search-popover"><label htmlFor="region-search">GO SOMEWHERE EXTRAORDINARY</label><input autoFocus id="region-search" placeholder="Search demo regions…" value={query} onChange={e=>setQuery(e.target.value)}/><button onClick={()=>chooseRegion('global')}><Globe2 size={17}/>Global perspective<ArrowUpRight size={16}/></button>{regions.filter(r=>r.name.toLowerCase().includes(query.toLowerCase())).map(r=><button key={r.id} onClick={()=>chooseRegion(r.id)}>{r.name}<ArrowUpRight size={16}/></button>)}{!regions.some(r=>r.name.toLowerCase().includes(query.toLowerCase()))&&<p>Try Amazon, Africa, Asia, Australia or Mediterranean.</p>}</div>}
   {scene==='explore'&&<section className="explore-title"><div className="eyebrow">{activeRegion?'REGIONAL FIELD NOTES':'THE GLOBAL PERSPECTIVE'} <span>/ {String(month+1).padStart(2,'0')}.{year}</span></div><h2>{activeRegion?activeRegion.title:<>Every signal<br/>has a story.</>}</h2><p>{activeRegion?activeRegion.copy:'Look closer. Follow a signal. Discover the patterns that connect us.'}</p>{activeRegion?<div className="region-actions"><button className="text-action" onClick={()=>navigate('time')}>EXPLORE THE SEASON <ArrowRight size={15}/></button><button className="subtle-button" onClick={()=>chooseRegion('global')}>← Back to Earth</button></div>:<div className="story-links">{regions.slice(0,3).map((r,i)=><button key={r.id} onClick={()=>chooseRegion(r.id)}><span>0{i+1}</span>{r.name}<ArrowUpRight size={16}/></button>)}</div>}</section>}
   {scene==='time'&&<Calendar year={year} month={month} region={region} sensors={effectiveSensors} onMonth={setMonth}/>}
   {scene==='science'&&<Science/>}
   {scene==='compare'&&<><section className="compare-heading"><div className="eyebrow">A SHARED LANDSCAPE. A DIFFERENT LENS.</div><h2>One planet.<br/><em>Two perspectives.</em></h2><div className="tabs">{['MODIS','split','VIIRS'].map(v=><button className={compareMode===v?'active':''} key={v} onClick={()=>setCompareMode(v)}>{v==='split'?'Compare':v}</button>)}</div></section>{compare&&<><div className="split-line" style={{left:`${split}%`}}><span>↔</span></div><input className="split-slider" type="range" min="10" max="90" value={split} onChange={e=>setSplit(Number(e.target.value))} aria-label="Sensor comparison divider"/><div className="compare-label left"><i/>MODIS <span>1 KM / NOMINAL</span></div><div className="compare-label right"><i/>VIIRS <span>375 M / NOMINAL</span></div></>}<div className="compare-note"><Info size={16}/><p>{year<2012?'VIIRS unavailable for this period. Suomi NPP coverage begins in January 2012.':'Finer pixels reveal different details. More detections do not mean more fires.'}<button onClick={()=>navigate('science')}>Understand the difference ↗</button></p></div></>}
   <div className="map-tools"><button className="icon-button" aria-label={globe?'Switch to flat map':'Switch to globe'} onClick={()=>setGlobe(g=>!g)}>{globe?<Globe2 size={18}/>:<MapIcon size={18}/>}</button><span/><button className="icon-button" aria-label="Zoom in" onClick={()=>map.current?.zoomIn()}><Plus size={18}/></button><button className="icon-button" aria-label="Zoom out" onClick={()=>map.current?.zoomOut()}><Minus size={18}/></button><button className="icon-button" aria-label="Reset north" onClick={()=>map.current?.resetNorth()}><Compass size={18}/></button></div>
   {scene!=='science'&&<div className="layer-picker"><Layers size={14}/><select aria-label="Visualization layer" value={layer} disabled={scene==='compare'} onChange={e=>setLayer(e.target.value)}><option value="points">Detections</option><option value="clusters">Spatial clusters</option><option value="density">Thermal density</option></select></div>}
   <div className="timeline"><div className="time-meta"><div><span className="eyebrow">EARTH’S THERMAL MEMORY</span><button className="calendar-link" onClick={()=>navigate(scene==='time'?'explore':'time')}>{scene==='time'?'Return to map':'Open activity calendar'}<ArrowUpRight size={14}/></button></div><div className="time-selects"><select aria-label="Year" value={year} onChange={e=>setYear(+e.target.value)}>{Array.from({length:27},(_,i)=><option key={i}>{2000+i}</option>)}</select><select aria-label="Month" value={month} onChange={e=>setMonth(+e.target.value)}>{months.map((m,i)=><option key={m} value={i}>{m}</option>)}</select></div></div><div className="time-track"><button className="play-button" aria-label={playing?'Pause timeline':'Play timeline'} onClick={()=>setPlaying(p=>!p)}>{playing?<Pause size={16}/>:<Play size={16}/>}</button><div className="scrubber"><div className="timeline-bars">{annual.map((v,i)=><button key={i} tabIndex={-1} aria-hidden="true" className={i===month?'active':''} onClick={()=>setMonth(i)}><i style={{height:`${5+v/Math.max(...annual,1)*23}px`}}/><span>{months[i].slice(0,3).toUpperCase()}</span></button>)}</div><input aria-label="Time scrubber" type="range" min="0" max="11" value={month} onChange={e=>setMonth(+e.target.value)}/></div><button className="speed" aria-label="Playback speed" onClick={()=>setSpeed(s=>s===4?1:s*2)}>{speed}×</button></div><div className="timeline-foot"><span>MODIS 2000 → <span className={year<2012?'unavailable':''}>VIIRS 2012 →</span></span><span>{data.length.toLocaleString()} OBSERVATIONS <i/> {activeRegion?.name.toUpperCase()??'GLOBAL'}</span></div></div>
  </>}
  {selected&&<aside className="observation-card"><button className="close icon-button" aria-label="Close observation" onClick={()=>setSelected(null)}><X size={18}/></button><div className="eyebrow">A SIGNAL FROM EARTH</div><h3>{regions.find(r=>r.id===selected.region)?.name}</h3><span className={`sensor-tag ${selected.sensor.toLowerCase()}`}>{selected.sensor} / {selected.satellite}</span><div className="frp">{selected.frp}<span>MW<br/>FIRE RADIATIVE POWER</span></div><dl><dt>Observed (UTC)</dt><dd>{selected.acquisitionDate} · {selected.acquisitionTime}</dd><dt>Native confidence</dt><dd>{selected.confidence}{selected.sensor==='MODIS'?' / 100':''}</dd><dt>Day / night</dt><dd>{selected.daynight==='D'?'Daytime':'Nighttime'}</dd><dt>Coordinates</dt><dd>{selected.latitude.toFixed(3)}, {selected.longitude.toFixed(3)}</dd><dt>Processing</dt><dd>{selected.processingType}</dd></dl><p>{backendLive?'Verified NASA FIRMS active-fire observation.':'Illustrative thermal detection. Not a confirmed wildfire.'}</p></aside>}
  <footer><span className="demo-label"><i style={{backgroundColor:backendLive?'#00e5a3':undefined}}/> {backendLive?'LIVE NASA FIRMS — DUCKDB BACKEND':'DEMO DATA — ILLUSTRATIVE OBSERVATIONS'}</span><a className="demo-label" style={{textDecoration:'none',marginLeft:'12px',cursor:'pointer'}} href={burnCalendarApi.getCsvDownloadUrl(region,`${year}-${String(month+1).padStart(2,'0')}-01`,`${year}-${String(month+1).padStart(2,'0')}-28`,effectiveSensors)} target="_blank" rel="noreferrer" title="Export CSV for current selection"><Download size={12} style={{marginRight:'4px',verticalAlign:'middle'}}/> CSV</a><div className="sensor-legend">{!compare&&(layer==='clusters'||(aggregated&&layer==='points'))&&<span>AMBER = COMBINED CLUSTERS</span>}{layer==='density'?<span>THERMAL DENSITY <i className="density-scale"/> LOW → HIGH</span>:<><span><i className="amber"/>{modis.toLocaleString()} MODIS</span><span><i className="cyan"/>{viirs.toLocaleString()} VIIRS</span></>}</div><button onClick={()=>navigate('science')}>DATA & METHODOLOGY <ArrowUpRight size={12}/></button></footer>
 </main>;
}
