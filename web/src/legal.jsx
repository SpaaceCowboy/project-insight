import {StrictMode, useState} from 'react';
import {createRoot} from 'react-dom/client';
import './styles/tokens.css';
import './styles/site.css';
import Header from './sections/Header.jsx';
import Footer from './sections/Footer.jsx';
import CheckoutSheet from './sections/CheckoutSheet.jsx';
import {installPress} from './ui.jsx';

// The privacy and terms pages: their text is static HTML; this adds the site's header (mark, theme, Worlds) and footer around it.
function Top() {
  const [buying, setBuying] = useState(false);
  return <>
    <Header sections={false} onUnlock={() => setBuying(true)} />
    <CheckoutSheet shown={buying} onClose={() => setBuying(false)} />
  </>;
}

installPress();
createRoot(document.getElementById('top')).render(<StrictMode><Top /></StrictMode>);
createRoot(document.getElementById('bottom')).render(<StrictMode><Footer home="/" /></StrictMode>);
