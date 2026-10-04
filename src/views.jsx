import React, {useSyncExternalStore} from 'react';
import {getView, subscribeView} from './view-store.js';
import {PuzzleArt,PuzzleRules} from './data.js';

const {ICONS,META,TILE_LIGHTS}=PuzzleArt;
function Symbol({type}) {
  // Only the bundled SVG artwork reaches this HTML sink; never imported puzzle text.
  return <span className="tile-symbol" dangerouslySetInnerHTML={{__html:ICONS[type]}} />;
}
export function Tile({type,children,...props}) {
  return <button type="button" {...props}><Symbol type={type} />{children}</button>;
}
function GameBoard({board,remaining,limits,revision}) {
  return <React.Fragment key={revision}>{board.flatMap((row,r)=>row.map((type,c)=>{
    if(type==='.')return <div key={`${r}:${c}`} className="cell hole" data-r={r} data-c={c} />;
    const limited=limits && type!=='W', left=remaining?.[r]?.[c];
    const direction=PuzzleRules.moves[type].map(([dr,dc])=>`${dr<0?'up':dr>0?'down':''}${dc ? (dr?' ':'')+(dc<0?'left':'right') : ''}`).join(' or ');
    const label=`${META[type].name}, row ${r+1}, column ${c+1}${direction ? ', moves '+direction : ', carried only'}${limited ? ', '+left+' moves left' : ''}`;
    return <div key={`${r}:${c}`} className="cell" data-r={r} data-c={c}>
      <Tile type={type} className={'tile '+META[type].cls+(limited && left===0?' spent':'')} style={{'--tile-order':r+c}}
        data-r={r} data-c={c} data-type={type} aria-label={label} aria-pressed="false">
        {limited && <span className="tile-allowance" aria-hidden="true">{left}</span>}
      </Tile>
    </div>;
  }))}</React.Fragment>;
}
function Target({cells}) {
  return cells.map((type,i)=><div key={i} className={'target-dot '+(type==='W'?'white':type==='.'?'hole':'')} style={{'--dot':TILE_LIGHTS[type]||'#bbb'}}>
    {type!=='.' && <Symbol type={type} />}
  </div>);
}
function WorldTabs({selected,onSelect}) {
  return [1,2,3,4,5].map(w=><button key={w} id={'worldTab'+w} className="ui-btn" role="tab" aria-controls="levelWorlds"
    aria-selected={selected===w} tabIndex={selected===w?0:-1} onClick={()=>onSelect(w)} onKeyDown={event=>{
      if(!['ArrowLeft','ArrowRight'].includes(event.key))return;
      event.preventDefault();
      const next=(w-1+(event.key==='ArrowRight'?1:4))%5+1;
      onSelect(next);document.getElementById('worldTab'+next).focus();
    }}>World {w}</button>);
}
function Levels({world,name,levels,progress,current,zen,unlocked,onSelect}) {
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
function EditorBoard({board,revision}) {
  return <React.Fragment key={revision}>{board.flatMap((row,r)=>[...row].map((type,c)=>{
    const props={'data-r':r,'data-c':c,'aria-label':`${META[type]?.name||'Empty slot'}, row ${r+1}, column ${c+1}`};
    return type==='.' ? <button key={`${r}:${c}`} type="button" className="edit-cell gap-brush" {...props}><span aria-hidden="true">+</span></button>
      : <Tile key={`${r}:${c}`} type={type} className={'edit-cell tile '+META[type].cls} {...props} />;
  }))}</React.Fragment>;
}
function Palette({counts,onDrag,onPick,onRemove}) {
  return <>{Object.entries(META).map(([type,meta])=>{
    const [a,b]=counts[type];
    return <Tile key={type} type={type} data-type={type} className={'hero-tile '+meta.cls} aria-pressed="false"
      aria-label={`${meta.name} tile, Start ${a}, Target ${b}`} title={'Drag '+meta.name+' onto the board'}
      onPointerDown={event=>onDrag(event,type)} onClick={event=>{if(event.detail===0)onPick(type,event.currentTarget)}}>
      <span className="brush-count" hidden={a===b}>{a}/{b}</span>
    </Tile>;
  })}<button id="removeTile" type="button" className="gap-brush" aria-label="Remove tile"
    title="Drag a board tile here or outside the board to leave an empty slot" onClick={onRemove}><span aria-hidden="true">×</span></button></>;
}
const components={
  confirmation:({title,message,accept,danger,onCancel,onAccept})=><><div className={'confirmation-mark'+(danger?' destructive':'')} aria-hidden="true">{danger?'!':'?'}</div><h2 id="confirmationTitle">{title}</h2><p id="confirmationMessage">{message}</p><div className="confirmation-actions"><button className="control-btn" id="confirmCancel" onClick={onCancel}>Cancel</button><button className={'control-btn '+(danger?'danger-btn':'primary')} id="confirmAccept" onClick={onAccept}>{accept}</button></div></>,
  notice:({message,tone,title})=>message && <div className={'system-notice notice-'+tone}><span className="notice-mark" aria-hidden="true">{tone==='success'?'✓':tone==='error'||tone==='warning'?'!':'i'}</span><div>{title && <strong>{title}</strong>}<p>{message}</p></div></div>,
  board:GameBoard,target:Target,worldTabs:WorldTabs,levels:Levels,editorBoard:EditorBoard,palette:Palette,
  hero:()=>['R','B','G','P','W','Y','B','G','R'].map((type,i)=><span key={i} className={'hero-tile '+META[type].cls}><Symbol type={type} /></span>),
  sound:({enabled})=><>{enabled?'♪':'×'} <span>{enabled?'Sound':'Muted'}</span></>,
  drafts:({drafts})=>drafts.map(item=><option key={item.id} value={item.id}>{item.name.trim()||'Untitled puzzle'}</option>),
  seeds:({levels})=>levels.map((level,i)=><option key={i} value={i}>{String(i+1).padStart(3,'0')} · {level.name}</option>),
  counts:({counts})=>Object.entries(counts).filter(([,values])=>values.some(Boolean)).map(([type,[a,b]])=><span key={type} className={'count-chip'+(a!==b?' mismatch':'')} title="Start / Target">{META[type].name} {a} / {b}</span>),
  achievementUnlocks:({badges})=>badges.length>0 && <div className="achievement-unlocks"><strong>{badges.length===1?badges[0].name+' earned':badges.length+' achievements earned'}</strong>
    <span>{badges.filter(b=>b.reward).map(b=>b.reward).join(' · ') || 'A new badge for your collection.'}</span><button className="ui-btn" id="winAchievementsBtn">View collection →</button></div>
};
export function View({name}) {
  const props=useSyncExternalStore(listener=>subscribeView(name,listener),()=>getView(name));
  const Component=components[name];
  return props ? <Component {...props} /> : null;
}
