import {useEffect, useState} from 'react';
import {TileFace} from '../game/Board.jsx';
import {PuzzleRules as Rules} from '../game/rules.js';
import {TILES, TILE_ORDER} from '../game/tileArt.js';
import {Heading, reducedMotion, useInView} from '../ui.jsx';

const shift = ([dr, dc]) => ({transform: `translate(calc(${dc} * var(--step)), calc(${dr} * var(--step)))`});

/** A 5×5 patch where the chosen tile keeps walking its own rule, out and back. */
function Demo({type, running}) {
  const moves = Rules.moves[type];
  const [at, setAt] = useState([0, 0]);
  useEffect(() => {
    setAt([0, 0]);
    if (!running || reducedMotion()) return;
    // White cannot start a move, so its demo shows Red swapping with it instead.
    const route = type === 'W' ? [[-1, 0], [0, 0]] : moves.flatMap(move => [move, [0, 0]]);
    let step = 0;
    const id = setInterval(() => { setAt(route[step % route.length]); step++; }, 900);
    return () => clearInterval(id);
  }, [type, running]);
  const reach = new Set(moves.map(([dr, dc]) => (2 + dr) * 5 + 2 + dc));
  const carried = type === 'W' && at[0] === -1;
  return <div className={'demo ' + TILES[type].cls} aria-hidden="true">
    <div className="demo-cells">{Array.from({length: 25}, (_, i) => <i key={i} className={reach.has(i) ? 'to' : undefined} />)}</div>
    <div className="demo-actors">
      {type === 'W' && <span className="actor helper" style={shift(carried ? [1, 0] : [0, 0])}><TileFace type="R" /></span>}
      <span className="actor" style={shift(at)}><TileFace type={type} /></span>
    </div>
  </div>;
}

export default function Tiles({onSandbox}) {
  const [type, setType] = useState('R');
  const [auto, setAuto] = useState(true);
  const [ref, inView] = useInView({threshold: .3});
  // Walk through all six on its own until the visitor picks one.
  useEffect(() => {
    if (!auto || !inView || reducedMotion()) return;
    const id = setInterval(() => setType(current => TILE_ORDER[(TILE_ORDER.indexOf(current) + 1) % 6]), 5400);
    return () => clearInterval(id);
  }, [auto, inView]);
  const tile = TILES[type];
  return <section id="tiles">
    <div className="wrap">
      <Heading sub="A tile's symbol is its rule. Learn to read them and every board becomes a small map of what can go where.">Meet the six.</Heading>
      <div ref={ref} className="showcase">
        <div className="picks" role="group" aria-label="Choose a tile">
          {TILE_ORDER.map(key => <button key={key} type="button" className="pick" aria-pressed={key === type}
            onClick={() => { setType(key); setAuto(false); }}>
            <TileFace type={key} /><span>{TILES[key].title}</span>
          </button>)}
        </div>
        <div className="showcase-stage"><Demo type={type} running={inView} /></div>
        <div className="showcase-copy" aria-live="polite">
          <h3 key={type}>{tile.title}</h3>
          <p key={type + 'rule'} className="rule">{tile.rule}</p>
          <button type="button" className="key" onClick={onSandbox}>Try all six on the board</button>
        </div>
      </div>
    </div>
  </section>;
}
