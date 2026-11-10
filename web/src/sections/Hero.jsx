import {useEffect, useMemo, useState} from 'react';
import {Board, TargetMini, TileFace} from '../game/Board.jsx';
import HeroField from '../game/HeroField.jsx';
import {useBoard} from '../game/useBoard.js';
import {LEVELS, SANDBOX} from '../game/levels.js';
import {TILES, TILE_ORDER} from '../game/tileArt.js';
import {LEVEL_COUNT} from '../config.js';
import {Icon, Live, PlayButton} from '../ui.jsx';

/** Small tile-coloured squares thrown from the board when a level is solved. */
function Burst() {
  const pieces = useMemo(() => Array.from({length: 30}, (_, i) => {
    const angle = Math.random() * Math.PI * 2, reach = 110 + Math.random() * 150;
    return {
      cls: TILES[TILE_ORDER[i % 6]].cls,
      style: {'--x': Math.cos(angle) * reach + 'px', '--y': Math.sin(angle) * reach - 40 + 'px', '--r': Math.random() * 540 - 270 + 'deg', '--d': 300 + Math.random() * 160 + 'ms', '--s': 7 + Math.random() * 8 + 'px'},
    };
  }), []);
  return <span className="burst" aria-hidden="true">{pieces.map((piece, i) => <i key={i} className={piece.cls} style={piece.style} />)}</span>;
}

function Stage({level, last, picker, onNext, onSolved}) {
  const game = useBoard(level);
  const [won, setWon] = useState(false);
  // The win bar waits for the solve bloom, as in the app.
  useEffect(() => {
    if (!game.solved) { setWon(false); return; }
    onSolved(level.id);
    const wait = matchMedia('(prefers-reduced-motion: reduce)').matches ? 100 : 850;
    const id = setTimeout(() => setWon(true), wait);
    return () => clearTimeout(id);
  }, [game.solved]);

  const sandbox = !level.target;
  let note;
  if (won) note = <>
    <span>{last ? `Beautifully solved. ${LEVEL_COUNT - LEVELS.length} more are waiting in the game.` : 'Beautifully solved.'}</span>
    {!last && <button type="button" className="key primary" onClick={onNext}>Next<Icon name="next" /></button>}
  </>;
  else if (sandbox) note = <span>The Rulebook board: all six tiles, no target. Move them freely.</span>;
  else if (game.moves === 0) note = <span>Tap a tile, then where it should go, or drag it there. Make the board match the target.</span>;
  else note = <span>{game.moves} {game.moves === 1 ? 'move' : 'moves'}. No limit, no timer.</span>;

  return <>
    <div className="stage-top">
      <p className="stage-title"><span className="label">{sandbox ? 'Free play' : `Journey · level ${level.id}`}</span>{level.name}</p>
      {level.target && <div className="stage-target"><span className="label">Target</span><TargetMini board={level.target} /></div>}
    </div>
    <div className={'platform' + (game.solved ? ' solved' : '')}>
      <Board game={game} label={`${level.name} board`} />
      {game.solved && <Burst />}
    </div>
    <div className="stage-controls">
      <button type="button" className="key icon" onClick={game.restart} aria-label="Restart this board"><Icon name="restart" /></button>
      {!sandbox && <button type="button" className="key icon" onClick={game.hint} disabled={game.solved} aria-label="Show a hint"><Icon name="lamp" /></button>}
      {picker}
    </div>
    <p className={'stage-note' + (won ? ' win' : '')} role="status">{note}</p>
  </>;
}

const BAND = ['Journey is free', `${LEVEL_COUNT} handcrafted levels`, 'No timers', 'Six tiles, six rules', 'No ads', 'Plays offline'];

export default function Hero({index, setIndex, onUnlock}) {
  const [done, setDone] = useState(() => new Set());
  const all = [...LEVELS, SANDBOX], level = all[index];
  const picker = <div className="dots" role="group" aria-label="Choose a board">
    {all.map((item, i) => <button key={item.id} type="button" className={'key dot' + (done.has(item.id) ? ' done' : '')}
      aria-current={i === index} aria-label={item.target ? `Level ${item.id}, ${item.name}${done.has(item.id) ? ', solved' : ''}` : 'Rulebook free play'}
      onClick={() => setIndex(i)}>{item.target ? i + 1 : <Icon name="play" />}</button>)}
  </div>;
  return <>
    <section className="hero" id="play">
      <HeroField />
      <div className="wrap">
        <div className="hero-copy">
          <h1><span className="line"><span>A little order.</span></span><span className="line"><span>A little wonder.</span></span></h1>
          <p className="hero-lede">Midori is a calm tile-swapping puzzle for Android. Every tile moves by its own rule; swap them until the board matches the target. Try it right here.</p>
        </div>
        <div className="hero-more">
          <div className="hero-cta">
            <PlayButton />
            <button type="button" className="key" onClick={onUnlock}>Unlock Worlds</button>
          </div>
        </div>
        <div className="stage">
          <Stage key={level.id} level={level} last={index >= LEVELS.length - 1} picker={picker}
            onNext={() => setIndex(Math.min(index + 1, LEVELS.length - 1))}
            onSolved={id => setDone(previous => previous.has(id) ? previous : new Set(previous).add(id))} />
        </div>
      </div>
    </section>
    <Live className="band" aria-hidden="true">
      <div className="band-track">
        {[0, 1].map(copy => <ul key={copy}>
          {BAND.map((text, i) => <li key={text}><TileFace type={TILE_ORDER[i]} />{text}</li>)}
        </ul>)}
      </div>
    </Live>
  </>;
}
