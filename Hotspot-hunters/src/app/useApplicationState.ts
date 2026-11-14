import {defaultExplorerFilters,type ExplorerFilters} from '../features/data-explorer/model';
import {useRef,useState} from 'react';
import type {Map as GLMap} from 'maplibre-gl';
import type {Observation,Sensor,DataMode} from '../shared/types/observation';
import type {Scene,MapLayer,ComparisonMode} from './types';
export function useApplicationState(){
 const [scene,setScene]=useState<Scene>(()=>typeof window!=='undefined'&&window.location.hash.startsWith('#research=')?'research':'entry'),[year,setYear]=useState(2026),[month,setMonth]=useState(10),[region,setRegion]=useState('global');
 const [sensors,setSensors]=useState<Sensor[]>(['MODIS','VIIRS']),[layer,setLayer]=useState<MapLayer>('points'),[globe,setGlobe]=useState(true),[playing,setPlaying]=useState(false),[speed,setSpeed]=useState(1),[split,setSplit]=useState(50),[compareMode,setCompareMode]=useState<ComparisonMode>('split');
 const [search,setSearch]=useState(false),[query,setQuery]=useState(''),[selected,setSelected]=useState<Observation|null>(null),[controls,setControls]=useState(false),[skipped,setSkipped]=useState(false);
 const [dateRange,setDateRange]=useState<{startDate:string;endDate:string}|null>(null);
 const [dataMode,setDataMode]=useState<DataMode>('demo');
 const [explorerFilters,setExplorerFilters]=useState<ExplorerFilters>({...defaultExplorerFilters});
 const [focus,setFocus]=useState<Observation|null>(null);
 const [methodologyNotes,setMethodologyNotes]=useState('');
 const map=useRef<GLMap|null>(null);
 const [aggregated,setAggregated]=useState(true);
 return {methodologyNotes,setMethodologyNotes,explorerFilters,setExplorerFilters,focus,setFocus,dateRange,setDateRange,dataMode,setDataMode,scene,setScene,year,setYear,month,setMonth,region,setRegion,sensors,setSensors,layer,setLayer,globe,setGlobe,playing,setPlaying,speed,setSpeed,split,setSplit,compareMode,setCompareMode,search,setSearch,query,setQuery,selected,setSelected,controls,setControls,skipped,setSkipped,map,aggregated,setAggregated};
}
