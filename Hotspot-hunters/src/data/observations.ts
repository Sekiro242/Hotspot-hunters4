import {months,regions} from '../shared/geography';
import type {Observation,Sensor} from '../shared/types/observation';
export {months,regions} from '../shared/geography';
export type {Observation,Sensor} from '../shared/types/observation';
function seeded(seed:number){return ()=>{seed|=0; seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
const cache=new Map<number,Observation[]>();
/** Frontend adapter boundary. Replace this implementation with parsed FIRMS records. */
export const demoAdapter={
 year(year:number):Observation[]{
  if(year<2000)return [];
  if(cache.has(year))return cache.get(year)!;
  const result:Observation[]=[];
  regions.forEach((r,ri)=>months.forEach((_,month)=>{
   const random=seeded(year*1231+ri*317+month*61);
   const seasonal=.25+.75*(1+Math.cos((month-r.peak)*Math.PI/6))/2;
   for(const sensor of ['MODIS','VIIRS'] as Sensor[]){
    if(sensor==='VIIRS'&&year<2012)continue;
    const count=Math.round((sensor==='MODIS'?105:235)*seasonal*(.7+random()*.6));
    for(let i=0;i<count;i++){
     const cluster=i%7, angle=cluster*2.399;
     const longitude=r.center[0]+Math.cos(angle)*r.spread[0]*.42+(random()-.5)*r.spread[0]*.42;
     const latitude=r.center[1]+Math.sin(angle)*r.spread[1]*.42+(random()-.5)*r.spread[1]*.42;
     const day=1+Math.floor(random()*28);
     result.push({id:`${year}-${month}-${r.id}-${sensor}-${i}`,latitude,longitude,acquisitionDate:`${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`,acquisitionTime:`${String(Math.floor(random()*24)).padStart(2,'0')}:${String(Math.floor(random()*60)).padStart(2,'0')}`,sensor,satellite:sensor==='MODIS'?(i%2?'Terra':'Aqua'):'Suomi NPP',confidence:sensor==='MODIS'?Math.floor(30+random()*70):(['low','nominal','high'][Math.floor(random()*3)]),frp:Math.round((2+random()**3*180)*10)/10,daynight:random()>.4?'D':'N',processingType:'SYNTHETIC',region:r.id});
    }
   }
  }));if(cache.size>=12)cache.delete(cache.keys().next().value!);cache.set(year,result);return result;
 },
 select(year:number,month:number,region:string,sensors:Sensor[]){return this.year(year).filter(o=>Number(o.acquisitionDate.slice(5,7))===month+1&&(region==='global'||o.region===region)&&sensors.includes(o.sensor));},
 monthly(year:number,region:string,sensors:Sensor[]){return months.map((_,i)=>this.select(year,i,region,sensors).length);}
};
export function geojson(data:Observation[]):GeoJSON.FeatureCollection<GeoJSON.Point>{return {type:'FeatureCollection',features:data.map(o=>({type:'Feature',id:o.id,geometry:{type:'Point',coordinates:[o.longitude,o.latitude]},properties:{...o}}))};}
