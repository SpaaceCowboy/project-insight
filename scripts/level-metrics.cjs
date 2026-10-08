// Difficulty signals shared by make-game2.cjs and check-levels --audit; sources in level-design.md.
const {PuzzleRules:rules}=require('../src/puzzle-rules.js'),{PuzzleSolver:solver}=require('../src/puzzle-solver.js');

// Counterintuitive moves (van Kreveld et al. 2015): route moves that increase misplaced tiles.
// ponytail: scores the one optimal route the solver returns; the minimum over all optimal routes would be stricter.
function counterintuitive(level,path,focus=''){
  const target=level.target.join(''),board=level.start.join('').split(''),movers=new Set();
  const misplaced=()=>board.filter((t,i)=>t!==target[i]).length;
  let ci=0,focusCi=0,neutral=0;
  for(const [a,b] of path){
    const before=misplaced(),mover=board[a];movers.add(mover);[board[a],board[b]]=[board[b],board[a]];
    const change=misplaced()-before;if(change>0){ci++;if(focus.includes(mover))focusCi++}else if(change===0)neutral++;
  }
  return {ci,focusCi,neutral,movers};
}
// Opening choices (Pelánek & Jarušek 2011): legal opening moves that stay optimal, out of all legal opening moves.
function openingChoices(level,par,cap){
  const g=rules.parse(level.start);let legal=0,good=0;
  g.forEach((row,r)=>row.forEach((t,c)=>rules.legalMoves(g,r,c).forEach(to=>{
    if(g[to[0]][to[1]]===t)return;legal++;
    const start=rules.swapCells(g,[r,c],to).map(x=>x.join(''));
    try{if(solver.solve({start,target:level.target},cap).distance===par-1)good++}
    catch(error){if(!/^Search limit/.test(error.message))throw error}
  })));
  return {good,legal};
}
// Focus requirement (Butler et al. 2013): 'all' if no solution exists without the tile's moves,
// 'longer' if one exists but is longer than par, false if the tile can be skipped at no cost, '?' at the cap.
const without=Object.fromEntries([...'RBGYP'].map(t=>{const r=rules.create();r.moves[t]=[];return [t,solver.create(r)]}));
function focusNeed(level,tile,par,cap){
  try{return without[tile].solve(level,cap).distance>par?'longer':false}
  catch(error){if(/^Unsolvable/.test(error.message))return 'all';if(/^Search limit/.test(error.message))return '?';throw error}
}
// Greedy solve rate ("no-brainer" test): a player who always takes a move that fixes the most misplaced tiles,
// breaking ties at random, wins within 3x par in this share of seeded trials. High = solvable without thinking.
function greedyRate(level,par,trials=50){
  const target=level.target.join('');let seed=1,wins=0;
  const random=()=>(seed=Math.imul(seed^seed>>>15,2246822507)+0x6D2B79F5|0,(seed>>>0)/4294967296);
  for(let t=0;t<trials;t++){
    let g=rules.parse(level.start);
    for(let step=0;step<Math.max(3,par*3);step++){
      const misplaced=b=>[...b].filter((x,i)=>x!==target[i]).length,before=misplaced(g.flat().join(''));
      let best=[],bestGain=-Infinity;
      g.forEach((row,r)=>row.forEach((tile,c)=>rules.legalMoves(g,r,c).forEach(to=>{
        if(g[to[0]][to[1]]===tile)return;
        const gain=before-misplaced(rules.swapCells(g,[r,c],to).flat().join(''));
        if(gain>bestGain){bestGain=gain;best=[]}if(gain===bestGain)best.push([[r,c],to]);
      })));
      if(!best.length)break;
      g=rules.swapCells(g,...best[Math.floor(random()*best.length)]);
      if(g.flat().join('')===target){wins++;break}
    }
  }
  return wins/trials;
}
module.exports={counterintuitive,openingChoices,focusNeed,greedyRate};
