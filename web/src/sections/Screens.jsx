import {TargetMini} from '../game/Board.jsx';
import {LEVEL_COUNT} from '../config.js';
import {COMMUNITY} from './Modes.jsx';
import {Heading, Live, Mark} from '../ui.jsx';

/** Drawn with the site's own parts rather than screenshots, so they follow the theme. */
export default function Screens() {
  return <section id="screens">
    <div className="wrap">
      <Heading sub="Midori keeps out of the way: two keys on the home screen, a grid of puzzles, and a place for what players create.">Quiet screens, big keys.</Heading>
      <Live className="phones">
        <figure className="phone">
          <div className="phone-body">
            <div className="phone-bar"><span className="pk sq" /><span className="wordmark">MIDORI</span><span className="pk sq" /></div>
            <div className="pk big first">Journey</div>
            <div className="pk big second">Worlds</div>
          </div>
          <figcaption>Home: Journey and Worlds</figcaption>
        </figure>
        <figure className="phone">
          <div className="phone-body">
            <div className="phone-bar"><span className="pk sq" /><span className="label">Journey</span><span className="pk sq" /></div>
            <div className="level-grid fill">
              {Array.from({length: 24}, (_, i) => <span key={i} className={'pk' + (i < 9 ? ' solved' : i === 9 ? ' on' : '')} style={{'--i': i}}>{i + 1}</span>)}
            </div>
          </div>
          <figcaption>{LEVEL_COUNT} levels, one after another</figcaption>
        </figure>
        <figure className="phone">
          <div className="phone-body">
            <div className="phone-bar"><span className="pk sq" /><Mark /><span className="pk sq" /></div>
            <div className="level-grid">
              {COMMUNITY.map((board, i) => <span key={i} className="pk" style={{'--i': i}}><TargetMini board={board} /></span>)}
            </div>
            <div className="phone-row"><span className="pk">Random</span><span className="pk">Create</span></div>
          </div>
          <figcaption>Worlds: puzzles by players</figcaption>
        </figure>
      </Live>
    </div>
  </section>;
}
