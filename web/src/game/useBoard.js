import {useEffect, useRef, useState} from 'react';
import {PuzzleRules as Rules} from './rules.js';
import {PuzzleSolver} from './solver.js';

const IDLE = {selected: null, drag: null, moving: null, rejected: null, arrived: [], hint: null, bloom: null};
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export const same = (a, b) => !!a && !!b && a[0] === b[0] && a[1] === b[1];

/** One board's play state: tap or drag a tile along its rule to swap it. Timings follow the app. */
export function useBoard(level) {
  const [board, setBoard] = useState(() => Rules.parse(level.start));
  const [moves, setMoves] = useState(0);
  const [ui, setUI] = useState(IDLE);
  const live = useRef(board), uiNow = useRef(ui);
  live.current = board; uiNow.current = ui;
  const boardRef = useRef(null), tiles = useRef(new Map()), drag = useRef(null), frame = useRef(null);
  const busy = useRef(false), timers = useRef(new Set()), animations = useRef([]);
  const solved = !!level.target && Rules.key(board) === level.target.join('|');
  const solvedNow = useRef(solved); solvedNow.current = solved;

  const change = patch => setUI(previous => ({...previous, ...patch}));
  function later(run, ms) {
    const id = setTimeout(() => { timers.current.delete(id); run(); }, ms);
    timers.current.add(id);
  }
  function stopAll() {
    timers.current.forEach(clearTimeout); timers.current.clear();
    animations.current.forEach(animation => animation.cancel()); animations.current = [];
    cancelAnimationFrame(frame.current); frame.current = null;
    if (drag.current) drag.current.node.style.removeProperty('transform');
    drag.current = null; busy.current = false;
  }
  useEffect(() => stopAll, []);

  const tileAt = position => tiles.current.get(position.join(':'));
  const tileRef = (r, c) => node => { if (node) tiles.current.set(r + ':' + c, node); else tiles.current.delete(r + ':' + c); };

  function restart() {
    stopAll(); setBoard(Rules.parse(level.start)); setMoves(0); setUI(IDLE);
  }
  function reject(position) {
    change({rejected: position});
    later(() => change({rejected: null}), 240);
  }
  function move(a, b, offset = null) {
    if (busy.current || !Rules.isLegal(live.current, a, b)) return;
    const from = tileAt(a), to = tileAt(b);
    const fromRect = from.parentElement.getBoundingClientRect(), toRect = to.parentElement.getBoundingClientRect();
    const dx = toRect.left - fromRect.left, dy = toRect.top - fromRect.top, duration = reducedMotion() ? 0 : 185;
    busy.current = true;
    change({selected: null, drag: null, hint: null, moving: [a, b], arrived: []});
    const initial = offset ? `translate(${offset[0]}px,${offset[1]}px) scale(1.045)` : 'translate(0,0)';
    const timing = {duration, fill: 'forwards', easing: 'ease-out'};
    animations.current = [
      from.animate([{transform: initial}, {transform: `translate(${dx}px,${dy}px)`}], timing),
      to.animate([{transform: 'translate(0,0)'}, {transform: `translate(${-dx}px,${-dy}px)`}], timing),
    ];
    later(() => {
      const previous = live.current, next = Rules.swapCells(previous, a, b);
      animations.current.forEach(animation => animation.cancel()); animations.current = [];
      busy.current = false;
      const arrived = level.target ? [a, b].filter(([r, c]) => next[r][c] === level.target[r][c] && previous[r][c] !== next[r][c]) : [];
      // The moved tile leaves a bloom of its own colour where it lands, like the app's ink.
      setBoard(next); setMoves(count => count + 1); change({moving: null, arrived, bloom: {at: b, type: previous[a[0]][a[1]], id: Date.now()}});
      if (arrived.length) later(() => change({arrived: []}), 420);
    }, duration + 8);
  }
  function choose(position) {
    if (busy.current || drag.current || solvedNow.current) return;
    const current = live.current, selected = uiNow.current.selected;
    if (selected && Rules.isLegal(current, selected, position)) { move(selected, position); return; }
    if (selected && !same(selected, position)) { reject(selected); return; }
    // A tile with nowhere to go does not lift, as in the app.
    if (!Rules.legalMoves(current, ...position).length) { change({selected: null}); reject(position); return; }
    change({selected: same(selected, position) ? null : position, hint: null});
  }

  function pointerDown(event, position) {
    if (event.button !== 0 || busy.current || drag.current || solvedNow.current) return;
    event.preventDefault(); event.currentTarget.focus({preventScroll: true});
    const legal = Rules.legalMoves(live.current, ...position);
    // Geometry stays fixed for the gesture.
    const targets = legal.map(target => ({position: target, rect: tileAt(target).parentElement.getBoundingClientRect()}));
    drag.current = {from: position, node: event.currentTarget, startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, pointerId: event.pointerId, moved: false, hover: null, legal, targets};
    // Capture keeps the drag alive outside the board; without it the gesture still works inside.
    try { boardRef.current?.setPointerCapture?.(event.pointerId); } catch { /* pointer already gone */ }
  }
  function updateDrag(item) {
    if (!item.moved && Math.hypot(item.x - item.startX, item.y - item.startY) < 8) return;
    const started = !item.moved, previous = item.hover;
    item.moved = true;
    item.hover = item.targets.find(({rect}) => item.x >= rect.left && item.x <= rect.right && item.y >= rect.top && item.y <= rect.bottom)?.position || null;
    item.node.style.transform = `translate3d(${item.x - item.startX}px,${item.y - item.startY}px,0) scale(1.045)`;
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
    else if (item.hover) move(item.from, item.hover, [item.x - item.startX, item.y - item.startY]);
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

  return {board, moves, ui, solved, boardRef, tileRef, pointerDown, pointerMove, pointerUp, pointerCancel, choose, restart, hint};
}
