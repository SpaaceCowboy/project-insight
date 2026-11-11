import {useEffect, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import {clampDrag, dropTarget, rewindMoves, SLIDE_MS, REWIND_MS, SLIDE_EASING} from './boardMotion.js';
import {PuzzleRules as Rules} from './rules.js';
import {PuzzleSolver} from './solver.js';

const IDLE = {selected: null, drag: null, moving: null, rejected: null, arrived: [], hint: null, bloom: null, resetting: false};
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export const same = (a, b) => !!a && !!b && a[0] === b[0] && a[1] === b[1];

/** One board's play state: tap or drag a tile along its rule to swap it. Timings follow the app. */
export function useBoard(level, options = {}) {
  const optionsNow = useRef(options); optionsNow.current = options;
  const levelNow = useRef(level); levelNow.current = level;
  const [board, setBoard] = useState(() => Rules.parse(options.initialBoard || level.start));
  const [moves, setMoves] = useState(0);
  const [ui, setUI] = useState(IDLE);
  const live = useRef(board), uiNow = useRef(ui);
  live.current = board; uiNow.current = ui;
  const boardRef = useRef(null), platformRef = useRef(null), tiles = useRef(new Map()), drag = useRef(null), frame = useRef(null);
  const generation = useRef(0);
  const busy = useRef(false), timers = useRef(new Set()), animations = useRef([]);
  const solved = !!level.target && Rules.key(board) === level.target.join('|');
  const solvedNow = useRef(solved); solvedNow.current = solved;

  const change = patch => setUI(previous => ({...previous, ...patch}));
  function later(run, ms) {
    const id = setTimeout(() => { timers.current.delete(id); run(); }, ms);
    timers.current.add(id);
  }
  function stopAll() {
    generation.current++;
    timers.current.forEach(clearTimeout); timers.current.clear();
    animations.current.forEach(animation => animation.cancel()); animations.current = [];
    cancelAnimationFrame(frame.current); frame.current = null;
    endDrag(); busy.current = false;
  }
  useEffect(() => {
    // Keep the gesture alive over the header and outside the board, including
    // browsers that accept pointer capture but subsequently lose it.
    window.addEventListener('pointermove', pointerMove, {passive: false});
    window.addEventListener('pointerup', pointerUp);
    window.addEventListener('pointercancel', pointerCancel);
    return () => {
      window.removeEventListener('pointermove', pointerMove);
      window.removeEventListener('pointerup', pointerUp);
      window.removeEventListener('pointercancel', pointerCancel);
      stopAll();
    };
  }, []);

  const tileAt = position => tiles.current.get(position.join(':'));
  const tileRef = (r, c) => node => { if (node) tiles.current.set(r + ':' + c, node); else tiles.current.delete(r + ':' + c); };

  // Animation transforms belong only to this transaction. Commit the new board and
  // remove them in the same task, so a recycled cell never retains the old offset.
  async function animateTiles(tracks, duration) {
    if (reducedMotion()) return true;
    const run = generation.current;
    const active = tracks.map(([node, from, to]) => node.animate(
      [{transform: `translate(${from[0]}px,${from[1]}px)`}, {transform: `translate(${to[0]}px,${to[1]}px)`}],
      {duration, fill: 'forwards', easing: SLIDE_EASING},
    ));
    animations.current = active;
    try { await Promise.all(active.map(animation => animation.finished)); }
    catch (error) {
      if (error.name !== 'AbortError') console.error('Board animation failed', error);
      if (run !== generation.current) return false;
    }
    return run === generation.current;
  }
  function clearAnimations() {
    animations.current.forEach(animation => animation.cancel()); animations.current = [];
  }
  const delta = (a, b) => {
    const from = tileAt(a).parentElement, to = tileAt(b).parentElement;
    return [to.offsetLeft - from.offsetLeft, to.offsetTop - from.offsetTop];
  };
  async function restart({immediate = false} = {}) {
    if (busy.current) return false;
    endDrag();
    timers.current.forEach(clearTimeout); timers.current.clear();
    const start = Rules.parse(level.start), plan = rewindMoves(live.current, start);
    if (!plan.some(([a, b]) => !same(a, b)) || reducedMotion()) {
      live.current = start; setBoard(start); setMoves(0); setUI(IDLE); return true;
    }
    busy.current = true;
    flushSync(() => setUI({...IDLE, resetting: true, moving: plan.map(([at]) => at)}));
    const run = generation.current;
    if (!immediate) await new Promise(resolve => setTimeout(resolve, 150));
    if (run !== generation.current) return false;
    const tracks = plan.filter(([a, b]) => !same(a, b)).map(([a, b]) => [tileAt(a), [0, 0], delta(a, b)]);
    if (!await animateTiles(tracks, REWIND_MS)) return false;
    flushSync(() => { live.current = start; setBoard(start); setMoves(0); setUI(IDLE); });
    clearAnimations(); busy.current = false;
    return true;
  }
  function replaceBoard(next) {
    stopAll();
    const parsed = Rules.parse(next);
    live.current = parsed; setBoard(parsed); setMoves(0); setUI(IDLE);
  }
  function reject(position) {
    change({rejected: position});
    later(() => change({rejected: null}), 240);
  }
  async function move(a, b, offset = [0, 0]) {
    if (busy.current || !Rules.isLegal(live.current, a, b) || optionsNow.current.beforeMove?.() === false) return;
    const previous = live.current, next = Rules.swapCells(previous, a, b);
    const [dx, dy] = delta(a, b);
    busy.current = true;
    flushSync(() => change({selected: null, drag: null, hint: null, moving: [a, b], arrived: [], rejected: null}));
    const finished = await animateTiles([
      [tileAt(a), offset, [dx, dy]],
      [tileAt(b), [0, 0], [-dx, -dy]],
    ], SLIDE_MS);
    if (!finished) return;
    const target = levelNow.current.target;
    const arrived = target ? [a, b].filter(([r, c]) => next[r][c] === target[r][c] && previous[r][c] !== next[r][c]) : [];
    const fromCell = tileAt(a).parentElement, toCell = tileAt(b).parentElement;
    const inkStyle = {left: (fromCell.offsetLeft + toCell.offsetLeft + fromCell.offsetWidth) / 2 + 'px',
      top: (fromCell.offsetTop + toCell.offsetTop + fromCell.offsetHeight) / 2 + 'px',
      width: Math.max(36, Math.hypot(dx, dy)) + 'px', '--angle': Math.atan2(dy, dx) + 'rad'};
    flushSync(() => {
      setBoard(next); setMoves(count => count + 1);
      change({moving: null, arrived, bloom: {at: b, style: inkStyle, type: previous[a[0]][a[1]], id: Date.now()}});
    });
    clearAnimations(); busy.current = false;
    optionsNow.current.onCommittedMove?.({from: a, at: b, board: next});
    if (arrived.length) later(() => change({arrived: []}), 420);
  }
  function choose(position) {
    if (busy.current || drag.current || solvedNow.current) return;
    const current = live.current, selected = uiNow.current.selected;
    if (selected && Rules.isLegal(current, selected, position)) { move(selected, position); return; }
    if (selected && !same(selected, position)) {
      if (Rules.legalMoves(current, ...position).length) change({selected: position, hint: null});
      else reject(selected);
      return;
    }
    // A tile with nowhere to go does not lift, as in the app.
    if (!Rules.legalMoves(current, ...position).length) { change({selected: null}); reject(position); return; }
    change({selected: same(selected, position) ? null : position, hint: null});
  }

  function pointerDown(event, position) {
    if (event.button !== 0 || busy.current || drag.current || solvedNow.current) return;
    event.preventDefault(); event.currentTarget.focus({preventScroll: true});
    const legal = Rules.legalMoves(live.current, ...position);
    // Freeze the same platform/cell geometry used by Android for this gesture.
    const cell = event.currentTarget.parentElement.getBoundingClientRect();
    const room = platformRef.current.getBoundingClientRect();
    const scale = cell.width / event.currentTarget.parentElement.offsetWidth;
    const centre = rect => ({x: (rect.left + rect.width / 2) / scale, y: (rect.top + rect.height / 2) / scale});
    const home = centre(cell), size = cell.width / scale, lifted = size * 1.045;
    const left = cell.left / scale - size * .0225, top = cell.top / scale - size * .0225;
    const bounds = [[room.left / scale + 4 - left, room.right / scale - 4 - lifted - left],
      [room.top / scale + 4 - top, room.bottom / scale - 4 - lifted - top]];
    const targets = legal.map(position => ({position, ...centre(tileAt(position).parentElement.getBoundingClientRect())}));
    drag.current = {from: position, node: event.currentTarget, startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, pointerId: event.pointerId, moved: false, hover: null, legal, targets, home, size, scale, bounds, offset: [0, 0]};
    // Capture keeps the drag alive outside the board; without it the gesture still works inside.
    try { boardRef.current?.setPointerCapture?.(event.pointerId); } catch { /* pointer already gone */ }
  }
  function updateDrag(item) {
    if (!item.moved && Math.hypot(item.x - item.startX, item.y - item.startY) < 8) return;
    const started = !item.moved, previous = item.hover;
    item.moved = true;
    item.offset = clampDrag([(item.x - item.startX) / item.scale, (item.y - item.startY) / item.scale], item.bounds);
    item.hover = dropTarget(item.home, item.offset, item.targets, item.size);
    item.node.style.transform = `translate(${item.offset[0]}px,${item.offset[1]}px) scale(1.045)`;
    if (started || previous !== item.hover) change({selected: null, hint: null, drag: {from: item.from, legal: item.legal, hover: item.hover}});
  }
  function endDrag() {
    const item = drag.current; drag.current = null;
    cancelAnimationFrame(frame.current); frame.current = null;
    if (!item) return null;
    item.node.style.removeProperty('transform');
    if (boardRef.current?.hasPointerCapture?.(item.pointerId)) boardRef.current.releasePointerCapture(item.pointerId);
    change({drag: null});
    return item;
  }
  function pointerMove(event) {
    const item = drag.current;
    if (!item || item.pointerId !== event.pointerId) return;
    event.preventDefault(); item.x = event.clientX; item.y = event.clientY;
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => { frame.current = null; if (drag.current === item) updateDrag(item); });
  }
  function pointerUp(event) {
    if (!drag.current || drag.current.pointerId !== event.pointerId) return;
    event.preventDefault();
    drag.current.x = event.clientX; drag.current.y = event.clientY; updateDrag(drag.current);
    const item = endDrag();
    if (!item.moved) choose(item.from);
    else if (item.hover) move(item.from, item.hover, item.offset);
    else reject(item.from);
  }
  function pointerCancel() { endDrag(); }

  /** Rings the next step of a shortest solution from where the board stands now. */
  function hint() {
    if (busy.current || solvedNow.current || !level.target) return;
    try {
      const current = live.current.map(row => row.join(''));
      const {path} = PuzzleSolver.solve({name: level.name, start: current, target: level.target}, {maxStates: 200000});
      if (!path.length) return;
      const width = current[0].length, cell = index => [Math.floor(index / width), index % width];
      change({selected: null, hint: path[0].map(cell)});
      later(() => change({hint: null}), 1600);
    } catch { /* no hint is better than a wrong one */ }
  }

  return {replaceBoard, isBusy: () => busy.current || !!drag.current, board, moves, ui, solved, boardRef, platformRef, tileRef, pointerDown, pointerMove, pointerUp, pointerCancel, choose, restart, hint};
}
