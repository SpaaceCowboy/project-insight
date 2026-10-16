import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {CAMPAIGN_LEVELS,CAMPAIGN_SOLUTIONS,PuzzleRules,PuzzleSolver,PuzzleArt} from './data.js';
import {useDialogs,useFeedback,useAppearance,useStrokes} from './react-ui.jsx';
import {readPreference} from './game-state.js';

const KEY='insight-editor-drafts-v1',PREVIEW_KEY='insight-editor-preview-v1';
const copy=value=>JSON.parse(JSON.stringify(value));
function newDraft(spec={name:'Untitled puzzle',start:['...','...','...'],target:['...','...','...']}){return {...PuzzleRules.validate(spec,false),id:crypto.randomUUID?.() || Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)}}
function puzzleKey(level){const spec=PuzzleRules.validate(level,false);delete spec.name;delete spec.revision;return JSON.stringify(spec)}
function getDraft(library){return library.drafts.find(item=>item.id===library.active) || library.drafts[0]}
function loadLibrary(){
  let raw=null,warning='';
  try{
    raw=localStorage.getItem(KEY);const data=JSON.parse(raw);
    if(data?.version===1 && Array.isArray(data.drafts) && data.drafts.length<=100){
      const drafts=[];
      for(const item of data.drafts)try{
        const spec=PuzzleRules.validate(item,false);
        if(typeof item.id!=='string' || !/^[\w-]{1,80}$/.test(item.id) || drafts.some(d=>d.id===item.id))throw new Error();
        const draft={...spec,id:item.id};if(item.proof)try{draft.proof=PuzzleSolver.verify(draft,item.proof)}catch{}
        drafts.push(draft);
      }catch{warning='Some damaged drafts could not be loaded. Your other puzzles are available.'}
      if(drafts.length)return {library:{version:1,active:drafts.some(d=>d.id===data.active)?data.active:drafts[0].id,drafts},warning,recovery:warning?raw:null};
    }else if(data)warning='Saved drafts could not be read. Import a backup to recover them.';
  }catch{warning='Saved drafts are unavailable. You can still create and export puzzles.'}
  const first=newDraft({name:'My first puzzle',start:['...','...','...'],target:['...','...','...']});
  return {library:{version:1,active:first.id,drafts:[first]},warning,recovery:raw};
}
function readyMessage(draft){
  if(draft.proof)return 'Verified · solvable in '+draft.proof.par+(draft.proof.par===1?' move':' moves');
  try{PuzzleRules.validate(draft);return 'Validate to check solvability.'}catch(error){return error.message}
}

export default function useEditor() {
  const [initial]=useState(loadLibrary),[library,setLibrary]=useState(initial.library),live=useRef(library),draft=getDraft(library);
  const [side,setSide]=useState('start'),[panel,setPanel]=useState('paint'),[edits,setEdits]=useState({undo:[],redo:[]}),history=useRef(edits);
  const [studioLast,setStudioLast]=useState(null);
  const [status,setStatus]=useState(null),[saved,setSaved]=useState(true),[checking,setChecking]=useState(false);
  const [holding,setHolding]=useState(null),[drag,setDrag]=useState(null),[drop,setDrop]=useState(null),[discarding,setDiscarding]=useState(false);
  const [color,setColor]=useState(PuzzleArt.TILE_LIGHTS.B),[importText,setImportText]=useState(''),[exportScope,setExportScope]=useState('one'),[seed,setSeed]=useState('0'),[download,setDownload]=useState(null);
  const dialogs=useDialogs(),feedback=useFeedback(dialogs),ink=useStrokes();
  const worker=useRef(null),workerURL=useRef(null),gesture=useRef(null),recovery=useRef(initial.recovery),disposed=useRef(false),pendingFocus=useRef(null);
  const boardRef=useRef(null),shellRef=useRef(null),removeRef=useRef(null),fileRef=useRef(null),downloadRef=useRef(null),cells=useRef(new Map()),palette=useRef(new Map());
  useAppearance({dark:readPreference('insight-theme-v1')!=='light',color});
  function publish(next){live.current=next;setLibrary(next)}
  function record(next){history.current=next;setEdits(next)}
  function save(value=live.current){
    try{
      if(recovery.current){localStorage.setItem(KEY+'-recovery',recovery.current);recovery.current=null}
      localStorage.setItem(KEY,JSON.stringify(value));setSaved(true);return true;
    }catch{setSaved(false);feedback.notify('Browser storage is unavailable. Export your puzzles to keep them.',{title:'Your draft is temporary',tone:'warning',duration:0});return false}
  }
  function message(text,tone='idle'){setStatus({text,tone});if(tone==='error')feedback.notify(text,{title:'Puzzle needs attention',tone:'error',duration:8000})}
  function stopWorker(){worker.current?.terminate();worker.current=null;if(workerURL.current)URL.revokeObjectURL(workerURL.current);workerURL.current=null;if(!disposed.current)setChecking(false)}
  function cancelPlacement(){
    const previous=gesture.current;gesture.current=null;
    if(previous?.source.hasPointerCapture(previous.pointerId))previous.source.releasePointerCapture(previous.pointerId);
    setHolding(null);setDrag(null);setDrop(null);setDiscarding(false);
  }
  function focusCell(position){cells.current.get(position.join(':'))?.focus({preventScroll:true})}
  useLayoutEffect(()=>{if(pendingFocus.current){focusCell(pendingFocus.current);pendingFocus.current=null}});
  useLayoutEffect(()=>{save(library)},[library]);
  useEffect(()=>{
    disposed.current=false;
    if(initial.warning)message(initial.warning,'error');
    try{const warning=sessionStorage.getItem('insight-editor-message-v1');if(warning){sessionStorage.removeItem('insight-editor-message-v1');message(warning,'error')}}catch{}
    return ()=>{disposed.current=true;worker.current?.terminate();if(workerURL.current)URL.revokeObjectURL(workerURL.current)};
  },[]);
  useEffect(()=>{
    if(!download)return;downloadRef.current.click();const timer=setTimeout(()=>URL.revokeObjectURL(download.url),1000);
    return ()=>{clearTimeout(timer);URL.revokeObjectURL(download.url)};
  },[download]);
  function replaceDraft(next){const current=live.current;publish({...current,drafts:current.drafts.map(item=>item.id===next.id?next:item)})}
  function change(update){
    cancelPlacement();const before=copy(getDraft(live.current)),next=copy(before);update(next);
    if(JSON.stringify(before)===JSON.stringify(next))return next;
    if(puzzleKey(before)!==puzzleKey(next)){stopWorker();delete next.proof}
    else if(next.proof)next.proof.name=next.name.trim() || 'Untitled puzzle';
    record({undo:[...history.current.undo,before].slice(-100),redo:[]});replaceDraft(next);setStatus(null);return next;
  }
  function undoEdit(reverse=false){
    cancelPlacement();stopWorker();ink.clear();const from=reverse?history.current.redo:history.current.undo,to=reverse?history.current.undo:history.current.redo;
    if(!from.length)return;const next=from.at(-1),previous=copy(getDraft(live.current));
    record(reverse?{undo:[...to,previous],redo:from.slice(0,-1)}:{undo:from.slice(0,-1),redo:[...to,previous]});replaceDraft(next);setStatus(null);
  }
  function switchDraft(id){cancelPlacement();stopWorker();ink.clear();publish({...live.current,active:id});record({undo:[],redo:[]});setSide('start');setStatus(null)}
  function addDraft(next){if(live.current.drafts.length>=100){message('100 puzzle slots are full. Export or delete one first.','error');return}publish({...live.current,drafts:[...live.current.drafts,next]});switchDraft(next.id)}
  function setCell(next,which,r,c,type){const chars=[...next[which][r]];chars[c]=type;next[which][r]=chars.join('')}
  function placeTile(item,r,c){
    const to=cells.current.get(r+':'+c).getBoundingClientRect(),from=item.from?cells.current.get(item.from.join(':')).getBoundingClientRect():to,other=side==='start'?'target':'start';
    change(next=>{
      if(item.from){const [sr,sc]=item.from;if(sr===r && sc===c)return;
        if(next[side][r][c]==='.')for(const which of [side,other]){setCell(next,which,r,c,next[which][sr][sc]);setCell(next,which,sr,sc,'.')}
        else{const destination=next[side][r][c];setCell(next,side,r,c,item.type);setCell(next,side,sr,sc,destination)}
      }else{setCell(next,side,r,c,item.type);if(next[other][r][c]==='.')setCell(next,other,r,c,item.type)}
    });
    setColor(PuzzleArt.TILE_LIGHTS[item.type]);pendingFocus.current=[r,c];
    if(!item.from || item.from[0]!==r || item.from[1]!==c)ink.add(shellRef.current,from,to,item.type);
  }
  function removeTile(position){change(next=>{for(const which of ['start','target'])setCell(next,which,...position,'.')});pendingFocus.current=position}
  function pickUp(item,source){cancelPlacement();setHolding(item);message('Picked up '+PuzzleArt.META[item.type].name+'. Enter places; Escape cancels.')}
  function activate(position){if(holding)placeTile(holding,...position);else if(draft[side][position[0]][position[1]]!=='.')pickUp({type:draft[side][position[0]][position[1]],from:position},cells.current.get(position.join(':')))}
  function beginDrag(event,item){
    if(event.button!==0 || gesture.current || dialogs.active)return;event.preventDefault();cancelPlacement();event.currentTarget.focus({preventScroll:true});
    gesture.current={...item,source:event.currentTarget,pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,x:event.clientX,y:event.clientY,moved:false};
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function outside(x,y){const rect=shellRef.current.getBoundingClientRect();return x<rect.left || x>rect.right || y<rect.top || y>rect.bottom}
  function dropAt(x,y){
    for(const [key,node] of cells.current){const rect=node.getBoundingClientRect();if(x>=rect.left && x<=rect.right && y>=rect.top && y<=rect.bottom)return key.split(':').map(Number)}
    const rect=removeRef.current.getBoundingClientRect();return x>=rect.left && x<=rect.right && y>=rect.top && y<=rect.bottom?'remove':null;
  }
  function pointerMove(event){
    const item=gesture.current;if(!item || event.pointerId!==item.pointerId)return;event.preventDefault();
    if(!item.moved && Math.hypot(event.clientX-item.startX,event.clientY-item.startY)<6)return;
    item.moved=true;item.x=event.clientX;item.y=event.clientY;setDrag({...item,size:Math.max(44,Math.min(100,boardRef.current.firstElementChild.getBoundingClientRect().width))});
    const destination=dropAt(item.x,item.y);setDrop(Array.isArray(destination)?destination:null);setDiscarding(!!item.from && (destination==='remove' || outside(item.x,item.y)));
  }
  function pointerUp(event){
    const item=gesture.current;if(!item || event.pointerId!==item.pointerId)return;
    const destination=dropAt(event.clientX,event.clientY);cancelPlacement();if(!item.moved)return;
    if(Array.isArray(destination))placeTile(item,...destination);else if(item.from && (destination==='remove' || outside(event.clientX,event.clientY)))removeTile(item.from);
  }
  function showPanel(name){cancelPlacement();setPanel(name)}
  function changeSide(which){cancelPlacement();setSide(which);setStatus(null)}
  async function deleteDraft(){
    cancelPlacement();const current=getDraft(live.current);
    if(!await feedback.confirm({title:'Delete this puzzle?',message:'“'+(current.name || 'Untitled puzzle')+'” will be removed from your library. Export it first if you want a backup.',accept:'Delete puzzle',danger:true}) || disposed.current || current.id!==live.current.active)return;
    let drafts=live.current.drafts.filter(item=>item.id!==current.id);if(!drafts.length)drafts=[newDraft()];publish({...live.current,drafts});switchDraft(drafts[0].id);feedback.notify('The puzzle was removed from your library.',{title:'Puzzle deleted',tone:'success'});
  }
  async function resize(width,height){
    cancelPlacement();const current=getDraft(live.current);
    if((width<current.start[0].length || height<current.start.length) && !await feedback.confirm({title:'Crop both boards?',message:'Cells outside '+width+' × '+height+' will be removed from Start and Target. Undo can restore them.',accept:'Crop boards'}))return;
    if(disposed.current || current.id!==live.current.active)return;
    change(next=>{for(const which of ['start','target'])next[which]=Array.from({length:height},(_,r)=>Array.from({length:width},(_,c)=>next[which][r]?.[c] || '.').join(''))});
  }
  async function clear(){
    cancelPlacement();const current=getDraft(live.current);
    if(await feedback.confirm({title:'Clear both boards?',message:'Every tile in Start and Target will become an empty slot. Undo can restore your tiles.',accept:'Clear boards'}) && !disposed.current && current.id===live.current.active)change(next=>{next.start=next.start.map(row=>'.'.repeat(row.length));next.target=next.start.slice()});
  }
  function validate(){
    cancelPlacement();if(worker.current){stopWorker();message('Validation cancelled. Your draft is saved.');return}
    const current=getDraft(live.current);let spec;
    try{spec=PuzzleRules.validate(current);if(spec.start.join('|')===spec.target.join('|'))throw new Error('Start and Target are already identical. Change one board.')}catch(error){message(error.message,'error');return}
    const known=CAMPAIGN_LEVELS.findIndex(level=>puzzleKey(level)===puzzleKey(spec));
    if(known>=0){replaceDraft({...current,proof:PuzzleSolver.verify(current,{path:CAMPAIGN_SOLUTIONS[known]})});setStatus(null);return}
    const pending={...current};delete pending.proof;replaceDraft(pending);
    const source=`const PuzzleRules=(${PuzzleRules.create.toString()})();const PuzzleSolver=(${PuzzleSolver.create.toString()})(PuzzleRules);onmessage=event=>{try{const result=PuzzleSolver.solve(event.data,{maxStates:350000,timeout:8000,progress:count=>postMessage({count})});postMessage({result:PuzzleSolver.verify(event.data,result)})}catch(error){postMessage({error:error.message})}};`;
    try{
      workerURL.current=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));const job=new Worker(workerURL.current);worker.current=job;setChecking(true);message('Checking solvability…');
      job.onmessage=event=>{
        if(worker.current!==job)return;if(event.data.count){message('Checking… '+event.data.count.toLocaleString()+' positions');return}stopWorker();
        if(event.data.error){message(event.data.error,'error');return}
        try{const next=getDraft(live.current);if(next.id!==current.id || puzzleKey(next)!==puzzleKey(spec))return;replaceDraft({...next,proof:PuzzleSolver.verify(next,event.data.result)});setStatus(null)}catch(error){message(error.message,'error')}
      };
      job.onerror=()=>{if(worker.current===job){stopWorker();message('Validation could not start in this browser. Your draft can still be exported.','error')}};job.postMessage(spec);
    }catch{stopWorker();message('Validation could not start in this browser. Your draft can still be exported.','error')}
  }
  function shuffle(){
    let board=PuzzleRules.parse(draft.target),previous=null,lastDifferent=null;
    for(let i=0;i<24;i++){
      const moves=board.flatMap((row,r)=>row.flatMap((type,c)=>type==='.'?[]:PuzzleRules.legalMoves(board,r,c).filter(([rr,cc])=>board[rr][cc]!==type && (!previous || r!==previous[0] || c!==previous[1] || rr!==previous[2] || cc!==previous[3])).map(to=>[[r,c],to])));
      if(!moves.length)break;const [a,b]=moves[Math.floor(Math.random()*moves.length)];previous=[...b,...a];board=PuzzleRules.swapCells(board,a,b);if(PuzzleRules.key(board)!==draft.target.join('|'))lastDifferent=board;
    }
    if(PuzzleRules.key(board)===draft.target.join('|') && lastDifferent)board=lastDifferent;
    if(PuzzleRules.key(board)===draft.target.join('|')){message('No different Start was generated. Add movable tiles to Target and try again.','error');return}
    change(next=>{next.start=board.map(row=>row.join(''))});setSide('start');validate();
  }
  // Dev server only: the newest studio level, which is the only one "Remove" may delete.
  async function refreshStudio(){
    if(!import.meta.env.DEV)return;
    try{const response=await fetch('/__studio/levels');setStudioLast((await response.json()).levels?.at(-1) || null)}catch{setStudioLast(null)}
  }
  useEffect(()=>{refreshStudio()},[]);
  async function addToGame(){
    try{
      const current=getDraft(live.current);if(!current.proof?.par)return;
      const response=await fetch('/__studio/add-level',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:current.name,start:current.start,target:current.target})});
      const result=await response.json().catch(()=>({error:'Unexpected response ('+response.status+').'}));
      if(!response.ok)throw new Error(result.error || 'Request failed ('+response.status+').');
      const android=result.android==='exported'?'Android assets updated.':'Android export '+result.android;
      feedback.notify('Level '+result.level+' · World '+result.world+' · par '+result.par+'. '+android,{title:'Added to game',tone:result.android==='exported'?'success':'warning',duration:result.android==='exported'?6000:0});
      refreshStudio();
    }catch(error){message('Add to game failed: '+error.message,'error')}
  }
  async function removeLastFromGame(){
    const last=studioLast;if(!last)return;
    if(!await feedback.confirm({title:'Remove level '+last.level+' from the game?',message:'“'+last.name+'” is deleted from the studio levels and the Android assets. Your drafts are not affected.',accept:'Remove level'}))return;
    try{
      const response=await fetch('/__studio/remove-last',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({level:last.level})});
      const result=await response.json().catch(()=>({error:'Unexpected response ('+response.status+').'}));
      if(!response.ok)throw new Error(result.error || 'Request failed ('+response.status+').');
      const android=result.android==='exported'?'Android assets updated.':'Android export '+result.android;
      feedback.notify('“'+result.removed+'” (level '+result.level+') removed. '+android,{title:'Removed from game',tone:result.android==='exported'?'success':'warning',duration:result.android==='exported'?6000:0});
    }catch(error){message('Remove failed: '+error.message,'error')}
    refreshStudio();
  }
  function playtest(){try{const current=getDraft(live.current);if(!current.proof)return;save();const spec=PuzzleSolver.verify(current,current.proof);sessionStorage.setItem(PREVIEW_KEY,JSON.stringify({...spec,id:current.id}));location.href='Puzzle.html?editor=1'}catch(error){message('Playtest could not open: '+error.message,'error')}}
  function importJSON(text){
    try{
      if(text.length>262144)throw new Error('Puzzle files must be smaller than 256 KB.');const data=JSON.parse(text);
      if(data.version!==undefined && data.version!==1)throw new Error('Unsupported puzzle file version.');const entries=data.puzzles || [data];
      if(!Array.isArray(entries) || !entries.length || entries.length>100 || live.current.drafts.length+entries.length>100)throw new Error('Import up to 100 puzzles within the library limit.');
      const imported=entries.map(item=>newDraft(PuzzleRules.validate(item,false)));publish({...live.current,drafts:[...live.current.drafts,...imported]});switchDraft(imported[0].id);setImportText('');message(imported.length+' puzzle'+(imported.length===1?'':'s')+' imported. Validate before playtesting.');feedback.notify(imported.length+' puzzle'+(imported.length===1?'':'s')+' added to your library.',{title:'Import complete',tone:'success'});
    }catch(error){message('Import failed: '+error.message,'error')}
  }
  async function importFile(event){const file=event.currentTarget.files[0];event.currentTarget.value='';if(!file)return;if(file.size>262144){message('Puzzle files must be smaller than 256 KB.','error');return}try{importJSON(await file.text())}catch{message('This file could not be read.','error')}}
  function exportFile(){
    cancelPlacement();save();const entries=exportScope==='all'?live.current.drafts:[getDraft(live.current)],payload={format:'insight-puzzles',version:1,puzzles:entries.map(item=>PuzzleRules.validate(item,false))};
    setDownload({url:URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)+'\n'],{type:'application/json'})),name:entries.length===1?(draft.name.replace(/[^a-z0-9_-]/gi,'-').slice(0,60) || 'puzzle')+'.json':'insight-puzzles.json'});
    message(entries.length+' puzzle'+(entries.length===1?'':'s')+' exported.');feedback.notify(entries.length+' puzzle'+(entries.length===1?'':'s')+' exported.',{title:'Backup ready',tone:'success'});
  }
  useEffect(()=>{
    function keydown(event){
      if(event.defaultPrevented)return;if(dialogs.active){if(event.key==='Escape'){event.preventDefault();dialogs.close()}return}
      if(/^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName))return;
      if((event.ctrlKey || event.metaKey) && ['z','y'].includes(event.key.toLowerCase())){event.preventDefault();undoEdit(event.key.toLowerCase()==='y' || event.shiftKey);return}
      if(event.ctrlKey || event.metaKey || event.altKey)return;
      const type=event.key.toUpperCase();if(PuzzleArt.META[type]){pickUp({type,from:null},palette.current.get(type));return}
      const button=event.target.closest('.edit-cell'),direction={ArrowUp:[-1,0],ArrowDown:[1,0],ArrowLeft:[0,-1],ArrowRight:[0,1]}[event.key];
      if(button && ['Delete','Backspace'].includes(event.key)){event.preventDefault();removeTile([+button.dataset.r,+button.dataset.c]);return}
      if(button && direction){event.preventDefault();focusCell([+button.dataset.r+direction[0],+button.dataset.c+direction[1]])}
      if(event.key==='Escape'){cancelPlacement();if(worker.current){stopWorker();message('Validation cancelled. Your draft is saved.')}else setStatus(null)}
    }
    function pagehide(){cancelPlacement();stopWorker()}
    document.addEventListener('keydown',keydown);window.addEventListener('pagehide',pagehide);window.addEventListener('blur',cancelPlacement);
    return ()=>{document.removeEventListener('keydown',keydown);window.removeEventListener('pagehide',pagehide);window.removeEventListener('blur',cancelPlacement)};
  });
  const counts=Object.fromEntries(Object.keys(PuzzleArt.META).map(type=>[type,['start','target'].map(which=>[...draft[which].join('')].filter(tile=>tile===type).length)]));
  return {library,draft,side,panel,edits,status:status || {text:readyMessage(draft),tone:draft.proof?'valid':'idle'},saved,checking,holding,drag,drop,discarding,counts,dialogs,feedback,ink,boardRef,shellRef,removeRef,fileRef,downloadRef,download,importText,setImportText,exportScope,setExportScope,seed,setSeed,cellRef:pos=>node=>{const key=pos.join(':');if(node)cells.current.set(key,node);else cells.current.delete(key)},paletteRef:type=>node=>{if(node)palette.current.set(type,node);else palette.current.delete(type)},beginDrag,pointerMove,pointerUp,cancelPlacement,pickUp,activate,showPanel,changeSide,change,undoEdit,switchDraft,newDraft:()=>addDraft(newDraft()),duplicateDraft:()=>addDraft({...copy(draft),id:newDraft().id,name:draft.name.slice(0,53)+' · copy'}),copyLevel:()=>addDraft(newDraft({...CAMPAIGN_LEVELS[+seed],name:CAMPAIGN_LEVELS[+seed].name+' · copy'})),deleteDraft,resize,clear,shuffle,validate,playtest,addToGame,studioLast,removeLastFromGame,importJSON,importFile,exportFile,removePicked:()=>{if(holding?.from)removeTile(holding.from);else message('Drag tiles here or outside the board to remove. Delete also removes.')}};
}
