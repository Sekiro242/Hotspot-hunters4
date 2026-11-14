import type {Observation,Sensor,DataMode} from '../../shared/types/observation';
import type {CalendarResponse} from '../contracts';
export type ObservationQuery={year:number;month:number;region:string;sensors:Sensor[];startDate?:string;endDate?:string;limit?:number};
export type ObservationResult={records:Observation[];source:DataMode;partial:boolean;warnings:string[];fetchedAt?:string;metadata?:Record<string,unknown>};
export interface ObservationRepository {readonly mode:DataMode;load(query:ObservationQuery,signal?:AbortSignal):Promise<ObservationResult>;calendar(query:ObservationQuery,signal?:AbortSignal):Promise<CalendarResponse>;monthly(query:ObservationQuery,signal?:AbortSignal):Promise<number[]>;}
