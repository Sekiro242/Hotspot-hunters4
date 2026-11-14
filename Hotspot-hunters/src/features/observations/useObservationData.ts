import {useEffect,useState} from 'react';
import {apiRepository} from '../../data/repositories/api';
import {demoRepository} from '../../data/repositories/demo';
import type {Observation,Sensor,DataMode} from '../../shared/types/observation';
import type {CalendarResponse} from '../../data/contracts';
import type {ObservationResult} from '../../data/repositories/types';
type State={key:string;status:'loading'|'ready'|'error';result:ObservationResult|null;calendar:CalendarResponse|null;error:string|null;calendarError:string|null};
export function useObservationData(year:number,month:number,region:string,sensors:Sensor[],mode:DataMode,startDate?:string,endDate?:string){
 const [revision,setRevision]=useState(0);const key=JSON.stringify([year,month,region,sensors,mode,startDate,endDate,revision]);
 const [state,setState]=useState<State>({key:'',status:'loading',result:null,calendar:null,error:null,calendarError:null});
 useEffect(()=>{const controller=new AbortController(),repository=mode==='real'?apiRepository:demoRepository;const q={year,month,region,sensors,startDate,endDate};setState({key,status:'loading',result:null,calendar:null,error:null,calendarError:null});
  repository.load(q,controller.signal).then(result=>{if(!controller.signal.aborted)setState(s=>s.key===key?{...s,status:'ready',result}:s);}).catch(e=>{if(!controller.signal.aborted)setState(s=>s.key===key?{...s,status:'error',error:e instanceof Error?e.message:'Observation request failed.'}:s);});
  repository.calendar(q,controller.signal).then(calendar=>{if(!controller.signal.aborted)setState(s=>s.key===key?{...s,calendar}:s);}).catch(e=>{if(!controller.signal.aborted)setState(s=>s.key===key?{...s,calendarError:e instanceof Error?e.message:'Calendar request failed.'}:s);});
  return()=>controller.abort();
 },[key]);
 const current=state.key===key?state:{...state,status:'loading' as const,result:null,calendar:null,error:null,calendarError:null};
 return {data:current.result?.records??EMPTY,annual:current.calendar?.monthly_rhythm.map(m=>m.detection_count)??ZERO,calendar:current.calendar,status:current.status,error:current.error,calendarError:current.calendarError,partial:current.result?.partial??false,warnings:current.result?.warnings??[],fetchedAt:current.result?.fetchedAt,backendLive:mode==='real'&&current.status==='ready',retry:()=>setRevision(v=>v+1)};
}
const EMPTY:Observation[]=[],ZERO:number[]=Array(12).fill(0);
