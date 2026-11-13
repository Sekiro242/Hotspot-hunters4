import {useEffect,useMemo,useState} from 'react';
import {ArrowUpRight} from 'lucide-react';
import {demoAdapter,months,type Sensor} from '../data/observations';
import {burnCalendarApi,type CalendarApiResponse} from '../data/apiClient';

export default function Calendar({year,month,region,sensors,onMonth}:{year:number;month:number;region:string;sensors:Sensor[];onMonth:(m:number)=>void}){
 const [mode,setMode]=useState('Monthly rhythm');
 const [apiData,setApiData]=useState<CalendarApiResponse|null>(null);

 useEffect(()=>{
  let active=true;
  burnCalendarApi.getCalendar(year,month,region,sensors)
   .then(data=>{if(active&&data)setApiData(data);})
   .catch(()=>{if(active)setApiData(null);});
  return()=>{active=false;};
 },[year,month,region,sensors]);

 const demoValues=useMemo(()=>demoAdapter.monthly(year,region,sensors),[year,region,sensors]);
 const demoHistoric=useMemo(()=>Array.from({length:6},(_,i)=>({year:year-5+i,count:demoAdapter.select(year-5+i,month,region,sensors).length})),[year,month,region,sensors]);

 const isLive=Boolean(apiData&&apiData.monthly_rhythm?.length===12);
 const values=isLive?apiData!.monthly_rhythm.map(m=>m.detection_count):demoValues;
 const historic=isLive?apiData!.historical_trends.map(h=>({year:h.year,count:h.detection_count})):demoHistoric;

 const average=values.reduce((a,b)=>a+b,0)/12,max=Math.max(...values,1);

 return <section className="calendar-sheet scene-sheet"><div className="eyebrow">BURNING ACTIVITY CALENDAR <span> / {year}</span></div><div className="sheet-heading"><h2>The Earth’s<br/><em>thermal memory.</em></h2><p>Every season leaves a pattern.<br/>Move through the months to find it.</p></div><div className="tabs">{['Monthly rhythm','Historical trends','Unusual periods'].map(t=><button key={t} className={mode===t?'active':''} onClick={()=>setMode(t)}>{t}</button>)}</div>
 {mode==='Historical trends'?<div className="history-chart">{historic.map(v=><div key={v.year}><span>{v.count.toLocaleString()}</span><i style={{height:`${Math.max(2,v.count/Math.max(...historic.map(h=>h.count),1)*100)}px`}}/><b>{v.year}</b></div>)}</div>:<div className="rhythm">{values.map((v,i)=><button aria-label={`${months[i]}: ${v} observations`} aria-pressed={month===i} key={i} onClick={()=>onMonth(i)} className={`${month===i?'selected':''} ${mode==='Unusual periods'&&v>average*1.3?'unusual':''}`}><span className="bar-count">{v}</span><span className="ribbon" style={{height:`${Math.max(4,v/max*100)}px`}}/><span className="month-label">{months[i].slice(0,3)}</span></button>)}</div>}
 <div className="calendar-footer"><div><b>{months[month]} {year}</b><span>{values[month].toLocaleString()} {isLive?'NASA observations (Live API)':'synthetic observations'} · {sensors.join(' + ')||'no sensors selected'}</span></div><ArrowUpRight size={24}/></div><p className="fine-print">{isLive?'Live NASA FIRMS active-fire aggregations computed via DuckDB and Parquet.':mode==='Unusual periods'?'Highlighted months exceed 1.3× this synthetic year’s monthly mean. This is a demo rule, not a validated anomaly measure.':mode==='Historical trends'?`Same month (${months[month]}) across six synthetic years. Sensor availability changes in 2012; raw counts are not calibrated.`:'Illustrative seasonal counts, not a validated harmonized index. Select a month to update the map.'}</p></section>;
}
