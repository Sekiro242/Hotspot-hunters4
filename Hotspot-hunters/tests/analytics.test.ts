import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildSeasonalDistribution,createAnalyticsService,type AnalyticsClient} from '../src/features/analytics/analyticsService';
import type {CalendarResponse,DataQualityReport} from '../src/data/contracts';
import type {Sensor} from '../src/shared/types/observation';

const sensors:Sensor[]=['MODIS','VIIRS'];
const query={year:2024,month:1,region:'amazon',sensors,startDate:'2024-02-01',endDate:'2024-02-29'};
const calendar:CalendarResponse={year:2024,selected_month:1,region:'amazon',sensors,monthly_rhythm:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((month,index)=>({month_index:index,month_number:index+1,month_name:month,month_abbr:month.slice(0,3),detection_count:index+1,active_cell_days:index+1,active_days:index+1})),historical_trends:[2021,2022,2023,2024].map(year=>({year,month:2,detection_count:year-2000,active_cell_days:1})),annual_total_detections:78,annual_active_cell_days:12,average_monthly_detections:6.5,unusual_period_threshold:8};
const quality:DataQualityReport={requested_start_date:query.startDate,requested_end_date:query.endDate,total_days_in_range:29,days_with_data_present:28,days_with_zero_detections:0,days_missing_or_unobserved:1,sensors_analyzed:sensors,sensor_metrics:{MODIS:{sensor:'MODIS',satellite:'Terra/Aqua',nominal_resolution_meters:1000,total_detections:4,low_confidence_count:1,nominal_confidence_count:2,high_confidence_count:1,mean_frp_mw:12.5,max_frp_mw:40},VIIRS:{sensor:'VIIRS',satellite:'NOAA-20',nominal_resolution_meters:375,total_detections:6,low_confidence_count:2,nominal_confidence_count:3,high_confidence_count:1,mean_frp_mw:7,max_frp_mw:19}},processing_tiers_present:['NRT'],known_limitations:['Cloud and smoke can obscure anomalies.'],harmonization_status:'uncalibrated_raw'};
const summary={total_detections:10,total_active_cell_days:7,modis_detections:4,viirs_detections:6,total_frp_mw:105,mean_daily_detections:10/29,peak_date:'2024-02-10',peak_detections:4};
const analysis={analysis_id:'fixture',request:{aoi:{region_preset:'amazon'},start_date:query.startDate,end_date:query.endDate,sensors,metric:'detections',mode:'raw'},summary,daily_time_series:[],monthly_rhythm:calendar.monthly_rhythm,top_active_cells:[{grid_id:'-10.0_-60.0',center_lat:-10,center_lon:-60,bbox:[-60,-10,-59.9,-9.9],total_detections:10,active_days:4,sensor_breakdown:{MODIS:4,VIIRS:6},mean_frp_mw:10}],quality_report:quality,methodology_version:'0.1.0-uncalibrated',computation_time_ms:4};

function clientFixture(counters:{summary:number;active:number}):AnalyticsClient{
 return {getSummary:async(region:string)=>{counters.summary+=1;await new Promise(resolve=>setTimeout(resolve,1));return {...summary,total_detections:region==='amazon'?10:region==='africa'?8:region==='asia'?7:region==='australia'?6:5};},getQuality:async()=>quality,getCalendar:async()=>calendar,analyze:async()=>{counters.active+=1;return analysis as never;}} as unknown as AnalyticsClient;
}

test('seasonal distribution groups server monthly values without changing their sum',()=>{
 const result=buildSeasonalDistribution(calendar.monthly_rhythm);
 assert.deepEqual(result.map(item=>item.value),[15,12,21,30]);
 assert.equal(result.reduce((sum,item)=>sum+item.value,0),78);
 assert.equal(result[0]?.months,'Jan / Feb / Dec');
});

test('real analytics uses bounded aggregate queries and never requests raw observation records',async()=>{
 const counters={summary:0,active:0};const service=createAnalyticsService(clientFixture(counters));
 const result=await service.load(query,'real',new AbortController().signal);
 assert.equal(result.source,'real');
 assert.equal(result.overview.total,10);
 assert.equal(result.frp.sensors[0]?.sum,null,'real aggregate contract does not expose per-sensor FRP sums');
 assert.equal(result.frp.sensors[0]?.mean,12.5);
 assert.equal(result.confidence[1]?.labels[0]?.label,'low');
 assert.equal(result.spatial[0]?.gridId,'-10.0_-60.0');
 assert.ok(result.warnings.some(w=>w.includes('50,000')));
 assert.ok(result.warnings.some(w=>w.includes('Day/night')));
 assert.ok(counters.summary>=7,'current, previous, and five regional summary queries should run');
 assert.equal(counters.active,1);
});

test('regional summary fan-out is bounded and region rows are independent raw counts',async()=>{
 let active=0;let maxActive=0;
 const counters={summary:0,active:0};const client=clientFixture(counters);
 const bounded={...client,getSummary:async(...args:Parameters<AnalyticsClient['getSummary']>)=>{active+=1;maxActive=Math.max(maxActive,active);await new Promise(resolve=>setTimeout(resolve,3));const value=await client.getSummary(...args);active-=1;return value;}} as AnalyticsClient;
 const result=await createAnalyticsService(bounded).load(query,'real',new AbortController().signal);
 assert.ok(maxActive<=4,'the five-region fan-out is bounded rather than unbounded');
 assert.equal(result.regions.length,5);
 assert.equal(result.regions.every(item=>!('share' in item)),true);
});

test('demo mode is explicitly synthetic and can calculate demo-only FRP sums',async()=>{
 const result=await createAnalyticsService(clientFixture({summary:0,active:0})).load({...query,region:'global'},'demo',new AbortController().signal);
 assert.equal(result.source,'demo');
 assert.match(result.overview.sourceLabel,/Synthetic/);
 assert.ok(result.warnings.some(w=>w.includes('not a scientific finding')));
 assert.ok(result.frp.sensors.every(sensor=>sensor.available));
 assert.equal(result.quality.harmonization_status,'synthetic_demo');
});
