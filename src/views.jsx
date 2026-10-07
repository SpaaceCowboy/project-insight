import React from 'react';
import {PuzzleArt,PuzzleRules} from './data.js';

const {ICONS,META,TILE_LIGHTS}=PuzzleArt;
function Symbol({type}) {
  // Only the bundled SVG artwork reaches this HTML sink; never imported puzzle text.
  return <span className="tile-symbol" dangerouslySetInnerHTML={{__html:ICONS[type]}} />;
}
export function Tile({type,children,...props}) {
  return <button type="button" {...props}><Symbol type={type} />{children}</button>;
}
export function GameBoard({game}) {
  const {state,ui}=game,{board,remaining}=state.attempt,limits=state.limits;
  const same=(a,b)=>a?.join(':')===b?.join(':');
  const revision=state.attempt.level+':'+limits;
  return <React.Fragment key={revision}>{board.flatMap((row,r)=>row.map((type,c)=>{
    if(type==='.')return <div key={`${r}:${c}`} className="cell hole" data-r={r} data-c={c} />;
    const limited=limits && type!=='W', left=remaining?.[r]?.[c];
    const direction=PuzzleRules.moves[type].map(([dr,dc])=>`${dr<0?'up':dr>0?'down':''}${dc ? (dr?' ':'')+(dc<0?'left':'right') : ''}`).join(' or ');
    const label=`${META[type].name}, row ${r+1}, column ${c+1}${direction ? ', moves '+direction : ', carried only'}${limited ? ', '+left+' moves left' : ''}`;
    return <div key={`${r}:${c}`} className={'cell'+(same(ui.drag?.hover,[r,c])?' hover-target':'')} data-r={r} data-c={c}>
      <Tile type={type} ref={game.tileRef([r,c])} className={'tile '+META[type].cls+(limited && left===0?' spent':'')+(same(ui.selected,[r,c])?' selected':'')+(same(ui.drag?.from,[r,c]) && ui.drag.moves.length?' dragging':'')+(ui.moving?.some(pos=>same(pos,[r,c]))?' moving':'')+(same(ui.rejected,[r,c])?' rejected':'')+(ui.arrived.some(pos=>same(pos,[r,c]))?' arrived':'')}
        style={{'--tile-order':r+c}}
        onPointerDown={event=>game.pointerDown(event,[r,c])} onClick={event=>{if(event.detail===0)game.choose([r,c])}} onAnimationEnd={event=>{if(event.target===event.currentTarget && event.animationName==='tileArrival')game.clearArrival([r,c])}}
        data-r={r} data-c={c} data-type={type} aria-label={label} aria-pressed={same(ui.selected,[r,c])}>
        {limited && <span className="tile-allowance" aria-hidden="true">{left}</span>}
      </Tile>
    </div>;
  }))}</React.Fragment>;
}
export function Target({cells}) {
  return cells.map((type,i)=><div key={i} className={'target-dot '+(type==='W'?'white':type==='.'?'hole':'')} style={{'--dot':TILE_LIGHTS[type]||'#bbb'}}>
    {type!=='.' && <Symbol type={type} />}
  </div>);
}
export function WorldTabs({selected,onSelect}) {
  return [1,2,3,4,5].map(w=><button key={w} id={'worldTab'+w} className="ui-btn" role="tab" aria-controls="levelWorlds"
    aria-selected={selected===w} tabIndex={selected===w?0:-1} onClick={()=>onSelect(w)} onKeyDown={event=>{
      if(!['ArrowLeft','ArrowRight'].includes(event.key))return;
      event.preventDefault();
      const next=(w-1+(event.key==='ArrowRight'?1:4))%5+1;
      onSelect(next);document.getElementById('worldTab'+next).focus();
    }}>World {w}</button>);
}
export function Levels({world,name,levels,progress,current,zen,unlocked,onSelect}) {
  const entries=levels.map((level,i)=>({level,i})).filter(({level})=>level.world===world);
  return <section className="world-block"><div className="world-head"><div className="world-title">WORLD {world} · {name}</div>
    <div className="world-sub">{entries.filter(({i})=>progress[i+1]).length} / {entries.length} solved</div></div>
    <div className="level-grid">{entries.map(({level,i})=>{
      const best=progress[i+1]||0;
      const locked=i>=unlocked;
      return <button key={i} className={'level-card '+(i===current?'current ':'')+(best?'done':'')}
        disabled={locked} aria-label={`Level ${i+1}, ${level.name}${locked?', locked':!zen && best?', best '+best+' stars':''}`} onClick={()=>onSelect(i)}>
        <div className="lvl-num">{String(i+1).padStart(3,'0')}</div><div className="lvl-name">{level.name}</div>
        <div className={'lvl-stars'+(locked?' locked-label':'')}>{locked?'Locked':best?'★'.repeat(best)+'☆'.repeat(3-best):''}</div>
      </button>;
    })}</div></section>;
}
export function EditorBoard({editor}) {
  const {draft,side,holding,drag}=editor,board=draft[side],revision=draft.id+':'+side;
  const same=(a,b)=>a?.join(':')===b?.join(':');
  return <React.Fragment key={revision}>{board.flatMap((row,r)=>[...row].map((type,c)=>{
    const props={ref:editor.cellRef([r,c]),onPointerDown:event=>{if(type!=='.')editor.beginDrag(event,{type,from:[r,c]})},onClick:event=>{if(event.detail===0)editor.activate([r,c])},'aria-pressed':same(holding?.from,[r,c]),'data-r':r,'data-c':c,'aria-label':`${META[type]?.name||'Empty slot'}, row ${r+1}, column ${c+1}`};
    return type==='.' ? <button key={`${r}:${c}`} type="button" className={'edit-cell gap-brush'+(same(editor.drop,[r,c])?' drop-ready':'')} {...props}><span aria-hidden="true">+</span></button>
      : <Tile key={`${r}:${c}`} type={type} className={'edit-cell tile '+META[type].cls+(same(holding?.from,[r,c])?' picked-up':'')+(same(drag?.from,[r,c])?' drag-source':'')+(same(editor.drop,[r,c])?' drop-ready':'')} {...props} />;
  }))}</React.Fragment>;
}
export function Palette({editor}) {
  const {counts}=editor;
  return <>{Object.entries(META).map(([type,meta])=>{
    const [a,b]=counts[type];
    return <Tile key={type} type={type} data-type={type} className={'hero-tile '+meta.cls+(editor.holding?.type===type && !editor.holding.from?' picked-up':'')} ref={editor.paletteRef(type)} aria-pressed={editor.holding?.type===type && !editor.holding.from}
      aria-label={`${meta.name} tile, Start ${a}, Target ${b}`} title={'Drag '+meta.name+' onto the board'}
      onPointerDown={event=>editor.beginDrag(event,{type,from:null})} onClick={event=>{if(event.detail===0)editor.pickUp({type,from:null},event.currentTarget)}}>
      <span className="brush-count" hidden={a===b}>{a}/{b}</span>
    </Tile>;
  })}<button id="removeTile" type="button" aria-label="Remove tile"
    title="Drag a board tile here or outside the board to leave an empty slot" ref={editor.removeRef} className={'gap-brush'+(editor.discarding?' drop-ready':'')} onClick={editor.removePicked}><span aria-hidden="true">×</span></button></>;
}
export function Hero(){return ['R','B','G','P','W','Y','B','G','R'].map((type,i)=><span key={i} className={'hero-tile '+META[type].cls}><Symbol type={type} /></span>)}
export function AchievementUnlocks({badges,onOpen}){return badges.length>0 && <div className="achievement-unlocks"><strong>{badges.length===1?badges[0].name+' earned':badges.length+' achievements earned'}</strong><span>{badges.filter(b=>b.reward).map(b=>b.reward).join(' · ') || 'A new badge for your collection.'}</span><button className="ui-btn" id="winAchievementsBtn" onClick={onOpen}>View collection →</button></div>}
export function Counts({counts}){return Object.entries(counts).filter(([,values])=>values.some(Boolean)).map(([type,[a,b]])=><span key={type} className={'count-chip'+(a!==b?' mismatch':'')} title="Start / Target">{META[type].name} {a} / {b}</span>)}
