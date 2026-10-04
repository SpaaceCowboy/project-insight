import {CORE_LEVELS,LEVEL_SOLUTIONS,LEVEL_LIMIT_SOLUTIONS,PuzzleRules,PuzzleSolver,PuzzleArt} from './src/data.js';
import {renderView} from './src/view-store.js';
import {createFeedback} from './src/feedback.js';

export function initEditor() {
  const events=new AbortController();
  const listen=(target,type,callback)=>target.addEventListener(type,callback,{signal:events.signal});
  const KEY='insight-editor-drafts-v1', PREVIEW_KEY='insight-editor-preview-v1';
  const $=id=>document.getElementById(id), {ICONS,META,TILE_LIGHTS}=PuzzleArt;
  const copy=value=>JSON.parse(JSON.stringify(value));
  const id=()=>crypto.randomUUID?.() || Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
  let warning='', recoveryData=null, library=loadLibrary(), draft=library.drafts.find(item=>item.id===library.active)||library.drafts[0];
  let side='start', undo=[], redo=[], drag=null, holding=null, worker=null, workerURL=null;
  let confirmationFocus=null,disposed=false;
  const feedback=createFeedback({open:()=>{
    cancelPlacement();confirmationFocus=document.activeElement;
    $('confirmationOverlay').classList.add('open');$('confirmationOverlay').inert=false;
    document.querySelector('.editor-app').inert=true;$('confirmCancel').focus({preventScroll:true});
  },close:closeConfirmation});
  function closeConfirmation() {
    feedback.cancel();$('confirmationOverlay').classList.remove('open');$('confirmationOverlay').inert=true;
    document.querySelector('.editor-app').inert=false;
    if(confirmationFocus?.isConnected)confirmationFocus.focus({preventScroll:true});
  }
  listen($('confirmationOverlay'),'click',event=>{if(event.target===$('confirmationOverlay'))closeConfirmation()});
  function newDraft(spec={name:'Untitled puzzle',start:['...','...','...'],target:['...','...','...']}) {
    return {...PuzzleRules.validate(spec,false),id:id()};
  }
  function loadLibrary() {
    try {
      const raw=localStorage.getItem(KEY);
      recoveryData=raw;
      const data=JSON.parse(raw);
      if (data?.version===1 && Array.isArray(data.drafts) && data.drafts.length<=100) {
        const drafts=[];
        for (const item of data.drafts) {
          try {
            const spec=PuzzleRules.validate(item,false);
            if (typeof item.id!=='string' || !/^[\w-]{1,80}$/.test(item.id) || drafts.some(d=>d.id===item.id)) throw new Error();
            const entry={...spec,id:item.id};
            if (item.proof) {
              try { entry.proof=PuzzleSolver.verify(entry,item.proof); } catch {}
            }
            drafts.push(entry);
          } catch { warning='Some damaged drafts could not be loaded. Your other puzzles are available.'; }
        }
        if (drafts.length) {if(!warning)recoveryData=null;return {version:1,active:data.active,drafts}}
      } else if (data) warning='Saved drafts could not be read. Import a backup to recover them.';
    } catch { warning='Saved drafts are unavailable. You can still create and export puzzles.'; }
    const first=newDraft({name:'My first puzzle',start:['...','...','...'],target:['...','...','...']});
    return {version:1,active:first.id,drafts:[first]};
  }
  function save() {
    library.active=draft.id;
    try {
      if(recoveryData){localStorage.setItem(KEY+'-recovery',recoveryData);recoveryData=null}
      localStorage.setItem(KEY,JSON.stringify(library)); $('saveState').textContent='Saved'; return true;
    }
    catch {
      $('saveState').textContent='Export to keep'; $('saveState').title='Browser storage is unavailable. Export your puzzles to keep them.';
      feedback.notify('Browser storage is unavailable. Export your puzzles to keep them.',{title:'Your draft is temporary',tone:'warning',duration:0});return false;
    }
  }
  function status(message,state='idle') {
    $('validationStatus').textContent=message;
    $('validationStatus').dataset.state=state;
    if(state==='error')feedback.notify(message,{title:'Puzzle needs attention',tone:'error',duration:8000});
  }
  function stopWorker() {
    worker?.terminate(); worker=null;
    if (workerURL) URL.revokeObjectURL(workerURL);
    workerURL=null;
    $('validatePuzzle').textContent='Validate';
  }
  function readyMessage() {
    if (draft.proof) return 'Verified · optimal par '+draft.proof.par+' · '+(draft.proof.fitsLimits ? 'Tile Limits ready · par '+draft.proof.limitedPar : 'Classic only: no verified Tile Limits route');
    try { PuzzleRules.validate(draft); return 'Validate to check solvability and optimal par.'; }
    catch (error) { return error.message; }
  }
  function invalidate() { stopWorker(); delete draft.proof; }
  function record(before) { undo.push(before); if(undo.length>100)undo.shift(); redo=[]; }
  function change(update) {
    cancelPlacement();
    const before=copy(draft);
    update();
    if (JSON.stringify(before)===JSON.stringify(draft)) return;
    if(puzzleKey(before)!==puzzleKey(draft))invalidate();
    else if(draft.proof)draft.proof.name=draft.name.trim()||'Untitled puzzle';
    record(before); save(); render();
  }
  function puzzleKey(level){const spec=PuzzleRules.validate(level,false);delete spec.name;delete spec.revision;return JSON.stringify(spec)}
  function undoEdit(reverse=false) {
    cancelPlacement();
    const from=reverse ? redo : undo, to=reverse ? undo : redo;
    if (!from.length) return;
    document.querySelectorAll('.color-stroke').forEach(el=>el.remove());
    stopWorker(); to.push(copy(draft));
    const restored=from.pop();
    Object.keys(draft).forEach(key=>delete draft[key]); Object.assign(draft,restored);
    save(); render();
  }
  function switchDraft(next) {
    document.querySelectorAll('.color-stroke').forEach(el=>el.remove());
    cancelPlacement(); stopWorker(); save();
    draft=next; undo=[]; redo=[]; side='start';
    save(); render();
  }
  function addDraft(next) {
    if(library.drafts.length>=100){status('100 puzzle slots are full. Export or delete one first.','error');return}
    library.drafts.push(next); switchDraft(next);
  }
  function render() {
    $('draftTitle').textContent=draft.name.trim()||'Untitled puzzle';
    $('editorSubtitle').textContent=draft.name.trim()||'Untitled puzzle';
    if(document.activeElement!==$('puzzleName'))$('puzzleName').value=draft.name;
    renderView('drafts',{drafts:library.drafts.map(item=>({...item}))});
    $('draftSelect').value=draft.id;
    $('boardWidth').value=draft.start[0].length; $('boardHeight').value=draft.start.length;
    $('boardDimensions').textContent=draft.start[0].length+' × '+draft.start.length;
    $('editStart').setAttribute('aria-pressed',String(side==='start'));
    $('editTarget').setAttribute('aria-pressed',String(side==='target'));
    $('copyBoard').textContent=side==='start' ? 'Start → Target' : 'Target → Start';
    $('editUndo').disabled=!undo.length; $('editRedo').disabled=!redo.length;
    $('playtestPuzzle').disabled=!draft.proof || !draft.proof.par;
    renderBoard(); renderCounts();
    status(worker ? 'Checking solvability…' : readyMessage(),draft.proof ? 'valid' : 'idle');
  }
  function renderCounts() {
    const counts=Object.fromEntries(Object.keys(META).map(type=>[type,['start','target'].map(which=>[...draft[which].join('')].filter(t=>t===type).length)]));
    renderView('counts',{counts});
    renderView('palette',{counts,onDrag:(event,type)=>beginDrag(event,{type,from:null},event.currentTarget),
      onPick:(type,source)=>pickUp({type,from:null},source),
      onRemove:()=>{if(holding?.from)removeTile(holding.from);else status('Drag tiles here or outside the board to remove. Delete also removes.')}});
  }
  function renderBoard() {
    const root=$('editorBoard'), focused=document.activeElement.closest?.('.edit-cell');
    const position=focused ? [+focused.dataset.r,+focused.dataset.c] : null;
    root.style.setProperty('--cols',draft.start[0].length); root.style.setProperty('--rows',draft.start.length);
    root.setAttribute('aria-label',(side==='start'?'Start':'Target')+' board');
    renderView('editorBoard',{board:draft[side].slice()});
    if(position)focusCell(...position);
  }
  function focusCell(r,c){$('editorBoard').querySelector(`[data-r="${r}"][data-c="${c}"]`)?.focus({preventScroll:true})}
  function setCell(which,r,c,type) { const chars=[...draft[which][r]]; chars[c]=type; draft[which][r]=chars.join(''); }
  function cancelPlacement() {
    const previous=drag; drag=null; holding=null;
    previous?.ghost?.remove();
    if(previous?.source.hasPointerCapture(previous.pointerId))previous.source.releasePointerCapture(previous.pointerId);
    document.querySelectorAll('.drop-ready,.picked-up,.drag-source').forEach(el=>{el.classList.remove('drop-ready','picked-up','drag-source');if(el.hasAttribute('aria-pressed'))el.setAttribute('aria-pressed','false')});
    for(const button of $('palette').children)if(button.dataset.type)button.setAttribute('aria-pressed','false');
  }
  function placeTile(item,r,c) {
    const board=$('editorBoard'),to=board.querySelector(`[data-r="${r}"][data-c="${c}"]`).getBoundingClientRect();
    const from=item.from ? board.querySelector(`[data-r="${item.from[0]}"][data-c="${item.from[1]}"]`).getBoundingClientRect() : to;
    const other=side==='start'?'target':'start';
    change(()=>{
      if(item.from) {
        const [sr,sc]=item.from;
        if(sr===r && sc===c)return;
        if(draft[side][r][c]==='.') {
          // Moving into a placeholder relocates the board cell on both arrangements.
          for(const which of [side,other]){setCell(which,r,c,draft[which][sr][sc]);setCell(which,sr,sc,'.')}
        } else {
          const destination=draft[side][r][c];setCell(side,r,c,item.type);setCell(side,...item.from,destination);
        }
      } else {
        setCell(side,r,c,item.type);
        if(draft[other][r][c]==='.')setCell(other,r,c,item.type);
      }
    });
    document.body.style.setProperty('--light-color',TILE_LIGHTS[item.type]);focusCell(r,c);
    if(!item.from || item.from[0]!==r || item.from[1]!==c)PuzzleArt.paintStroke(board.parentElement,from,to,item.type);
    if(!worker)status(readyMessage(),draft.proof?'valid':'idle');
  }
  function removeTile(position) {
    change(()=>{for(const which of ['start','target'])setCell(which,...position,'.')});
    focusCell(...position);
  }
  function pickUp(item,source) {
    cancelPlacement();holding=item;source.classList.add('picked-up');
    source.setAttribute('aria-pressed','true');
    status('Picked up '+META[item.type].name+'. Enter places; Escape cancels.');
  }
  function beginDrag(event,item,source) {
    if(event.button!==0 || drag)return;
    event.preventDefault();cancelPlacement();source.focus({preventScroll:true});
    drag={...item,source,pointerId:event.pointerId,x:event.clientX,y:event.clientY,moved:false,ghost:null};
    source.setPointerCapture(event.pointerId);
  }
  function dropTarget(x,y) {
    const element=document.elementFromPoint(x,y);
    const slot=element?.closest('.edit-cell');
    if(slot && $('editorBoard').contains(slot))return slot;
    return element?.closest('#removeTile')||null;
  }
  function outsideBoard(x,y) {
    const rect=board.parentElement.getBoundingClientRect();
    return x<rect.left || x>rect.right || y<rect.top || y>rect.bottom;
  }
  const board=$('editorBoard');
  listen(board,'pointerdown',event=>{
    const button=event.target.closest('.edit-cell');
    if(!button)return;
    const r=+button.dataset.r,c=+button.dataset.c,type=draft[side][r][c];
    if(type!=='.')beginDrag(event,{type,from:[r,c]},button);
  });
  listen(document,'pointermove',event=>{
    if(!drag || event.pointerId!==drag.pointerId)return;
    event.preventDefault();
    if(!drag.moved && Math.hypot(event.clientX-drag.x,event.clientY-drag.y)<6)return;
    if(!drag.ghost) {
      drag.moved=true;drag.source.classList.add('drag-source');
      const size=Math.max(44,Math.min(100,board.firstElementChild.getBoundingClientRect().width));
      const ghost=document.createElement('div');ghost.className='tile '+META[drag.type].cls+' drag-preview';
      ghost.setAttribute('aria-hidden','true');ghost.innerHTML=ICONS[drag.type];ghost.style.setProperty('--cell',size+'px');
      document.body.appendChild(ghost);drag.ghost=ghost;
    }
    drag.ghost.style.left=event.clientX+'px';drag.ghost.style.top=event.clientY+'px';
    document.querySelectorAll('.drop-ready').forEach(el=>el.classList.remove('drop-ready'));
    const target=dropTarget(event.clientX,event.clientY);
    if(target && (target.id!=='removeTile' || drag.from))target.classList.add('drop-ready');
    const discarding=drag.from && outsideBoard(event.clientX,event.clientY);
    drag.ghost.classList.toggle('discarding',!!discarding);
    if(discarding)$('removeTile').classList.add('drop-ready');
  });
  listen(document,'pointerup',event=>{
    if(!drag || event.pointerId!==drag.pointerId)return;
    const item=drag,target=dropTarget(event.clientX,event.clientY);cancelPlacement();
    if(!item.moved)return;
    if(!target){if(item.from && outsideBoard(event.clientX,event.clientY))removeTile(item.from);return}
    if(target.id==='removeTile'){if(item.from)removeTile(item.from)}
    else placeTile(item,+target.dataset.r,+target.dataset.c);
  });
  listen(document,'pointercancel',event=>{if(drag?.pointerId===event.pointerId)cancelPlacement()});
  listen(document,'lostpointercapture',event=>{if(drag?.pointerId===event.pointerId)cancelPlacement()});
  listen(board,'click',event=>{
    const button=event.target.closest('.edit-cell');
    if(!button || event.detail!==0)return;
    const r=+button.dataset.r,c=+button.dataset.c;
    if(holding)placeTile(holding,r,c);
    else if(draft[side][r][c]!=='.')pickUp({type:draft[side][r][c],from:[r,c]},button);
  });
  function panel(name) {
    cancelPlacement();
    for(const tab of document.querySelectorAll('[data-panel]')) {
      const selected=tab.dataset.panel===name;
      tab.setAttribute('aria-selected',String(selected)); tab.tabIndex=selected ? 0 : -1;
      $(tab.dataset.panel+'Panel').hidden=!selected;
    }
  }
  for(const tab of document.querySelectorAll('[data-panel]')) {
    listen(tab,'click',()=>panel(tab.dataset.panel));
    listen(tab,'keydown',event=>{
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
      event.preventDefault(); const tabs=[...document.querySelectorAll('[data-panel]')],i=tabs.indexOf(tab);
      const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(i+(event.key==='ArrowRight'?1:tabs.length-1))%tabs.length;
      panel(tabs[next].dataset.panel); tabs[next].focus();
    });
  }
  listen($('editStart'),'click',()=>{cancelPlacement();side='start';render()});
  listen($('editTarget'),'click',()=>{cancelPlacement();side='target';render()});
  listen($('editUndo'),'click',()=>undoEdit());
  listen($('editRedo'),'click',()=>undoEdit(true));
  listen($('copyBoard'),'click',()=>change(()=>{draft[side==='start'?'target':'start']=draft[side].slice()}));
  listen($('swapBoards'),'click',()=>change(()=>{[draft.start,draft.target]=[draft.target,draft.start]}));
  listen($('puzzleName'),'input',event=>change(()=>{draft.name=event.target.value}));
  listen($('draftSelect'),'change',event=>switchDraft(library.drafts.find(item=>item.id===event.target.value)));
  listen($('newDraft'),'click',()=>addDraft(newDraft()));
  listen($('duplicateDraft'),'click',()=>addDraft({...copy(draft),id:id(),name:(draft.name.slice(0,53)+' · copy')}));
  listen($('deleteDraft'),'click',async()=>{
    const current=draft;
    if(!await feedback.confirm({title:'Delete this puzzle?',message:'“'+(draft.name||'Untitled puzzle')+'” will be removed from your library. Export it first if you want a backup.',accept:'Delete puzzle',danger:true}) || disposed || draft!==current)return;
    library.drafts=library.drafts.filter(item=>item!==draft);
    if(!library.drafts.length)library.drafts.push(newDraft());
    switchDraft(library.drafts[0]);
    feedback.notify('The puzzle was removed from your library.',{title:'Puzzle deleted',tone:'success'});
  });
  for(const control of ['boardWidth','boardHeight'])listen($(control),'change',async()=>{
    const width=+$('boardWidth').value,height=+$('boardHeight').value;
    const current=draft;
    if((width<draft.start[0].length || height<draft.start.length) && !await feedback.confirm({title:'Crop both boards?',message:'Cells outside '+width+' × '+height+' will be removed from Start and Target. Undo can restore them.',accept:'Crop boards'})){if(!disposed)render();return}
    if(disposed || draft!==current)return;
    change(()=>{for(const which of ['start','target'])draft[which]=Array.from({length:height},(_,r)=>Array.from({length:width},(_,c)=>draft[which][r]?.[c]||'.').join(''))});
  });
  listen($('clearBoard'),'click',async()=>{
    const current=draft;
    if(await feedback.confirm({title:'Clear both boards?',message:'Every tile in Start and Target will become an empty slot. Undo can restore your tiles.',accept:'Clear boards'}) && !disposed && draft===current)change(()=>{draft.start=draft.start.map(row=>'.'.repeat(row.length));draft.target=draft.start.slice()});
  });
  renderView('seeds',{levels:CORE_LEVELS});
  listen($('copyLevel'),'click',()=>{
    const source=CORE_LEVELS[+$('seedLevel').value];
    addDraft(newDraft({...source,name:source.name+' · copy'}));
  });
  listen($('shuffleStart'),'click',()=>{
    let shuffled=PuzzleRules.parse(draft.target), previous=null, lastDifferent=null;
    for(let i=0;i<24;i++) {
      const moves=shuffled.flatMap((row,r)=>row.flatMap((type,c)=>type==='.'?[]:PuzzleRules.legalMoves(shuffled,r,c).filter(([rr,cc])=>shuffled[rr][cc]!==type && (!previous || r!==previous[0] || c!==previous[1] || rr!==previous[2] || cc!==previous[3])).map(to=>[[r,c],to])));
      if(!moves.length)break;
      const [a,b]=moves[Math.floor(Math.random()*moves.length)]; previous=[...b,...a]; shuffled=PuzzleRules.swapCells(shuffled,a,b);
      if(PuzzleRules.key(shuffled)!==draft.target.join('|'))lastDifferent=shuffled;
    }
    if(PuzzleRules.key(shuffled)===draft.target.join('|') && lastDifferent)shuffled=lastDifferent;
    if(PuzzleRules.key(shuffled)===draft.target.join('|')){status('No different Start was generated. Add movable tiles to Target and try again.','error');return}
    change(()=>{draft.start=shuffled.map(row=>row.join(''))}); side='start'; render(); validate();
  });
  function validate() {
    cancelPlacement();
    if(worker){stopWorker();status('Validation cancelled. Your draft is saved.');return}
    let spec;
    try {
      spec=PuzzleRules.validate(draft);
      if(spec.start.join('|')===spec.target.join('|'))throw new Error('Start and Target are already identical. Change one board.');
    } catch(error){status(error.message,'error');return}
    const known=CORE_LEVELS.findIndex(level=>puzzleKey(level)===puzzleKey(spec));
    if(known>=0){draft.proof=PuzzleSolver.verify(draft,{path:LEVEL_SOLUTIONS[known],limitedPath:LEVEL_LIMIT_SOLUTIONS?.[known]});save();render();return}
    delete draft.proof; $('playtestPuzzle').disabled=true;
    const source=`const PuzzleRules=(${PuzzleRules.create.toString()})();
      const PuzzleSolver=(${PuzzleSolver.create.toString()})(PuzzleRules);
      onmessage=event=>{
        try{
          const options={maxStates:350000,timeout:8000,progress:count=>postMessage({count})};
          const result=PuzzleSolver.solve(event.data,options);
          postMessage({result:PuzzleSolver.verify(event.data,result)});
        }catch(error){postMessage({error:error.message})}
      };`;
    try {
      workerURL=URL.createObjectURL(new Blob([source],{type:'text/javascript'})); worker=new Worker(workerURL);
      const job=worker;
      $('validatePuzzle').textContent='Cancel check'; status('Checking solvability…');
      worker.onmessage=event=>{
        if(worker!==job)return;
        if(event.data.count){status('Checking… '+event.data.count.toLocaleString()+' positions');return}
        stopWorker();
        if(event.data.error){status(event.data.error,'error');save();return}
        try {draft.proof=PuzzleSolver.verify(draft,event.data.result);save();render()}
        catch(error){status(error.message,'error')}
      };
      worker.onerror=()=>{if(worker===job){stopWorker();status('Validation could not start in this browser. Your draft can still be exported.','error')}};
      worker.postMessage(spec);
    } catch {stopWorker();status('Validation could not start in this browser. Your draft can still be exported.','error')}
  }
  listen($('validatePuzzle'),'click',validate);
  listen($('playtestPuzzle'),'click',()=>{
    if(!draft.proof)return;
    save();
    try {
      const spec=PuzzleSolver.verify(draft,draft.proof);
      sessionStorage.setItem(PREVIEW_KEY,JSON.stringify({...spec,id:draft.id})); location.href='Puzzle.html?editor=1';
    } catch(error){status('Playtest could not open: '+error.message,'error')}
  });
  function importJSON(text) {
    try {
      if(text.length>262144)throw new Error('Puzzle files must be smaller than 256 KB.');
      const data=JSON.parse(text);
      if(data.version!==undefined && data.version!==1)throw new Error('Unsupported puzzle file version.');
      const entries=data.puzzles || [data];
      if(!Array.isArray(entries) || !entries.length || entries.length>100 || library.drafts.length+entries.length>100)throw new Error('Import up to 100 puzzles within the library limit.');
      const imported=entries.map(item=>newDraft(PuzzleRules.validate(item,false)));
      library.drafts.push(...imported); switchDraft(imported[0]);
      $('importText').value=''; status(imported.length+' puzzle'+(imported.length===1?'':'s')+' imported. Validate before playtesting.');
      feedback.notify(imported.length+' puzzle'+(imported.length===1?'':'s')+' added to your library.',{title:'Import complete',tone:'success'});
    } catch(error){status('Import failed: '+error.message,'error')}
  }
  listen($('importPaste'),'click',()=>importJSON($('importText').value));
  listen($('importFile'),'click',()=>$('fileInput').click());
  listen($('fileInput'),'change',async event=>{
    const file=event.target.files[0]; if(!file)return;
    if(file.size>262144){status('Puzzle files must be smaller than 256 KB.','error');event.target.value='';return}
    try {importJSON(await file.text())}catch{status('This file could not be read.','error')}
    event.target.value='';
  });
  listen($('exportFile'),'click',()=>{
    cancelPlacement(); save();
    const entries=$('exportScope').value==='all' ? library.drafts : [draft];
    const payload={format:'insight-puzzles',version:1,puzzles:entries.map(item=>PuzzleRules.validate(item,false))};
    const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)+'\n'],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download=entries.length===1?(draft.name.replace(/[^a-z0-9_-]/gi,'-').slice(0,60)||'puzzle')+'.json':'insight-puzzles.json';link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);status(entries.length+' puzzle'+(entries.length===1?'':'s')+' exported.');
    feedback.notify(entries.length+' puzzle'+(entries.length===1?'':'s')+' exported.',{title:'Backup ready',tone:'success'});
  });
  listen(document,'keydown',event=>{
    if($('confirmationOverlay').classList.contains('open')) {
      if(event.key==='Escape'){event.preventDefault();closeConfirmation()}
      if(event.key==='Tab') {
        if(event.shiftKey && document.activeElement===$('confirmCancel')){event.preventDefault();$('confirmAccept').focus()}
        else if(!event.shiftKey && document.activeElement===$('confirmAccept')){event.preventDefault();$('confirmCancel').focus()}
      }
      return;
    }
    if(/^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName))return;
    if((event.ctrlKey||event.metaKey) && ['z','y'].includes(event.key.toLowerCase())){
      event.preventDefault();undoEdit(event.key.toLowerCase()==='y'||event.shiftKey);return;
    }
    if(event.ctrlKey||event.metaKey||event.altKey)return;
    const type=event.key.toUpperCase();
    if(META[type]){pickUp({type,from:null},$('palette').querySelector(`[data-type="${type}"]`));return}
    const button=event.target.closest('.edit-cell'), directions={ArrowUp:[-1,0],ArrowDown:[1,0],ArrowLeft:[0,-1],ArrowRight:[0,1]};
    if(button && ['Delete','Backspace'].includes(event.key)){event.preventDefault();removeTile([+button.dataset.r,+button.dataset.c]);return}
    if(button && directions[event.key]){event.preventDefault();const [dr,dc]=directions[event.key];focusCell(+button.dataset.r+dr,+button.dataset.c+dc)}
    if(event.key==='Escape'){cancelPlacement();if(worker){stopWorker();status('Validation cancelled. Your draft is saved.')}else status(readyMessage(),draft.proof?'valid':'idle')}
  });
  listen(window,'pagehide',()=>{cancelPlacement();stopWorker();save()});
  listen(window,'blur',cancelPlacement);
  try {document.body.classList.toggle('light-mode',localStorage.getItem('insight-theme-v1')==='light')}catch{}
  save(); render();
  if(warning)status(warning,'error');
  try {
    const message=sessionStorage.getItem('insight-editor-message-v1');
    if(message){sessionStorage.removeItem('insight-editor-message-v1');status(message,'error')}
  }catch{}
  return () => {disposed=true;events.abort();cancelPlacement();stopWorker();save();feedback.dispose();document.querySelectorAll('.color-stroke').forEach(el=>el.remove())};
}
