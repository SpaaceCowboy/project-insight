import {TargetMini} from '../game/Board.jsx';
import {LEVEL_COUNT, WORLDS_PRICE} from '../config.js';
import {CountUp, Heading, Icon, Live, PlayButton, tilt} from '../ui.jsx';

export const WORLDS_INCLUDES = [
  'Puzzles made by other players, with new ones arriving all the time',
  'Random: a fresh community puzzle whenever you want one',
  'Create: design a board, prove it can be solved, and publish it',
  'A profile, with likes, bookmarks, follows, XP and badges',
];
const JOURNEY_INCLUDES = [
  `All ${LEVEL_COUNT} handcrafted levels, start to finish`,
  'Plays offline, with no account needed',
  'The Rulebook, with a free-play board for every tile',
  'No ads and nothing to buy along the way',
];
// One colour per stretch of twenty levels, as the level studio groups them.
const STRETCH = ['#93D2DB', '#E09A91', '#A6D7AD', '#F0D38B', '#C9B8E1', '#8FD9C9', '#F0B48C', '#A4B4EC', '#C5D98F', '#E8A3CF', '#E4ECDF'];
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
          <Live once threshold={.5} className="trail" aria-hidden="true">
            {Array.from({length: LEVEL_COUNT}, (_, i) => <i key={i} style={{'--c': STRETCH[Math.floor(i / 20)], '--i': i}} />)}
          </Live>
          <p className="panel-stat"><CountUp to={LEVEL_COUNT} /> levels, every one of them free</p>
          <ul>{JOURNEY_INCLUDES.map(text => <Item key={text}>{text}</Item>)}</ul>
          <PlayButton />
        </article>
        <article className="panel worlds" {...tilt}>
          <div className="panel-head"><h3>Worlds</h3><span className="price">{WORLDS_PRICE || 'Pay once'}</span></div>
          <p className="panel-sub">Everything players build for each other, opened with a single purchase.</p>
          <Live className="drifts" aria-hidden="true">
            <Drift boards={COMMUNITY.slice(0, 6)} />
            <Drift boards={COMMUNITY.slice(6)} reverse />
          </Live>
          <p className="panel-stat">New boards from players, for as long as people keep making them</p>
          <ul>{WORLDS_INCLUDES.map(text => <Item key={text}>{text}</Item>)}</ul>
          <button type="button" className="key invert" onClick={onUnlock}>Unlock Worlds</button>
          <p className="price-note">{WORLDS_PRICE ? 'One payment. No subscription.' : 'One payment, no subscription. Price announced soon.'}</p>
        </article>
      </div>
      <ol className="how" aria-label="How buying Worlds works">
        <li><strong>Buy Worlds here</strong>One payment on this site, tied to your Midori account.</li>
        <li><strong>Sign in to the game</strong>Use the same account in Midori on your phone.</li>
        <li><strong>Worlds is open</strong>Play, create and publish. Journey stays free either way.</li>
      </ol>
    </div>
  </section>;
}
