const fs=require('node:fs'),assert=require('node:assert/strict');
const {rootPath}=require('./check-paths.cjs');
const {PuzzleRules:rules}=require('../src/puzzle-rules.js'),{PuzzleSolver:solver}=require('../src/puzzle-solver.js');
// `--game 2` checks the Game 2 campaign and writes its own certificates.
const game2=process.argv.includes('--game') && process.argv[process.argv.indexOf('--game')+1]==='2',suffix=game2?'-2':'';
const data=require('../src/data/levels'+suffix+'.js'),count=game2?100:106;
const levels=JSON.parse(JSON.stringify(game2?data.GAME2_LEVELS:data.CORE_LEVELS));
assert.equal(levels.length,count);
if(process.argv.includes('--audit')){audit();return}
const results=[];
for(const [index,level] of levels.entries()){
  rules.validate(level);
  for(const field of ['switches','gates','rotators','allowances','limitedPar','allowanceFloor','solution_len'])if(process.argv.includes('--update'))delete level[field];else assert.equal(level[field],undefined,'Removed campaign feature '+field);
  const classic=solver.solve(level,{maxStates:350000,timeout:8000});solver.verify(level,classic);
  if(process.argv.includes('--update'))level.par=classic.distance;
  assert.equal(classic.distance,level.par,'Optimal par '+(index+1));
  results.push({level:index+1,name:level.name,world:level.world,par:level.par,width:level.start[0].length,...classic});
  console.log((index+1)+': '+classic.distance+' moves '+level.name);
}
fs.mkdirSync(rootPath('artifacts'),{recursive:true});
fs.writeFileSync(rootPath('artifacts','level-checks'+suffix+'.json'),JSON.stringify(results,null,2)+'\n');
fs.writeFileSync(rootPath('src','data','level-solutions'+suffix+'.js'),'// Generated optimal routes.\nexport const LEVEL_SOLUTIONS = '+JSON.stringify(results.map(r=>r.path))+';\n');
if(process.argv.includes('--update'))fs.writeFileSync(rootPath('src','data','levels'+suffix+'.js'),game2?fs.readFileSync(rootPath('src','data','levels-2.js'),'utf8').replace(/export const GAME2_LEVELS = [\s\S]*$/,'export const GAME2_LEVELS = '+JSON.stringify(levels,null,2)+';\n'):'// Stable campaign positions; changed boards have individual revisions.\nexport const CORE_LEVELS = '+JSON.stringify(levels,null,2)+';\n');
console.log('All '+count+' puzzles verified.');

// `--audit` is read-only: difficulty signals from scripts/level-metrics.cjs (sources in level-design.md).
function audit(){
  const {counterintuitive,openingChoices,focusNeed}=require('./level-metrics.cjs'),cap={maxStates:350000},first={};
  console.log(['lvl','world','tag','par','ci','neutral','choices','movers','new','focus','name'].join('\t'));
  for(const [index,level] of levels.entries()){
    const {path}=solver.solve(level,cap),{ci,neutral,movers}=counterintuitive(level,path),{good,legal}=openingChoices(level,path.length,cap);
    const fresh=[...movers].filter(t=>!first[t]);fresh.forEach(t=>first[t]=index+1);
    const focus=[...(level.design?.focus || '')].map(t=>t+':'+(focusNeed(level,t,path.length,cap) || 'no')).join(' ');
    console.log([index+1,level.world,level.tag || '',path.length,ci,neutral,good+'/'+legal,[...movers].sort().join(''),fresh.sort().join('') || '-',focus || '-',level.name].join('\t'));
  }
}
