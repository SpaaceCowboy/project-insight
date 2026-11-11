import {TargetMini, TileFace} from '../game/Board.jsx';
import {LEVEL_COUNT, WORLDS_PRICE} from '../config.js';
import {CountUp, Heading, Icon, Live, PlayButton, tilt} from '../ui.jsx';

export const WORLDS_INCLUDES = [
  'Puzzles made by other players, with new ones arriving all the time',
  'Random: a fresh community puzzle whenever you want one',
  'Create: design a board, prove it can be solved, and publish it',
];
const JOURNEY_INCLUDES = [
  `All ${LEVEL_COUNT} handcrafted levels, start to finish`,
  'Plays offline, with no account needed',
  'The Rulebook, with a free-play board for every tile',
  'No ads and nothing to buy along the way',
];
export const COMMUNITY = [['RB', 'BR'], ['GY', 'YG'], ['PWP'], ['RG', 'BY'], ['YYR', 'RBB'], ['BPB'], ['WR', 'GW'], ['RR', 'BB'], ['GPG', 'Y.Y'], ['BW', 'WB'], ['RYR'], ['PG', 'GP']];
const Item = ({children}) => <li><Icon name="check" /><span>{children}</span></li>;
const Drift = ({boards, reverse}) => <div className={'drift' + (reverse ? ' reverse' : '')}>
  {[0, 1, 2, 3].map(copy => <span key={copy}>{boards.map((board, i) => <b key={i}><TargetMini board={board} /></b>)}</span>)}
</div>;

export default function Modes({onUnlock}) {
  return <section id="modes" className="modes">
    <div className="wrap">
      <Heading sub="Midori has two halves, the same two keys you see on its home screen. One costs nothing. The other you buy once and keep.">Journey is free. Worlds is a one-time purchase.</Heading>
      <div className="mode-grid">
        <article className="panel journey" {...tilt}>
          <div className="panel-head"><h3>Journey</h3><span className="price">Free</span></div>
          <p className="panel-sub">The whole single-player game, free to play from the first level to the last.</p>
          <Live className="journey-scene" aria-hidden="true">
            <div className="journey-deck">
              <div className="journey-puzzle">
                {['B', 'R', 'G', 'Y', 'P', 'W', 'R', 'G', 'B'].map((type, i) =>
                  <TileFace key={i} type={type} className={i === 0 ? 'swap-out' : i === 1 ? 'swap-back' : ''} />)}
              </div>
            </div>
            <span className="journey-loose loose-purple"><TileFace type="P" /></span>
            <span className="journey-loose loose-yellow"><TileFace type="Y" /></span>
            <span className="journey-loose loose-green"><TileFace type="G" /></span>
            <span className="journey-loose loose-white"><TileFace type="W" /></span>
            <span className="journey-spark spark-one" /><span className="journey-spark spark-two" />
          </Live>
          <p className="panel-stat"><CountUp to={LEVEL_COUNT} /> levels, every one of them free</p>
          <ul>{JOURNEY_INCLUDES.map(text => <Item key={text}>{text}</Item>)}</ul>
          <PlayButton />
        </article>
        <article className="panel worlds" {...tilt}>
          <div className="panel-head"><h3>Worlds</h3><span className="price">{WORLDS_PRICE || 'Pay once'}</span></div>
          <p className="panel-sub">Play community puzzles and publish your own boards with a single purchase.</p>
          <Live className="drifts" aria-hidden="true">
            <Drift boards={COMMUNITY.slice(0, 6)} />
            <Drift boards={COMMUNITY.slice(6)} reverse />
          </Live>
          <p className="panel-stat">New boards from players, for as long as people keep making them</p>
          <ul>{WORLDS_INCLUDES.map(text => <Item key={text}>{text}</Item>)}</ul>
          <button type="button" className="key invert" onClick={onUnlock}>Unlock Worlds</button>
          <a className="creator-link" href="#create">Try the creator</a>
          <p className="price-note">{WORLDS_PRICE ? 'One payment. No subscription.' : 'One payment, no subscription. Price announced soon.'}</p>
        </article>
      </div>
      <p className="shared-features"><strong>Free for every player:</strong> profiles, likes, bookmarks, follows, XP and badges.</p>
      <ol className="how" aria-label="How buying Worlds works">
        <li><strong>Buy Worlds here</strong>One payment on this site, tied to your Midori account.</li>
        <li><strong>Sign in to the game</strong>Use the same account in Midori on your phone.</li>
        <li><strong>Worlds is open</strong>Play, create and publish. Journey stays free either way.</li>
      </ol>
    </div>
  </section>;
}
