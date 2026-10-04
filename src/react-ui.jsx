import React, {useEffect,useLayoutEffect,useRef,useState,useSyncExternalStore} from 'react';
import {createPortal} from 'react-dom';
import {achievements} from './achievement-store.js';
import {PuzzleArt} from './data.js';

export function useDialogs(initial=null) {
  const [stack,setStack]=useState(initial?[{id:initial,focus:null}]:[]);
  const current=useRef(stack),nodes=useRef(new Map()),restore=useRef(null);
  function update(next){current.current=next;setStack(next)}
  function open(id,{nested=false,onClose}={}) {
    const entry={id,focus:document.activeElement,onClose};
    update(nested?[...current.current,entry]:[entry]);
  }
  function close(all=false) {
    const entries=current.current;if(!entries.length)return;
    const removed=all?entries:entries.slice(-1);
    restore.current=all?entries[0].focus:entries.at(-1).focus;
    update(all?[]:entries.slice(0,-1));
    removed.forEach(entry=>entry.onClose?.());
  }
  useLayoutEffect(()=>{
    const node=nodes.current.get(stack.at(-1)?.id),focus=restore.current;
    restore.current=null;
    if(focus?.isConnected && focus.getClientRects().length && (!node || node.contains(focus)))focus.focus({preventScroll:true});
    else (node?.querySelector('#confirmCancel') || node?.querySelector('button:not(:disabled)'))?.focus({preventScroll:true});
  },[stack]);
  return {active:stack.at(-1)?.id || null,open,close,ref:id=>node=>{if(node)nodes.current.set(id,node);else nodes.current.delete(id)}};
}

export function Dialog({dialogs,id,className='',children,...props}) {
  const active=dialogs.active===id;
  return <div {...props} id={id} ref={dialogs.ref(id)} className={'overlay '+className+(active?' open':'')} inert={!active}
    onClick={event=>{if(event.target===event.currentTarget)dialogs.close()}}
    onKeyDown={event=>{
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();dialogs.close()}
      if(event.key!=='Tab')return;
      const items=[...event.currentTarget.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]')].filter(node=>node.tabIndex>=0 && node.getClientRects().length);
      const first=items[0],last=items.at(-1);
      if(first && event.shiftKey && document.activeElement===first){event.preventDefault();last.focus()}
      else if(last && !event.shiftKey && document.activeElement===last){event.preventDefault();first.focus()}
    }}>{children}</div>;
}

export function useFeedback(dialogs) {
  const [confirmation,setConfirmation]=useState(null),[notice,setNotice]=useState(null);
  const pending=useRef(null),timer=useRef(null),sticky=useRef(null);
  function cancel(){const resolve=pending.current;pending.current=null;resolve?.(false)}
  function finish(answer){const resolve=pending.current;pending.current=null;dialogs.close();resolve?.(answer)}
  function confirm(spec){
    if(pending.current)return Promise.resolve(false);
    setConfirmation({accept:'Continue',danger:false,...spec});
    return new Promise(resolve=>{pending.current=resolve;dialogs.open('confirmationOverlay',{nested:true,onClose:cancel})});
  }
  function notify(message,{tone='info',title='',duration=6000}={}) {
    const next={message,tone,title};if(!duration){sticky.current=next;if(timer.current)return}
    clearTimeout(timer.current);setNotice(next);
    if(duration)timer.current=setTimeout(()=>{timer.current=null;setNotice(sticky.current)},duration);
  }
  useEffect(()=>()=>{cancel();clearTimeout(timer.current)},[]);
  return {confirmation,notice,confirm,notify,finish};
}

export function useAppearance({dark=false,zen=false,color=PuzzleArt.TILE_LIGHTS.B}={}) {
  const {appearance}=useSyncExternalStore(achievements.subscribe,achievements.getSnapshot);
  useLayoutEffect(()=>{
    document.body.classList.toggle('light-mode',!dark);
    document.body.classList.toggle('zen-mode',zen);
    document.body.style.setProperty('--light-color',color);
    document.body.dataset.background=appearance.background;
    document.body.dataset.finish=appearance.finish;
    document.querySelector('meta[name=theme-color]')?.setAttribute('content',dark?'#0c252e':'#d9e9dc');
  },[dark,zen,color,appearance.background,appearance.finish]);
  useEffect(()=>{
    const frame=requestAnimationFrame(()=>{document.documentElement.dataset.ready='true';document.getElementById('root').inert=false});
    return ()=>{cancelAnimationFrame(frame);delete document.documentElement.dataset.ready};
  },[]);
}

export function useStrokes() {
  const [strokes,setStrokes]=useState([]),serial=useRef(0);
  function add(shell,from,to,type){
    if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const bounds=shell.getBoundingClientRect(),x1=from.left+from.width/2,y1=from.top+from.height/2,x2=to.left+to.width/2,y2=to.top+to.height/2;
    const transform=`translate(-50%,-50%) rotate(${Math.atan2(y2-y1,x2-x1)}rad)`,id=++serial.current;
    setStrokes(items=>[...items.slice(-11),{id,type,local:true,screen:true,transform,x:(x1+x2)/2,y:(y1+y2)/2,left:(x1+x2)/2-bounds.left,top:(y1+y2)/2-bounds.top,width:Math.max(36,Math.hypot(x2-x1,y2-y1))}]);
  }
  function remove(id,kind){setStrokes(items=>items.map(item=>item.id===id?{...item,[kind]:false}:item).filter(item=>item.local || item.screen))}
  return {strokes,add,remove,clear:()=>setStrokes([])};
}
export function ColorStrokes({ink}) {
  function stroke(item,screen){return <div key={item.id} className={'color-stroke'+(screen?' screen-stroke':'')} data-type={item.type} aria-hidden="true"
    style={{left:screen?item.x:item.left,top:screen?item.y:item.top,width:screen?'40vw':item.width,transform:item.transform,'--stroke-color':PuzzleArt.TILE_LIGHTS[item.type]}}>
    <span onAnimationEnd={()=>ink.remove(item.id,screen?'screen':'local')} /></div>}
  return <>{ink.strokes.filter(item=>item.local).map(item=>stroke(item,false))}{createPortal(ink.strokes.filter(item=>item.screen).map(item=>stroke(item,true)),document.body)}</>;
}

export function Particles({burst}) {
  const canvas=useRef(null);
  useEffect(()=>{
    const node=canvas.current,context=node.getContext('2d');
    node.width=innerWidth*devicePixelRatio;node.height=innerHeight*devicePixelRatio;
    context.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);
    if(!burst || matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const dots=burst.points.flatMap(({x,y,color,count=7})=>Array.from({length:count},(_,i)=>{const angle=i/count*Math.PI*2;return {x,y,color,vx:Math.cos(angle)*2.8,vy:Math.sin(angle)*2.8-1,r:1.7,life:1}}));
    let frame;
    function draw(){
      context.clearRect(0,0,innerWidth,innerHeight);
      for(const p of dots){p.x+=p.vx;p.y+=p.vy;p.vy+=.045;p.vx*=.989;p.life-=.024;if(p.life<=0)continue;context.globalAlpha=p.life;context.beginPath();context.arc(p.x,p.y,p.r,0,Math.PI*2);context.fillStyle=p.color || '#d8f4dc';context.fill()}
      if(dots.some(p=>p.life>0))frame=requestAnimationFrame(draw);
    }
    frame=requestAnimationFrame(draw);
    return ()=>{cancelAnimationFrame(frame);context.clearRect(0,0,innerWidth,innerHeight)};
  },[burst]);
  return <canvas id="fx" ref={canvas} aria-hidden="true" style={{width:'100vw',height:'100vh'}} />;
}
