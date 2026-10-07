export const ACHIEVEMENTS_KEY='insight-achievements-v1';
export const APPEARANCE_KEY='insight-appearance-v1';
export const COSMETICS=[
  {id:'forest',kind:'background',name:'Forest',description:'Soft greens and moving light.'},
  {id:'mist',kind:'background',name:'Northern Mist',badge:'world-1',description:'Cool blue skies and teal light.'},
  {id:'aurora',kind:'background',name:'Aurora',badge:'complete',description:'Blue twilight with violet light.'},
  {id:'original',kind:'finish',name:'Original',description:'The familiar warm tile surface.'},
  // legacy: badges retired with stars and Tile Limits still grant the cosmetic to players who earned them.
  {id:'frosted',kind:'finish',name:'Frosted',badge:'first-clean',legacy:'perfect-1',description:'A soft, luminous glass surface.'},
  {id:'metal',kind:'finish',name:'Brushed Metal',badge:'clean-sweep',legacy:'limits',description:'Fine brushing and a gentle satin shine.'}
];

export function newAttempt(eligible=true) {
  return {version:1,eligible,undoUsed:false,noUndoKnown:true};
}
export function restoreAttempt(saved,eligible=true) {
  if(saved?.version!==1 || typeof saved.eligible!=='boolean' || typeof saved.undoUsed!=='boolean' || typeof saved.noUndoKnown!=='boolean') {
    return {version:1,eligible,undoUsed:false,noUndoKnown:false};
  }
  return {version:1,eligible:eligible && saved.eligible,undoUsed:saved.undoUsed,noUndoKnown:saved.noUndoKnown};
}

const LEGACY_BADGES=['perfect-1','perfect-10','precision','clean','limits'];

export function createAchievements({levels,storage,onStorageError=()=>{},progressKeys=[]}) {
  const catalog=[
    {id:'first',name:'First Step',requirement:'Complete 1 campaign level.',goal:1,metric:'completed',mark:'Ⅰ'},
    {id:'flow',name:'Finding Flow',requirement:'Complete 10 distinct campaign levels.',goal:10,metric:'completed',mark:'≈'},
    {id:'halfway',name:'Halfway Home',requirement:'Complete 50 distinct campaign levels.',goal:50,metric:'completed',mark:'◐'},
    {id:'complete',name:'INSIGHT Complete',requirement:'Complete all '+levels.length+' campaign levels.',goal:levels.length,metric:'completed',mark:'✦'},
    ...[1,2,3,4,5].map(world=>({id:'world-'+world,name:'World '+world+' Master',requirement:'Complete every level in World '+world+'.',goal:levels.filter(level=>level.world===world).length,world,metric:'world',mark:String(world)})),
    {id:'first-clean',name:'First Clean Solve',requirement:'Complete 1 campaign level without undo.',goal:1,metric:'noUndo',mark:'★'},
    {id:'steady',name:'Steady Hand',requirement:'Complete 10 distinct levels without undo.',goal:10,metric:'noUndo',mark:'⌁'},
    {id:'unbroken',name:'Unbroken',requirement:'Complete 25 distinct levels without undo.',goal:25,metric:'noUndo',mark:'✧'},
    {id:'flawless',name:'Flawless',requirement:'Complete 50 distinct levels without undo.',goal:50,metric:'noUndo',mark:'◇'},
    {id:'clean-sweep',name:'Clean Sweep',requirement:'Complete every level in one world without undo.',goal:1,metric:'cleanWorld',mark:'⋈'},
    {id:'pristine',name:'Pristine',requirement:'Complete all '+levels.length+' campaign levels without undo.',goal:levels.length,metric:'noUndo',mark:'⊞'}
  ];
  let results={},earned={},legacy={},appearance={background:'forest',finish:'original'},snapshot;
  const listeners=new Set();
  function read(key) {
    let raw;
    try{raw=storage.getItem(key)}catch{onStorageError();return null}
    try{return JSON.parse(raw)}catch{return null}
  }
  function write(key,value) {try{storage.setItem(key,JSON.stringify(value))}catch{onStorageError()}}
  function validStars(value) {return Number.isInteger(value) && value>=1 && value<=3}
  function validId(id) {return /^[1-9]\d*$/.test(id) && +id<=levels.length}
  function count(badge) {
    if(badge.metric==='cleanWorld')return [...new Set(levels.map(level=>level.world))].filter(world=>levels.every((level,i)=>level.world!==world || results[i+1]?.noUndo===true)).length;
    return Object.entries(results).filter(([id,result])=>badge.metric==='completed' || (badge.metric==='world'?levels[+id-1].world===badge.world:result[badge.metric]===true)).length;
  }
  function award() {
    const unlocked=[];
    for(const badge of catalog)if(!earned[badge.id] && count(badge)>=badge.goal){earned[badge.id]=Date.now();unlocked.push({...badge,reward:COSMETICS.find(c=>c.badge===badge.id)?.name})}
    return unlocked;
  }
  function owns(cosmetic) {return !cosmetic.badge || !!earned[cosmetic.badge] || !!legacy[cosmetic.legacy]}
  function publish() {
    snapshot={badges:catalog.map(badge=>({...badge,progress:Math.min(badge.goal,count(badge)),earned:!!earned[badge.id],reward:COSMETICS.find(c=>c.badge===badge.id)?.name})),
      cosmetics:COSMETICS.map(c=>({...c,owned:owns(c),requirement:catalog.find(b=>b.id===c.badge)?.requirement})),appearance:{...appearance},earnedCount:Object.keys(earned).length};
    listeners.forEach(listener=>listener());
  }
  function persist() {write(ACHIEVEMENTS_KEY,{version:2,migrated:true,results,earned,legacy})}
  // Version 2 stores solved levels ({noUndo}) without stars; version 1 results (stars per mode) migrate here.
  const saved=read(ACHIEVEMENTS_KEY);
  if((saved?.version===1 || saved?.version===2) && saved.migrated===true) {
    if(saved.results && typeof saved.results==='object' && !Array.isArray(saved.results))for(const [id,result] of Object.entries(saved.results)) {
      if(!validId(id) || !result || typeof result!=='object' || Array.isArray(result))continue;
      if(saved.version===1 && !validStars(result.classic) && !validStars(result.limited))continue;
      results[id]=result.noUndo===true?{noUndo:true}:{};
    }
    for(const badge of catalog)if(count(badge)>=badge.goal && Number.isSafeInteger(saved.earned?.[badge.id]) && saved.earned[badge.id]>0)earned[badge.id]=saved.earned[badge.id];
    const retired=saved.version===1?saved.earned:saved.legacy;
    for(const id of LEGACY_BADGES)if(Number.isSafeInteger(retired?.[id]) && retired[id]>0)legacy[id]=retired[id];
  } else {
    for(const key of progressKeys) {
      const old=read(key);
      if(old?.done && typeof old.done==='object' && !Array.isArray(old.done))for(const [id,value] of Object.entries(old.done))if(validId(id) && (value===true || validStars(value)))results[id]??={};
    }
  }
  award();persist();
  const selected=read(APPEARANCE_KEY);
  if(selected?.version===1)for(const kind of ['background','finish']) {
    const cosmetic=COSMETICS.find(c=>c.kind===kind && c.id===selected[kind]);
    if(cosmetic && owns(cosmetic))appearance[kind]=cosmetic.id;
  }
  publish();
  return {
    getSnapshot:()=>snapshot,
    subscribe(listener){listeners.add(listener);return ()=>listeners.delete(listener)},
    record({level,custom=false,developer=false,attempt}) {
      if(custom || developer || !Number.isInteger(level) || !levels[level] || attempt?.eligible!==true)return [];
      const result=results[level+1]??={};
      if(attempt.noUndoKnown===true && attempt.undoUsed===false)result.noUndo=true;
      const unlocked=award();persist();publish();return unlocked;
    },
    equip(kind,id) {
      const cosmetic=COSMETICS.find(c=>c.kind===kind && c.id===id);
      if(!cosmetic || !owns(cosmetic))return false;
      appearance[kind]=id;write(APPEARANCE_KEY,{version:1,...appearance});publish();return true;
    }
  };
}
