import {useState} from 'react';
import {LEVELS} from './game/levels.js';
import Header from './sections/Header.jsx';
import Hero from './sections/Hero.jsx';
import Intro from './sections/Intro.jsx';
import Tiles from './sections/Tiles.jsx';
import Modes from './sections/Modes.jsx';
import Worlds from './sections/Worlds.jsx';
import Screens from './sections/Screens.jsx';
import Faq from './sections/Faq.jsx';
import Footer, {FinalCall} from './sections/Footer.jsx';
import CheckoutSheet from './sections/CheckoutSheet.jsx';

export default function App() {
  const [index, setIndex] = useState(0);
  const [buying, setBuying] = useState(false);
  const unlock = () => setBuying(true);
  // "Try all six on the board" opens the last hero board, which has every tile.
  function tryAll() {
    setIndex(LEVELS.length - 1);
    document.getElementById('play').scrollIntoView();
  }
  return <>
    <Header onUnlock={unlock} />
    <main>
      <Hero index={index} setIndex={setIndex} onUnlock={unlock} />
      <Intro />
      <Tiles onTryAll={tryAll} />
      <Modes onUnlock={unlock} />
      <Worlds />
      <Screens />
      <Faq />
      <FinalCall onUnlock={unlock} />
    </main>
    <Footer />
    <CheckoutSheet shown={buying} onClose={() => setBuying(false)} />
  </>;
}
