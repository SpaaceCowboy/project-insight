(() => {
  const KEY='insight-editor-drafts-v1', PREVIEW_KEY='insight-editor-preview-v1';
  const $=id=>document.getElementById(id), {ICONS,META,TILE_LIGHTS}=PuzzleArt;
  const copy=value=>JSON.parse(JSON.stringify(value));
  const id=()=>crypto.randomUUID?.() || Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
  let warning='', recoveryData=null, library=loadLibrary(), draft=library.drafts.find(item=>item.id===library.active)||library.drafts[0];
  let side='start', undo=[], redo=[], drag=null, holding=null, worker=null, workerURL=null;
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
    catch { $('saveState').textContent='Export to keep'; $('saveState').title='Browser storage is unavailable. Export your puzzles to keep them.'; return false; }
  }
  function status(message,state='idle') {
    $('validationStatus').textContent=message;
    $('validationStatus').dataset.state=state;
  }
  function stopWorker() {
    worker?.terminate(); worker=null;
    if (workerURL) URL.revokeObjectURL(workerURL);
    workerURL=null;
    $('validatePuzzle').textContent='Validate';
  }
  function readyMessage() {
    if (draft.proof) return 'Verified · optimal par '+draft.proof.par+' · '+(draft.proof.fitsLimits ? 'Tile Limits ready' : 'Classic only: a tile needs more than 6 moves');
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
    if(JSON.stringify([before.start,before.target])!==JSON.stringify([draft.start,draft.target]))invalidate();
    else if(draft.proof)draft.proof.name=draft.name.trim()||'Untitled puzzle';
    record(before); save(); render();
  }
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
    const select=$('draftSelect'); select.replaceChildren();
    for (const item of library.drafts) { const option=new Option(item.name.trim()||'Untitled puzzle',item.id); select.add(option); }
    select.value=draft.id;
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
    const root=$('tileCounts'); root.replaceChildren();
    for (const [type,meta] of Object.entries(META)) {
      const count=which=>[...draft[which].join('')].filter(t=>t===type).length;
      const a=count('start'),b=count('target');
      const button=$('palette').querySelector(`[data-type="${type}"]`), badge=button.querySelector('.brush-count');
      badge.textContent=a+'/'+b; badge.hidden=a===b;
      button.setAttribute('aria-label',meta.name+' tile, Start '+a+', Target '+b);
      if(!a&&!b)continue;
      const chip=document.createElement('span'); chip.className='count-chip'+(a!==b ? ' mismatch' : '');
      chip.textContent=meta.name+' '+a+' / '+b; chip.title='Start / Target'; root.appendChild(chip);
    }
  }
  function renderBoard() {
    const root=$('editorBoard'), focused=document.activeElement.closest?.('.edit-cell');
    const position=focused ? [+focused.dataset.r,+focused.dataset.c] : null;
    root.style.setProperty('--cols',draft.start[0].length); root.style.setProperty('--rows',draft.start.length);
    root.setAttribute('aria-label',(side==='start'?'Start':'Target')+' board');
    root.replaceChildren();
    draft[side].forEach((row,r)=>[...row].forEach((type,c)=>{
      const button=document.createElement('button'); button.type='button'; button.dataset.r=r; button.dataset.c=c;
      button.className='edit-cell '+(type==='.' ? 'gap-brush' : 'tile '+META[type].cls);
      button.innerHTML=ICONS[type]||'<span aria-hidden="true">+</span>';
      button.setAttribute('aria-label',(META[type]?.name||'Empty slot')+', row '+(r+1)+', column '+(c+1));
      root.appendChild(button);
    }));
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
  board.addEventListener('pointerdown',event=>{
    const button=event.target.closest('.edit-cell');
    if(!button)return;
    const r=+button.dataset.r,c=+button.dataset.c,type=draft[side][r][c];
    if(type!=='.')beginDrag(event,{type,from:[r,c]},button);
  });
  document.addEventListener('pointermove',event=>{
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
  document.addEventListener('pointerup',event=>{
    if(!drag || event.pointerId!==drag.pointerId)return;
    const item=drag,target=dropTarget(event.clientX,event.clientY);cancelPlacement();
    if(!item.moved)return;
    if(!target){if(item.from && outsideBoard(event.clientX,event.clientY))removeTile(item.from);return}
    if(target.id==='removeTile'){if(item.from)removeTile(item.from)}
    else placeTile(item,+target.dataset.r,+target.dataset.c);
  });
  document.addEventListener('pointercancel',event=>{if(drag?.pointerId===event.pointerId)cancelPlacement()});
  document.addEventListener('lostpointercapture',event=>{if(drag?.pointerId===event.pointerId)cancelPlacement()});
  board.addEventListener('click',event=>{
    const button=event.target.closest('.edit-cell');
    if(!button || event.detail!==0)return;
    const r=+button.dataset.r,c=+button.dataset.c;
    if(holding)placeTile(holding,r,c);
    else if(draft[side][r][c]!=='.')pickUp({type:draft[side][r][c],from:[r,c]},button);
  });
  for(const type of Object.keys(META)) {
    const button=document.createElement('button'); button.type='button'; button.dataset.type=type;
    button.className='hero-tile '+META[type].cls;
    button.innerHTML=ICONS[type]+'<span class="brush-count" hidden></span>';button.setAttribute('aria-pressed','false');
    button.title='Drag '+META[type].name+' onto the board';
    button.addEventListener('pointerdown',event=>beginDrag(event,{type,from:null},button));
    button.addEventListener('click',event=>{if(event.detail===0)pickUp({type,from:null},button)});
    $('palette').appendChild(button);
  }
  const remove=document.createElement('button');remove.id='removeTile';remove.className='gap-brush';
  remove.innerHTML='<span aria-hidden="true">×</span>';remove.setAttribute('aria-label','Remove tile');remove.title='Drag a board tile here or outside the board to leave an empty slot';
  remove.addEventListener('click',()=>{if(holding?.from)removeTile(holding.from);else status('Drag tiles here or outside the board to remove. Delete also removes.')});
  $('palette').appendChild(remove);
  function panel(name) {
    cancelPlacement();
    for(const tab of document.querySelectorAll('[data-panel]')) {
      const selected=tab.dataset.panel===name;
      tab.setAttribute('aria-selected',String(selected)); tab.tabIndex=selected ? 0 : -1;
      $(tab.dataset.panel+'Panel').hidden=!selected;
    }
  }
  for(const tab of document.querySelectorAll('[data-panel]')) {
    tab.addEventListener('click',()=>panel(tab.dataset.panel));
    tab.addEventListener('keydown',event=>{
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
      event.preventDefault(); const tabs=[...document.querySelectorAll('[data-panel]')],i=tabs.indexOf(tab);
      const next=event.key==='Home'?0:event.key==='End'?2:(i+(event.key==='ArrowRight'?1:2))%3;
      panel(tabs[next].dataset.panel); tabs[next].focus();
    });
  }
  $('editStart').addEventListener('click',()=>{cancelPlacement();side='start';render()});
  $('editTarget').addEventListener('click',()=>{cancelPlacement();side='target';render()});
  $('editUndo').addEventListener('click',()=>undoEdit());
  $('editRedo').addEventListener('click',()=>undoEdit(true));
  $('copyBoard').addEventListener('click',()=>change(()=>{draft[side==='start'?'target':'start']=draft[side].slice()}));
  $('swapBoards').addEventListener('click',()=>change(()=>{[draft.start,draft.target]=[draft.target,draft.start]}));
  $('puzzleName').addEventListener('input',event=>change(()=>{draft.name=event.target.value}));
  $('draftSelect').addEventListener('change',event=>switchDraft(library.drafts.find(item=>item.id===event.target.value)));
  $('newDraft').addEventListener('click',()=>addDraft(newDraft()));
  $('duplicateDraft').addEventListener('click',()=>addDraft({...copy(draft),id:id(),name:(draft.name.slice(0,53)+' · copy')}));
  $('deleteDraft').addEventListener('click',()=>{
    if(!confirm('Delete “'+(draft.name||'Untitled puzzle')+'”? Export it first if you want a backup.'))return;
    library.drafts=library.drafts.filter(item=>item!==draft);
    if(!library.drafts.length)library.drafts.push(newDraft());
    switchDraft(library.drafts[0]);
  });
  for(const control of ['boardWidth','boardHeight'])$(control).addEventListener('change',()=>{
    const width=+$('boardWidth').value,height=+$('boardHeight').value;
    if((width<draft.start[0].length || height<draft.start.length) && !confirm('Crop the board? Undo can restore the removed cells.')){render();return}
    change(()=>{for(const which of ['start','target'])draft[which]=Array.from({length:height},(_,r)=>Array.from({length:width},(_,c)=>draft[which][r]?.[c]||'.').join(''))});
  });
  $('clearBoard').addEventListener('click',()=>{
    if(confirm('Clear both boards? Undo can restore them.'))change(()=>{draft.start=draft.start.map(row=>'.'.repeat(row.length));draft.target=draft.start.slice()});
  });
  CORE_LEVELS.forEach((level,i)=>$('seedLevel').add(new Option(String(i+1).padStart(3,'0')+' · '+level.name,i)));
  $('copyLevel').addEventListener('click',()=>{
    const source=CORE_LEVELS[+$('seedLevel').value];
    addDraft(newDraft({name:source.name+' · copy',start:source.start,target:source.target}));
  });
  $('shuffleStart').addEventListener('click',()=>{
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
    const known=CORE_LEVELS.findIndex(level=>level.start.join('|')===spec.start.join('|') && level.target.join('|')===spec.target.join('|'));
    if(known>=0){draft.proof=PuzzleSolver.verify(draft,{path:LEVEL_SOLUTIONS[known]});save();render();return}
    delete draft.proof; $('playtestPuzzle').disabled=true;
    const source='const PuzzleRules=('+PuzzleRules.create.toString()+')(); const PuzzleSolver=('+PuzzleSolver.create.toString()+')(PuzzleRules); onmessage=event=>{try{const result=PuzzleSolver.solve(event.data,{maxStates:350000,timeout:8000,progress:count=>postMessage({count})});postMessage({result:PuzzleSolver.verify(event.data,result)});}catch(error){postMessage({error:error.message});}};';
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
  $('validatePuzzle').addEventListener('click',validate);
  $('playtestPuzzle').addEventListener('click',()=>{
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
    } catch(error){status('Import failed: '+error.message,'error')}
  }
  $('importPaste').addEventListener('click',()=>importJSON($('importText').value));
  $('importFile').addEventListener('click',()=>$('fileInput').click());
  $('fileInput').addEventListener('change',async event=>{
    const file=event.target.files[0]; if(!file)return;
    if(file.size>262144){status('Puzzle files must be smaller than 256 KB.','error');event.target.value='';return}
    try {importJSON(await file.text())}catch{status('This file could not be read.','error')}
    event.target.value='';
  });
  $('exportFile').addEventListener('click',()=>{
    cancelPlacement(); save();
    const entries=$('exportScope').value==='all' ? library.drafts : [draft];
    const payload={format:'insight-puzzles',version:1,puzzles:entries.map(item=>({name:item.name.trim()||'Untitled puzzle',start:item.start.slice(),target:item.target.slice()}))};
    const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)+'\n'],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download=entries.length===1?(draft.name.replace(/[^a-z0-9_-]/gi,'-').slice(0,60)||'puzzle')+'.json':'insight-puzzles.json';link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);status(entries.length+' puzzle'+(entries.length===1?'':'s')+' exported.');
  });
  document.addEventListener('keydown',event=>{
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
  addEventListener('pagehide',()=>{cancelPlacement();stopWorker();save()});
  addEventListener('blur',cancelPlacement);
  try {document.body.classList.toggle('light-mode',localStorage.getItem('insight-theme-v1')==='light')}catch{}
  save(); render();
  if(warning)status(warning,'error');
  try {
    const message=sessionStorage.getItem('insight-editor-message-v1');
    if(message){sessionStorage.removeItem('insight-editor-message-v1');status(message,'error')}
  }catch{}
})();
