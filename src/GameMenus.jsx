import React from 'react';
import {Hero} from './views.jsx';
import {Dialog,BackButton} from './react-ui.jsx';
import {solved} from './game-state.js';
import Creator from './Creator.jsx';

export default function GameMenus({game}) {
  const {state,dialogs,settingsTab,setSettingsTab,sound}=game,custom=state.config.custom,index=state.attempt.level;
  const complete=solved(state.attempt);
  function tabKeys(event,tab){if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const tabs=['play','sound','appearance'],i=tabs.indexOf(tab),next=event.key==='Home'?0:event.key==='End'?2:(i+(event.key==='ArrowRight'?1:2))%3;setSettingsTab(tabs[next]);document.getElementById('settingsTab-'+tabs[next]).focus()}
  return <>
    <Dialog dialogs={dialogs} className="menu-overlay home-screen" id="menuOverlay" role="dialog" aria-modal="true" aria-labelledby="menuTitle">
      <div className="home-panel">
        <div className="home-brand"><div className="menu-logo" id="menuTitle">INSIGHT</div><div className="menu-tagline">A little order. A little wonder.</div>
          <div className="menu-hero" id="menuHero" aria-hidden="true"><Hero /></div></div>
        <div className="home-main">
          <button className="menu-main-btn home-btn" id="singlePlayerBtn" onClick={game.showWorlds}>Single player</button>
          <button className="menu-main-btn home-btn" id="onlineBtn" onClick={()=>game.openDialog('onlineOverlay',true)}>Online</button>
          <button className="menu-main-btn home-btn" id="homeSettingsBtn" onClick={()=>game.openDialog('settingsOverlay',true)}>Options</button>
        </div>
        <div className="home-cubes">
          <button className="menu-main-btn home-cube" id="achievementsBtn" onClick={()=>game.showAchievements()}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4h8v5a4 4 0 0 1-8 0V4ZM8 6H4.5v1.5A3 3 0 0 0 8 10.5M16 6h3.5v1.5a3 3 0 0 1-3.5 3M12 13v4M8.5 20h7M10 17h4"/></svg>Achievements</button>
          <button className="menu-main-btn home-cube" id="logInBtn" aria-disabled="true"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8.5" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/></svg>Log In</button>
          <button className="menu-main-btn home-cube" id="whatsNextBtn" aria-disabled="true"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5 13.9 9l5.6 1.9-5.6 1.9L12 18.3l-1.9-5.5-5.6-1.9L10.1 9 12 3.5ZM19 16.5v3M17.5 18h3"/></svg>What's Next</button>
        </div>
      </div>
    </Dialog>
    <Dialog dialogs={dialogs} className="screen" id="onlineOverlay" role="dialog" aria-modal="true" aria-labelledby="onlineTitle">
      <div className="modal online-card"><div className="screen-head"><BackButton id="closeOnline" onClick={()=>dialogs.close()} label="Back" data-close="onlineOverlay" /><div><h2 id="onlineTitle">Online</h2></div></div>
        <div className="online-main">
          <button className="menu-main-btn home-btn" id="onlineCreateBtn" onClick={()=>game.openDialog('createOverlay',true)}>Create</button>
          <button className="menu-main-btn home-btn" id="onlinePlayBtn" aria-disabled="true">Play</button>
        </div>
      </div>
    </Dialog>
    <Dialog dialogs={dialogs} className="screen creator-screen" id="createOverlay" role="dialog" aria-modal="true" aria-labelledby="createTitle"><Creator dialogs={dialogs} sound={sound} /></Dialog>
    <Dialog dialogs={dialogs} className="menu-overlay" id="pauseOverlay" role="dialog" aria-modal="true" aria-labelledby="pauseTitle">
      <div className="menu-card pause-card"><h2 id="pauseTitle">Menu</h2><p id="pauseDescription">{'Level '+String(index+1).padStart(3,'0')+' · '+state.config.levels[index].name}</p>
        <div className="menu-actions menu-stack">
          <button className="menu-main-btn primary" id="resumeBtn" onClick={game.resume}>{complete?'View result':'Resume'}</button>
          <button className="menu-main-btn" id="pauseLevelsBtn" onClick={game.showLevels}>{custom?'Back to editor':'Levels'}</button>
          <button className="menu-main-btn" id="pauseSettingsBtn" onClick={()=>game.openDialog('settingsOverlay',true)}>Options</button>
          <button className="menu-main-btn" id="pauseAchievementsBtn" onClick={()=>game.showAchievements()}>Achievements</button>
          <button className="menu-main-btn" id="homeBtn" onClick={()=>game.openDialog('menuOverlay')}>Main Menu</button>
        </div>
      </div>
    </Dialog>
    <Dialog dialogs={dialogs} className="screen" id="settingsOverlay" role="dialog" aria-modal="true" aria-labelledby="settingsTitle">
      <div className="modal settings-card"><div className="screen-head"><BackButton id="closeSettings" onClick={()=>dialogs.close()} label="Back" data-close="settingsOverlay" /><div><h2 id="settingsTitle">Options</h2><p>Make yourself at home.</p></div></div>
        <div className="settings-tabs" role="tablist" aria-label="Settings sections">{['play','sound','appearance'].map((tab,i)=><button className="ui-btn" key={tab} id={'settingsTab-'+tab} role="tab" aria-controls={'settingsPanel-'+tab} aria-selected={settingsTab===tab} tabIndex={settingsTab===tab?0:-1} onClick={()=>setSettingsTab(tab)} onKeyDown={event=>tabKeys(event,tab)} data-settings-tab={tab}>{tab[0].toUpperCase()+tab.slice(1)}</button>)}</div>
        <section id="settingsPanel-play" role="tabpanel" aria-labelledby="settingsTab-play" className="settings-panel" hidden={settingsTab!=='play'}>
          <div className="settings-options"><button className="menu-main-btn menu-wide" id="devModeBtn" hidden={!!custom} onClick={game.toggleDev} aria-label="Developer mode" aria-pressed={state.dev}>Dev Mode · {state.dev?'ON':'OFF'}</button></div>
          <p className="settings-note" id="devModeNote">{custom?'Playtest progress is kept separate from the campaign.':'Developer Mode opens every campaign level. Achievements pause until you turn it off and restart.'}</p>
        </section>
        <section id="settingsPanel-sound" role="tabpanel" aria-labelledby="settingsTab-sound" className="settings-panel" hidden={settingsTab!=='sound'}>
          <div className="sound-controls"><label className="volume-control" htmlFor="ambienceSlider">Ambience <output id="ambienceValue">{Math.round(sound.preferences.ambience*100)}%</output><input id="ambienceSlider" value={Math.round(sound.preferences.ambience*100)} onChange={()=>{}} onInput={event=>sound.change('ambience',+event.currentTarget.value/100)} type="range" min="0" max="100" /></label>
            <label className="volume-control" htmlFor="volumeSlider">Effects <output id="volumeValue">{Math.round(sound.preferences.effects*100)}%</output><input id="volumeSlider" value={Math.round(sound.preferences.effects*100)} onChange={()=>{}} onInput={event=>sound.change('effects',+event.currentTarget.value/100)} type="range" min="0" max="100" /></label></div>
          <label className="voice-control"><input id="voiceToggle" type="checkbox" checked={sound.preferences.voice} onChange={event=>sound.change('voice',event.currentTarget.checked)} /> Spoken celebration</label>
          <button className="menu-main-btn menu-wide" id="settingsSoundBtn" onClick={()=>game.toggle('sound')} aria-pressed={state.sound}>Sound · {state.sound?'ON':'OFF'}</button>
        </section>
        <section id="settingsPanel-appearance" role="tabpanel" aria-labelledby="settingsTab-appearance" className="settings-panel" hidden={settingsTab!=='appearance'}>
          <div className="settings-options"><button className="menu-main-btn" id="themeBtn" onClick={()=>game.toggle('dark')}>{state.dark?'Dark Mode · ON':'Light Mode · ON'}</button><button className="menu-main-btn" id="appearanceBtn" onClick={()=>game.showAchievements('appearance')}>Themes &amp; tile finishes →</button></div>
          <p className="settings-note">Equip your cosmetic rewards from the Appearance collection.</p>
        </section>
      </div>
    </Dialog>
  </>;
}
