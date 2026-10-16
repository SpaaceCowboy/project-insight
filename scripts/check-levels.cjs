const fs=require('node:fs'),assert=require('node:assert/strict');
const {rootPath}=require('./check-paths.cjs');
const {PuzzleRules:rules}=require('../src/puzzle-rules.js'),{PuzzleSolver:solver}=require('../src/puzzle-solver.js');
const {greedyRate}=require('./level-metrics.cjs');
// `--game 2` checks the Game 2 campaign, `--game 3` the studio levels; each writes its own certificates.
const game=process.argv.includes('--game')?process.argv[process.argv.indexOf('--game')+1]:'1',game2=game==='2',studio=game==='3',suffix=game==='1'?'':'-'+game;
assert(['1','2','3'].includes(game),'Unknown --game '+game);
const data=require('../src/data/levels'+suffix+'.js'),list=game2?data.GAME2_LEVELS:studio?data.STUDIO_LEVELS:data.CORE_LEVELS,count=game2?100:studio?list.length:106;
const levels=JSON.parse(JSON.stringify(list));
assert.equal(levels.length,count);
if(process.argv.includes('--audit')){audit();return}
const results=[];
for(const [index,level] of levels.entries()){
  rules.validate(level);
  for(const field of ['switches','gates','rotators','allowances','limitedPar','allowanceFloor','solution_len'])if(process.argv.includes('--update'))delete level[field];else assert.equal(level[field],undefined,'Removed campaign feature '+field);
  const classic=solver.solve(level,{maxStates:350000,timeout:8000});solver.verify(level,classic);
  if(process.argv.includes('--update'))level.par=classic.distance;
  assert.equal(classic.distance,level.par,'Optimal par '+(index+1));
  // Harder Game 2 levels must not be no-brainers: a greedy player may win at most 60% of the time (level-design.md).
  if(game2 && ['test','twist','boss'].includes(level.tag))assert(greedyRate(level,level.par)<=.6,'Level '+(index+1)+' is solvable without thinking');
  results.push({level:index+1,name:level.name,world:level.world,par:level.par,width:level.start[0].length,...classic});
  console.log((index+1)+': '+classic.distance+' moves '+level.name);
}
fs.mkdirSync(rootPath('artifacts'),{recursive:true});
fs.writeFileSync(rootPath('artifacts','level-checks'+suffix+'.json'),JSON.stringify(results,null,2)+'\n');
fs.writeFileSync(rootPath('src','data','level-solutions'+suffix+'.js'),'// Generated optimal routes.\nexport const LEVEL_SOLUTIONS = '+JSON.stringify(results.map(r=>r.path))+';\n');
if(process.argv.includes('--update'))fs.writeFileSync(rootPath('src','data','levels'+suffix+'.js'),studio?fs.readFileSync(rootPath('src','data','levels-3.js'),'utf8').replace(/export const STUDIO_LEVELS = [\s\S]*$/,'export const STUDIO_LEVELS = '+JSON.stringify(levels,null,2)+';\n'):game2?fs.readFileSync(rootPath('src','data','levels-2.js'),'utf8').replace(/export const GAME2_LEVELS = [\s\S]*$/,'export const GAME2_LEVELS = '+JSON.stringify(levels,null,2)+';\n'):'// Stable campaign positions; changed boards have individual revisions.\nexport const CORE_LEVELS = '+JSON.stringify(levels,null,2)+';\n');
console.log('All '+count+' puzzles verified.');

// `--audit` is read-only: difficulty signals from scripts/level-metrics.cjs (sources in level-design.md).
function audit(){
  const {counterintuitive,openingChoices,focusNeed}=require('./level-metrics.cjs'),cap={maxStates:350000},first={};
  console.log(['lvl','world','tag','par','ci','neutral','choices','greedy','movers','new','focus','name'].join('\t'));
  for(const [index,level] of levels.entries()){
    const {path}=solver.solve(level,cap),{ci,neutral,movers}=counterintuitive(level,path),{good,legal}=openingChoices(level,path.length,cap);
    const fresh=[...movers].filter(t=>!first[t]);fresh.forEach(t=>first[t]=index+1);
    const focus=[...(level.design?.focus || '')].map(t=>t+':'+(focusNeed(level,t,path.length,cap) || 'no')).join(' ');
    console.log([index+1,level.world,level.tag || '',path.length,ci,neutral,good+'/'+legal,greedyRate(level,path.length).toFixed(2),[...movers].sort().join(''),fresh.sort().join('') || '-',focus || '-',level.name].join('\t'));
  }
}
