import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {Board, TargetMini, TileFace} from '../game/Board.jsx';
import {useBoard, same} from '../game/useBoard.js';
import {PuzzleRules as Rules} from '../game/rules.js';
import {DRAFT_KEY, editCreator, freshCreator, restoreCreator} from '../game/creatorState.js';
import {TILES, TILE_ORDER} from '../game/tileArt.js';
import {Heading} from '../ui.jsx';

const STEPS = ['Build your start', 'Find your target', 'Preview your puzzle'];
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
function loadDraft() {
  let raw;
  try { raw = localStorage.getItem(DRAFT_KEY); }
  catch { return {state: freshCreator(), notice: 'Browser storage is unavailable. Your draft will last for this visit only.'}; }
  try { return {state: raw ? restoreCreator(raw) : freshCreator(), notice: raw ? 'Your browser draft has been restored.' : ''}; }
  catch { return {state: freshCreator(), notice: 'Your saved draft could not be restored safely. A new empty grid is ready.'}; }
}

export default function Create({onUnlock}) {
  const [initial] = useState(loadDraft);
  const [state, setState] = useState(initial.state);
  const [notice, setNotice] = useState(initial.notice);
  const [error, setError] = useState('');
  const [holding, setHolding] = useState(null), [picked, setPicked] = useState(null);
  const [gesture, setGesture] = useState(null), [locked, setLocked] = useState(false);
  const now = useRef(state); now.current = state;
  const lock = useRef(false), drag = useRef(null), surface = useRef(null), morph = useRef(null), active = useRef([]), fading = useRef([]);
  const handlers = useRef(null), mounted = useRef(true), lastPhase = useRef(state.phase);
  const phase = state.phase, build = phase === 'BUILD', step = ['BUILD', 'SHAPE', 'CHECK'].indexOf(phase);
  const game = useBoard({start: state.start || state.board, target: state.target}, {
    initialBoard: initial.state.board,
    beforeMove: () => {
      const path = now.current.phase === 'SHAPE' ? now.current.construction : now.current.check;
      if (path.length < 10000) return true;
      setError('Move limit reached. Reset this stage to continue.'); return false;
    },
    onCommittedMove: ({from, at}) => commit({type: 'move', from, at}, false),
  });

  useEffect(() => {
    if (lastPhase.current !== phase) surface.current.querySelector('h3').focus({preventScroll: true});
    lastPhase.current = phase;
  }, [phase]);

  function save(next) {
    now.current = next; setState(next);
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(next)); }
    catch { setNotice('Browser storage is unavailable. Your draft will last for this visit only.'); }
  }
  function capture(action) {
    const before = now.current;
    const shift = action.type === 'next' && before.phase === 'BUILD' ? Rules.bounds(before.board) : {minR: 0, minC: 0};
    morph.current = {action, shift, cells: [...surface.current.querySelectorAll('.board > .cell')].map((node, index) => ({
      at: [Math.floor(index / before.board[0].length), index % before.board[0].length], rect: node.getBoundingClientRect(), clone: node.cloneNode(true),
    }))};
  }
  function commit(action, syncBoard = true) {
    try {
      const next = editCreator(now.current, action);
      if (next === now.current) return false;
      if (syncBoard && ['next', 'back', 'resize', 'relocate'].includes(action.type)) capture(action);
      save(next); setError(''); setPicked(null);
      if (['next', 'back', 'reset'].includes(action.type)) setHolding(null);
      if (syncBoard) game.replaceBoard(next.board);
      return true;
    } catch (reason) { setError(reason.message); return false; }
  }
  useLayoutEffect(() => {
    const transition = morph.current; morph.current = null;
    if (!transition || reduced()) return;
    active.current.forEach(animation => animation.cancel());
    fading.current.forEach(node => node.remove()); fading.current = [];
    const {action, shift, cells} = transition;
    const duration = action.type === 'resize' ? 170 : action.type === 'relocate' ? 185 : 260;
    const nodes = [...surface.current.querySelectorAll('.board > .cell')];
    active.current = nodes.map((node, index) => {
      const at = [Math.floor(index / state.board[0].length), index % state.board[0].length];
      let oldAt = [at[0] + shift.minR, at[1] + shift.minC];
      if (action.type === 'relocate') {
        if (same(at, action.at)) oldAt = action.from;
        else if (same(at, action.from)) oldAt = action.at;
      }
      const old = cells.find(cell => same(cell.at, oldAt))?.rect;
      const rect = node.getBoundingClientRect();
      if (!rect.width) return null;
      if (!old) return node.animate([{transform: 'scale(.7)', opacity: 0}, {transform: 'none', opacity: 1}], {duration, easing: 'cubic-bezier(.4,0,.2,1)'});
      return node.animate([{transform: `translate(${old.x - rect.x}px,${old.y - rect.y}px) scale(${old.width / rect.width})`}, {transform: 'none'}], {duration, easing: 'cubic-bezier(.4,0,.2,1)'});
    }).filter(Boolean);
    if (action.type === 'resize' || shift.minR || shift.minC || action.type === 'next') {
      const platform = surface.current.querySelector('.creator-platform'), shell = platform.getBoundingClientRect();
      for (const cell of cells) {
        const r = cell.at[0] - shift.minR, c = cell.at[1] - shift.minC;
        if (r >= 0 && c >= 0 && r < state.board.length && c < state.board[0].length) continue;
        const node = cell.clone;
        node.setAttribute('aria-hidden', 'true'); node.inert = true;
        Object.assign(node.style, {position: 'absolute', pointerEvents: 'none', left: `${cell.rect.x - shell.x}px`, top: `${cell.rect.y - shell.y}px`, width: `${cell.rect.width}px`, height: `${cell.rect.height}px`});
        node.style.setProperty('--cell', `${cell.rect.width}px`);
        platform.appendChild(node); fading.current.push(node);
        const animation = node.animate([{opacity: 1, transform: 'none'}, {opacity: 0, transform: 'scale(.7)'}], {duration, fill: 'forwards'});
        animation.finished.then(() => node.remove(), () => node.remove());
        active.current.push(animation);
      }
    }
    if (action.type === 'resize') return; // The handle remains live while the grid follows it.
    lock.current = true; setLocked(true);
    Promise.all(active.current.map(animation => animation.finished.catch(() => {}))).then(() => {
      if (mounted.current) { lock.current = false; setLocked(false); }
    });
  }, [state.phase, state.board]);
  useEffect(() => {
    mounted.current = true;
    const move = event => handlers.current.move(event), up = event => handlers.current.up(event), cancel = event => handlers.current.cancel(event);
    window.addEventListener('pointermove', move, {passive: false});
    window.addEventListener('pointerup', up); window.addEventListener('pointercancel', cancel);
    return () => {
      mounted.current = false; active.current.forEach(animation => animation.cancel()); fading.current.forEach(node => node.remove());
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', cancel);
    };
  }, []);
  const unavailable = () => lock.current || game.isBusy() || !!drag.current;
  async function control(type) {
    if (unavailable()) return;
    if (type === 'next' && phase === 'SHAPE') {
      // Verify the target before moving any tile, then await the app's rewind.
      let next;
      try { next = editCreator(now.current, {type}); } catch (reason) { setError(reason.message); return; }
      lock.current = true; setLocked(true);
      const finished = await game.restart({immediate: true});
      if (mounted.current && finished) { save(next); setError(''); setPicked(null); }
      if (mounted.current) { lock.current = false; setLocked(false); }
      return;
    }
    if (type === 'reset' && !build) {
      lock.current = true; setLocked(true);
      const finished = await game.restart({immediate: true});
      if (mounted.current && finished) commit({type}, false);
      if (mounted.current) { lock.current = false; setLocked(false); }
      return;
    }
    commit({type});
  }
  function choose(at) {
    if (unavailable()) return;
    if (holding) commit({type: 'place', tile: holding, at});
    else if (picked && !same(picked, at)) commit({type: 'relocate', from: picked, at});
    else setPicked(state.board[at[0]][at[1]] !== '.' && !same(picked, at) ? at : null);
  }
  function begin(event, source) {
    if (event.button !== 0 || unavailable()) return;
    event.preventDefault(); event.currentTarget.focus({preventScroll: true});
    const rect = surface.current.querySelector('.board').getBoundingClientRect();
    const cols = now.current.board[0].length, rows = now.current.board.length;
    const size = (rect.width - (cols - 1) * 5) / cols;
    drag.current = {...source, node: event.currentTarget, id: event.pointerId, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, rect, size, cols, rows, moved: false};
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* Synthetic or already cancelled pointer. */ }
  }
  function cellAt(x, y) {
    const nodes = [...surface.current.querySelectorAll('.board > .cell')];
    const index = nodes.findIndex(node => { const rect = node.getBoundingClientRect(); return x >= rect.left - 2.5 && x <= rect.right + 2.5 && y >= rect.top - 2.5 && y <= rect.bottom + 2.5; });
    return index < 0 ? null : [Math.floor(index / now.current.board[0].length), index % now.current.board[0].length];
  }
  function cancel(event) {
    if (!drag.current || (event && event.pointerId !== drag.current.id)) return;
    const item = drag.current; drag.current = null; setGesture(null);
    if (item.node.hasPointerCapture?.(item.id)) item.node.releasePointerCapture(item.id);
  }
  function pointerMove(event) {
    const item = drag.current;
    if (!item || event.pointerId !== item.id) return;
    event.preventDefault(); item.x = event.clientX; item.y = event.clientY;
    if (Math.hypot(item.x - item.startX, item.y - item.startY) >= 8) item.moved = true;
    if (!item.moved || item.tile === '.') return;
    if (item.resize) {
      const cols = Math.max(1, Math.min(5, item.cols + Math.round(2 * (item.x - item.startX) / (item.size + 5))));
      const rows = Math.max(1, Math.min(5, item.rows + Math.round(2 * (item.y - item.startY) / (item.size + 5))));
      if (cols !== now.current.board[0].length || rows !== now.current.board.length) commit({type: 'resize', rows, cols});
    } else setGesture({...item, hover: cellAt(item.x, item.y)});
  }
  function pointerUp(event) {
    const item = drag.current;
    if (!item || event.pointerId !== item.id) return;
    pointerMove(event); cancel(event);
    if (item.resize) return;
    if (!item.moved || item.tile === '.') {
      if (item.from) choose(item.from);
      else { setPicked(null); setHolding(previous => previous === item.tile ? null : item.tile); }
      return;
    }
    const at = cellAt(event.clientX, event.clientY);
    if (at) commit(item.from ? {type: 'relocate', from: item.from, at} : {type: 'place', tile: item.tile, at});
    else if (item.from) commit({type: 'place', tile: '.', at: item.from});
  }
  handlers.current = {move: pointerMove, up: pointerUp, cancel};
  const buildingGame = {...game, building: true, board: Rules.parse(state.board), solved: false,
    ui: {...game.ui, selected: picked, drag: gesture ? {from: gesture.from, hover: gesture.hover} : null},
    pointerDown: (event, from) => begin(event, {from, tile: state.board[from[0]][from[1]]}), choose,
    pointerCancel: cancel,
  };
  const busy = locked || !!game.ui.moving || !!gesture;
  return <section id="create" className="creator">
    <div className="wrap">
      <Heading sub="Build a start, find a target through legal moves, then solve your own puzzle.">Make a little puzzle of your own.</Heading>
      <div className="creator-layout">
        <div className="creator-guide">
          <ol className="creator-steps" aria-label="Creator stages">{STEPS.map((title, index) => <li key={title} aria-current={step === index ? 'step' : undefined}><span>{index + 1}</span><strong>{title}</strong></li>)}</ol>
          <p>{build ? 'Choose a tile, then tap a cell to place it. Drag from the palette, rearrange freely, or drag a tile off the grid to remove it.' : phase === 'SHAPE' ? 'Every tile follows its own rule now. Swap tiles until you find a target you like, then press Next.' : 'Make the board match your target. You have already built a legal route to it.'}</p>
          {build && <p>Drag the corner dot to resize. Hidden tiles return when you grow the grid. Next trims empty outer rows and columns.</p>}
          <div className="creator-purchase"><p>Try creating here. Publish your puzzles in Worlds.</p><button type="button" className="key" onClick={onUnlock}>Unlock Worlds</button><small>Drafts stay in this browser. They are not published or transferred to the game.</small></div>
        </div>
        <div ref={surface} className={'creator-editor' + (build ? ' building' : '')} onKeyDown={event => {
          if (event.key === 'Escape') { cancel(); game.pointerCancel(); setPicked(null); setHolding(null); }
          if (build && (event.key === 'Delete' || event.key === 'Backspace') && picked && !unavailable() && event.target.tagName !== 'SELECT') {
            event.preventDefault(); commit({type: 'place', tile: '.', at: picked});
          }
        }}>
          <h3 tabIndex={-1}>{STEPS[step]}</h3>
          <div className="creator-strip">
            {build && <div className="creator-palette" role="group" aria-label="Tile palette">{TILE_ORDER.map(tile => <button type="button" key={tile} className={'palette-tile' + (holding === tile ? ' selected' : '')} aria-label={`Place ${TILES[tile].name}. ${TILES[tile].rule}`} aria-pressed={holding === tile} disabled={busy}
              onLostPointerCapture={cancel} onPointerDown={event => begin(event, {tile})} onClick={event => { if (event.detail === 0 && !unavailable()) { setPicked(null); setHolding(previous => previous === tile ? null : tile); } }}><TileFace type={tile} /></button>)}</div>}
            {phase === 'SHAPE' && <p>{state.construction.length} {state.construction.length === 1 ? 'move' : 'moves'} to shape your target</p>}
            {phase === 'CHECK' && <div className="stage-target" role="img" aria-label={'Target: ' + state.target.map((row, r) => `row ${r + 1}: ${[...row].map(t => TILES[t]?.name || 'gap').join(', ')}`).join('; ')}><span>Target</span><TargetMini board={state.target} /></div>}
          </div>
          <div ref={game.platformRef} className="platform creator-platform" dir="ltr">
            <div className="creator-grid-shell">
              <Board game={build ? buildingGame : game} label="Creator puzzle board" />
              {build && <button type="button" className="creator-resize" onLostPointerCapture={cancel} aria-label="Resize grid. Use arrow keys or the row and column controls." onPointerDown={event => begin(event, {resize: true})} onKeyDown={event => {
                const offsets = {ArrowDown: [1, 0], ArrowUp: [-1, 0], ArrowRight: [0, 1], ArrowLeft: [0, -1]};
                if (!offsets[event.key] || unavailable()) return;
                event.preventDefault(); const [r, c] = offsets[event.key]; commit({type: 'resize', rows: Math.max(1, Math.min(5, state.board.length + r)), cols: Math.max(1, Math.min(5, state.board[0].length + c))});
              }} />}
            </div>
          </div>
          {build && <div className="creator-dimensions"><label>Rows<select value={state.board.length} disabled={busy} onChange={event => !unavailable() && commit({type: 'resize', rows: Number(event.target.value), cols: state.board[0].length})}>{[1, 2, 3, 4, 5].map(n => <option key={n}>{n}</option>)}</select></label><label>Columns<select value={state.board[0].length} disabled={busy} onChange={event => !unavailable() && commit({type: 'resize', rows: state.board.length, cols: Number(event.target.value)})}>{[1, 2, 3, 4, 5].map(n => <option key={n}>{n}</option>)}</select></label><button type="button" className="key" disabled={!picked || busy} onClick={() => picked && !unavailable() && commit({type: 'place', tile: '.', at: picked})}>Remove tile</button></div>}
          <div className="creator-controls"><button type="button" className="key" disabled={build || busy} onClick={() => control('back')}>Back</button><button type="button" className="key" disabled={busy} onClick={() => control('reset')}>{build ? 'Clear grid' : phase === 'SHAPE' ? 'Reset target' : 'Restart puzzle'}</button>{phase !== 'CHECK' && <button type="button" className="key primary" disabled={busy} onClick={() => control('next')}>Next</button>}</div>
          <p className={'creator-message' + (error ? ' error' : '')} role="status" aria-live="polite">{error || (phase === 'CHECK' && game.solved ? 'Puzzle solved. Restart to play again, or go Back to change your target.' : build && holding ? TILES[holding].rule : phase === 'CHECK' ? `${state.check.length} moves. Tap a tile and its destination, or drag to swap.` : 'Tap or drag tiles. Use the controls below the board at any time.')}</p>
          <p className="creator-storage" role="status">{notice || 'Draft saved automatically in this browser.'}</p>
        </div>
      </div>
      {gesture && !gesture.resize && gesture.tile !== '.' && <div className="creator-ghost" style={{left: gesture.x, top: gesture.y, '--cell': gesture.size + 'px'}} aria-hidden="true"><TileFace type={gesture.tile} /></div>}
    </div>
  </section>;
}
