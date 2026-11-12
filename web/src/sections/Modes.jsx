import {TargetMini} from '../game/Board.jsx';
import {TILES, TILE_ORDER} from '../game/tileArt.js';
import {LEVEL_COUNT, WORLDS_PRICE} from '../config.js';
import {Heading, Icon, Live, PlayButton, tilt} from '../ui.jsx';

export const WORLDS_INCLUDES = [
  'Puzzles made by other creators, with new ones arriving all the time',
  'Random: a fresh community puzzle whenever you want one',
  'Create: design a puzzle and share it',
  'Like or bookmark puzzles you enjoy, follow other puzzle designers, and earn community badges.',
];
const JOURNEY_INCLUDES = [
  `${LEVEL_COUNT} levels, every one of them free`,
  'Plays offline, with no account needed',
  'Daily streaks and badges',
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
          <p className="panel-sub">The single-player experience, free to play from the first level to the last.</p>
          {/* One flat target square per Journey level, in the six tile colours in turn. */}
          <Live once threshold={.5} className="trail" aria-hidden="true">
            {Array.from({length: LEVEL_COUNT}, (_, i) => <i key={i} className={'mini-cell ' + TILES[TILE_ORDER[i % 6]].cls} style={{'--i': i}} />)}
          </Live>
          <ul>{JOURNEY_INCLUDES.map(text => <Item key={text}>{text}</Item>)}</ul>
          <PlayButton />
        </article>
        <article className="panel worlds" {...tilt}>
          <div className="panel-head"><h3>Worlds</h3><span className="price">{WORLDS_PRICE || 'Pay once'}</span></div>
          <p className="panel-sub">Join the community of puzzle designers around the world. Make your own puzzles and share them with others.</p>
          <Live className="drifts" aria-hidden="true">
            <Drift boards={COMMUNITY.slice(0, 6)} />
            <Drift boards={COMMUNITY.slice(6)} reverse />
          </Live>
          <ul>{WORLDS_INCLUDES.map(text => <Item key={text}>{text}</Item>)}</ul>
          <button type="button" className="key invert" onClick={onUnlock}>Unlock Worlds</button>
          <p className="price-note">One payment, no subscription.</p>
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
