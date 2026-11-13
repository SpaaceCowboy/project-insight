import {SUPPORT_EMAIL} from '../config.js';
import {Mark, PlayButton} from '../ui.jsx';

export function FinalCall({onUnlock}) {
  return <section id="get" className="final">
    <div className="wrap">
      <h2>Start the Journey. Open Worlds when you are ready.</h2>
      <div className="hero-cta">
        <PlayButton />
        <button type="button" className="key" onClick={onUnlock}>Unlock Worlds</button>
      </div>
    </div>
  </section>;
}

/** On the home page the mark goes back to the top; on the legal pages it goes home. */
export default function Footer({home = '#play'}) {
  return <footer className="site-footer">
    <div className="wrap">
      <a className="brand" href={home} aria-label={home === '/' ? 'Midori home' : 'Midori, back to top'}><Mark /><span className="wordmark">MIDORI</span></a>
      <nav aria-label="Legal and contact">
        <a href="/privacy/">Privacy</a>
        <a href="/terms/">Terms</a>
        {SUPPORT_EMAIL && <a href={`mailto:${SUPPORT_EMAIL}`}>Contact</a>}
      </nav>
    </div>
  </footer>;
}
