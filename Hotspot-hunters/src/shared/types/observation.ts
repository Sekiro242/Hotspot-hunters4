export type Sensor='MODIS'|'VIIRS';
export type DataMode='demo'|'real';
export type Observation={
 id:string;latitude:number;longitude:number;acquisitionDate:string;acquisitionTime:string;
 sensor:Sensor;satellite:string|null;confidence:number|string|null;frp:number|null;daynight:'D'|'N'|null;
 processingType:'NRT'|'STANDARD'|'SYNTHETIC'|'ARCHIVE'|null;region:string|null;
 confidenceLevel?:string|null;gridId?:string|null;sourceProduct?:string|null;
 dataSource?:DataMode;frpUnit?:'MW';timezone?:'UTC';originalProperties?:Record<string,unknown>;
};
