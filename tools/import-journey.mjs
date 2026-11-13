// Replaces the Journey with puzzles exported from an online account (v0.2.30: the 100 puzzles of the account "Levels", in its own numbering; that account was
// deleted in v0.2.31 and tools/journey-levels.json, its export, is the source now).
// Each puzzle is solved for its optimal route with the website's solver, which becomes its par and the route the unit tests replay. A board too large to
// search exhaustively (a full 5x5 has far too many arrangements) gets the shortest route a beam search finds instead: still a verified solution, its
// length is then an upper bound rather than the true par (par is not shown in the game; only the tests use it).
//
// Usage: node tools/import-journey.mjs <export.json> <path-to-website-game-folder>
//   export.json: [{"number":1,"code":"…","start":["RB"],"target":["BR"]}, …] in Journey order, from a read-only query such as
//     SELECT json_agg(json_build_object('number',g.level_number,'code',g.code,'start',g.start_board,'target',g.target_board) ORDER BY g.level_number)
//     FROM grids g JOIN users u ON u.id=g.owner_id WHERE u.username='Levels' AND g.published_at IS NOT NULL;
//   the website game folder holds solver.js and rules.js (web/src/game on the `web` branch).
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const [exportFile,gameFolder]=process.argv.slice(2);
if(!exportFile || !gameFolder)throw new Error('Usage: node tools/import-journey.mjs <export.json> <website game folder>');
const {PuzzleSolver}=await import(pathToFileURL(join(resolve(gameFolder),'solver.js')).href);

/** Tiles out of place; the beam search keeps the boards closest to the target by this count. */
function mismatches(state,target){let n=0;for(let i=0;i<state.length;i++)if(state[i]!==target[i])n++;return n}

/** A route found by beam search: each step keeps the [width] best new boards; the beam restarts wider when it stalls. */
function beamSolve(level){
  const MOVES={R:[[-1,0],[1,0]],B:[[0,-1],[0,1]],G:[[-1,1],[1,-1]],Y:[[-1,-1],[1,1]],P:[[-2,0],[2,0],[0,-2],[0,2]],W:[]};
  const width=level.start[0].length,height=level.start.length,start=level.start.join(''),target=level.target.join('');
  const edges=Object.fromEntries(Object.entries(MOVES).map(([t,ds])=>[t,Array.from({length:start.length},(_,i)=>ds.map(([dr,dc])=>{
    const r=Math.floor(i/width)+dr,c=i%width+dc;return r>=0&&r<height&&c>=0&&c<width&&start[r*width+c]!=='.'?r*width+c:-1}).filter(j=>j>=0))]));
  for(const beam of [2000,8000,30000,100000]){
    const parent=new Map([[start,null]]);
    let front=[start];
    for(let depth=0;depth<400 && front.length;depth++){
      const next=[];
      for(const s of front)for(let i=0;i<s.length;i++){
        if(s[i]==='.')continue;
        for(const j of edges[s[i]][i]){
          if(s[i]===s[j])continue;
          const a=s.split('');[a[i],a[j]]=[a[j],a[i]];const k=a.join('');
          if(parent.has(k))continue;
          parent.set(k,{previous:s,move:[i,j]});
          if(k===target){const path=[];let cur=k;while(parent.get(cur)){const st=parent.get(cur);path.push(st.move);cur=st.previous}return path.reverse()}
          next.push(k);
        }
      }
      next.sort((x,y)=>mismatches(x,target)-mismatches(y,target)||(Math.random()-.5));
      front=next.slice(0,beam);
      if(parent.size>12e6)break;
    }
  }
  throw new Error('No route found');
}

const puzzles=JSON.parse(readFileSync(exportFile,'utf8'));
puzzles.forEach((p,i)=>{if(p.number!==i+1)throw new Error(`Expected puzzle ${i+1}, found ${p.number}: the export must be complete and in order.`)});
const levels=[],solutions=[];
for(const [i,p] of puzzles.entries()){
  const level={name:`Journey ${i+1}`,start:p.start,target:p.target};
  let path,exact=true;
  try{({path}=PuzzleSolver.solve(level,{maxStates:6e6}))}
  catch(error){if(!/Search limit/.test(error.message))throw error;exact=false;path=beamSolve(level)}
  const verified=PuzzleSolver.verify(level,{path});
  // Worlds of 20, as before: only a fallback, the game itself reads levels in order.
  levels.push({name:level.name,start:p.start,target:p.target,world:Math.floor(i/20)+1,par:verified.par});
  solutions.push(path);
  console.log(`${String(i+1).padStart(3)} ${p.code} ${p.start.length}x${p.start[0].length} par ${verified.par}${exact?'':' (beam search: an upper bound)'}`);
}
mkdirSync(join(root,'app/src/main/assets'),{recursive:true});
writeFileSync(join(root,'app/src/main/assets/levels.json'),JSON.stringify(levels)+'\n');
mkdirSync(join(root,'app/src/test/resources'),{recursive:true});
writeFileSync(join(root,'app/src/test/resources/solutions.json'),JSON.stringify(solutions)+'\n');
console.log(`Imported ${levels.length} Journey levels from ${exportFile}`);
