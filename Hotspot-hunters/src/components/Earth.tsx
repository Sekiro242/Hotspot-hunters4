import {useEffect,useRef,useState} from 'react';
import * as maplibregl from 'maplibre-gl';
import type {Map as GLMap,GeoJSONSource,StyleSpecification} from 'maplibre-gl';
import {geojson,type Observation} from '../data/observations';
export type EarthProps={data:Observation[];globe:boolean;layer:string;region:[number,number]|null;intro:boolean;onSelect:(o:Observation)=>void;compare:boolean;split:number;onReady:(map:GLMap)=>void};
const style:StyleSpecification={version:8,sources:{land:{type:'geojson',data:'/countries.geojson'},imagery:{type:'raster',tiles:['https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],tileSize:256,maxzoom:17,attribution:'Imagery © Esri, Maxar, Earthstar Geographics | Natural Earth'}},layers:[{id:'ocean',type:'background',paint:{'background-color':'#081923'}},{id:'land',type:'fill',source:'land',paint:{'fill-color':'#203a3e'}},{id:'satellite',type:'raster',source:'imagery',paint:{'raster-opacity':.72,'raster-saturation':-.65,'raster-brightness-max':.68}},{id:'borders',type:'line',source:'land',paint:{'line-color':'#92b1ac','line-opacity':.16,'line-width':.5}}]};
function addData(map:GLMap){
 map.addSource('observations',{type:'geojson',data:geojson([])});
 map.addSource('clusters',{type:'geojson',data:geojson([]),cluster:true,clusterMaxZoom:5,clusterRadius:35});
 map.addLayer({id:'heat',type:'heatmap',source:'observations',paint:{'heatmap-weight':.6,'heatmap-intensity':1.1,'heatmap-radius':25,'heatmap-opacity':.75,'heatmap-color':['interpolate',['linear'],['heatmap-density'],0,'rgba(255,70,35,0)',.2,'#943c25',.5,'#f46a32',.8,'#ffac4b',1,'#fff1b7']}});
 map.addLayer({id:'halos',type:'circle',source:'observations',paint:{'circle-radius':['interpolate',['linear'],['zoom'],1,5,7,10],'circle-color':['match',['get','sensor'],'VIIRS','#5bdddb','#ff985c'],'circle-opacity':.12,'circle-blur':.7}});
 map.addLayer({id:'points',type:'circle',source:'observations',paint:{'circle-radius':['interpolate',['linear'],['zoom'],1,1.8,5,3,9,6],'circle-color':['match',['get','sensor'],'VIIRS','#63dfde','#ffa568'],'circle-opacity':.95,'circle-stroke-color':'#fff1cb','circle-stroke-width':.2}});
 map.addLayer({id:'cluster-points',type:'circle',source:'clusters',paint:{'circle-radius':['case',['has','point_count'],['interpolate',['linear'],['get','point_count'],2,2.5,150,7],3],'circle-color':'#ff9a57','circle-opacity':.9,'circle-blur':.25,'circle-stroke-color':'#ffd7b5','circle-stroke-width':.3}});
 map.addLayer({id:'hover',type:'circle',source:'observations',filter:['==',['get','id'],''],paint:{'circle-radius':9,'circle-color':'transparent','circle-stroke-color':'#edf7ed','circle-stroke-width':1.5}});
}
export default function Earth(p:EarthProps){
 const host=useRef<HTMLDivElement>(null),second=useRef<HTMLDivElement>(null),main=useRef<GLMap|null>(null),other=useRef<GLMap|null>(null),latest=useRef(p);latest.current=p;
 const [ready,setReady]=useState(false),[fallback,setFallback]=useState(false),[fatal,setFatal]=useState(false);
 useEffect(()=>{
  if(!host.current)return;
  let map:GLMap;
  try{map=new maplibregl.Map({container:host.current,style,center:[-30,5],zoom:2.25,minZoom:.7,maxZoom:13,attributionControl:{compact:true},canvasContextAttributes:{antialias:true}});}catch{setFatal(true);return;}
  main.current=map;
  map.on('style.load',()=>{map.setProjection({type:latest.current.globe?'globe':'mercator'});map.setSky({'sky-color':'#060c13','horizon-color':'#47828b','fog-color':'#101f28','sky-horizon-blend':.5,'horizon-fog-blend':.5,'fog-ground-blend':.2});addData(map);setReady(true);latest.current.onReady(map);});
  map.on('error',e=>{if(e.error.message.includes('fetch')||e.error.message.includes('tile'))setFallback(true);});
  const hitMap=(x:number)=>latest.current.compare&&x>map.getContainer().clientWidth*latest.current.split/100&&other.current?.getLayer('points')?other.current:map;
  map.on('click',e=>{const target=hitMap(e.point.x);if(!target.getLayer('points'))return;const f=target.queryRenderedFeatures([[e.point.x-5,e.point.y-5],[e.point.x+5,e.point.y+5]],{layers:['points','cluster-points']})[0];if(!f)return;if(f.properties?.cluster){map.easeTo({center:(f.geometry as GeoJSON.Point).coordinates as [number,number],zoom:map.getZoom()+2,duration:600});return;}const o=latest.current.data.find(o=>o.id===f.properties?.id);if(o)latest.current.onSelect(o);});
  map.on('mousemove',e=>{const target=hitMap(e.point.x);if(!target.getLayer('points'))return;const f=target.queryRenderedFeatures(e.point,{layers:['points','cluster-points']})[0];map.getCanvas().style.cursor=f?'pointer':'';target.setFilter('hover',['==',['get','id'],f?.properties?.id??'']);});
  const observer=new ResizeObserver(()=>map.resize());observer.observe(host.current);
  return ()=>{observer.disconnect();map.remove();main.current=null;};
 },[]);
 useEffect(()=>{if(!ready||!main.current)return;main.current.setProjection({type:p.globe?'globe':'mercator'});other.current?.setProjection({type:p.globe?'globe':'mercator'});},[p.globe,ready]);
 useEffect(()=>{if(!ready||!main.current)return;main.current.flyTo({center:p.region??[-30,5],zoom:p.region?4:2.25,duration:matchMedia('(prefers-reduced-motion: reduce)').matches?0:1800});},[p.region,ready]);
 useEffect(()=>{
  const map=main.current;if(!ready||!map)return;
  const update=(m:GLMap,records:Observation[])=>{(m.getSource('observations') as GeoJSONSource)?.setData(geojson(records));(m.getSource('clusters') as GeoJSONSource)?.setData(geojson(records));const aggregate=!p.compare&&p.layer==='points';m.setLayerZoomRange('points',aggregate?2.5:0,24);m.setLayerZoomRange('halos',aggregate?2.5:0,24);m.setLayerZoomRange('cluster-points',0,aggregate?2.5:24);for(const id of ['heat','halos','points','cluster-points'])m.setLayoutProperty(id,'visibility',(p.layer==='density'?id==='heat':p.layer==='clusters'?id==='cluster-points':id==='points'||id==='halos'||(aggregate&&id==='cluster-points'))?'visible':'none');};
  update(map,p.compare?p.data.filter(o=>o.sensor==='MODIS'):p.data);
  if(other.current?.getSource('observations'))update(other.current,p.data.filter(o=>o.sensor==='VIIRS'));
 },[p.data,p.layer,p.compare,ready]);
 useEffect(()=>{
  const map=main.current;if(!p.compare||!ready||!map||!second.current)return;
  const m=new maplibregl.Map({container:second.current,style,center:map.getCenter(),zoom:map.getZoom(),bearing:map.getBearing(),pitch:map.getPitch(),interactive:false,attributionControl:false});other.current=m;
  const sync=()=>m.jumpTo({center:map.getCenter(),zoom:map.getZoom(),bearing:map.getBearing(),pitch:map.getPitch()});map.on('move',sync);
  m.on('style.load',()=>{m.setProjection({type:latest.current.globe?'globe':'mercator'});addData(m);(m.getSource('observations') as GeoJSONSource).setData(geojson(latest.current.data.filter(o=>o.sensor==='VIIRS')));m.setLayoutProperty('heat','visibility','none');m.setLayoutProperty('cluster-points','visibility','none');});
  const resize=new ResizeObserver(()=>m.resize());resize.observe(second.current);
  return()=>{resize.disconnect();map.off('move',sync);m.remove();other.current=null;};
 },[p.compare,ready]);
 return <><div className={`earth-stage ${p.intro?'entry-earth':''}`}><div ref={host} className="map-canvas"/>{p.compare&&<div className="comparison-clip" style={{clipPath:`inset(0 0 0 ${p.split}%)`}}><div ref={second} className="map-canvas"/></div>}</div>{!ready&&!fatal&&<div className="map-loading"><span className="orbit-loader"/>ESTABLISHING A PLANETARY PERSPECTIVE</div>}{fallback&&<div className="map-notice">Some imagery unavailable · local geography remains interactive</div>}{fatal&&<div className="map-loading">WebGL is unavailable. Enable hardware acceleration and reload to explore the map.</div>}</>;
}


