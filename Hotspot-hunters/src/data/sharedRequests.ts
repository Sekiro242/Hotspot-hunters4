type Entry<T>={controller:AbortController;promise:Promise<T>;subscribers:number;settled:boolean;value?:T;expires:number};
/** Small immutable-result GET cache. One consumer abort never cancels another consumer. */
export function createSharedLoader<T>(load:(key:string,signal:AbortSignal)=>Promise<T>,ttlMs=30000,maxEntries=24){
 const entries=new Map<string,Entry<T>>();
 return (key:string,signal?:AbortSignal):Promise<T>=>{
  if(signal?.aborted)return Promise.reject(new DOMException('Aborted','AbortError'));
  let entry=entries.get(key);if(entry?.settled&&entry.expires<=Date.now()){entries.delete(key);entry=undefined;}
  if(entry?.settled)return Promise.resolve(entry.value as T);
  if(!entry){const controller=new AbortController();entry={controller,promise:Promise.resolve(null as T),subscribers:0,settled:false,expires:0};const current=entry;entries.set(key,current);
   current.promise=Promise.resolve().then(()=>load(key,controller.signal)).then(value=>{if(!controller.signal.aborted){current.value=value;current.settled=true;current.expires=Date.now()+ttlMs;for(const [k,e] of entries){if(entries.size<=maxEntries)break;if(e.settled&&k!==key)entries.delete(k);}}return value;},error=>{if(entries.get(key)===current)entries.delete(key);throw error;});
  }
  const current=entry;current.subscribers++;
  return new Promise<T>((resolve,reject)=>{let finished=false;
   const finish=()=>{if(finished)return false;finished=true;signal?.removeEventListener('abort',abort);current.subscribers--;if(!current.subscribers&&!current.settled){current.controller.abort();if(entries.get(key)===current)entries.delete(key);}return true;};
   const abort=()=>{if(finish())reject(new DOMException('Aborted','AbortError'));};signal?.addEventListener('abort',abort,{once:true});
   current.promise.then(value=>{if(finish())resolve(value);},error=>{if(finish())reject(error);});
  });
 };
}
