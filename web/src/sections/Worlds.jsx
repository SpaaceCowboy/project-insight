import {TargetMini, TileFace} from '../game/Board.jsx';
import {TILE_ORDER} from '../game/tileArt.js';
import {COMMUNITY} from './Modes.jsx';
import {Heading, Icon, Live} from '../ui.jsx';

// Stand-ins until real captures of the app exist: the same drawn phones as "Quiet screens", one per part of Worlds.
const START = ['R', null, 'B', null, null, 'G', null, null, 'Y', null, 'P', null, null, null, 'W', null];
const PLAY = ['B', 'R', 'G', 'Y', 'P', 'W', 'R', 'G', 'B'];

export default function Worlds() {
  return <section id="worlds">
    <div className="wrap">
      <Heading sub="Build a puzzle, share it, follow the designers you like and play what they make.">Inside Worlds.</Heading>
      <Live className="phones four">
        <figure className="phone">
          <div className="phone-body">
            <div className="phone-bar"><span className="pk sq" /><span className="label">Create</span><span className="pk sq" /></div>
            <div className="mock-shelf">{TILE_ORDER.map(type => <TileFace key={type} type={type} />)}</div>
            <div className="mock-platform">
              <div className="mock-grid four">
                {START.map((type, i) => type ? <TileFace key={i} type={type} className="drop" /> : <span key={i} className="slot-empty" />)}
              </div>
            </div>
            <div className="pk wide">Next</div>
          </div>
          <figcaption>Create: build your start</figcaption>
        </figure>
        <figure className="phone">
          <div className="phone-body">
            <div className="phone-bar"><span className="pk sq" /><span className="label">Profile</span><span className="pk sq" /></div>
            <div className="mock-person"><span className="avatar" /><span className="bars"><i /><i /></span></div>
            <div className="mock-badges">{TILE_ORDER.slice(0, 5).map((type, i) => <TileFace key={type} type={type} className="badge" />)}</div>
            <div className="level-grid">
              {COMMUNITY.slice(0, 8).map((board, i) => <span key={i} className="pk" style={{'--i': i}}><TargetMini board={board} /></span>)}
            </div>
          </div>
          <figcaption>Profile: your puzzles and badges</figcaption>
        </figure>
        <figure className="phone">
          <div className="phone-body">
            <div className="phone-bar"><span className="pk sq" /><span className="label">Designers</span><span className="pk sq" /></div>
            {[0, 1, 2, 3, 4].map(i => <div key={i} className="mock-row" style={{'--i': i}}>
              <span className="avatar" /><span className="bars"><i /><i /></span>
              <span className={'pk follow' + (i === 1 ? ' turn' : i % 2 ? '' : ' on')}>{i === 1 ? <><b>Follow</b><b>Following</b></> : i % 2 ? 'Follow' : 'Following'}</span>
            </div>)}
          </div>
          <figcaption>Follow other designers</figcaption>
        </figure>
        <figure className="phone">
          <div className="phone-body">
            <div className="phone-bar"><span className="pk sq" /><span className="pk name"><i /></span><span className="pk sq" /></div>
            <div className="phone-bar"><span className="pk sq like"><Icon name="heart" /></span><TargetMini board={['GRB', 'YPW', 'BGR']} /><span className="pk sq"><Icon name="bookmark" /></span></div>
            <div className="mock-platform tall">
              <div className="mock-grid">{PLAY.map((type, i) => <TileFace key={i} type={type} className={i === 0 ? 'swap-out' : i === 1 ? 'swap-back' : ''} />)}</div>
            </div>
          </div>
          <figcaption>Play: like and bookmark</figcaption>
        </figure>
      </Live>
    </div>
  </section>;
}
