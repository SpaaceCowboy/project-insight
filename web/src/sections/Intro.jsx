import {LEVEL_COUNT} from '../config.js';
import {CountUp, useInView} from '../ui.jsx';

export default function Intro() {
  const [ref, inView] = useInView({once: true, threshold: .35});
  return <section id="about">
    <div className="wrap">
      <h2 ref={ref} className={'statement' + (inView ? ' in' : '')}>
        One board. One target. Tiles with minds of their own.
      </h2>
      <dl className="facts">
        <div><dt><CountUp to={LEVEL_COUNT} /></dt><dd>levels in Journey, with intuitive progression and increasing complexity.</dd></div>
        <div><dt><CountUp to={6} /></dt><dd>kinds of tile. The symbol on each one is the rule it follows.</dd></div>
        <div><dt><CountUp to={0} /></dt><dd>regressive elements like timers, move limits, stars or ads. There are no wrong moves.</dd></div>
      </dl>
    </div>
  </section>;
}
