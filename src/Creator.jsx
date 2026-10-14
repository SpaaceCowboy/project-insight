import React from 'react';
import {createPortal} from 'react-dom';
import useCreator from './useCreator.js';
import {Tile,Target} from './views.jsx';
import {BackButton,ColorStrokes} from './react-ui.jsx';
import {PuzzleArt} from './data.js';
import {bounds} from './board-layout.js';

const {META,TILE_LIGHTS}=PuzzleArt;
const same=(a,b)=>a?.[0]===b?.[0] && a?.[1]===b?.[1];

function Preview({label,board}) {
  const box=bounds(board.map(row=>row.join(''))),cols=box.maxC-box.minC+1;
  const cells=board.slice(box.minR,box.maxR+1).flatMap(row=>row.slice(box.minC,box.maxC+1));
  return <div className="creator-preview"><div className="target-label">{label}</div>
    <div className="creator-mini" role="img" aria-label={label+' arrangement'} style={{gridTemplateColumns:`repeat(${cols},var(--target-cell))`}}><Target cells={cells} /></div></div>;
}

export default function Creator({dialogs,sound}) {
  const c=useCreator(sound),{phase,board,start,target,holding,picked,arrived,note}=c.state,{drag}=c;
  const rows=board.length,cols=board[0].length;
  const hint=note || {
    build:holding?'Tap the grid to place '+META[holding].name+'. Tap the tile again to stop.':'Drag tiles onto the grid, then press S.',
    shape:'Move tiles to shape your target, then press T.',
    check:c.solved?'Target reached. Your level works.':'Play your level. Press T or S to go back.'
  }[phase];
  return <div className="modal creator-card" onPointerMove={c.move} onPointerUp={c.up} onPointerCancel={c.cancel} onLostPointerCapture={c.cancel} onKeyDown={c.keyDown}>
    <div className="screen-head"><BackButton id="closeCreate" onClick={()=>dialogs.close()} label="Back" data-close="createOverlay" /><div><h2 id="createTitle">Create</h2><p id="creatorHint" role="status" aria-live="polite">{hint}</p></div></div>
    <div className="creator-top">{phase==='build'
      ? Object.keys(META).map(type=><Tile key={type} type={type} data-type={type} className={'tile '+META[type].cls+' pal-tile'+(holding===type?' selected':'')} style={{'--light-color':TILE_LIGHTS[type]}}
          aria-label={META[type].name+' tile'} aria-pressed={holding===type} onPointerDown={event=>c.down(event,{type,from:null})} onClick={event=>{if(event.detail===0)c.tapTile(type)}} />)
      : <Preview label={phase==='shape'?'Start':'Target'} board={phase==='shape'?start:target} />}</div>
    <section className="board-shell creator-shell" ref={c.shellRef} style={{'--cols':5,'--rows':5}}>
      <div className={'board'+(c.solved?' solved':'')} ref={c.boardRef} role="group" aria-label="Level grid" style={{gridTemplateColumns:`repeat(${cols},var(--cell))`}}>
        {board.flatMap((row,r)=>row.map((type,c2)=>{
          const pos=[r,c2],key=r+':'+c2,hover=same(drag?.hover,pos);
          if(type==='.')return phase==='build'
            ? <div key={key} className={'cell'+(hover?' hover-target':'')} data-r={r} data-c={c2}><button type="button" className="slot" aria-label={`Empty slot, row ${r+1}, column ${c2+1}`} onClick={()=>c.tapCell(r,c2)} /></div>
            : <div key={key} className="cell hole" data-r={r} data-c={c2} />;
          return <div key={key} className={'cell'+(hover?' hover-target':'')} data-r={r} data-c={c2}>
            <Tile type={type} data-type={type} className={'tile '+META[type].cls+(same(picked,pos)?' selected':'')+(same(drag?.from,pos) && drag.type===type?' drag-source':'')+(arrived.some(item=>same(item,pos))?' arrived':'')}
              style={{'--light-color':TILE_LIGHTS[type],'--tile-order':r+c2}} aria-label={`${META[type].name}, row ${r+1}, column ${c2+1}`} aria-pressed={phase==='build'?undefined:same(picked,pos)}
              onPointerDown={event=>c.down(event,{type,from:pos})} onClick={event=>{if(event.detail===0)c.tapCell(r,c2)}}
              onAnimationEnd={event=>{if(event.target===event.currentTarget && event.animationName==='tileArrival')c.clearArrival(pos)}} />
          </div>;
        }))}
        {phase==='build' && <button type="button" className="resize-handle" id="resizeHandle" aria-label={`Resize grid, currently ${cols} by ${rows}. Use the arrow keys.`} onPointerDown={c.resizeDown}
          onKeyDown={event=>{const d={ArrowRight:[0,1],ArrowLeft:[0,-1],ArrowDown:[1,0],ArrowUp:[-1,0]}[event.key];if(d){event.preventDefault();event.stopPropagation();c.resizeBy(...d)}}} />}
      </div>
      <ColorStrokes ink={c.ink} />
    </section>
    <div className="creator-bar" role="group" aria-label="Creation steps">
      <button type="button" id="creatorStartBtn" className={'creator-step '+(phase==='build'?'on':'done')} aria-label="Start position" onClick={c.pressStart}>S</button>
      <button type="button" id="creatorTargetBtn" className={'creator-step '+(phase==='shape'?'on':phase==='check'?'done':'locked')} aria-label="Target position" aria-disabled={phase==='build'} onClick={c.pressTarget}>T</button>
      <button type="button" id="creatorMakeBtn" className={'creator-step'+(phase==='check'?'':' locked')} aria-label="Make level" aria-disabled="true">M</button>
    </div>
    {drag && createPortal(<Tile type={drag.type} className={'tile '+META[drag.type].cls+' drag-preview'} aria-hidden="true" tabIndex={-1} style={{left:drag.x,top:drag.y,'--cell':drag.size+'px'}} />,document.body)}
  </div>;
}
