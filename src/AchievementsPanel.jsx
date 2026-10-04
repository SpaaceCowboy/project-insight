import React, {useEffect,useState,useSyncExternalStore} from 'react';
import {achievements} from './achievement-store.js';
import {Dialog} from './react-ui.jsx';

export default function AchievementsPanel({dialogs,request}) {
  const state=useSyncExternalStore(achievements.subscribe,achievements.getSnapshot);
  const [tab,setTab]=useState('collection'),[page,setPage]=useState(0);
  const pages=Math.ceil(state.badges.length/4);
  useEffect(()=>setTab(request.tab==='appearance'?'appearance':'collection'),[request]);
  function changePage(next) {
    setPage(next);requestAnimationFrame(()=>document.getElementById('collectionPageStatus')?.focus());
  }
  function tabKeys(event) {
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    event.preventDefault();
    const next=event.key==='Home'?'collection':event.key==='End'?'appearance':tab==='collection'?'appearance':'collection';
    setTab(next);document.getElementById('achievementTab-'+next).focus();
  }
  return <Dialog dialogs={dialogs} id="achievementsOverlay" role="dialog" aria-modal="true" aria-labelledby="achievementsTitle">
    <div className="modal achievement-modal">
      <div className="modal-head"><div><h2 id="achievementsTitle">Achievements</h2><p>{state.earnedCount} / {state.badges.length} earned · Yours to keep</p></div>
        <button className="close" id="closeAchievements" onClick={()=>dialogs.close()} aria-label="Close achievements">×</button></div>
      <div className="achievement-tabs" role="tablist" aria-label="Achievements and appearance">{['collection','appearance'].map(value=><button key={value} className="ui-btn" role="tab" id={'achievementTab-'+value}
        aria-selected={tab===value} aria-controls={'achievementPanel-'+value} tabIndex={tab===value?0:-1} onKeyDown={tabKeys} onClick={()=>setTab(value)}>{value==='collection'?'Collection':'Appearance'}</button>)}</div>
      <section className="collection-panel" role="tabpanel" id="achievementPanel-collection" aria-labelledby="achievementTab-collection" hidden={tab!=='collection'}>
        <div className="badge-grid">{state.badges.slice(page*4,page*4+4).map(badge=><article key={badge.id} className={'badge-card'+(badge.earned?' earned':'')} data-badge={badge.id}>
          <span className="badge-mark" aria-hidden="true">{badge.mark}</span><div className="badge-state">{badge.earned?'Earned':'Locked'}</div>
          <h3>{badge.name}</h3><p>{badge.requirement}</p>
          <div className="badge-progress"><progress value={badge.progress} max={badge.goal} aria-label={badge.name+' progress'} /><span>{badge.progress} / {badge.goal}</span></div>
          {badge.reward && <div className="badge-reward">Unlocks {badge.reward}</div>}
        </article>)}</div>
        <div className="collection-pages"><button className="ui-btn" disabled={page===0} onClick={()=>changePage(page-1)} aria-label="Previous achievements page">←</button><span id="collectionPageStatus" tabIndex={-1} role="status" aria-live="polite">Page {page+1} / {pages}</span><button className="ui-btn" disabled={page===pages-1} onClick={()=>changePage(page+1)} aria-label="Next achievements page">→</button></div>
      </section>
      <section className="appearance-panel" role="tabpanel" id="achievementPanel-appearance" aria-labelledby="achievementTab-appearance" hidden={tab!=='appearance'}>
        {['background','finish'].map(kind=><div className="appearance-group" key={kind}><h3>{kind==='background'?'Background':'Tile finish'}</h3><div className="cosmetic-grid">
          {state.cosmetics.filter(c=>c.kind===kind).map(c=><button key={c.id} className={'cosmetic-card'+(state.appearance[kind]===c.id?' equipped':'')} data-cosmetic={c.id} disabled={!c.owned}
            aria-pressed={state.appearance[kind]===c.id} onClick={()=>achievements.equip(kind,c.id)}>
            <span className={'cosmetic-preview preview-'+c.id} aria-hidden="true">{kind==='finish'?'✦':''}</span><strong>{c.name}</strong>
            <span>{c.owned ? state.appearance[kind]===c.id?'Equipped':c.description : c.requirement}</span>
          </button>)}
        </div></div>)}
        <p className="appearance-note">Keep your light or dark setting. Rewards change the look; your puzzle stays the same.</p>
      </section>
    </div>
  </Dialog>;
}
