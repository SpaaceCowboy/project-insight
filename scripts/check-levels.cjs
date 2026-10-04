const fs=require('node:fs'),assert=require('node:assert/strict');
const {rootPath}=require('./check-paths.cjs');
const {PuzzleRules:rules}=require('../src/puzzle-rules.js'),{PuzzleSolver:solver}=require('../src/puzzle-solver.js');
const levels=JSON.parse(JSON.stringify(require('../src/data/levels.js').CORE_LEVELS));
assert.equal(levels.length,106);
const results=[];
for(const [index,level] of levels.entries()){
  rules.validate(level);
  for(const field of ['switches','gates','rotators','allowances'])assert.equal(level[field],undefined,'Removed campaign feature '+field);
  const options={maxStates:350000,timeout:8000},optimal=solver.solve(level,options);
  const classic=optimal;
  let limited=classic,proof=solver.verify(level,classic);
  if(!proof.fitsLimits){
    const remaining=level.start.map(row=>[...row].map(t=>'.W'.includes(t)?0:6));
    limited=solver.solve(level,{...options,remaining});proof=solver.verify(level,{...classic,limitedPath:limited.path});
  }
  if(process.argv.includes('--update')){level.par=classic.distance;level.limitedPar=limited.distance;level.solution_len=classic.distance;level.allowanceFloor=proof.allowanceFloor;}
  assert.equal(classic.distance,level.par,'Classic optimal par '+(index+1));assert.equal(limited.distance,level.limitedPar,'Limited optimal par '+(index+1));assert(proof.fitsLimits);
  assert.deepEqual(proof.allowanceFloor,JSON.parse(JSON.stringify(level.allowanceFloor)));
  const width=level.start[0].length;
  results.push({level:index+1,name:level.name,world:level.world,par:level.par,limitedPar:level.limitedPar,width,...classic,limitedPath:limited.path});
  console.log((index+1)+': '+classic.distance+'/'+limited.distance+' moves '+level.name);
}
fs.mkdirSync(rootPath('artifacts'),{recursive:true});
fs.writeFileSync(rootPath('artifacts','level-checks.json'),JSON.stringify(results,null,2)+'\n');
fs.writeFileSync(rootPath('src','data','level-solutions.js'),'// Generated optimal routes for both campaign modes.\nexport const LEVEL_SOLUTIONS = '+JSON.stringify(results.map(r=>r.path))+';\nexport const LEVEL_LIMIT_SOLUTIONS = '+JSON.stringify(results.map(r=>r.limitedPath))+';\n');
if(process.argv.includes('--update'))fs.writeFileSync(rootPath('src','data','levels.js'),'// Stable campaign positions; changed boards have individual revisions.\nexport const CORE_LEVELS = '+JSON.stringify(levels,null,2)+';\n');
console.log('All 106 puzzles verified in both modes.');
