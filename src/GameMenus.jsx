import React from 'react';
import {View} from './views.jsx';

export default function GameMenus() {
  return <>
    <div className="overlay menu-overlay open" id="menuOverlay" role="dialog" aria-modal="true" aria-labelledby="menuTitle">
      <div className="menu-card home-card">
        <div className="menu-logo" id="menuTitle">INSIGHT</div><div className="menu-tagline">A little order. A little wonder.</div>
        <div className="menu-hero" id="menuHero" aria-hidden="true"><View name="hero" /></div>
        <div className="menu-progress" id="menuProgress"></div>
        <div className="menu-actions">
          <button className="menu-main-btn primary" id="playBtn">Play / Continue</button>
          <button className="menu-main-btn" id="newGameBtn">New Game</button><button className="menu-main-btn" id="menuLevelsBtn">Levels</button>
          <button className="menu-main-btn" id="editorBtn">My Puzzles · Editor</button><button className="menu-main-btn" id="achievementsBtn">Achievements</button>
          <button className="menu-main-btn menu-wide" id="homeSettingsBtn">Settings</button>
        </div>
      </div>
    </div>
    <div className="overlay menu-overlay" id="pauseOverlay" role="dialog" aria-modal="true" aria-labelledby="pauseTitle" inert={true}>
      <div className="menu-card pause-card"><div className="win-kicker">Take a breath</div><h2 id="pauseTitle">Paused</h2><p id="pauseDescription"></p>
        <div className="menu-actions">
          <button className="menu-main-btn primary" id="resumeBtn">Resume puzzle</button>
          <button className="menu-main-btn" id="pauseRestartBtn">Restart</button><button className="menu-main-btn" id="pauseLevelsBtn">Levels</button>
          <button className="menu-main-btn" id="pauseAchievementsBtn">Achievements</button><button className="menu-main-btn" id="pauseSettingsBtn">Settings</button>
          <button className="menu-main-btn menu-wide" id="homeBtn">Back to home</button>
        </div>
      </div>
    </div>
    <div className="overlay" id="settingsOverlay" role="dialog" aria-modal="true" aria-labelledby="settingsTitle" inert={true}>
      <div className="modal settings-card"><div className="modal-head"><div><h2 id="settingsTitle">Settings</h2><p>Make yourself at home.</p></div><button className="close" id="closeSettings" aria-label="Close settings" data-close="settingsOverlay">×</button></div>
        <div className="settings-tabs" role="tablist" aria-label="Settings sections">{['play','sound','appearance'].map((tab,i)=><button className="ui-btn" key={tab} id={'settingsTab-'+tab} role="tab" aria-controls={'settingsPanel-'+tab} aria-selected={i===0} tabIndex={i===0?0:-1} data-settings-tab={tab}>{tab[0].toUpperCase()+tab.slice(1)}</button>)}</div>
        <section id="settingsPanel-play" role="tabpanel" aria-labelledby="settingsTab-play" className="settings-panel">
          <div className="settings-options"><button className="menu-main-btn" id="modeBtn">Zen Mode · ON</button><button className="menu-main-btn" id="limitsBtn">Tile Limits · ON</button></div>
          <p className="settings-note" id="modeNote">Zen Mode keeps the experience quiet.</p>
          <div className="settings-divider"></div><div className="settings-options"><button className="menu-main-btn" id="devModeBtn" aria-label="Developer mode" aria-pressed="false">Dev Mode · OFF</button><button className="menu-main-btn" id="resetProgress">Reset Stars</button></div>
          <p className="settings-note" id="devModeNote">Developer Mode opens every campaign level. Achievements pause until you turn it off and restart.</p>
        </section>
        <section id="settingsPanel-sound" role="tabpanel" aria-labelledby="settingsTab-sound" className="settings-panel" hidden={true}>
          <div className="sound-controls"><label className="volume-control" htmlFor="ambienceSlider">Ambience <output id="ambienceValue">80%</output><input id="ambienceSlider" type="range" min="0" max="100" defaultValue="80" /></label>
            <label className="volume-control" htmlFor="volumeSlider">Effects <output id="volumeValue">80%</output><input id="volumeSlider" type="range" min="0" max="100" defaultValue="80" /></label></div>
          <label className="voice-control"><input id="voiceToggle" type="checkbox" defaultChecked={true} /> Spoken celebration</label>
          <button className="menu-main-btn menu-wide" id="settingsSoundBtn" aria-pressed="true">Sound · ON</button>
        </section>
        <section id="settingsPanel-appearance" role="tabpanel" aria-labelledby="settingsTab-appearance" className="settings-panel" hidden={true}>
          <div className="settings-options"><button className="menu-main-btn" id="themeBtn">Dark Mode · ON</button><button className="menu-main-btn" id="appearanceBtn">Themes &amp; tile finishes →</button></div>
          <p className="settings-note">Equip your cosmetic rewards from the Appearance collection.</p>
        </section>
      </div>
    </div>
  </>;
}
