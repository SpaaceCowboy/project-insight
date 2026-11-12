import {TileFace} from '../game/Board.jsx';
import {TILE_ORDER} from '../game/tileArt.js';
import {SUPPORT_EMAIL} from '../config.js';
import {Live, Mark, PlayButton} from '../ui.jsx';

export default function Footer({onUnlock}) {
  return <>
    <section id="get" className="final">
      <div className="wrap">
        <Live className="wave" aria-hidden="true">
          {TILE_ORDER.map((type, i) => <span key={type} style={{'--i': i}}><TileFace type={type} /></span>)}
        </Live>
        <h2>Start the Journey for free. Open Worlds when you are ready.</h2>
        <div className="hero-cta">
          <PlayButton />
          <button type="button" className="key" onClick={onUnlock}>Unlock Worlds</button>
        </div>
      </div>
    </section>
    <footer className="site-footer">
      <div className="wrap">
        <a className="brand" href="#play" aria-label="Midori, back to top"><Mark /><span className="wordmark">MIDORI</span></a>
        <nav aria-label="Legal and contact">
          <a href="/privacy/">Privacy</a>
          <a href="/terms/">Terms</a>
          {SUPPORT_EMAIL && <a href={`mailto:${SUPPORT_EMAIL}`}>Contact</a>}
        </nav>
      </div>
    </footer>
  </>;
}
