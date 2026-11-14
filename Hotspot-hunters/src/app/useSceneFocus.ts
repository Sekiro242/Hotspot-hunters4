import {useEffect,useRef} from 'react';
import type {Scene} from './types';
export function useSceneFocus(scene:Scene,hasDialog:boolean){
 const previous=useRef(scene);
 useEffect(()=>{if(previous.current===scene)return;previous.current=scene;if(hasDialog)return;
  let done=false;const root=document.querySelector('.app');if(!root)return;
  const focus=()=>{const heading=root.querySelector<HTMLElement>('.workspace-page h1,.hero h1,.explore-title h2,.scene-sheet h2,.science-sheet h2,.compare-heading h2');if(!heading)return;heading.tabIndex=-1;heading.focus({preventScroll:true});done=true;};
  const observer=new MutationObserver(()=>{if(!done)focus();});observer.observe(root,{childList:true,subtree:true});focus();const timer=setTimeout(()=>observer.disconnect(),2000);
  return()=>{observer.disconnect();clearTimeout(timer);};
 },[scene,hasDialog]);
}
