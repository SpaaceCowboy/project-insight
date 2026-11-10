import {TileFace} from '../game/Board.jsx';
import {LEVEL_COUNT} from '../config.js';
import {CountUp, useInView} from '../ui.jsx';

const T = ({type}) => <TileFace type={type} className="inline" />;

export default function Intro() {
  const [ref, inView] = useInView({once: true, threshold: .35});
  return <section id="about">
    <div className="wrap">
      <h2 ref={ref} className={'statement' + (inView ? ' in' : '')}>
        One board. One target. Tiles with minds of their own: <T type="R" /> slides, <T type="G" /> steps aside, <T type="P" /> leaps, and <T type="W" /> waits to be moved.
      </h2>
      <dl className="facts">
        <div><dt><CountUp to={LEVEL_COUNT} /></dt><dd>handcrafted levels, each checked to be solvable and fair.</dd></div>
        <div><dt><CountUp to={6} /></dt><dd>kinds of tile. The symbol on each one is the rule it follows.</dd></div>
        <div><dt><CountUp to={0} /></dt><dd>timers, move limits, stars or ads. A wrong move is simply declined.</dd></div>
      </dl>
    </div>
  </section>;
}
