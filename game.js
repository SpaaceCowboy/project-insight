(() => {
let editorProblem=null;
function readEditorPuzzle() {
  if (!new URLSearchParams(location.search).has('editor')) return null;
  try {
    const preview=JSON.parse(sessionStorage.getItem('insight-editor-preview-v1'));
    const verified=PuzzleSolver.verify(preview,preview);
    if (!verified.par) throw new Error('Start and Target are already identical.');
    if(typeof preview.id!=='string' || !/^[\w-]{1,80}$/.test(preview.id))throw new Error('Invalid puzzle ID.');
    return {...verified,id:preview.id,world:1};
  } catch { editorProblem='Playtest unavailable. Open the editor and validate your puzzle again.'; return null; }
}
const customPuzzle=readEditorPuzzle();
if(editorProblem){
  try{sessionStorage.setItem('insight-editor-message-v1',editorProblem)}catch{}
  location.replace('Editor.html');return;
}
const LEVELS=customPuzzle ? [customPuzzle] : CORE_LEVELS;
const puzzleStamp=customPuzzle ? JSON.stringify([customPuzzle.id,customPuzzle.start,customPuzzle.target]) : null;
const WORLD_META = {
  1: {name: 'FOUNDATIONS'},
  2: {name: 'SHAPED SPACE'},
  3: {name: 'ROUTING CHALLENGES'},
  4: {name: 'CONVERGENCE'},
  5: {name: 'COMPLEX MAPS'}
};
const {ICONS,META,TILE_LIGHTS}=PuzzleArt;
const {clone,parse,key,active,legalMoves,swapCells}=PuzzleRules;
const KEY = 'insight-100-fixed-v4';
const MODE_KEY = 'insight-mode-v1';
const THEME_KEY = 'insight-theme-v1';
const LIMITS_KEY = 'insight-tile-limits-v1';
const LIMIT_STARS_KEY = 'insight-limit-stars-v1';
const SESSION_KEY = customPuzzle ? 'insight-editor-session-v1' : 'insight-session-v1';
const ATTEMPTS_KEY = customPuzzle ? 'insight-editor-attempts-v1' : 'insight-attempts-v1';
const SOUND_KEY = 'insight-sound-v1';
let limitsOn = loadLimits();
function loadLimits() {
  if (customPuzzle && !customPuzzle.fitsLimits) return false;
  try { return localStorage.getItem(LIMITS_KEY) !== 'off'; }
  catch { return true; }
}
const $=id=>document.getElementById(id);
const boardEl=$('board'), targetEl=$('target');
const levelsOverlay=$('levelsOverlay'), menuOverlay=$('menuOverlay'), winOverlay=$('winOverlay');
let moveTimer=null, winTimer=null, selected=null, history=[], activeOverlay=null, returnFocus=null;
let selectorWorld = 1;
let progress=loadProgress(), levelIndex=0, levelState=null, drag=null, busy=false, soundOn=loadSound(), toastTimer=null, particles=[], zenMode=loadMode(), darkMode=loadTheme();
let attempts=loadAttempts(), restartRecovery=null;
const fx=$('fx'),fctx=fx.getContext('2d');
function loadProgress() {
  if (customPuzzle) return {done:{}};
  try {
    const stored = JSON.parse(localStorage.getItem(limitsOn ? LIMIT_STARS_KEY : KEY) || '{}');
    const done = {};
    for (const [id, stars] of Object.entries(stored?.done || {})) {
      if (/^[1-9]\d*$/.test(id) && Number(id) <= LEVELS.length && Number.isInteger(stars) && stars >= 1 && stars <= 3) done[id] = stars;
    }
    return {done};
  } catch { return {done: {}}; }
}
function store(key, value) {
  try { localStorage.setItem(key, value); }
  catch { toast('Browser storage unavailable; changes last for this session.'); }
}
function saveProgress(){if(!customPuzzle)store(limitsOn ? LIMIT_STARS_KEY : KEY,JSON.stringify(progress))}
function loadSound(){try{return localStorage.getItem(SOUND_KEY)!=='off'}catch{return true}}
function applySound() {
  $('soundBtn').innerHTML = soundOn ? '♪ <span>Sound</span>' : '× <span>Muted</span>';
  $('soundBtn').setAttribute('aria-label', soundOn ? 'Mute sound' : 'Enable sound');
  $('soundBtn').setAttribute('aria-pressed', String(soundOn));
}
function attemptKey(level,limited){return (customPuzzle ? customPuzzle.id+':' : '')+(limited ? 'limited:' : 'classic:')+level}
function loadAttempts() {
  try {
    const saved=JSON.parse(localStorage.getItem(ATTEMPTS_KEY));
    if (saved && Number.isInteger(saved.last) && LEVELS[saved.last] && saved.entries && !Array.isArray(saved.entries) && typeof saved.entries==='object') {
      const entries={};
      for (const [id,entry] of Object.entries(saved.entries)) {
        const validKey=customPuzzle ? /^[\w-]{1,80}:(limited|classic):0$/.test(id) && id.endsWith(':'+(entry?.limits ? 'limited' : 'classic')+':0') : id===attemptKey(entry?.level,entry?.limits) && /^(limited|classic):\d+$/.test(id);
        if (validKey && entry && Number.isInteger(entry.level) && LEVELS[entry.level] && typeof entry.limits==='boolean') entries[id]=entry;
      }
      return {last:saved.last,entries};
    }
    const legacy=JSON.parse(localStorage.getItem(SESSION_KEY));
    if (legacy && Number.isInteger(legacy.level) && LEVELS[legacy.level] && typeof legacy.limits==='boolean') {
      return {last:legacy.level,entries:{[attemptKey(legacy.level,legacy.limits)]:legacy}};
    }
  } catch {}
  return {last:0,entries:{}};
}
function sessionSnapshot(state=levelState,steps=history) {
  return {level:state.level,limits:state.limits,allowances:state.allowances,path:steps.map(step=>step.move),...(customPuzzle ? {puzzleStamp} : {})};
}
function saveSession() {
  const saved=sessionSnapshot();
  if (restartRecovery) saved.restart=sessionSnapshot(restartRecovery.state,restartRecovery.steps);
  attempts.last=levelIndex;
  attempts.entries[attemptKey(saved.level,saved.limits)]=saved;
  store(ATTEMPTS_KEY,JSON.stringify(attempts));
  store(SESSION_KEY,JSON.stringify(saved));
}
function loadSession(saved) {
  try {
    if (!saved || (customPuzzle && saved.puzzleStamp!==puzzleStamp) || saved.limits!==limitsOn || !Number.isInteger(saved.level) || !LEVELS[saved.level] ||
        !Array.isArray(saved.path) || saved.path.length>10000) return null;
    const spec = LEVELS[saved.level];
    const allowances = saved.allowances;
    if (limitsOn && (!Array.isArray(allowances) || allowances.length!==spec.start.length ||
        !allowances.every((row,r)=>Array.isArray(row) && row.length===spec.start[r].length && row.every((n,c)=>
          Number.isInteger(n) && ('.W'.includes(spec.start[r][c]) ? n===0 : n>=Math.max(3,spec.allowanceFloor[r][c]) && n<=6))))) return null;
    const state = {level:saved.level, limits:saved.limits, target:parse(spec.target), board:parse(spec.start), moves:0,
      allowances:limitsOn ? allowances : null, remaining:limitsOn ? clone(allowances) : null};
    const steps = [];
    let color = TILE_LIGHTS.B;
    for (const move of saved.path) {
      if (!Array.isArray(move) || move.length!==2 || !move.every(pos=>Array.isArray(pos) && pos.length===2 && pos.every(Number.isInteger))) return null;
      const [a,b] = move;
      if (!legalMoves(state.board,...a,state.remaining).some(([r,c])=>r===b[0] && c===b[1]) || key(state.board)===key(state.target)) return null;
      steps.push({board:clone(state.board), moves:state.moves, remaining:state.remaining ? clone(state.remaining) : null, color, move});
      color = TILE_LIGHTS[state.board[a[0]][a[1]]];
      if (state.remaining) { state.remaining[a[0]][a[1]]--; state.remaining=swapCells(state.remaining,a,b); }
      state.board=swapCells(state.board,a,b);
      state.moves++;
    }
    return {state, steps, color};
  } catch { return null; }
}
function loadMode(){try{return localStorage.getItem(MODE_KEY)!=='star'}catch{return true}}
function saveMode(){store(MODE_KEY,zenMode?'zen':'star')}
function applyMode() {
  document.querySelector('.app').classList.toggle('zen-mode', zenMode);
  document.body.classList.toggle('zen-mode', zenMode);
  $('modeBtn').textContent = zenMode ? 'Zen Mode · ON' : 'Star Mode · ON';
  $('modeBtn').setAttribute('aria-pressed', String(zenMode));
  $('modeNote').textContent = zenMode
    ? 'Zen Mode keeps the experience quiet. Turn on Star Mode to see moves, par and stars while you play.'
    : 'Star Mode shows the moves, 3★ par and your best stars while you play.';
}
function toggleMode(){zenMode=!zenMode;saveMode();applyMode();playTone('select')}
function loadTheme(){try{return localStorage.getItem(THEME_KEY)!=='light'}catch{return true}}
function saveTheme(){store(THEME_KEY,darkMode?'dark':'light')}
function applyTheme() {
  document.body.classList.toggle('light-mode', !darkMode);
  $('themeBtn').textContent = darkMode ? 'Moonlit Forest' : 'Forest at Dawn';
  document.querySelector('meta[name=theme-color]').content = darkMode ? '#0c252e' : '#d9e9dc';
}
function toggleTheme(){darkMode=!darkMode;saveTheme();applyTheme();playTone('select')}
function starsFor(moves,par){return moves<=par?3:moves<=par+2?2:1}
function starText(n){return '★'.repeat(n)+'☆'.repeat(3-n)}
function cancelPending() {
  clearTimeout(moveTimer);
  clearTimeout(winTimer);
  cancelDrag();
  selected = null;
  busy = false;
}
function isSolved(){return key(levelState.board)===key(levelState.target)}
function isExhausted() {
  return levelState.remaining && !isSolved() && !levelState.board.some((row,r)=>row.some((t,c)=>legalMoves(levelState.board,r,c,levelState.remaining).length));
}
function showRecovery(){if(isExhausted())openOverlay($('emptyOverlay'))}
function focusBoard(position) {
  (position && tileAt(...position) || boardEl.querySelector('.tile'))?.focus({preventScroll:true});
}
function restartLevel() {
  const recovery=levelState.moves ? {state:levelState,steps:history,color:document.body.style.getPropertyValue('--light-color')} : restartRecovery;
  startLevel(levelIndex,true);
  restartRecovery=recovery;
  updateHeader(); saveSession(); focusBoard();
  playTone('undo');
}
function startLevel(idx,restart=false) {
  if (idx < 0 || idx >= LEVELS.length) return;
  document.querySelectorAll('.color-stroke').forEach(el=>el.remove());
  cancelPending();
  if (levelState && !restart) saveSession();
  const saved=attempts.entries[attemptKey(idx,limitsOn)];
  const restored=restart ? null : loadSession(saved);
  const canResume=restored && key(restored.state.board)!==key(restored.state.target);
  const previousAllowances = levelState?.level===idx && levelState.limits===limitsOn ? levelState.allowances : restored?.state.allowances;
  levelIndex = idx;
  const spec = LEVELS[idx];
  const allowances = limitsOn ? previousAllowances || spec.start.map((row,r) => [...row].map((t,c) => {
    if (t === '.' || t === 'W') return 0;
    const floor = Math.max(3, spec.allowanceFloor[r][c]);
    return floor + Math.floor(Math.random() * (7-floor));
  })) : null;
  levelState = canResume ? restored.state : {level:idx, limits:limitsOn, target:parse(spec.target), board:parse(spec.start), moves:0,
    allowances, remaining:allowances ? clone(allowances) : null};
  history = canResume ? restored.steps : [];
  const recovery=canResume && !history.length ? loadSession(saved.restart) : null;
  restartRecovery=recovery && recovery.state.level===idx && recovery.state.moves ? recovery : null;
  document.body.style.setProperty('--light-color',canResume ? restored.color : TILE_LIGHTS.B);
  renderBoard();
  renderTarget();
  updateHeader();
  closeOverlay();
  saveSession();
  focusBoard();
  showRecovery();
}
function updateHeader() {
  const spec = LEVELS[levelIndex];
  $('levelNo').textContent = customPuzzle ? 'MY PUZZLES · PLAYTEST' : WORLD_META[spec.world].name + ' · LEVEL ' + String(levelIndex + 1).padStart(3, '0');
  $('levelName').textContent = spec.name;
  $('moves').textContent = levelState.moves;
  $('par').textContent = spec.par;
  const best = progress.done[levelIndex + 1] || 0;
  $('starsTop').textContent = best ? starText(best) : '☆☆☆';
  $('undoBtn').disabled = !history.length && !restartRecovery;
  $('undoBtn').textContent = restartRecovery ? '↶ Undo restart' : '↶ Undo';
  const solved = key(levelState.board)===key(levelState.target);
  boardEl.classList.toggle('solved', solved);
  $('nextBtn').textContent=levelIndex<LEVELS.length-1 ? 'Next →' : 'Replay final';
  $('playBtn').textContent = solved ? levelIndex<LEVELS.length-1 ? 'Next puzzle →' : 'Replay final' : levelState.moves ? 'Resume · Level '+String(levelIndex+1).padStart(3,'0') : 'Play · Level '+String(levelIndex+1).padStart(3,'0');
  $('menuProgress').textContent = Object.keys(progress.done).length + ' / '+LEVELS.length+' puzzles solved';
  if (customPuzzle) {
    $('nextBtn').textContent='Back to editor';
    $('playBtn').textContent=solved ? 'Back to editor' : levelState.moves ? 'Resume playtest' : 'Playtest';
    $('menuProgress').textContent='Custom puzzle · Progress kept separate';
  }
}
function cellHTML(t, r, c) {
  if (t === '.') return '<div class="cell hole" data-r="'+r+'" data-c="'+c+'"></div>';
  const meta = META[t];
  const left = levelState.remaining?.[r]?.[c];
  const limited = limitsOn && t !== 'W';
  const label = meta.name + ', row ' + (r+1) + ', column ' + (c+1) + (limited ? ', '+left+' moves left' : '');
  const badge = limited ? '<span class="tile-allowance" aria-hidden="true">'+left+'</span>' : '';
  return '<div class="cell" data-r="'+r+'" data-c="'+c+'"><button type="button" class="tile '+meta.cls+(limited && left===0 ? ' spent' : '')+'" style="--tile-order:'+(r+c)+'" data-r="'+r+'" data-c="'+c+'" data-type="'+t+'" aria-label="'+label+'" aria-pressed="false">'+ICONS[t]+badge+'</button></div>';
}
function renderBoard() {
  const g = levelState.board;
  const rows = g.length, cols = g[0].length;
  boardEl.innerHTML = '';
  boardEl.style.gridTemplateColumns = `repeat(${cols},var(--cell))`;
  boardEl.parentElement.style.setProperty('--cols', cols);
  boardEl.parentElement.style.setProperty('--rows', rows);
  let minR = rows, maxR = -1, minC = cols, maxC = -1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (g[r][c] !== '.') {
        minR = Math.min(minR, r);
        maxR = Math.max(maxR, r);
        minC = Math.min(minC, c);
        maxC = Math.max(maxC, c);
      }
      boardEl.insertAdjacentHTML('beforeend', cellHTML(g[r][c], r, c));
    }
  }
  if (maxR < 0) {
    boardEl.style.marginLeft = '0';
    boardEl.style.marginTop = '0';
    return;
  }
  const cellPx = boardEl.querySelector('.cell').getBoundingClientRect().width;
  const gap = parseFloat(getComputedStyle(boardEl).columnGap) || 6;
  const pitch = cellPx + gap;
  const shapeW = (maxC-minC+1)*cellPx + (maxC-minC)*gap;
  const shapeH = (maxR-minR+1)*cellPx + (maxR-minR)*gap;
  const totalW = cols*cellPx + (cols-1)*gap;
  const totalH = rows*cellPx + (rows-1)*gap;
  boardEl.style.marginLeft = `${(totalW-shapeW)/2 - minC*pitch}px`;
  boardEl.style.marginTop = `${(totalH-shapeH)/2 - minR*pitch}px`;
}
function renderTarget(){
  const g=levelState.target;
  let minR=g.length, maxR=-1, minC=g[0]?.length||0, maxC=-1;
  for(let r=0;r<g.length;r++) for(let c=0;c<(g[r]?.length||0);c++){
    if(g[r][c]!=='.'){minR=Math.min(minR,r);maxR=Math.max(maxR,r);minC=Math.min(minC,c);maxC=Math.max(maxC,c)}
  }
  if(maxR<0){targetEl.innerHTML='';targetEl.style.width='0px';return}
  const rows=maxR-minR+1, cols=maxC-minC+1;
  const s=innerHeight<=450 ? 13 : innerWidth<700 && innerHeight<=650 ? 16 : 20;
  targetEl.style.setProperty('--target-cell',s+'px');
  targetEl.style.gridTemplateColumns=`repeat(${cols},${s}px)`;
  targetEl.style.gridTemplateRows=`repeat(${rows},${s}px)`;
  targetEl.style.width=(cols*s+(cols-1)*4)+'px';
  targetEl.style.minHeight=(rows*s+(rows-1)*4)+'px';
  targetEl.innerHTML='';
  targetEl.setAttribute('aria-label', 'Target arrangement: ' + g.map((row, i) => 'row ' + (i+1) + ': ' + row.map(t => META[t]?.name || 'gap').join(', ')).join('; '));
  for(let r=minR;r<=maxR;r++) for(let c=minC;c<=maxC;c++){
    const t=g[r][c],d=document.createElement('div');
    d.className='target-dot '+(t==='W'?'white':t==='.'?'hole':'');
    d.style.setProperty('--dot',TILE_LIGHTS[t]||'#bbb');
    d.innerHTML=ICONS[t]||'';
    targetEl.appendChild(d);
  }
}
function clearHover(){boardEl.querySelectorAll('.hover-target').forEach(el=>el.classList.remove('hover-target'))}
function refreshSelection() {
  boardEl.querySelectorAll('.tile').forEach(el => {
    el.classList.remove('selected');
    el.setAttribute('aria-pressed', 'false');
  });
  const from = drag?.from || selected;
  if (!from) return;
  const [r, c] = from;
  const tile = tileAt(r, c);
  tile?.classList.add('selected');
  tile?.setAttribute('aria-pressed', 'true');
}
function tileAt(r,c){return boardEl.querySelector(`.tile[data-r="${r}"][data-c="${c}"]`)}
function cellAtPoint(x, y) {
  for (const cell of boardEl.querySelectorAll('.cell[data-r]')) {
    const rect = cell.getBoundingClientRect();
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return cell;
  }
  return null;
}
function setDragTransform(){if(!drag)return;drag.el.style.transform=`translate3d(${drag.x-drag.startX}px,${drag.y-drag.startY}px,0) scale(1.045)`}
function updateHover() {
  if (!drag) return;
  const cell = cellAtPoint(drag.x, drag.y);
  let next = null;
  if (cell) {
    const r = +cell.dataset.r, c = +cell.dataset.c;
    if (drag.moves.some(([rr, cc]) => rr === r && cc === c)) next = [r, c];
  }
  if (drag.hover && next && drag.hover[0] === next[0] && drag.hover[1] === next[1]) return;
  clearHover();
  drag.hover = next;
  if (next) boardEl.querySelector(`.cell[data-r="${next[0]}"][data-c="${next[1]}"]`)?.classList.add('hover-target');
}
function handlePointerDown(e) {
  if (busy || drag || isSolved() || e.button !== 0) return;
  const tile = e.target.closest('.tile');
  if (!tile) return;
  const r = +tile.dataset.r, c = +tile.dataset.c;
  const moves = legalMoves(levelState.board, r, c, levelState.remaining);
  e.preventDefault();
  tile.focus({preventScroll: true});
  drag = {el: tile, from: [r,c], moves, startX:e.clientX, startY:e.clientY,
    x:e.clientX, y:e.clientY, hover:null, moved:false, pointerId:e.pointerId};
  boardEl.setPointerCapture?.(e.pointerId);
}
function handlePointerMove(e) {
  if (!drag || e.pointerId!==drag.pointerId) return;
  e.preventDefault();
  drag.x=e.clientX; drag.y=e.clientY;
  if (!drag.moved && Math.hypot(drag.x-drag.startX,drag.y-drag.startY)<8) return;
  if (!drag.moves.length) { drag.moved=true; return; }
  if (!drag.moved) {
    drag.moved=true; selected=null;
    drag.el.classList.add('dragging'); refreshSelection();
    playTone('select',levelState.board[drag.from[0]][drag.from[1]]);
  }
  setDragTransform(); updateHover();
}
function releaseDrag() {
  if (!drag) return null;
  const d = drag;
  drag = null;
  if (boardEl.hasPointerCapture?.(d.pointerId)) boardEl.releasePointerCapture(d.pointerId);
  clearHover();
  d.el.classList.remove('dragging');
  d.el.style.transform = '';
  return d;
}
function cancelDrag() {
  releaseDrag();
  refreshSelection();
}
function endDrag() {
  const d = releaseDrag();
  if (!d) return;
  if (!d.moved) chooseTile(d.el);
  else if (d.hover) performMove(d.from, d.hover, d.el,[d.x-d.startX,d.y-d.startY]);
  else { refreshSelection(); rejectMove(d.el,'That swap is not allowed.'); }
}
function handlePointerUp(e){if(drag&&e.pointerId===drag.pointerId){e.preventDefault();endDrag()}}
function rejectMove(tile,message) {
  tile.classList.remove('rejected');
  void tile.offsetWidth;
  tile.classList.add('rejected');
  setTimeout(()=>tile.classList.remove('rejected'),240);
  playTone('deny'); announce(message);
}
function performMove(a, b, fromEl,dragOffset) {
  if (busy || !legalMoves(levelState.board, ...a, levelState.remaining).some(([r,c]) => r===b[0] && c===b[1])) return;
  selected = null;
  refreshSelection();
  busy = true;
  const current = levelState;
  const fromRect = fromEl.parentElement.getBoundingClientRect();
  const toEl = tileAt(...b), toRect = toEl.parentElement.getBoundingClientRect();
  const dx = toRect.left - fromRect.left, dy = toRect.top - fromRect.top;
  const duration = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 185;
  const initial=dragOffset ? 'translate('+dragOffset[0]+'px,'+dragOffset[1]+'px) scale(1.045)' : 'translate(0,0)';
  fromEl.classList.add('moving');
  fromEl.animate([{transform:initial}, {transform:'translate('+dx+'px,'+dy+'px)'}],
    {duration, fill:'forwards'});
  toEl.animate([{transform:'translate(0,0)'}, {transform:'translate('+(-dx)+'px,'+(-dy)+'px)'}],
    {duration, fill:'forwards'});
  popParticlesAtCell(a);
  popParticlesAtCell(b);
  playTone('move',current.board[a[0]][a[1]]);
  moveTimer = setTimeout(() => {
    if (levelState !== current) return;
    history.push({board:clone(current.board), moves:current.moves,
      remaining:current.remaining ? clone(current.remaining) : null, color:document.body.style.getPropertyValue('--light-color'), move:[a,b]});
    const movedType = current.board[a[0]][a[1]];
    restartRecovery=null;
    if (current.remaining) {
      current.remaining[a[0]][a[1]]--;
      current.remaining = swapCells(current.remaining, a, b);
    }
    document.body.style.setProperty('--light-color', TILE_LIGHTS[movedType]);
    PuzzleArt.paintStroke(boardEl.parentElement,fromRect,toRect,movedType);
    current.board = swapCells(current.board, a, b);
    current.moves++;
    busy = false;
    renderBoard();
    for (const [r,c] of [a,b]) {
      if (current.board[r][c]===current.target[r][c] && history.at(-1).board[r][c]!==current.board[r][c]) tileAt(r,c)?.classList.add('arrived');
    }
    updateHeader();
    saveSession();
    tileAt(...b)?.focus({preventScroll:true});
    announce('Move ' + current.moves + '. ' + META[current.board[b[0]][b[1]]].name + ' moved to row ' + (b[0]+1) + ', column ' + (b[1]+1) + '.');
    if (key(current.board) === key(current.target)) win();
    else if (isExhausted()) {
      openOverlay($('emptyOverlay'));
      playTone('deny');
    }
  }, duration + 8);
}
function undo() {
  if (!history.length && !restartRecovery) return;
  document.querySelectorAll('.color-stroke').forEach(el=>el.remove());
  cancelPending();
  if (restartRecovery) {
    levelState=restartRecovery.state; history=restartRecovery.steps;
    document.body.style.setProperty('--light-color',restartRecovery.color);
    restartRecovery=null;
    closeOverlay(); renderBoard(); updateHeader(); saveSession();
    focusBoard(history.at(-1)?.move[1]); showRecovery();
    playTone('undo'); announce('Restart undone. '+levelState.moves+' moves.');
    return;
  }
  const previous = history.pop();
  levelState.board = previous.board;
  levelState.moves = previous.moves;
  levelState.remaining = previous.remaining;
  document.body.style.setProperty('--light-color', previous.color);
  closeOverlay();
  renderBoard();
  updateHeader();
  saveSession();
  focusBoard(previous.move[0]);
  playTone('undo');
  announce('Move undone. ' + levelState.moves + ' moves.');
}
function win() {
  busy = true;
  const current = levelState;
  const stars = starsFor(current.moves, LEVELS[levelIndex].par);
  if (stars > (progress.done[levelIndex+1] || 0)) {
    progress.done[levelIndex+1] = stars;
    saveProgress();
  }
  updateHeader();
  $('winTitle').textContent = zenMode ? 'Beautifully solved.' : stars===3 ? 'Perfect shift.' : stars===2 ? 'Clean solve.' : 'Grid conquered.';
  $('winStars').textContent = starText(stars);
  $('winMeta').textContent = current.moves + ' moves · par ' + LEVELS[levelIndex].par;
  $('winNextBtn').textContent = levelIndex < LEVELS.length-1 ? 'Next →' : 'Replay Final';
  $('winLevelsBtn').hidden=levelIndex<LEVELS.length-1;
  if (customPuzzle) { $('winNextBtn').textContent='Back to editor'; $('winLevelsBtn').hidden=true; }
  winTimer = setTimeout(() => {
    if (levelState !== current) return;
    if (activeOverlay) { busy = false; return; }
    openOverlay(winOverlay);
    busy = false;
    burstCenter(stars===3 ? 28 : 18);
    playTone('win');
    announce('Puzzle solved.');
  }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 100 : 850);
}
function leaveEditor(){cancelPending();saveSession();location.href='Editor.html'}
function nextLevel(){if(customPuzzle)leaveEditor();else if(levelIndex<LEVELS.length-1)startLevel(levelIndex+1);else restartLevel()}
function buildLevelSelector() {
  selectorWorld = LEVELS[levelIndex].world;
  const tabs = $('worldTabs');
  tabs.innerHTML = '';
  for (let w = 1; w <= 5; w++) {
    const tab = document.createElement('button');
    tab.id = 'worldTab' + w;
    tab.className = 'ui-btn';
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', 'levelWorlds');
    tab.textContent = 'World ' + w;
    tab.addEventListener('click', () => renderLevelWorld(w));
    tab.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const next = (w - 1 + (e.key === 'ArrowRight' ? 1 : 4)) % 5 + 1;
        renderLevelWorld(next);
        $('worldTab' + next).focus();
      }
    });
    tabs.appendChild(tab);
  }
  renderLevelWorld(selectorWorld);
}
function renderLevelWorld(w) {
  selectorWorld = w;
  for (const tab of $('worldTabs').children) {
    const active = tab.id === 'worldTab' + w;
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
  }
  const root = $('levelWorlds');
  root.setAttribute('aria-labelledby', 'worldTab' + w);
  root.innerHTML = '';
  const section = document.createElement('section');
  section.className = 'world-block';
  const completed = LEVELS.filter((level,i)=>level.world===w && progress.done[i+1]).length;
  const total = LEVELS.filter(level=>level.world===w).length;
  section.innerHTML = `<div class="world-head"><div class="world-title">WORLD ${w} · ${WORLD_META[w].name}</div><div class="world-sub">${completed} / ${total} solved</div></div>`;
  const grid = document.createElement('div');
  grid.className = 'level-grid';
  LEVELS.forEach((level, i) => {
    if (level.world !== w) return;
    const card = document.createElement('button');
    card.className = 'level-card ' + (i === levelIndex ? 'current ' : '') + (progress.done[i+1] ? 'done' : '');
    const best = progress.done[i+1] || 0;
    card.innerHTML = `<div class="lvl-num">${String(i+1).padStart(3,'0')}</div><div class="lvl-name">${level.name}</div><div class="lvl-stars">${best ? starText(best) : ''}</div>`;
    card.setAttribute('aria-label', `Level ${i+1}, ${level.name}${!zenMode && best ? ', best '+best+' stars' : ''}`);
    card.addEventListener('click', () => {
      startLevel(i);
      playTone('select');
    });
    grid.appendChild(card);
  });
  section.appendChild(grid);
  root.appendChild(section);
}
function toast(msg){const t=$('toast');t.textContent=msg;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),1800)}
function playTone(kind,type) {
  if (soundOn) window.playTone(kind,type);
}
function resizeFX(){fx.width=innerWidth*devicePixelRatio;fx.height=innerHeight*devicePixelRatio;fx.style.width=innerWidth+'px';fx.style.height=innerHeight+'px';fctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0)}
function cellCenter(pos) {
  const cell = boardEl.querySelector(`.cell[data-r="${pos[0]}"][data-c="${pos[1]}"]`);
  if (!cell) return {x: innerWidth/2, y: innerHeight*.5};
  const rect = cell.getBoundingClientRect();
  return {x: rect.left+rect.width/2, y: rect.top+rect.height/2};
}
function popParticlesAtCell(pos) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!particles.length) requestAnimationFrame(animate);
  const p = cellCenter(pos);
  for (let i = 0; i < 7; i++) {
    const angle = (i/7)*Math.PI*2;
    particles.push({x:p.x, y:p.y, vx:Math.cos(angle)*2.2, vy:Math.sin(angle)*2.2-1, r:1.6, life:1, color:TILE_LIGHTS[levelState.board[pos[0]][pos[1]]]});
  }
}
function burstCenter(count) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!particles.length) requestAnimationFrame(animate);
  for (let i = 0; i < count; i++) {
    const angle = (i/count)*Math.PI*2, speed = 2.2+(i%4)*.8;
    particles.push({x:innerWidth/2, y:innerHeight*.48, vx:Math.cos(angle)*speed,
      vy:Math.sin(angle)*speed-1.8, r:1.7+(i%3)*.45, life:1});
  }
}
function animate() {
  fctx.clearRect(0, 0, innerWidth, innerHeight);
  for (let i = particles.length-1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += .045;
    p.vx *= .989;
    p.life -= .024;
    fctx.globalAlpha = Math.max(0, p.life);
    fctx.beginPath();
    fctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
    fctx.fillStyle = p.color || '#d8f4dc';
    fctx.fill();
    if (p.life <= 0) particles.splice(i, 1);
  }
  if (particles.length) requestAnimationFrame(animate);
}

function announce(message) { $('announcement').textContent = message; }
function openOverlay(overlay) {
  clearTimeout(winTimer);
  if (key(levelState.board) === key(levelState.target)) busy = false;
  cancelDrag();
  selected = null;
  refreshSelection();
  if (!activeOverlay) returnFocus = document.activeElement;
  if (activeOverlay) activeOverlay.classList.remove('open');
  activeOverlay = overlay;
  overlay.classList.add('open');
  document.querySelector('.app').inert = true;
  for (const other of document.querySelectorAll('.overlay')) other.inert = other !== overlay;
  overlay.querySelector('button')?.focus();
}
function closeOverlay() {
  if (!activeOverlay) return;
  activeOverlay.classList.remove('open');
  activeOverlay = null;
  document.querySelector('.app').inert = false;
  for (const overlay of document.querySelectorAll('.overlay')) overlay.inert = true;
  if (returnFocus?.isConnected) returnFocus.focus({preventScroll:true});
}
function chooseTile(tile) {
  if (busy || drag || isSolved()) return;
  const position = [+tile.dataset.r, +tile.dataset.c];
  if (selected && legalMoves(levelState.board, ...selected, levelState.remaining).some(([r,c]) => r===position[0] && c===position[1])) {
    performMove(selected, position, tileAt(...selected));
    return;
  }
  if (selected && (selected[0]!==position[0] || selected[1]!==position[1])) {
    rejectMove(tileAt(...selected),'That swap is not allowed.');
    return;
  }
  const moves = legalMoves(levelState.board, ...position, levelState.remaining);
  const same = selected && selected[0]===position[0] && selected[1]===position[1];
  selected = moves.length && !same ? position : null;
  refreshSelection();
  if (!moves.length) {
    rejectMove(tile,levelState.remaining?.[position[0]][position[1]]===0 && levelState.board[position[0]][position[1]]!=='W' ? 'No moves left on this tile.' : 'Tile not selected.');
    return;
  }
  playTone('select',levelState.board[position[0]][position[1]]);
  announce(selected ? 'Selected ' + META[levelState.board[position[0]][position[1]]].name + '.' : 'Tile not selected.');
}
boardEl.addEventListener('pointerdown', handlePointerDown);
boardEl.addEventListener('pointermove', handlePointerMove);
boardEl.addEventListener('pointerup', handlePointerUp);
boardEl.addEventListener('pointercancel', cancelDrag);
boardEl.addEventListener('lostpointercapture', () => { if (drag) cancelDrag(); });
boardEl.addEventListener('click', e => { if (e.detail===0 && e.target.closest('.tile')) chooseTile(e.target.closest('.tile')); });
boardEl.parentElement.addEventListener('pointerdown', e=>{
  if (e.button===0 && !busy && !drag && !e.target.closest('.tile')) { selected=null; refreshSelection(); }
});
window.addEventListener('pointerup', e => { if (drag && e.pointerId===drag.pointerId) endDrag(); });
$('restartBtn').addEventListener('click', restartLevel);
$('undoBtn').addEventListener('click', undo);
$('modeBtn').addEventListener('click', toggleMode);
$('limitsBtn').addEventListener('click', () => {
  limitsOn = !limitsOn;
  store(LIMITS_KEY, limitsOn ? 'on' : 'off');
  progress = loadProgress();
  startLevel(levelIndex);
  $('limitsBtn').textContent = limitsOn ? 'Tile Limits · ON' : 'Tile Limits · OFF';
  $('limitsBtn').setAttribute('aria-pressed', String(limitsOn));
  playTone('select');
});
$('emptyUndoBtn').addEventListener('click', undo);
$('emptyRestartBtn').addEventListener('click', restartLevel);
$('emptyLevelsBtn').addEventListener('click', showLevels);
$('themeBtn').addEventListener('click', toggleTheme);
$('nextBtn').addEventListener('click', nextLevel);
function showLevels() { if(customPuzzle){leaveEditor();return} buildLevelSelector(); openOverlay(levelsOverlay); }
$('levelsBtn').addEventListener('click', showLevels);
$('levelsBtn2').addEventListener('click', showLevels);
$('menuLevelsBtn').addEventListener('click', showLevels);
$('editorBtn').addEventListener('click',()=>{cancelPending();saveSession();location.href='Editor.html'});
$('menuBtn').addEventListener('click', () => openOverlay(menuOverlay));
$('playBtn').addEventListener('click', () => {
  if (key(levelState.board)===key(levelState.target)) nextLevel();
  else { closeOverlay(); showRecovery(); }
  playTone('select');
});
document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', closeOverlay));
for (const overlay of document.querySelectorAll('.overlay')) {
  overlay.addEventListener('click', e => { if (e.target===overlay) closeOverlay(); });
}
$('replayBtn').addEventListener('click', restartLevel);
$('winNextBtn').addEventListener('click', nextLevel);
$('winLevelsBtn').addEventListener('click', showLevels);
$('soundBtn').addEventListener('click', () => {
  soundOn = !soundOn;
  store(SOUND_KEY, soundOn ? 'on' : 'off');
  applySound();
  if (soundOn) playTone('select'); else stopMusic();
});
$('resetProgress').addEventListener('click', () => {
  if (!confirm('Reset all saved stars?')) return;
  progress = {done:{}};
  saveProgress();
  buildLevelSelector();
  $('resetProgress').focus();
  updateHeader();
  toast('Stars reset.');
});
document.addEventListener('keydown', e => {
  if (activeOverlay) {
    if (e.key==='Escape') { e.preventDefault(); closeOverlay(); }
    if (e.key==='Tab') {
      const buttons = [...activeOverlay.querySelectorAll('button:not(:disabled), input:not(:disabled)')].filter(el=>el.getClientRects().length);
      const first = buttons[0], last = buttons.at(-1);
      if (e.shiftKey && document.activeElement===first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement===last) { e.preventDefault(); first.focus(); }
    }
    return;
  }
  if (e.key==='Escape') { cancelDrag(); selected=null; refreshSelection(); }
  if (e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
  if (e.key.toLowerCase()==='r') restartLevel();
  if (e.key.toLowerCase()==='l') showLevels();
  if (e.key.toLowerCase()==='u') undo();
  const tile = e.target.closest('.tile');
  const directions = {ArrowUp:[-1,0], ArrowDown:[1,0], ArrowLeft:[0,-1], ArrowRight:[0,1]};
  if (tile && directions[e.key]) {
    e.preventDefault();
    const [dr,dc] = directions[e.key];
    let r = +tile.dataset.r+dr, c = +tile.dataset.c+dc;
    while (r>=0 && r<levelState.board.length && c>=0 && c<levelState.board[0].length) {
      const next = tileAt(r,c);
      if (next) { next.focus(); break; }
      r+=dr; c+=dc;
    }
  }
});
addEventListener('resize', () => {
  const focused=document.activeElement.closest?.('.tile');
  const position=focused ? [+focused.dataset.r,+focused.dataset.c] : null;
  resizeFX(); cancelDrag(); renderBoard(); renderTarget(); refreshSelection();
  if(position)focusBoard(position);
});
$('limitsBtn').textContent = limitsOn ? 'Tile Limits · ON' : 'Tile Limits · OFF';
$('limitsBtn').setAttribute('aria-pressed', String(limitsOn));
$('menuHero').innerHTML=['R','B','G','P','W','Y','B','G','R'].map(t=>'<span class="hero-tile '+META[t].cls+'">'+ICONS[t]+'</span>').join('');
resizeFX();
applyMode();
applyTheme();
applySound();
const savedSession = loadSession(attempts.entries[attemptKey(attempts.last,limitsOn)]);
const unfinished = LEVELS.findIndex((level,i)=>!progress.done[i+1]);
startLevel(savedSession && key(savedSession.state.board)!==key(savedSession.state.target) ? savedSession.state.level : Math.max(0,unfinished));
if (!customPuzzle) buildLevelSelector();
else {
  $('levelsBtn2').textContent='My Puzzles';
  $('levelsBtn').setAttribute('aria-label','Back to editor');
  $('menuLevelsBtn').textContent='Back to editor';
  $('editorBtn').hidden=true;
  $('limitsBtn').disabled=!customPuzzle.fitsLimits;
  if (!customPuzzle.fitsLimits) $('limitsBtn').textContent='Classic only';
}
openOverlay(menuOverlay);
})();
