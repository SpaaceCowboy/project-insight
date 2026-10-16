import React from 'react';
import useGame from './useGame.js';
import {GameBoard,Target} from './views.jsx';
import {Dialog,ColorStrokes,Particles} from './react-ui.jsx';
import {bounds} from './board-layout.js';
import {solved} from './game-state.js';
import {PuzzleArt} from './data.js';
import GameMenus from './GameMenus.jsx';
import FeedbackUI from './FeedbackUI.jsx';

// Dialogs that fill the whole screen; the game board is hidden while any is in the stack.
const SCREENS=['settingsOverlay'];

export default function GameApp() {
  const game=useGame(),{state,ui,dialogs}=game,{attempt,config}=state,spec=config.levels[attempt.level];
  const rows=attempt.board.length,cols=attempt.board[0].length,shape=bounds(attempt.board),target=bounds(attempt.target);
  const targetRows=target.maxR-target.minR+1,targetCols=target.maxC-target.minC+1;
  const targetCells=attempt.target.slice(target.minR,target.maxR+1).flatMap(row=>row.slice(target.minC,target.maxC+1));
  const complete=solved(attempt);
  const targetLabel='Target arrangement: '+attempt.target.map((row,i)=>'row '+(i+1)+': '+row.map(type=>PuzzleArt.META[type]?.name || 'gap').join(', ')).join('; ');
  if(config.error)return null;
  return <>
    <div className="ambient-lights" aria-hidden="true"><span></span><span></span></div>
    <Particles burst={ui.burst} />
    <div className={'app'+(SCREENS.some(dialogs.has)?' behind-screen':'')} inert={!!dialogs.active}>
      <button className="corner-btn left" id="menuBtn" aria-label="Menu" onClick={()=>game.openDialog('pauseOverlay')}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>
      <button className="corner-btn right" id="restartBtn" aria-label="Restart level" onClick={game.restart}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.6-5.9M20 4v4.5h-4.5"/></svg></button>
      <main>
        <section className="level-meta"><div className="eyebrow" id="levelNo">PLAYTEST</div><h1 id="levelName">{spec.name}</h1></section>
        <section className="target-area"><div className="target-label">Target</div><div id="target" role="img" aria-label={targetLabel} style={{gridTemplateColumns:`repeat(${targetCols},var(--target-cell))`,gridTemplateRows:`repeat(${targetRows},var(--target-cell))`,width:`calc(${targetCols} * var(--target-cell) + ${(targetCols-1)*4}px)`,minHeight:`calc(${targetRows} * var(--target-cell) + ${(targetRows-1)*4}px)`}}><Target cells={targetCells} /></div></section>
        <section className="board-shell" ref={game.shellRef} style={{'--cols':cols,'--rows':rows}} onPointerDown={event=>{if(event.button===0 && !event.target.closest('.tile'))game.clearSelection()}}>
          <div className={'board'+(complete?' solved':'')} id="board" ref={game.boardRef} role="group" aria-label="Puzzle board"
            style={{gridTemplateColumns:`repeat(${cols},var(--cell))`,marginLeft:`calc(${(cols-1-shape.minC-shape.maxC)/2} * (var(--cell) + var(--gap)))`,marginTop:`calc(${(rows-1-shape.minR-shape.maxR)/2} * (var(--cell) + var(--gap)))`}}
            onPointerMove={game.pointerMove} onPointerUp={game.pointerUp} onPointerCancel={game.cancelDrag} onLostPointerCapture={()=>game.cancelDrag()}><GameBoard game={game} /></div>
          <ColorStrokes ink={game.ink} />
        </section>
      </main>
    </div>
    <GameMenus game={game} />
    <Dialog dialogs={dialogs} id="winOverlay" role="dialog" aria-modal="true" aria-labelledby="winTitle"><div className="win-card"><div className="win-kicker">Grid solved</div><div className="win-title" id="winTitle">Beautifully solved.</div><div className="win-actions"><button className="control-btn" id="replayBtn" onClick={game.restart}>Replay</button><button className="control-btn primary" id="winNextBtn" onClick={game.leaveEditor}>Back to editor</button></div></div></Dialog>
    <FeedbackUI dialogs={dialogs} feedback={game.feedback} />
    <div className="sr-only" id="announcement" role="status" aria-live="polite" aria-atomic="true">{ui.announcement}</div>
  </>;
}
