import React, {useEffect} from 'react';
import {View} from './views.jsx';
import {initGame} from '../game.js';
import AchievementsPanel from './AchievementsPanel.jsx';
import AchievementAnnouncer from './AchievementAnnouncer.jsx';
import GameMenus from './GameMenus.jsx';
import FeedbackUI from './FeedbackUI.jsx';

export default function GameApp() {
  useEffect(() => {
    let cleanup;
    const timer=setTimeout(() => {cleanup=initGame();document.documentElement.dataset.ready="true";document.getElementById("root").inert=false},0);
    return () => {clearTimeout(timer);cleanup?.()};
  },[]);
  return <>
<div className="ambient-lights" aria-hidden="true"><span></span><span></span></div>
<canvas id="fx" aria-hidden="true"></canvas>
<div className="app">
<header className="topbar">
  <div className="brand"><div className="brand-mark" aria-hidden="true"><svg viewBox="0 0 48 48" fill="none">
  <path d="M24 4 42 14 24 24 6 14 24 4Z M24 24 42 14v20L24 44 6 34V14" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
  <path d="M24 10 34 15.5 24 21 14 15.5 24 10Z M24 21v13 M14 15.5v13.4 M34 15.5v13.4" stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" opacity=".92"/>
  <path d="M14 28.9 24 34 34 28.9" stroke="currentColor" strokeWidth="1.15" opacity=".62"/>
</svg></div><div className="brand-name">INSIGHT</div></div>
  <div className="top-actions"><button className="ui-btn" id="menuBtn" aria-label="Pause game">Ⅱ <span>Pause</span></button><button className="ui-btn" id="levelsBtn" aria-label="Choose level">▦ <span>Levels</span></button><button className="ui-btn" id="soundBtn" aria-label="Mute sound"><View name="sound" /></button></div>
</header>
<main>
  <section className="level-meta">
    <div className="eyebrow" id="levelNo">LEVEL 01</div>
    <h1 id="levelName">The First Turn</h1>
  </section>
  <section className="target-area">
    <div className="target-label">Target</div>
    <div id="target" role="img" aria-label="Level target"><View name="target" /></div>
  </section>
  <section className="stats">
    <div className="stat"><strong id="moves">0</strong><span>Moves</span></div>
    <div className="stat"><strong id="par">—</strong><span>3★ par</span></div>
    <div className="stat"><strong id="starsTop">☆☆☆</strong><span>Best</span></div>
  </section>
  <section className="board-shell">
    <div className="board" id="board" role="group" aria-label="Puzzle board"><View name="board" /></div>
  </section>
  <div className="controls"><button className="control-btn" id="restartBtn">↶ Restart</button><button className="control-btn" id="undoBtn" disabled={true}>↶ Undo</button><button className="control-btn primary" id="levelsBtn2">Choose Level</button><button className="control-btn" id="nextBtn">Next →</button></div>
</main>
</div>

<GameMenus />
<div className="overlay" id="levelsOverlay" role="dialog" aria-modal="true" aria-labelledby="levelsTitle" inert={true}><div className="modal"><div className="modal-head"><div><h2 id="levelsTitle">106 Levels</h2><p id="levelsDescription">1 / 106 levels unlocked.</p></div><button className="close" aria-label="Close level selection" data-close="levelsOverlay">×</button></div><div id="worldTabs" role="tablist" aria-label="Choose world"><View name="worldTabs" /></div><div id="levelWorlds" role="tabpanel"><View name="levels" /></div></div></div>
<div className="overlay" id="emptyOverlay" role="dialog" aria-modal="true" aria-labelledby="emptyTitle" inert={true}><div className="win-card"><h2 id="emptyTitle">No moves left</h2><div className="win-actions"><button className="control-btn" id="emptyUndoBtn">Undo</button><button className="control-btn" id="emptyRestartBtn">Restart</button><button className="control-btn primary" id="emptyLevelsBtn">Choose another puzzle</button></div></div></div>
<div className="overlay" id="winOverlay" role="dialog" aria-modal="true" aria-labelledby="winTitle" inert={true}><div className="win-card"><div className="win-kicker">Grid solved</div><div className="win-title" id="winTitle">Perfect shift.</div><div className="big-stars" id="winStars">★★★</div><div className="win-meta" id="winMeta">0 moves</div><div id="winAchievementSummary"><View name="achievementUnlocks" /></div><div className="win-actions"><button className="control-btn" id="replayBtn">Replay</button><button className="control-btn primary" id="winNextBtn">Next →</button><button className="control-btn" id="winLevelsBtn" hidden={true}>Choose level</button></div></div></div>
<FeedbackUI />
<AchievementsPanel />
<AchievementAnnouncer />
<div className="sr-only" id="announcement" role="status" aria-live="polite" aria-atomic="true"></div>
  </>;
}
