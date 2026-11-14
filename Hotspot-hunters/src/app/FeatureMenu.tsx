import {useEffect,useRef,useState} from 'react';
import {ChevronDown} from 'lucide-react';
import type {Scene} from './types';
const items:{scene:Scene;label:string;number:string}[]=[{scene:'analytics',label:'Analytics',number:'05'},{scene:'data',label:'Data Explorer',number:'06'},{scene:'research',label:'Research Workspace',number:'07'},{scene:'lab',label:'Harmonization Lab',number:'08'}];
export default function FeatureMenu({scene,navigate}:{scene:Scene;navigate:(s:Scene)=>void}){
 const [open,setOpen]=useState(false);const host=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null);
 useEffect(()=>{if(!open)return;const outside=(event:PointerEvent)=>{if(!host.current?.contains(event.target as Node))setOpen(false);};const key=(event:KeyboardEvent)=>{if(event.key==='Escape'){setOpen(false);trigger.current?.focus();}};document.addEventListener('pointerdown',outside);document.addEventListener('keydown',key);return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',key);};},[open]);
 return <div className="feature-menu" ref={host}><button ref={trigger} aria-expanded={open} aria-controls="research-navigation" onClick={()=>setOpen(v=>!v)} className={items.some(i=>i.scene===scene)?'active':''}>RESEARCH <ChevronDown size={12}/></button>{open&&<div id="research-navigation" role="group" className="feature-menu-panel" aria-label="Research navigation">{items.map(i=><button key={i.scene} aria-current={scene===i.scene?'page':undefined} onClick={()=>{navigate(i.scene);setOpen(false);}}><span>{i.number}</span>{i.label}</button>)}</div>}</div>;
}
