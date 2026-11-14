export class ApiError extends Error{constructor(public kind:'http'|'network'|'timeout'|'schema'|'size',message:string,public status?:number){super(message);this.name='ApiError';}}
export type HttpOptions={signal?:AbortSignal;method?:'GET'|'POST';body?:unknown};
export function createHttpClient(baseUrl:string,timeoutMs=15000,fetcher:typeof fetch=fetch,maxBytes=16*1024*1024){
 return async function request(path:string,query:URLSearchParams=new URLSearchParams(),options:HttpOptions={}):Promise<unknown>{
  const controller=new AbortController();let timedOut=false;
  const abort=()=>controller.abort();if(options.signal?.aborted)controller.abort();options.signal?.addEventListener('abort',abort,{once:true});
  const timer=setTimeout(()=>{timedOut=true;controller.abort();},timeoutMs);
  try{
   const url=baseUrl.replace(/\/$/,'')+path+(query.size?'?'+query:'');
   const response=await fetcher(url,{signal:controller.signal,method:options.method??'GET',headers:{Accept:'application/json',...(options.body?{'Content-Type':'application/json'}:{})},...(options.body?{body:JSON.stringify(options.body)}:{})});
   if(!response.ok)throw new ApiError('http',response.status===422?'Invalid selection. Check the dates, region and sensors.':`Backend request failed (HTTP ${response.status}). Please retry.`,response.status);
   if(Number(response.headers.get('content-length'))>maxBytes)throw new ApiError('size','Response exceeds safe browser limit. Narrow the date range or region.');
   const reader=response.body?.getReader();let text='';
   if(reader){const decoder=new TextDecoder();let bytes=0;while(true){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;if(bytes>maxBytes){await reader.cancel();throw new ApiError('size','Response exceeds safe browser limit. Narrow the selection.');}text+=decoder.decode(part.value,{stream:true});}text+=decoder.decode();}else{text=await response.text();if(new TextEncoder().encode(text).byteLength>maxBytes)throw new ApiError('size','Response exceeds safe browser limit. Narrow the selection.');}
   try{return JSON.parse(text) as unknown;}catch{throw new ApiError('schema','Backend returned invalid JSON. No demo data was substituted.');}
  }catch(error){if(options.signal?.aborted)throw error;if(timedOut)throw new ApiError('timeout','Backend request timed out. Please retry or narrow the selection.');if(error instanceof ApiError)throw error;throw new ApiError('network','Cannot reach the backend. Check the connection and API URL, then retry.');}
  finally{clearTimeout(timer);options.signal?.removeEventListener('abort',abort);}
 };
}
export function object(value:unknown):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))throw new ApiError('schema','Unexpected backend response structure.');return value as Record<string,unknown>;}
export function numericFields(value:unknown,keys:string[]){const record=object(value);for(const k of keys)if(typeof record[k]!=='number'||!Number.isFinite(record[k])||(record[k] as number)<0)throw new ApiError('schema',`Invalid numeric field in backend response: ${k}`);return record;}
