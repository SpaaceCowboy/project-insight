import React from 'react';
import {Dialog,BackButton} from './react-ui.jsx';
import {solved} from './game-state.js';

export default function GameMenus({game}) {
  const {state,dialogs,sound}=game;
  const complete=solved(state.attempt);
  return <>
    <Dialog dialogs={dialogs} className="menu-overlay" id="pauseOverlay" role="dialog" aria-modal="true" aria-labelledby="pauseTitle">
      <div className="menu-card pause-card"><h2 id="pauseTitle">Menu</h2><p id="pauseDescription">{state.config.levels[state.attempt.level].name}</p>
        <div className="menu-actions menu-stack">
          <button className="menu-main-btn primary" id="resumeBtn" onClick={game.resume}>{complete?'View result':'Resume'}</button>
          <button className="menu-main-btn" id="pauseLevelsBtn" onClick={game.leaveEditor}>Back to editor</button>
          <button className="menu-main-btn" id="pauseSettingsBtn" onClick={()=>game.openDialog('settingsOverlay',true)}>Options</button>
        </div>
      </div>
    </Dialog>
    <Dialog dialogs={dialogs} className="screen" id="settingsOverlay" role="dialog" aria-modal="true" aria-labelledby="settingsTitle">
      <div className="modal settings-card"><div className="screen-head"><BackButton id="closeSettings" onClick={()=>dialogs.close()} label="Back" data-close="settingsOverlay" /><div><h2 id="settingsTitle">Options</h2><p>Make yourself at home.</p></div></div>
        <section id="settingsPanel-sound" className="settings-panel">
          <div className="sound-controls"><label className="volume-control" htmlFor="ambienceSlider">Ambience <output id="ambienceValue">{Math.round(sound.preferences.ambience*100)}%</output><input id="ambienceSlider" value={Math.round(sound.preferences.ambience*100)} onChange={()=>{}} onInput={event=>sound.change('ambience',+event.currentTarget.value/100)} type="range" min="0" max="100" /></label>
            <label className="volume-control" htmlFor="volumeSlider">Effects <output id="volumeValue">{Math.round(sound.preferences.effects*100)}%</output><input id="volumeSlider" value={Math.round(sound.preferences.effects*100)} onChange={()=>{}} onInput={event=>sound.change('effects',+event.currentTarget.value/100)} type="range" min="0" max="100" /></label></div>
          <label className="voice-control"><input id="voiceToggle" type="checkbox" checked={sound.preferences.voice} onChange={event=>sound.change('voice',event.currentTarget.checked)} /> Spoken celebration</label>
          <div className="settings-options"><button className="menu-main-btn" id="settingsSoundBtn" onClick={()=>game.toggle('sound')} aria-pressed={state.sound}>Sound · {state.sound?'ON':'OFF'}</button><button className="menu-main-btn" id="themeBtn" onClick={()=>game.toggle('dark')}>{state.dark?'Dark Mode · ON':'Light Mode · ON'}</button></div>
        </section>
      </div>
    </Dialog>
  </>;
}
