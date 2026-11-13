import {useEffect, useRef, useState} from 'react';
import {Board, MorphTarget, StillBoard, TargetMini} from '../game/Board.jsx';
import Guide from '../game/Guide.jsx';
import {useBoard} from '../game/useBoard.js';
import {GLOW_DELAY_MS, HOLD_MS, LEVEL_SLIDE_MS} from '../game/boardMotion.js';
import {LEVELS} from '../game/levels.js';
import {PlayButton, reducedMotion} from '../ui.jsx';

// GameScreen.kt: a swipe is 80dp of mostly sideways travel, a hold ends after the touch slop, the grid owns one gap around its cells.
const SWIPE = 80, SLOP = 8, GAP = 5;
/** A solved board moves on once its bloom (830ms) has played out. */
const SOLVED_HOLD_MS = 1000;

/** Screens.kt lampArt: an open bulb on its base, filled while the tips are showing. It keeps its colour on a solved board. */
function Lamp({lit}) {
  return <svg className={'lamp-art' + (lit ? ' lit' : '')} viewBox="0 0 24 24" aria-hidden="true">
    <path className="bulb" d="M8.46 13.2A5.5 5.5 0 1 1 15.54 13.2L14.5 16h-5Z" />
    <path d="M9.5 16 8.46 13.2A5.5 5.5 0 1 1 15.54 13.2L14.5 16h-5M10 19h4" />
  </svg>;
}

function Stage({level, picker, leaving, entering, shared, target, onAdvance, onSolved, onSwipe}) {
  const game = useBoard(level);
  shared.current = game.board;
  const [holding, setHolding] = useState(false);
  const [guide, setGuide] = useState(null);
  // How this platform arrived: sliding in after a swipe, or settling into place. Fixed at mount so the animation never restarts.
  const [arrival] = useState(entering);
  const press = useRef(null), lamp = useRef(null);
  // GameModel.guideSteps: the target comes right after the board.
  const steps = ['board', 'target', 'hold', 'swipe'];

  // No result bar: once the solve bloom has played, the next board slides in (the last one stays).
  useEffect(() => {
    if (!game.solved) return;
    onSolved(level.id);
    const id = setTimeout(onAdvance, SOLVED_HOLD_MS);
    return () => clearTimeout(id);
  }, [game.solved]);

  function endPress() {
    const item = press.current; press.current = null;
    if (!item) return;
    clearTimeout(item.glow); clearTimeout(item.hold);
    window.removeEventListener('pointermove', item.move);
    window.removeEventListener('pointerup', item.end);
    window.removeEventListener('pointercancel', item.end);
  }
  useEffect(() => endPress, []);

  /**
   * GameScreen.kt: hold the platform anywhere but on a tile and it sinks, lights its wall and sends the tiles back to
   * the start; swipe from anywhere but the grid to move between boards. The glow waits, so a swipe never lights it.
   */
  function platformDown(event) {
    if (event.button !== 0 || press.current || event.target.closest('.tile, .lamp')) return;
    game.deselect();
    const box = game.boardRef.current.getBoundingClientRect(), x = event.clientX, y = event.clientY, id = event.pointerId;
    const onGrid = x >= box.left - GAP && x <= box.right + GAP && y >= box.top - GAP && y <= box.bottom + GAP;
    const swipeable = !onGrid && !entering && !game.solved && !game.isBusy();
    let still = game.canRestart();
    if (!still && !swipeable) return;
    const item = {
      move(next) {
        if (next.pointerId !== id) return;
        const dx = next.clientX - x, dy = next.clientY - y;
        if (swipeable && Math.abs(dx) > SWIPE && Math.abs(dx) > 2 * Math.abs(dy)) { endPress(); setHolding(false); onSwipe(dx < 0 ? 1 : -1); return; }
        if (still && Math.hypot(dx, dy) > SLOP) { still = false; clearTimeout(item.glow); clearTimeout(item.hold); setHolding(false); }
        if (!still && !swipeable) endPress();
      },
      end(next) { if (next.pointerId === id) { endPress(); setHolding(false); } },
    };
    if (still) {
      if (!reducedMotion()) item.glow = setTimeout(() => setHolding(true), GLOW_DELAY_MS);
      item.hold = setTimeout(() => { endPress(); game.restart({immediate: true}); setHolding(false); }, HOLD_MS);
    }
    press.current = item;
    window.addEventListener('pointermove', item.move);
    window.addEventListener('pointerup', item.end);
    window.addEventListener('pointercancel', item.end);
  }

  function closeGuide() { setGuide(null); lamp.current?.focus({preventScroll: true}); }
  function advanceGuide() {
    const next = steps[steps.indexOf(guide) + 1];
    if (next) setGuide(next); else closeGuide();
  }

  return <>
    <div className="stage-rail">
      {leaving}
      <div className={'slot ' + (arrival ? 'entering' : 'settle')} style={arrival ? {'--dir': arrival} : undefined}>
        <div ref={game.platformRef} className={'platform' + (holding || game.ui.resetting ? ' held' : '')}
          onPointerDown={platformDown} onContextMenu={event => event.preventDefault()}>
          {/* The lamp is etched into the platform under the tiles, so a tile dragged over it covers it; its key sits on top.
              It travels with the platform during a slide; only its key waits for the slide to end. */}
          <Lamp lit={!!guide} />
          <Board game={game} label={`${level.name} board`} />
          {!entering && <button ref={lamp} type="button" className="lamp" onClick={() => setGuide(steps[0])} disabled={game.solved} aria-label="Gameplay tips" />}
        </div>
      </div>
    </div>
    {picker}
    {guide && <Guide step={guide} platform={game.platformRef} board={game.boardRef} target={target} onAdvance={advanceGuide} onEnd={closeGuide} />}
  </>;
}

export default function Hero({index, setIndex, onUnlock}) {
  const [done, setDone] = useState(() => new Set());
  // The board being left while the next one slides in (GameScreen.kt LevelSwap).
  const [swap, setSwap] = useState(null);
  const shared = useRef(null), target = useRef(null), latestGo = useRef(null);
  const level = LEVELS[index];

  function go(next) {
    if (next < 0 || next >= LEVELS.length || next === index || swap) return;
    if (!reducedMotion()) setSwap({level, board: shared.current.map(row => row.join('')), direction: next > index ? 1 : -1});
    setIndex(next);
  }
  latestGo.current = go;
  useEffect(() => {
    if (!swap) return;
    const id = setTimeout(() => setSwap(null), LEVEL_SLIDE_MS);
    return () => clearTimeout(id);
  }, [swap]);

  const picker = <div className="dots" role="group" aria-label="Choose a board">
    {LEVELS.map((item, i) => <button key={item.id} type="button" className={'key dot' + (done.has(item.id) ? ' done' : '')}
      aria-current={i === index} aria-label={`Board ${i + 1}, ${item.name}${done.has(item.id) ? ', solved' : ''}`}
      onClick={() => go(i)}>{i + 1}</button>)}
  </div>;
  const leaving = swap && <div className="slot leaving" style={{'--dir': swap.direction}} aria-hidden="true">
    <div className="platform"><Lamp /><StillBoard board={swap.board} /></div>
  </div>;

  return <section className="hero" id="play">
    {/* <HeroField /> (src/game/HeroField.jsx): the self-playing backdrop, parked for now. */}
    <div className="wrap">
      <div className="hero-copy">
        <h1><span>A calm tile-swapping puzzle</span></h1>
        <p className="hero-lede">Midori is a relaxing puzzle based on tile-swapping. Every tile moves by its own rule; swap them until the board matches the target. Try it right here.</p>
      </div>
      <div className="stage">
        <div ref={target} className="stage-target">
          {swap ? <MorphTarget from={swap.level.target} to={level.target} /> : <TargetMini board={level.target} />}
        </div>
        <Stage key={level.id} level={level} picker={picker} leaving={leaving} entering={swap?.direction}
          shared={shared} target={target} onAdvance={() => latestGo.current(index + 1)} onSwipe={direction => go(index + direction)}
          onSolved={id => setDone(previous => previous.has(id) ? previous : new Set(previous).add(id))} />
      </div>
      <div className="hero-cta">
        <PlayButton />
        <button type="button" className="key" onClick={onUnlock}>Unlock Worlds</button>
      </div>
    </div>
  </section>;
}
