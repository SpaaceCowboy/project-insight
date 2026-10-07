// Generates the Game 2 campaign: designed targets, solver-selected starts.
// Each slot fixes the target (pattern + colours + gaps), the tiles it teaches, a par band and a mood.
// Starts are reverse-scrambled from the target, solved optimally, and scored. Seeds are fixed, so output is stable.
// Run `node scripts/make-game2.cjs`, then `node scripts/check-levels.cjs --game 2 --update`.
const fs=require('node:fs');
const {rootPath}=require('./check-paths.cjs');
const {PuzzleRules:rules}=require('../src/puzzle-rules.js'),{PuzzleSolver:solver}=require('../src/puzzle-solver.js');
const {CORE_LEVELS}=require('../src/data/levels.js');
const LIMIT={maxStates:350000,timeout:8000};

const PATTERNS={
  rows:(r,c)=>r, cols:(r,c)=>c, checker:(r,c)=>r+c, slash:(r,c)=>r-c+99,
  ring:(r,c,h,w)=>Math.min(r,c,h-1-r,w-1-c), halves:(r,c,h,w)=>+(c>=w/2), split:(r,c,h,w)=>+(r>=h/2),
  quads:(r,c,h,w)=>(r>=h/2)*2+(c>=w/2), cross:(r,c,h,w)=>+(r===(h-1)>>1 || c===(w-1)>>1),
  frame:(r,c,h,w)=>+(r===0 || c===0 || r===h-1 || c===w-1), weave:(r,c)=>(r>>1)+(c>>1),
  zig:(r,c)=>r+(c>>1), steps:(r,c)=>(r>>1)+c, blocks:(r,c)=>(r>>1)*2+(c>>1)+r,
  // bands: every tile's move changes the class mod 5, so all five movers matter; rose: rings split into quadrants.
  bands:(r,c)=>r+2*c, rose:(r,c,h,w)=>Math.min(r,c,h-1-r,w-1-c)+(r>=h/2)*2+(c>=w/2)
};
// [name, size, pattern, colours (class i -> colours[i % n]), focus tiles, [min,max] par, mood, gaps]
// Moods: teach = cleanest route (no detours); breather = easy; test/twist/boss = most detour within the band.
const WORLDS=[
  ['STRAIGHT LINES',[
    ['First Light','2x2','rows','RB','R',[1,1],'teach'],
    ['Rising Column','3x2','rows','RB','R',[2,3],'teach'],
    ['Side Step','2x2','cols','RB','B',[1,2],'teach'],
    ['Long Hallway','2x3','cols','BR','B',[3,3],'teach'],
    ['Two Directions','3x3','checker','RB','RB',[3,4],'test'],
    ['Woven Pair','2x4','checker','BR','RB',[4,5],'test'],
    ['Ladder','4x2','rows','RB','RB',[4,5],'test'],
    ['Crossing Threads','3x3','cross','RB','RB',[5,6],'twist'],
    ['Still Stone','3x3','rows','RWB','RB',[2,4],'teach'],
    ['Around the Stone','3x3','cross','RW','R',[3,4],'twist'],
    ['Pillar Garden','3x3','checker','BRW','RB',[4,5],'test'],
    ['Easy Breeze','2x3','halves','RB','RB',[2,3],'breather'],
    ['First Gap','3x3','rows','RB','RB',[3,4],'teach',['...','.x.','...']],
    ['Broken Bridge','2x4','cols','RB','RB',[4,5],'test',['x..x','....']],
    ['Island Hop','3x4','checker','RB','RB',[5,6],'twist',['..x.','.x..','....']],
    ['Stone and Hollow','3x4','frame','RBW','RB',[5,6],'test',['x...','.W..','...x']],
    ['Three Lanes','3x4','rows','RBW','RB',[6,7],'test'],
    ['Quiet Tide','3x3','split','BR','RB',[3,4],'breather'],
    ['Knotted Rope','3x4','weave','RB','RB',[7,8],'twist'],
    ['The Straight Path','4x4','rows','RBRW','RB',[8,9],'boss']
  ]],
  ['SLANTED LIGHT',[
    ['Green Lean','2x2','rows','GR','G',[1,2],'teach'],
    ['Leaning Tower','3x3','rows','GW','G',[2,3],'teach'],
    ['Gold Lean','2x2','cols','YB','Y',[1,2],'teach'],
    ['Gilded Stair','3x3','cols','YW','Y',[2,3],'teach'],
    ['Crossed Beams','3x3','rows','GY','GY',[3,4],'test'],
    ['Diagonal Dance','3x3','rows','GYW','GY',[4,5],'test'],
    ['Lattice','3x4','cols','YG','GY',[5,6],'twist'],
    ['Open Window','3x4','split','GY','GY',[2,3],'breather'],
    ['Green and Red','3x3','rows','GR','GR',[4,5],'test'],
    ['Gold and Blue','3x3','cols','YB','YB',[4,5],'test'],
    ['Compass Rose','3x3','bands','RBGY','RBGY',[5,6],'twist'],
    ['Four Winds','2x4','cols','RGBY','RBGY',[5,6],'test'],
    ['Mirror Lake','3x3','split','GY','GY',[3,4],'breather'],
    ['Herringbone','3x4','zig','RGY','RGY',[6,7],'test'],
    ['Basket Weave','3x4','weave','BGY','BGY',[6,7],'twist'],
    ['Leaning Walls','4x3','steps','RGBY','RBGY',[7,8],'test'],
    ['Slanted Garden','3x4','quads','RBGY','RBGY',[7,8],'test'],
    ['Shadowed Corners','3x4','ring','GY','GY',[4,5],'twist',['x...','....','...x']],
    ['Prism Gate','3x4','zig','RGBY','RBGY',[8,9],'twist',['....','.x..','....']],
    ['Kaleidoscope','4x4','quads','GYRB','RBGY',[9,10],'boss']
  ]],
  ['LONG JUMPS',[
    ['First Leap','1x3','cols','PRB','P',[1,1],'teach'],
    ['Over the Stone','3x2','rows','PWR','P',[2,3],'teach'],
    ['Leapfrog','2x4','halves','PB','P',[2,3],'teach'],
    ['Jump the Gap','3x3','halves','PR','P',[2,3],'teach',['...','x.x','...']],
    ['Moat','3x3','halves','PW','P',[3,4],'twist',['...','.x.','...']],
    ['Hop and Step','3x4','halves','PR','PR',[3,4],'test'],
    ['Purple Rain','4x2','split','PB','PB',[4,5],'test'],
    ['Stepping Stones','3x4','bands','PBR','PRB',[5,6],'test'],
    ['Long and Short','3x3','bands','PRB','PRB',[5,6],'twist'],
    ['Echo','2x5','cols','PRB','PRB',[5,6],'test'],
    ['Soft Landing','2x4','halves','PB','PB',[2,3],'breather'],
    ['Jumping Light','3x3','split','PG','PG',[4,5],'test'],
    ['Leap of Gold','3x3','halves','PY','PY',[4,5],'test'],
    ['Over and Across','3x4','bands','PGY','PGY',[6,7],'twist'],
    ['Skipping Stair','4x3','steps','PYG','PGY',[6,7],'test'],
    ['Hollow Leap','3x4','bands','PGR','PGR',[6,7],'twist',['....','.xx.','....']],
    ['Rest Stop','3x3','split','PB','PB',[3,4],'breather'],
    ['Grasshopper','4x4','checker','PRYB','PRYB',[8,9],'test'],
    ['Across the Chasm','4x4','cols','PGRB','PGRB',[8,9],'twist',['....','x..x','....','....']],
    ['The Great Leap','4x4','rose','PBGY','PBGY',[9,11],'boss']
  ]],
  ['MOSAICS',[
    ['Tile Floor','3x3','quads','RBGY','RBGY',[4,5],'test'],
    ['Six Colours','3x4','checker','RBGYPW','RBGYP',[5,6],'test'],
    ['Stained Glass','4x4','ring','RGW','RG',[6,7],'test'],
    ['Patchwork','4x4','quads','BYPR','BYPR',[7,8],'twist'],
    ['Weaver','4x4','weave','RBG','RBG',[7,8],'test'],
    ['Inlay','4x4','rose','YPW','YP',[6,7],'twist'],
    ['Calm Courtyard','3x3','ring','BR','RB',[3,4],'breather'],
    ['Herald','4x4','bands','GBY','GBY',[8,9],'test'],
    ['Terraces','4x4','steps','RBGY','RBGY',[8,9],'test'],
    ['Labyrinth Tile','4x4','checker','RBGYW','RBGY',[8,9],'twist',['x...','....','....','...x']],
    ['Rosette','4x4','rose','YGP','YGP',[8,9],'test'],
    ['Breathing Room','3x4','halves','GY','GY',[4,5],'breather'],
    ['Chevron','4x4','zig','RYB','RYB',[9,10],'twist'],
    ['Tessellate','4x4','slash','BGRY','RBGY',[9,10],'test'],
    ['Cloister','4x4','rose','RBPW','RBP',[9,10],'twist',['....','.x..','....','..x.']],
    ['Parquet','4x4','bands','RBGY','RBGY',[9,10],'test'],
    ['Gentle Mosaic','3x3','checker','YGB','YGB',[4,5],'breather'],
    ['Fresco','4x4','rose','PBYG','PBYG',[10,11],'twist'],
    ['Cathedral Floor','4x5','bands','RBGW','RBG',[10,11],'test',['.....','.x.x.','.....','.....']],
    ['Grand Mosaic','4x4','bands','RBGYPW','RBGYP',[10,12],'boss']
  ]],
  ['MASTERWORKS',[
    ['Prelude','4x4','checker','RBGY','RBGY',[8,9],'test'],
    ['Overture','4x4','rose','PGY','PGY',[9,10],'twist'],
    ['Counterpoint','4x4','bands','RBGYP','RBGYP',[10,11],'test'],
    ['Fugue','4x5','rows','RBGY','RBGY',[10,11],'twist',['.....','..x..','.....','.....']],
    ['Nocturne','5x4','cols','BYRW','BYR',[10,11],'test',['....','.xx.','....','....','....']],
    ['Interlude','3x4','halves','RB','RB',[5,6],'breather'],
    ['Canon','4x4','steps','GYRB','RBGY',[10,11],'twist'],
    ['Sonata','4x5','weave','RBGY','RBGY',[11,12],'test',['x...x','.....','.....','x...x']],
    ['Requiem','5x4','bands','PBGY','PBGY',[11,12],'twist',['....','.x..','..x.','.x..','....']],
    ['Etude','4x4','rose','RBYP','RBYP',[11,12],'test'],
    ['Lullaby','3x4','rows','GY','GY',[4,5],'breather'],
    ['Rhapsody','4x5','checker','RBGYP','RBGYP',[12,13],'twist',['x....','.....','.....','....x']],
    ['Toccata','4x4','zig','PRBGY','PRBGY',[12,13],'test'],
    ['Cadenza','5x5','bands','RGBW','RGB',[12,13],'twist',['x...x','.....','..W..','.....','x...x']],
    ['Serenade','4x4','quads','YGPB','YGPB',[12,13],'test'],
    ['Coda Rest','3x4','checker','RB','RB',[5,6],'breather'],
    ['Symphony','5x5','rose','RBGY','RBGY',[13,14],'twist',['x...x','.x.x.','.....','.x.x.','x...x']],
    ['Opus','4x5','slash','RBGYP','RBGYP',[13,15],'test',['.....','..x..','.....','..x..']],
    ['Crescendo','5x5','bands','PBRGY','PBRGY',[14,16],'twist',['x...x','.x.x.','.....','.x.x.','x...x']],
    ['Magnum Opus','5x5','bands','RBGYP','RBGYP',[14,16],'boss',['x...x','.x.x.','.....','.x.x.','x...x']]
  ]]
];

function rng(seed){return ()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296}}
function makeTarget([h,w],pattern,colours,gaps){
  return Array.from({length:h},(_,r)=>Array.from({length:w},(_,c)=>{
    const mark=gaps?.[r]?.[c];if(mark==='x')return '.';if(mark && mark!=='.')return mark;
    const k=PATTERNS[pattern](r,c,h,w);return colours[((k%colours.length)+colours.length)%colours.length];
  }).join(''));
}
function scramble(target,steps,random){
  let g=rules.parse(target);
  for(let k=0;k<steps;k++){
    const options=[];
    g.forEach((row,r)=>row.forEach((t,c)=>rules.legalMoves(g,r,c).forEach(b=>{if(g[b[0]][b[1]]!==t)options.push([[r,c],b])})));
    if(!options.length)break;g=rules.swapCells(g,...options[Math.floor(random()*options.length)]);
  }
  return g.map(row=>row.join(''));
}
// Solving without a focus tile's moves must fail or take longer, so the level genuinely needs that tile.
const without=Object.fromEntries('RBGYP'.split('').map(t=>{const r=rules.create();r.moves[t]=[];return [t,solver.create(r)]}));
function needs(level,tile,par){
  try{return without[tile].solve(level,{maxStates:60000}).distance>par}
  catch(error){return true} // ponytail: unsolvable or past 60k states both count as "needed"; exhaustive proof if a level ever looks skippable
}

const seen=new Set(CORE_LEVELS.map(l=>l.start.join('|')+'>'+l.target.join('|')));
// Unchanged slots keep their previous start, so edits only re-search the slots that changed.
let previous=[];try{previous=require('../src/data/levels-2.js').GAME2_LEVELS}catch{}
const levels=[],failures=[];
WORLDS.forEach(([worldName,slots],w)=>slots.forEach(([name,size,pattern,colours,focus,[min,max],mood,gaps],i)=>{
  const dims=size.split('x').map(Number),target=makeTarget(dims,pattern,colours,gaps),random=rng((w+1)*1000+i);
  rules.validate({start:target,target});
  const tiles=new Set(target.join('').replace(/[.W]/g,''));
  if([...focus].some(t=>!tiles.has(t))){failures.push(`${name}: focus ${focus} not all in target ${target.join('|')}`);return}
  // Widen the par band one step at a time when a target cannot reach it; the log shows any slack used.
  const kept=previous.find(l=>l.name===name && l.tag===mood && l.target.join('|')===target.join('|'));
  if(kept){seen.add(kept.start.join('|')+'>'+target.join('|'));levels.push({name,start:kept.start,target,revision:kept.revision,world:w+1,tag:mood});console.log(String(levels.length).padStart(3)+' kept '+name);return}
  let best=null,slack=0;
  for(;!best && slack<=3;slack++)for(let attempt=0,found=0;attempt<200 && found<40;attempt++){
    const start=scramble(target,min+Math.floor(random()*(max-min+5)),random),key=start.join('|')+'>'+target.join('|');
    if(start.join('')===target.join('') || seen.has(key))continue;
    let result;try{result=solver.solve({name,start,target},LIMIT)}catch{continue}
    if(result.distance<min-slack || result.distance>max+slack)continue;
    const proof=solver.verify({name,start,target},result);if(!proof.fitsLimits)continue;
    const misplaced=[...start.join('')].filter((t,j)=>t!==target.join('')[j]).length,detour=result.distance-Math.ceil(misplaced/2);
    const score=mood==='teach'||mood==='breather'?-detour*10+result.distance:detour*10+result.distance;
    found++;if(best && score<=best.score)continue;
    if(![...focus].every(t=>needs({name,start,target},t,result.distance)))continue;
    best={start,score,key,par:result.distance};
  }
  if(!best){failures.push(`${worldName} ${i+1} ${name} ${target.join('|')}`);return}
  seen.add(best.key);
  levels.push({name,start:best.start,target,revision:1,world:w+1,tag:mood});
  console.log(String(levels.length).padStart(3)+' '+worldName.padEnd(15)+name.padEnd(18)+best.par+(slack>1?' (band +'+(slack-1)+')':''));
}));

const header='// Game 2 campaign, generated by scripts/make-game2.cjs; par fields come from check-levels --game 2 --update.\n';
fs.writeFileSync(rootPath('src','data','levels-2.js'),header+'export const GAME2_WORLDS = '+JSON.stringify(Object.fromEntries(WORLDS.map(([n],i)=>[i+1,n])))+';\nexport const GAME2_LEVELS = '+JSON.stringify(levels,null,2)+';\n');
console.log('Wrote '+levels.length+' levels.');
if(failures.length)throw new Error('No level found for:\n'+failures.join('\n'));
