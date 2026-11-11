import {useState} from 'react';
import {Icon, Mark} from '../ui.jsx';

function currentTheme() {
  return document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}

export default function Header({onUnlock}) {
  const [theme, setTheme] = useState(currentTheme);
  function toggle() {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('midori-theme', next); } catch { /* the choice just lasts for this visit */ }
    setTheme(next);
  }
  return <header className="site-header">
    <div className="wrap">
      <a className="brand" href="#play" aria-label="Midori, back to top"><Mark /><span className="wordmark">MIDORI</span></a>
      <nav className="site-nav" aria-label="Sections">
        <a href="#play">Play</a>
        <a href="#tiles">Tiles</a>
        <a href="#modes">Journey &amp; Worlds</a>
        <a href="#create">Create</a>
        <a href="#faq">Questions</a>
      </nav>
      <div className="header-actions">
        <button type="button" className="key icon" onClick={toggle} aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}>
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
        </button>
        <button type="button" className="key primary unlock" onClick={onUnlock}><span>Unlock Worlds</span></button>
      </div>
    </div>
  </header>;
}
