import React from 'react';
import {Hero} from './views.jsx';
import {Dialog} from './react-ui.jsx';
import {solved} from './game-state.js';

export default function GameMenus({game}) {
  const {state,dialogs,settingsTab,setSettingsTab,sound}=game,custom=state.config.custom,index=state.attempt.level;
  const complete=solved(state.attempt),count=state.config.levels.length;
  const playLabel=custom?(complete?'Back to editor':state.attempt.moves?'Resume playtest':'Playtest'):complete?(index<count-1?'Next puzzle →':'Replay final'):state.attempt.moves?'Resume · Level '+String(index+1).padStart(3,'0'):'Play · Level '+String(index+1).padStart(3,'0');
  function tabKeys(event,tab){if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const tabs=['play','sound','appearance'],i=tabs.indexOf(tab),next=event.key==='Home'?0:event.key==='End'?2:(i+(event.key==='ArrowRight'?1:2))%3;setSettingsTab(tabs[next]);document.getElementById('settingsTab-'+tabs[next]).focus()}
  return <>
    <Dialog dialogs={dialogs} className="menu-overlay" id="menuOverlay" role="dialog" aria-modal="true" aria-labelledby="menuTitle">
      <div className="menu-card home-card">
        <div className="menu-logo" id="menuTitle">INSIGHT</div><div className="menu-tagline">A little order. A little wonder.</div>
        <div className="menu-hero" id="menuHero" aria-hidden="true"><Hero /></div>
        <div className="menu-progress" id="menuProgress">{custom?'Custom puzzle · Progress kept separate':state.dev?'Developer Mode · All '+count+' levels unlocked':'Game '+state.config.game+' · Level '+state.unlocked+' / '+count}</div>
        <div className="menu-actions">
          <button className="menu-main-btn primary" id="playBtn" onClick={game.continuePlay}>{playLabel}</button>
          <button className="menu-main-btn" id="newGameBtn" hidden={!!custom} onClick={()=>game.newGame(1)}>New Game 1</button><button className="menu-main-btn" id="newGame2Btn" hidden={!!custom} onClick={()=>game.newGame(2)}>New Game 2</button><button className="menu-main-btn" id="menuLevelsBtn" onClick={game.showLevels}>{custom?'Back to editor':'Levels'}</button>
          <button className="menu-main-btn" id="editorBtn" hidden={!!custom} onClick={game.leaveEditor}>My Puzzles · Editor</button><button className="menu-main-btn" id="achievementsBtn" onClick={()=>game.showAchievements()}>Achievements</button>
          <button className={"menu-main-btn"+(custom?" menu-wide":"")} id="homeSettingsBtn" onClick={()=>game.openDialog('settingsOverlay',true)}>Settings</button>
        </div>
      </div>
    </Dialog>
    <Dialog dialogs={dialogs} className="menu-overlay" id="pauseOverlay" role="dialog" aria-modal="true" aria-labelledby="pauseTitle">
      <div className="menu-card pause-card"><div className="win-kicker">Take a breath</div><h2 id="pauseTitle">Paused</h2><p id="pauseDescription">{'Level '+String(index+1).padStart(3,'0')+' · '+state.config.levels[index].name}</p>
        <div className="menu-actions">
          <button className="menu-main-btn primary" id="resumeBtn" onClick={game.resume}>{complete?'View result':'Resume puzzle'}</button>
          <button className="menu-main-btn" id="pauseRestartBtn" onClick={game.restart}>Restart</button><button className="menu-main-btn" id="pauseLevelsBtn" onClick={game.showLevels}>{custom?'Back to editor':'Levels'}</button>
          <button className="menu-main-btn" id="pauseAchievementsBtn" onClick={()=>game.showAchievements()}>Achievements</button><button className="menu-main-btn" id="pauseSettingsBtn" onClick={()=>game.openDialog('settingsOverlay',true)}>Settings</button>
          <button className="menu-main-btn menu-wide" id="homeBtn" onClick={()=>game.openDialog('menuOverlay')}>Back to home</button>
        </div>
      </div>
    </Dialog>
    <Dialog dialogs={dialogs} id="settingsOverlay" role="dialog" aria-modal="true" aria-labelledby="settingsTitle">
      <div className="modal settings-card"><div className="modal-head"><div><h2 id="settingsTitle">Settings</h2><p>Make yourself at home.</p></div><button className="close" id="closeSettings" onClick={()=>dialogs.close()} aria-label="Close settings" data-close="settingsOverlay">×</button></div>
        <div className="settings-tabs" role="tablist" aria-label="Settings sections">{['play','sound','appearance'].map((tab,i)=><button className="ui-btn" key={tab} id={'settingsTab-'+tab} role="tab" aria-controls={'settingsPanel-'+tab} aria-selected={settingsTab===tab} tabIndex={settingsTab===tab?0:-1} onClick={()=>setSettingsTab(tab)} onKeyDown={event=>tabKeys(event,tab)} data-settings-tab={tab}>{tab[0].toUpperCase()+tab.slice(1)}</button>)}</div>
        <section id="settingsPanel-play" role="tabpanel" aria-labelledby="settingsTab-play" className="settings-panel" hidden={settingsTab!=='play'}>
          <div className="settings-options"><button className="menu-main-btn" id="modeBtn" onClick={()=>game.toggle('zen')}>{state.zen?'Zen Mode · ON':'Star Mode · ON'}</button><button className="menu-main-btn" id="limitsBtn" disabled={!!custom && !custom.fitsLimits} aria-pressed={state.limits} onClick={game.toggleLimits}>{custom && !custom.fitsLimits?'Classic only':state.limits?'Tile Limits · ON':'Tile Limits · OFF'}</button></div>
          <p className="settings-note" id="modeNote">{state.zen?'Zen Mode keeps the experience quiet. Turn on Star Mode to see moves, par and stars while you play.':'Star Mode shows the moves, 3★ par and your best stars while you play.'}</p>
          <div className="settings-divider"></div><div className="settings-options"><button className="menu-main-btn" id="devModeBtn" hidden={!!custom} onClick={game.toggleDev} aria-label="Developer mode" aria-pressed={state.dev}>Dev Mode · {state.dev?'ON':'OFF'}</button><button className="menu-main-btn" id="resetProgress" hidden={!!custom} onClick={game.resetStars}>{state.limits?'Reset Tile Limits stars':'Reset Classic stars'}</button></div>
          <p className="settings-note" id="devModeNote" hidden={!!custom}>Developer Mode opens every campaign level. Achievements pause until you turn it off and restart.</p>
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
