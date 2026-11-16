// Requires a running dev/preview server and Chrome; no npm browser dependency.
// Override POLISH_URL or CHROME_BIN to test another local build/browser.
import {spawn} from 'node:child_process';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const url = process.env.POLISH_URL || 'http://127.0.0.1:5180/';
const profile=await mkdtemp(join(tmpdir(),'midori-board-'));
const chrome=spawn(process.env.CHROME_BIN || 'google-chrome',['--headless=new','--no-sandbox','--disable-gpu','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','pipe']});
let socket;
try {
const ws=await new Promise((resolve,reject)=>{let output='';const timer=setTimeout(()=>reject(new Error('Chrome startup timeout')),10000);chrome.stderr.on('data',b=>{output+=b;const match=output.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(match){clearTimeout(timer);resolve(match[1]);}});chrome.on('error',reject);});
socket=new WebSocket(ws);await new Promise(r=>socket.addEventListener('open',r,{once:true}));
let serial=0;const pending=new Map(),errors=[];
socket.addEventListener('message',({data})=>{const msg=JSON.parse(data);if(msg.id){const p=pending.get(msg.id);if(p){pending.delete(msg.id);msg.error?p.reject(new Error(JSON.stringify(msg.error))):p.resolve(msg.result);}}if(msg.method==='Runtime.exceptionThrown')errors.push(msg.params.exceptionDetails.text+': '+msg.params.exceptionDetails.exception?.description);if(msg.method==='Runtime.consoleAPICalled'&&msg.params.type==='error')errors.push(JSON.stringify(msg.params.args));});
const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params,sessionId}));});
const {targetId}=await send('Target.createTarget',{url:'about:blank'});
const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
const cdp=(method,params={})=>send(method,params,sessionId);
await cdp('Runtime.enable');await cdp('Page.enable');await cdp('Page.bringToFront');
const js=async expression=>{const r=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=async expression=>{for(let i=0;i<200;i++){if(await js(expression))return;await new Promise(r=>setTimeout(r,30));}throw new Error('Timed out: '+expression+' '+JSON.stringify({errors,body:await js('document.documentElement.outerHTML.slice(0,2200)'),url:await js('location.href')}));};
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const mouse = (type, x, y) => cdp('Input.dispatchMouseEvent', {type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1});
const point = selector => js(`(() => { const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
async function tap(selector, touch) {
  const {x,y} = await point(selector);
  if (touch) {
    await cdp('Input.dispatchTouchEvent', {type:'touchStart', touchPoints:[{x,y,id:0}]});
    await cdp('Input.dispatchTouchEvent', {type:'touchEnd', touchPoints:[]});
  } else {
    await mouse('mousePressed',x,y); await mouse('mouseReleased',x,y);
  }
  await pause(30);
}
const first = '.board .tile';
for (const mode of [
  {name:'desktop',width:1280,height:900,touch:false,motion:'no-preference'},
  {name:'mobile',width:390,height:844,touch:true,motion:'no-preference'},
  {name:'reduced motion',width:390,height:844,touch:true,motion:'reduce'},
]) {
  await cdp('Emulation.setDeviceMetricsOverride',{width:mode.width,height:mode.height,deviceScaleFactor:1,mobile:mode.touch});
  await cdp('Emulation.setTouchEmulationEnabled',{enabled:mode.touch});
  await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:mode.motion}]});
  await cdp('Page.navigate',{url});
  await wait(`!!document.querySelector('.board .tile')`);
  await js(`document.querySelector('.platform').scrollIntoView({block:'center',behavior:'instant'})`);
  await tap(first,mode.touch);
  await wait(`document.querySelector('.board .tile').getAttribute('aria-pressed')==='true'`);
  // Pointer play must retain the border fix.
  assert.equal(await js(`getComputedStyle(document.querySelector('.board .tile')).outlineStyle`),'none');
  await tap('.board .cell:nth-child(2) .tile',mode.touch);
  await wait(`document.querySelector('.board .tile').classList.contains('red') && document.querySelector('.board').getAttribute('aria-busy')==='false'`);
  // Navigation away and back must preserve the same immediate tap behavior.
  await js(`document.querySelector('.dots button:nth-child(2)').click()`); await pause(400);
  await js(`document.querySelector('.dots button').click()`); await pause(400);
  await tap(first,mode.touch);
  await wait(`document.querySelector('.board .tile').getAttribute('aria-pressed')==='true'`);
  await tap(first,mode.touch);
  // Drag remains usable after tap selection.
  const a=await point(first), b=await point('.board .cell:nth-child(2) .tile');
  if (mode.touch) {
    await cdp('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...a,id:0}]});
    await cdp('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...b,id:0}]});
    await cdp('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  } else {
    await mouse('mousePressed',a.x,a.y); await mouse('mouseMoved',b.x,b.y); await mouse('mouseReleased',b.x,b.y);
  }
  await wait(`document.querySelector('.board .tile').classList.contains('red') && document.querySelector('.board').getAttribute('aria-busy')==='false'`);
  // Keyboard selection remains independent of pointer selection.
  await js(`document.querySelector('.dots button:nth-child(2)').click()`); await pause(400);
  await js(`document.querySelector('.dots button').click()`); await pause(400);
  await js(`document.querySelector('.board .tile').focus()`);
  await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'});
  await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  await wait(`document.querySelector('.board .tile').getAttribute('aria-pressed')==='true'`);
  if (mode.touch) {
    await cdp('Emulation.setDeviceMetricsOverride',{width:mode.width,height:340,deviceScaleFactor:1,mobile:true});
    await pause(100);
  }
  // Every purchase entry point shares the same scroll lock and cleanup.
  for (const n of [0,1,2,3]) {
    await js(`window.scrollTo({top:800,behavior:'instant'}); [...document.querySelectorAll('button')].filter(n=>n.textContent==='Unlock Worlds')[${n}].click()`);
    await wait(`document.querySelector('.sheet').open`); await pause(450);
    assert.equal(await js(`document.body.style.position`),'fixed');
    assert.equal(await js(`getComputedStyle(document.querySelector('.sheet')).overscrollBehavior`),'none');
    const p=await point('.sheet');
    await js(`document.querySelector('.sheet').scrollTop=10000`);
    await cdp('Input.dispatchMouseEvent',{type:'mouseWheel',...p,deltaY:600,deltaX:0}); await pause(100);
    assert.equal(await js(`document.body.getBoundingClientRect().top`),-800);
    await js(`document.querySelector('.sheet').scrollTop=0`);
    await cdp('Input.dispatchMouseEvent',{type:'mouseWheel',...p,deltaY:-600,deltaX:0}); await pause(100);
    if (n%2) await js(`document.querySelector('.sheet-head button').click()`);
    else {
      await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
      await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
    }
    await wait(`!document.querySelector('.sheet').open && document.body.style.position===''`);
    assert.equal(await js(`window.scrollY`),800);
  }
  console.log(`PASS ${mode.name}: fresh tap, swap, navigation, drag, keyboard, popup scroll and cleanup`);
}
for (const width of [360,390,768,1080,1280,1440]) {
  await cdp('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<500});
  await pause(100);
  for (const theme of ['light','dark']) {
    await js(`document.documentElement.dataset.theme=${JSON.stringify(theme)}`);
    const layout=await js(`(() => {
      const worlds=document.querySelector('#worlds .phones'), screens=document.querySelector('#screens .phones');
      worlds.scrollLeft=0; screens.scrollLeft=0;
      const card=n=>n.querySelector('.phone').getBoundingClientRect();
      return {sameWidth:card(worlds).width===card(screens).width,sameGap:getComputedStyle(worlds).gap===getComputedStyle(screens).gap,
        peek:[worlds,screens].every(n=>n.children[1].getBoundingClientRect().left<n.getBoundingClientRect().right),
        fits:document.documentElement.scrollWidth<=innerWidth,
        line:getComputedStyle(document.querySelector('.statement-ending')).display};
    })()`);
    assert.ok(layout.sameWidth && layout.sameGap && layout.fits,JSON.stringify({width,theme,layout}));
    if(width<500) assert.ok(layout.peek,'next screenshot must peek: '+JSON.stringify({width,theme,layout}));
    if(width>=720) assert.equal(layout.line,'block');
  }
}
console.log('PASS gallery layout at six widths in both themes; desktop statement break');
assert.deepEqual(errors,[],'browser errors');
await send('Browser.close');
} finally {
  socket?.close(); chrome.kill('SIGTERM');
  await new Promise(resolve=>setTimeout(resolve,200));
  await rm(profile,{recursive:true,force:true});
}
