import {useState} from 'react';
import {LEVELS} from './game/levels.js';
import Header from './sections/Header.jsx';
import Hero from './sections/Hero.jsx';
import Intro from './sections/Intro.jsx';
import Tiles from './sections/Tiles.jsx';
import Modes from './sections/Modes.jsx';
import Create from './sections/Create.jsx';
import Screens from './sections/Screens.jsx';
import Faq from './sections/Faq.jsx';
import Footer from './sections/Footer.jsx';
import CheckoutSheet from './sections/CheckoutSheet.jsx';

export default function App() {
  const [index, setIndex] = useState(0);
  const [buying, setBuying] = useState(false);
  const unlock = () => setBuying(true);
  function sandbox() {
    setIndex(LEVELS.length);
    document.getElementById('play').scrollIntoView();
  }
  return <>
    <Header onUnlock={unlock} />
    <main>
      <Hero index={index} setIndex={setIndex} onUnlock={unlock} />
      <Intro />
      <Tiles onSandbox={sandbox} />
      <Modes onUnlock={unlock} />
      <Create onUnlock={unlock} />
      <Screens />
      <Faq />
      <Footer onUnlock={unlock} />
    </main>
    <CheckoutSheet shown={buying} onClose={() => setBuying(false)} />
  </>;
}
