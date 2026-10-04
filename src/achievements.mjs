export const ACHIEVEMENTS_KEY='insight-achievements-v1';
export const APPEARANCE_KEY='insight-appearance-v1';
export const COSMETICS=[
  {id:'forest',kind:'background',name:'Forest',description:'Soft greens and moving light.'},
  {id:'mist',kind:'background',name:'Northern Mist',badge:'world-1',description:'Cool blue skies and teal light.'},
  {id:'aurora',kind:'background',name:'Aurora',badge:'complete',description:'Blue twilight with violet light.'},
  {id:'original',kind:'finish',name:'Original',description:'The familiar warm tile surface.'},
  {id:'frosted',kind:'finish',name:'Frosted',badge:'perfect-1',description:'A soft, luminous glass surface.'},
  {id:'metal',kind:'finish',name:'Brushed Metal',badge:'limits',description:'Fine brushing and a gentle satin shine.'}
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

export function createAchievements({levels,storage,onStorageError=()=>{},progressKeys=['insight-100-fixed-v4','insight-limit-stars-v1']}) {
  const catalog=[
    {id:'first',name:'First Step',requirement:'Complete 1 campaign level.',goal:1,metric:'completed',mark:'Ⅰ'},
    {id:'flow',name:'Finding Flow',requirement:'Complete 10 distinct campaign levels.',goal:10,metric:'completed',mark:'≈'},
    {id:'halfway',name:'Halfway Home',requirement:'Complete 50 distinct campaign levels.',goal:50,metric:'completed',mark:'◐'},
    {id:'complete',name:'INSIGHT Complete',requirement:'Complete all '+levels.length+' campaign levels.',goal:levels.length,metric:'completed',mark:'✦'},
    ...[1,2,3,4,5].map(world=>({id:'world-'+world,name:'World '+world+' Master',requirement:'Complete every level in World '+world+'.',goal:levels.filter(level=>level.world===world).length,world,metric:'world',mark:String(world)})),
    {id:'perfect-1',name:'First Perfect',requirement:'Earn a three-star campaign solve.',goal:1,metric:'perfect',mark:'★'},
    {id:'perfect-10',name:'Perfect Ten',requirement:'Earn three stars on 10 distinct levels.',goal:10,metric:'perfect',mark:'✧'},
    {id:'precision',name:'Precision',requirement:'Earn three stars on 25 distinct levels.',goal:25,metric:'perfect',mark:'◇'},
    {id:'steady',name:'Steady Hand',requirement:'Complete 10 distinct levels without undo.',goal:10,metric:'noUndo',mark:'⌁'},
    {id:'clean',name:'Clean Cut',requirement:'Earn three stars on 5 distinct levels without undo.',goal:5,metric:'clean',mark:'⋈'},
    {id:'limits',name:'Limits Master',requirement:'Earn three stars on 10 distinct levels in Tile Limits.',goal:10,metric:'limitedPerfect',mark:'⊞'}
  ];
  let results={},earned={},appearance={background:'forest',finish:'original'},snapshot;
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
    return Object.entries(results).filter(([id,result])=>{
      const best=Math.max(result.classic||0,result.limited||0);
      if(badge.metric==='completed')return best>0;
      if(badge.metric==='perfect')return best===3;
      if(badge.metric==='world')return best>0 && levels[+id-1].world===badge.world;
      return result[badge.metric]===true;
    }).length;
  }
  function award() {
    const unlocked=[];
    for(const badge of catalog)if(!earned[badge.id] && count(badge)>=badge.goal){earned[badge.id]=Date.now();unlocked.push({...badge,reward:COSMETICS.find(c=>c.badge===badge.id)?.name})}
    return unlocked;
  }
  function owns(cosmetic) {return !cosmetic.badge || !!earned[cosmetic.badge]}
  function publish() {
    snapshot={badges:catalog.map(badge=>({...badge,progress:Math.min(badge.goal,count(badge)),earned:!!earned[badge.id],reward:COSMETICS.find(c=>c.badge===badge.id)?.name})),
      cosmetics:COSMETICS.map(c=>({...c,owned:owns(c),requirement:catalog.find(b=>b.id===c.badge)?.requirement})),appearance:{...appearance},earnedCount:Object.keys(earned).length};
    listeners.forEach(listener=>listener());
  }
  function persist() {write(ACHIEVEMENTS_KEY,{version:1,migrated:true,results,earned})}
  const saved=read(ACHIEVEMENTS_KEY);
  if(saved?.version===1 && saved.migrated===true) {
    if(saved.results && typeof saved.results==='object' && !Array.isArray(saved.results))for(const [id,result] of Object.entries(saved.results)) {
      if(!validId(id) || !result || typeof result!=='object' || Array.isArray(result))continue;
      const clean={};
      for(const mode of ['classic','limited'])if(validStars(result[mode]))clean[mode]=result[mode];
      if(!Object.keys(clean).length)continue;
      for(const flag of ['noUndo','clean','limitedPerfect'])if(result[flag]===true &&
        (flag!=='clean' || result.noUndo===true && Math.max(clean.classic||0,clean.limited||0)===3) && (flag!=='limitedPerfect' || clean.limited===3))clean[flag]=true;
      results[id]=clean;
    }
    for(const badge of catalog)if(count(badge)>=badge.goal && Number.isSafeInteger(saved.earned?.[badge.id]) && saved.earned[badge.id]>0)earned[badge.id]=saved.earned[badge.id];
  } else {
    for(const [key,mode] of [[progressKeys[0],'classic'],[progressKeys[1],'limited']]) {
      const old=read(key);
      if(old?.done && typeof old.done==='object' && !Array.isArray(old.done))for(const [id,stars] of Object.entries(old.done))if(validId(id) && validStars(stars)) {
        results[id]??={};results[id][mode]=stars;
      }
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
    record({level,stars,limited,custom=false,developer=false,attempt}) {
      if(custom || developer || !Number.isInteger(level) || !levels[level] || !validStars(stars) || typeof limited!=='boolean' || attempt?.eligible!==true)return [];
      const id=level+1,mode=limited?'limited':'classic';
      results[id]??={};const result=results[id];
      result[mode]=Math.max(result[mode]||0,stars);
      if(attempt.noUndoKnown===true && attempt.undoUsed===false){result.noUndo=true;if(stars===3)result.clean=true}
      if(limited && stars===3)result.limitedPerfect=true;
      const unlocked=award();persist();publish();return unlocked;
    },
    equip(kind,id) {
      const cosmetic=COSMETICS.find(c=>c.kind===kind && c.id===id);
      if(!cosmetic || !owns(cosmetic))return false;
      appearance[kind]=id;write(APPEARANCE_KEY,{version:1,...appearance});publish();return true;
    }
  };
}
