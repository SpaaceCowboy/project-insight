import React from 'react';
import useGame from './useGame.js';
import {GameBoard,Target,WorldTabs,Levels,AchievementUnlocks} from './views.jsx';
import {Dialog,ColorStrokes,Particles} from './react-ui.jsx';
import {bounds} from './board-layout.js';
import {solved,canAccess,parFor,starsFor,starText} from './game-state.js';
import {PuzzleArt} from './data.js';
import GameMenus from './GameMenus.jsx';
import FeedbackUI from './FeedbackUI.jsx';
import AchievementsPanel from './AchievementsPanel.jsx';
import AchievementAnnouncer from './AchievementAnnouncer.jsx';

export default function GameApp() {
  const game=useGame(),{state,ui,dialogs}=game,{attempt,config}=state,spec=config.levels[attempt.level],custom=config.custom;
  const rows=attempt.board.length,cols=attempt.board[0].length,shape=bounds(attempt.board),target=bounds(attempt.target);
  const targetRows=target.maxR-target.minR+1,targetCols=target.maxC-target.minC+1;
  const targetCells=attempt.target.slice(target.minR,target.maxR+1).flatMap(row=>row.slice(target.minC,target.maxC+1));
  const complete=solved(attempt),par=parFor(state),stars=starsFor(attempt.moves,par),final=attempt.level===config.levels.length-1;
  const targetLabel='Target arrangement: '+attempt.target.map((row,i)=>'row '+(i+1)+': '+row.map(type=>PuzzleArt.META[type]?.name || 'gap').join(', ')).join('; ');
  if(config.error)return null;
  return <>
    <div className="ambient-lights" aria-hidden="true"><span></span><span></span></div>
    <Particles burst={ui.burst} />
    <div className={'app'+(state.zen?' zen-mode':'')} inert={!!dialogs.active}>
      <header className="topbar">
  <div className="brand"><div className="brand-mark" aria-hidden="true"><svg viewBox="0 0 48 48" fill="none">
  <path d="M24 4 42 14 24 24 6 14 24 4Z M24 24 42 14v20L24 44 6 34V14" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
  <path d="M24 10 34 15.5 24 21 14 15.5 24 10Z M24 21v13 M14 15.5v13.4 M34 15.5v13.4" stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" opacity=".92"/>
  <path d="M14 28.9 24 34 34 28.9" stroke="currentColor" strokeWidth="1.15" opacity=".62"/>
</svg></div><div className="brand-name">INSIGHT</div></div>

        <div className="top-actions"><button className="ui-btn" id="menuBtn" aria-label="Pause game" onClick={()=>game.openDialog('pauseOverlay')}>Ⅱ <span>Pause</span></button><button className="ui-btn" id="levelsBtn" aria-label={custom?'Back to editor':'Choose level'} onClick={game.showLevels}>▦ <span>Levels</span></button><button className="ui-btn" id="soundBtn" aria-label={state.sound?'Mute sound':'Enable sound'} aria-pressed={state.sound} onClick={()=>game.toggle('sound')}>{state.sound?'♪':'×'} <span>{state.sound?'Sound':'Muted'}</span></button></div>
      </header>
      <main>
        <section className="level-meta"><div className="eyebrow" id="levelNo">{custom?'MY PUZZLES · PLAYTEST':config.worldNames[spec.world]+' · LEVEL '+String(attempt.level+1).padStart(3,'0')}</div><h1 id="levelName">{spec.name}</h1></section>
        <section className="target-area"><div className="target-label">Target</div><div id="target" role="img" aria-label={targetLabel} style={{gridTemplateColumns:`repeat(${targetCols},var(--target-cell))`,gridTemplateRows:`repeat(${targetRows},var(--target-cell))`,width:`calc(${targetCols} * var(--target-cell) + ${(targetCols-1)*4}px)`,minHeight:`calc(${targetRows} * var(--target-cell) + ${(targetRows-1)*4}px)`}}><Target cells={targetCells} /></div></section>
        <section className="stats"><div className="stat"><strong id="moves">{attempt.moves}</strong><span>Moves</span></div><div className="stat"><strong id="par">{par}</strong><span>3★ par</span></div><div className="stat"><strong id="starsTop">{starText(state.progress.done[attempt.level+1] || 0)}</strong><span>Best</span></div></section>
        <section className="board-shell" ref={game.shellRef} style={{'--cols':cols,'--rows':rows}} onPointerDown={event=>{if(event.button===0 && !event.target.closest('.tile'))game.clearSelection()}}>
          <div className={'board'+(complete?' solved':'')} id="board" ref={game.boardRef} role="group" aria-label="Puzzle board"
            style={{gridTemplateColumns:`repeat(${cols},var(--cell))`,marginLeft:`calc(${(cols-1-shape.minC-shape.maxC)/2} * (var(--cell) + var(--gap)))`,marginTop:`calc(${(rows-1-shape.minR-shape.maxR)/2} * (var(--cell) + var(--gap)))`}}
            onPointerMove={game.pointerMove} onPointerUp={game.pointerUp} onPointerCancel={game.cancelDrag} onLostPointerCapture={()=>game.cancelDrag()}><GameBoard game={game} /></div>
          <ColorStrokes ink={game.ink} />
        </section>
        <div className="controls"><button className="control-btn" id="restartBtn" onClick={game.restart}>↶ Restart</button><button className="control-btn" id="undoBtn" disabled={!state.history.length && !state.restart} onClick={game.undo}>{state.restart?'↶ Undo restart':'↶ Undo'}</button><button className="control-btn primary" id="levelsBtn2" onClick={game.showLevels}>{custom?'My Puzzles':'Choose Level'}</button><button className="control-btn" id="nextBtn" disabled={!custom && !final && !canAccess(state,attempt.level+1)} onClick={game.next}>{custom?'Back to editor':final?'Replay final':'Next →'}</button></div>
      </main>
    </div>
    <GameMenus game={game} />
    <Dialog dialogs={dialogs} id="levelsOverlay" role="dialog" aria-modal="true" aria-labelledby="levelsTitle"><div className="modal"><div className="modal-head"><div><h2 id="levelsTitle">{config.levels.length} Levels</h2><p id="levelsDescription">{state.dev?'Developer Mode · All levels unlocked.':state.unlocked+' / '+config.levels.length+' levels unlocked.'}</p></div><button className="close" aria-label="Close level selection" data-close="levelsOverlay" onClick={()=>dialogs.close()}>×</button></div><div id="worldTabs" role="tablist" aria-label="Choose world"><WorldTabs selected={game.world} onSelect={game.setWorld} /></div><div id="levelWorlds" role="tabpanel" aria-labelledby={'worldTab'+game.world}><Levels world={game.world} name={config.worldNames[game.world]} levels={config.levels} progress={state.progress.done} current={attempt.level} zen={state.zen} unlocked={state.dev?config.levels.length:state.unlocked} onSelect={index=>{game.start(index);game.sound.play('select')}} /></div></div></Dialog>
    <Dialog dialogs={dialogs} id="emptyOverlay" role="dialog" aria-modal="true" aria-labelledby="emptyTitle"><div className="win-card"><h2 id="emptyTitle">No moves left</h2><div className="win-actions"><button className="control-btn" id="emptyUndoBtn" onClick={game.undo}>Undo</button><button className="control-btn" id="emptyRestartBtn" onClick={game.restart}>Restart</button><button className="control-btn primary" id="emptyLevelsBtn" onClick={game.showLevels}>Choose another puzzle</button></div></div></Dialog>
    <Dialog dialogs={dialogs} id="winOverlay" role="dialog" aria-modal="true" aria-labelledby="winTitle"><div className="win-card"><div className="win-kicker">Grid solved</div><div className="win-title" id="winTitle">{state.zen?'Beautifully solved.':stars===3?'Perfect shift.':stars===2?'Clean solve.':'Grid conquered.'}</div><div className="big-stars" id="winStars">{starText(stars)}</div><div className="win-meta" id="winMeta">{attempt.moves+' moves · par '+par}</div><div id="winAchievementSummary"><AchievementUnlocks badges={state.badges} onOpen={()=>game.showAchievements()} /></div><div className="win-actions"><button className="control-btn" id="replayBtn" onClick={game.restart}>Replay</button><button className="control-btn primary" id="winNextBtn" disabled={!custom && !final && !canAccess(state,attempt.level+1)} onClick={game.next}>{custom?'Back to editor':final?'Replay Final':'Next →'}</button><button className="control-btn" id="winLevelsBtn" hidden={!!custom || !final} onClick={game.showLevels}>Choose level</button></div></div></Dialog>
    <FeedbackUI dialogs={dialogs} feedback={game.feedback} />
    <AchievementsPanel dialogs={dialogs} request={game.collectionRequest} />
    <AchievementAnnouncer queue={game.notices} onDismiss={game.dismissNotice} />
    <div className="sr-only" id="announcement" role="status" aria-live="polite" aria-atomic="true">{ui.announcement}</div>
  </>;
}
