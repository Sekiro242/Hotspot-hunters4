import {useState} from 'react';
import {ArrowUpRight} from 'lucide-react';
import {months} from '../../shared/geography';
import type {Sensor} from '../../shared/types/observation';

import type {CalendarResponse} from '../../data/contracts';

export default function Calendar({year,month,region,sensors,onMonth,data,dataMode,error,onRetry}:{data:CalendarResponse|null;dataMode:'demo'|'real';error:string|null;onRetry:()=>void;year:number;month:number;region:string;sensors:Sensor[];onMonth:(m:number)=>void}){
 const [mode,setMode]=useState('Monthly rhythm');
 const isLive=dataMode==='real';
 const values=data?.monthly_rhythm.map(m=>m.detection_count)??Array(12).fill(0);
 const historic=data?.historical_trends.map(h=>({year:h.year,count:h.detection_count,status:h.data_status}))??[];
 const average=values.reduce((a,b)=>a+b,0)/12,max=Math.max(...values,1);

 return <section className="calendar-sheet scene-sheet"><div className="eyebrow">BURNING ACTIVITY CALENDAR <span> / {year}</span></div><div className="sheet-heading"><h2>The Earth’s<br/><em>thermal memory.</em></h2><p>Every season leaves a pattern.<br/>Move through the months to find it.</p></div><div className="tabs">{['Monthly rhythm','Historical trends','Unusual periods'].map(t=><button key={t} aria-pressed={mode===t} className={mode===t?'active':''} onClick={()=>setMode(t)}>{t}</button>)}</div>
 {data&&(mode==='Historical trends'?<div className="history-chart">{historic.map(v=><div key={v.year}><span>{v.count.toLocaleString()}</span><i style={{height:`${Math.max(2,v.count/Math.max(...historic.map(h=>h.count),1)*100)}px`}}/><b>{v.year}</b><small>{v.status?.includes('unobserved')?'Unobserved / unknown':v.status==='synthetic'?'Demo':'Raw'}</small></div>)}</div>:<div className="rhythm">{values.map((v,i)=><button aria-label={`${months[i]}: ${v} ${months[i].slice(0,3)} ${isLive?'backend':'illustrative'} observations`} aria-pressed={month===i} key={i} onClick={()=>onMonth(i)} className={`${month===i?'selected':''} ${mode==='Unusual periods'&&v>average*1.3?'unusual':''}`}><span className="bar-count">{v}</span>{' '}<span className="ribbon" style={{height:`${Math.max(4,v/max*100)}px`}}/>{' '}<span className="month-label">{months[i].slice(0,3)}</span></button>)}</div>)}
 {error?<p role="alert">{error} <button onClick={onRetry}>Retry calendar</button></p>:!data?<p role="status">Loading activity calendar…</p>:null}
 <div className="calendar-footer"><div><b>{months[month]} {year}</b><span>{data?values[month].toLocaleString():'—'} {isLive?'backend raw observations':'synthetic observations'} · {sensors.join(' + ')||'no sensors selected'}</span></div><ArrowUpRight size={24}/></div><p className="fine-print">{isLive?'Backend FIRMS raw counts (not calibrated). Aggregates may be capped at 50,000 records. Missing or unobserved periods do not prove zero activity; 1.3× annual mean is a descriptive rule, not validated anomaly detection.':mode==='Unusual periods'?'Highlighted months exceed 1.3× this synthetic year’s monthly mean. This is a demo rule, not a validated anomaly measure.':mode==='Historical trends'?`Same month (${months[month]}) across six synthetic years. Sensor availability changes in 2012; raw counts are not calibrated.`:'Illustrative seasonal counts, not a validated harmonized index. Select a month to update the map.'}</p></section>;
}
