import {demoAdapter} from '../observations';
import {months} from '../../shared/geography';
import {monthRange,validDate} from '../../shared/dates';
import type {ObservationRepository,ObservationQuery} from './types';
import type {CalendarResponse} from '../contracts';
import {ApiError} from '../http';
export function demoRecords(q:ObservationQuery){
 if(!q.startDate||!q.endDate)return demoAdapter.select(q.year,q.month,q.region,q.sensors);
 if(!validDate(q.startDate)||!validDate(q.endDate)||q.startDate>q.endDate)throw new ApiError('schema','Invalid date range.');
 const startYear=Number(q.startDate.slice(0,4)),endYear=Number(q.endDate.slice(0,4));
 if(endYear-startYear>6)throw new ApiError('size','Demo ranges are limited to seven years.');
 return Array.from({length:endYear-startYear+1},(_,i)=>demoAdapter.year(startYear+i)).flat().filter(o=>o.acquisitionDate>=q.startDate!&&o.acquisitionDate<=q.endDate!&&(q.region==='global'||o.region===q.region)&&q.sensors.includes(o.sensor));
}
export function demoCalendar(q:ObservationQuery):CalendarResponse{
 const values=demoAdapter.monthly(q.year,q.region,q.sensors),total=values.reduce((a,b)=>a+b,0),mean=total/12;
 return {year:q.year,selected_month:q.month,region:q.region,sensors:q.sensors,monthly_rhythm:values.map((count,i)=>({month_index:i,month_number:i+1,month_name:months[i],month_abbr:months[i].slice(0,3),detection_count:count,active_cell_days:0,active_days:0,is_unusual:count>mean*1.3,baseline_ratio:mean?count/mean:null})),historical_trends:Array.from({length:6},(_,i)=>{const year=q.year-5+i,rows=demoAdapter.select(year,q.month,q.region,q.sensors);return {year,month:q.month+1,detection_count:rows.length,active_cell_days:0,modis_count:rows.filter(o=>o.sensor==='MODIS').length,viirs_count:rows.filter(o=>o.sensor==='VIIRS').length,data_status:'synthetic'};}),annual_total_detections:total,annual_active_cell_days:0,average_monthly_detections:mean,unusual_period_threshold:mean*1.3,quality_notes:['Illustrative synthetic data. Not measured coverage or validated anomalies.']};
}
export const demoRepository:ObservationRepository={mode:'demo',async load(q){return {records:demoRecords(q).map(o=>({...o,dataSource:'demo',timezone:'UTC',frpUnit:'MW',sourceProduct:'LOCAL_SYNTHETIC_DEMO'})),source:'demo',partial:false,warnings:[]};},async calendar(q){return demoCalendar(q);},async monthly(q){return demoAdapter.monthly(q.year,q.region,q.sensors);}};
