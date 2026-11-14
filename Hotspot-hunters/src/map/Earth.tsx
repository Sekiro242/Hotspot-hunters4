import {useEffect,useMemo,useRef,useState} from 'react';
import * as maplibregl from 'maplibre-gl';
import type {Map as GLMap,GeoJSONSource,MapMouseEvent,StyleSpecification} from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import type {Observation} from '../shared/types/observation';
import type {MapLayer} from '../app/types';
import {addObservationLayers,updateObservationLayers,highlight,clearSourceCache} from './layers';
// Vite's optimized dependency folder does not contain MapLibre 6's worker sibling.
maplibregl.setWorkerUrl(workerUrl);
export type EarthProps={data:Observation[];globe:boolean;layer:MapLayer;region:[number,number]|null;intro:boolean;onSelect:(o:Observation)=>void;compare:boolean;split:number;onReady:(map:GLMap|null)=>void;onZoom?:(zoom:number)=>void;selected?:Observation|null;focus?:Observation|null};
const style:StyleSpecification={version:8,sources:{land:{type:'geojson',data:'/countries.geojson'},imagery:{type:'raster',tiles:['https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],tileSize:256,maxzoom:17,attribution:'Imagery © Esri, Maxar, Earthstar Geographics | Natural Earth'}},layers:[{id:'ocean',type:'background',paint:{'background-color':'#081923'}},{id:'land',type:'fill',source:'land',paint:{'fill-color':'#203a3e'}},{id:'satellite',type:'raster',source:'imagery',paint:{'raster-opacity':.72,'raster-saturation':-.65,'raster-brightness-max':.68}},{id:'borders',type:'line',source:'land',paint:{'line-color':'#92b1ac','line-opacity':.16,'line-width':.5}}]};
type MapIssue='imagery'|'geography'|'observations'|'initialization'|'webgl';
const messages:Record<MapIssue,string>={imagery:'Some imagery unavailable · local geography remains interactive',geography:'Local geography failed to load · basemap may be incomplete',observations:'Observation layers failed to render · data remains available in the explorer',initialization:'Map initialization failed. Reload to retry.',webgl:'WebGL is unavailable or its context was lost. Enable hardware acceleration and reload.'};
const duration=(ms:number)=>matchMedia('(prefers-reduced-motion: reduce)').matches?0:ms;
type TestContainer=HTMLDivElement&{__hotspotMap?:GLMap};
export default function Earth(p:EarthProps){
 const host=useRef<HTMLDivElement>(null),second=useRef<HTMLDivElement>(null),main=useRef<GLMap|null>(null),other=useRef<GLMap|null>(null),latest=useRef(p);latest.current=p;
 const [ready,setReady]=useState(false),[otherReady,setOtherReady]=useState(false),[issues,setIssues]=useState<MapIssue[]>([]);
 const modis=useMemo(()=>p.data.filter(o=>o.sensor==='MODIS'),[p.data]),viirs=useMemo(()=>p.data.filter(o=>o.sensor==='VIIRS'),[p.data]);
 const index=useMemo(()=>new Map(p.data.map(o=>[o.id,o])),[p.data]),recordIndex=useRef(index);recordIndex.current=index;
 useEffect(()=>{
  const container=host.current;if(!container)return;
  let active=true;let map:GLMap;const started=performance.now();
  const issue=(value:MapIssue)=>{if(active)setIssues(values=>values.includes(value)?values:[...values,value]);};
  try{map=new maplibregl.Map({container,style,center:[-30,5],zoom:2.25,minZoom:.7,maxZoom:13,attributionControl:{compact:true},canvasContextAttributes:{antialias:true}});}catch(error){issue(/webgl/i.test(String(error))?'webgl':'initialization');return;}
  main.current=map;if(import.meta.env.DEV)(container as TestContainer).__hotspotMap=map;
  map.getCanvas().setAttribute('aria-label','Earth observation map. Arrow keys pan, plus and minus zoom. Use Data Explorer for record selection.');
  const loaded=()=>{
   if(!active)return;
   try{map.setProjection({type:latest.current.globe?'globe':'mercator'});map.setSky({'sky-color':'#060c13','horizon-color':'#47828b','fog-color':'#101f28','sky-horizon-blend':.5,'horizon-fog-blend':.5,'fog-ground-blend':.2});addObservationLayers(map);setReady(true);latest.current.onReady(map);latest.current.onZoom?.(map.getZoom());container.dataset.mapInitMs=String(performance.now()-started);performance.mark('hotspot-map-ready');}catch{issue('initialization');}
  };
  const error=(e:{error:{message:string};sourceId?:string})=>{const source=e.sourceId;if(source==='imagery')issue('imagery');else if(source==='land')issue('geography');else if(source==='observations'||source==='clusters')issue('observations');else if(/worker|webgl|context/i.test(e.error.message))issue(/webgl|context/i.test(e.error.message)?'webgl':'observations');};
  // Primary canvas owns gestures; querying uses the visible sensor's full-size map.
  const targetAt=(x:number)=>latest.current.compare&&x>container.clientWidth*latest.current.split/100&&other.current?.getLayer('points')?other.current:map;
  const hit=(e:MapMouseEvent)=>{const target=targetAt(e.point.x);if(!target.getLayer('points'))return {target,feature:undefined};return {target,feature:target.queryRenderedFeatures([[e.point.x-5,e.point.y-5],[e.point.x+5,e.point.y+5]],{layers:['points','cluster-points']})[0]};};
  const click=async(e:MapMouseEvent)=>{
   const {target,feature}=hit(e);if(!feature)return;
   if(feature.properties?.cluster){try{const zoom=await (target.getSource('clusters') as GeoJSONSource).getClusterExpansionZoom(Number(feature.properties.cluster_id));if(!active||main.current!==map||(target!==map&&target!==other.current))return;map.easeTo({center:(feature.geometry as GeoJSON.Point).coordinates as [number,number],zoom,duration:duration(600)});}catch{if(active)issue('observations');}return;}
   const record=recordIndex.current.get(String(feature.properties?.id));if(record)latest.current.onSelect(record);
  };
  const move=(e:MapMouseEvent)=>{const {target,feature}=hit(e);map.getCanvas().style.cursor=feature?'pointer':'';highlight(map,'hover',null);highlight(other.current,'hover',null);highlight(target,'hover',typeof feature?.properties?.id==='string'?feature.properties.id:null);};
  const leave=()=>{highlight(map,'hover',null);highlight(other.current,'hover',null);map.getCanvas().style.cursor='';};
  const zoom=()=>{if(active)latest.current.onZoom?.(map.getZoom());};const lost=()=>issue('webgl');
  map.on('style.load',loaded);map.on('error',error);map.on('click',click);map.on('mousemove',move);map.on('zoomend',zoom);
  map.getCanvas().addEventListener('mouseleave',leave);map.getCanvas().addEventListener('webglcontextlost',lost);
  const observer=new ResizeObserver(()=>{if(active)map.resize();});observer.observe(container);
  return()=>{active=false;observer.disconnect();map.off('style.load',loaded);map.off('error',error);map.off('click',click);map.off('mousemove',move);map.off('zoomend',zoom);map.getCanvas().removeEventListener('mouseleave',leave);map.getCanvas().removeEventListener('webglcontextlost',lost);clearSourceCache(map);map.remove();if(main.current===map)main.current=null;delete (container as TestContainer).__hotspotMap;latest.current.onReady(null);};
 },[]);
 useEffect(()=>{if(ready&&main.current)main.current.setProjection({type:p.globe?'globe':'mercator'});if(otherReady&&other.current)other.current.setProjection({type:p.globe?'globe':'mercator'});},[p.globe,ready,otherReady]);
 useEffect(()=>{if(ready&&main.current)main.current.flyTo({center:p.region??[-30,5],zoom:p.region?4:2.25,duration:duration(1800)});},[p.region,ready]);
 useEffect(()=>{
  const map=main.current,container=second.current;if(!p.compare||!ready||!map||!container)return;
  let active=true;let m:GLMap;setOtherReady(false);
  try{m=new maplibregl.Map({container,style,center:map.getCenter(),zoom:map.getZoom(),bearing:map.getBearing(),pitch:map.getPitch(),interactive:false,attributionControl:false});}catch{setIssues(v=>v.includes('initialization')?v:[...v,'initialization']);return;}
  other.current=m;if(import.meta.env.DEV)(container as TestContainer).__hotspotMap=m;m.getCanvas().setAttribute('aria-hidden','true');m.getCanvas().tabIndex=-1;
  const sync=()=>{if(active)m.jumpTo({center:map.getCenter(),zoom:map.getZoom(),bearing:map.getBearing(),pitch:map.getPitch()});};
  const loaded=()=>{if(!active)return;m.setProjection({type:latest.current.globe?'globe':'mercator'});addObservationLayers(m);sync();setOtherReady(true);};
  const error=(e:{error:{message:string};sourceId?:string})=>{if(!active)return;const source=e.sourceId;const issue:MapIssue=source==='imagery'?'imagery':source==='land'?'geography':'observations';setIssues(v=>v.includes(issue)?v:[...v,issue]);};
  map.on('move',sync);m.on('style.load',loaded);m.on('error',error);const resize=new ResizeObserver(()=>{if(active)m.resize();});resize.observe(container);
  return()=>{active=false;resize.disconnect();map.off('move',sync);m.off('style.load',loaded);m.off('error',error);clearSourceCache(m);m.remove();if(other.current===m)other.current=null;delete (container as TestContainer).__hotspotMap;};
 },[p.compare,ready]);
 useEffect(()=>{if(ready&&main.current)updateObservationLayers(main.current,p.compare?modis:p.data,p.layer,p.compare);if(p.compare&&otherReady&&other.current)updateObservationLayers(other.current,viirs,p.layer,true);},[p.data,p.layer,p.compare,modis,viirs,ready,otherReady]);
 useEffect(()=>{highlight(main.current,'selected',p.selected?.id??null);highlight(other.current,'selected',p.selected?.id??null);},[p.selected,ready,otherReady]);
 useEffect(()=>{if(p.focus&&ready)main.current?.flyTo({center:[p.focus.longitude,p.focus.latitude],zoom:8,duration:duration(800)});},[p.focus,ready]);
 const fatal=issues.some(i=>i==='webgl'||i==='initialization');
 return <><div className={`earth-stage ${p.intro?'entry-earth':''}`} role="region" aria-label={p.compare?'MODIS and VIIRS split observation map':'Earth observation map'}><div ref={host} className="map-canvas"/>{p.compare&&<div className="comparison-clip" style={{clipPath:`inset(0 0 0 ${p.split}%)`}}><div ref={second} className="map-canvas"/></div>}</div>{(!ready||(p.compare&&!otherReady))&&!fatal&&<div className="map-loading" role="status"><span className="orbit-loader"/>ESTABLISHING A PLANETARY PERSPECTIVE</div>}{ready&&!p.intro&&p.data.length===0&&<div className="map-empty" role="status">No observations in the current map selection.</div>}{issues.length>0&&<div className={fatal?'map-loading':'map-notice'} role="status">{issues.map(i=><p key={i}>{messages[i]}</p>)}</div>}</>;
}
