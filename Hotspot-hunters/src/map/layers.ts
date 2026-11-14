import type {Map as GLMap,GeoJSONSource} from 'maplibre-gl';
import {geojson} from '../data/observations';
import type {Observation} from '../shared/types/observation';
import type {MapLayer} from '../app/types';
const lastData=new WeakMap<GLMap,Observation[]>();
export function addObservationLayers(map:GLMap){
 if(map.getSource('observations'))return;
 map.addSource('observations',{type:'geojson',data:geojson([])});
 map.addSource('clusters',{type:'geojson',data:geojson([]),cluster:true,clusterMaxZoom:5,clusterRadius:35});
 map.addLayer({id:'heat',type:'heatmap',source:'observations',paint:{'heatmap-weight':.6,'heatmap-intensity':1.1,'heatmap-radius':25,'heatmap-opacity':.75,'heatmap-color':['interpolate',['linear'],['heatmap-density'],0,'rgba(255,70,35,0)',.2,'#943c25',.5,'#f46a32',.8,'#ffac4b',1,'#fff1b7']}});
 map.addLayer({id:'halos',type:'circle',source:'observations',paint:{'circle-radius':['interpolate',['linear'],['zoom'],1,5,7,10],'circle-color':['match',['get','sensor'],'VIIRS','#5bdddb','#ff985c'],'circle-opacity':.12,'circle-blur':.7}});
 map.addLayer({id:'points',type:'circle',source:'observations',paint:{'circle-radius':['interpolate',['linear'],['zoom'],1,1.8,5,3,9,6],'circle-color':['match',['get','sensor'],'VIIRS','#63dfde','#ffa568'],'circle-opacity':.95,'circle-stroke-color':'#fff1cb','circle-stroke-width':.2}});
 map.addLayer({id:'cluster-points',type:'circle',source:'clusters',paint:{'circle-radius':['case',['has','point_count'],['interpolate',['linear'],['get','point_count'],2,2.5,150,7],3],'circle-color':['match',['get','sensor'],'VIIRS','#63dfde','#ff9a57'],'circle-opacity':.9,'circle-blur':.25,'circle-stroke-color':'#ffd7b5','circle-stroke-width':.3}});
 map.addLayer({id:'hover',type:'circle',source:'observations',filter:['==',['get','id'],''],paint:{'circle-radius':9,'circle-color':'transparent','circle-stroke-color':'#edf7ed','circle-stroke-width':1.5}});
 map.addLayer({id:'selected',type:'circle',source:'observations',filter:['==',['get','id'],''],paint:{'circle-radius':11,'circle-color':'transparent','circle-stroke-color':'#edf7ed','circle-stroke-width':2}});
}
export function updateObservationLayers(map:GLMap,records:Observation[],layer:MapLayer,compare:boolean){
 if(!map.getSource('observations')||!map.getLayer('points'))return;
 if(lastData.get(map)!==records){
  const collection=geojson(records);collection.features.forEach(f=>{f.properties={id:f.id,sensor:f.properties?.sensor};});
  (map.getSource('observations') as GeoJSONSource).setData(collection);
  (map.getSource('clusters') as GeoJSONSource).setData(collection);
  lastData.set(map,records);
 }
 const aggregate=!compare&&layer==='points';
 map.setLayerZoomRange('points',aggregate?2.5:0,24);map.setLayerZoomRange('halos',aggregate?2.5:0,24);
 map.setLayerZoomRange('cluster-points',0,aggregate?2.5:24);
 for(const id of ['heat','halos','points','cluster-points']){
  const visible=layer==='density'?id==='heat':layer==='clusters'?id==='cluster-points':id==='points'||id==='halos'||(aggregate&&id==='cluster-points');
  map.setLayoutProperty(id,'visibility',visible?'visible':'none');
 }
}
export function highlight(map:GLMap|null,layer:'hover'|'selected',id:string|null){
 if(map?.getLayer(layer))map.setFilter(layer,['==',['get','id'],id??'']);
}
export function clearSourceCache(map:GLMap){lastData.delete(map);}
