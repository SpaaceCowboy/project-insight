// One solver for editor validation and the built-in level checks.
import {PuzzleRules} from './puzzle-rules.js';
function create(rules) {
  const moves=rules.moves;
  function solve(level,options={}) {
    level=rules.validate(level);
    const deadline=Date.now()+(options.timeout ?? Infinity), maxStates=options.maxStates ?? Infinity;
    // ponytail: bounded exhaustive search; report unverified when the editor limit is reached.
    const width = Math.max(...level.start.map(row => row.length));
    const start = level.start.join('');
    const target = level.target.join('');
    const height = level.start.length;
    const edges = Object.fromEntries(Object.entries(moves).map(([type, directions]) => [type, Array.from({length:start.length}, (_, i) => directions.map(([dr, dc]) => {
      const r = Math.floor(i/width)+dr, c = i%width+dc;
      return r>=0 && r<height && c>=0 && c<width ? r*width+c : -1;
    }).filter(j => j>=0 && start[j]!=='.'))]));
    const maps = [new Map([[start, null]]), new Map([[target, null]])];
    let fronts = [[start], [target]];
    if (start === target) return {distance:0, path:[]};
    while (fronts[0].length && fronts[1].length) {
      const side = fronts[0].length <= fronts[1].length ? 0 : 1;
      const next = [];
      for (const state of fronts[side]) {
        const count=maps[0].size+maps[1].size;
        if (count>maxStates || Date.now()>deadline) throw new Error("Search limit reached. This puzzle is not verified; try a smaller or simpler board.");
        if (count%2048===0) options.progress?.(count);
        for (let i=0;i<state.length;i++) {
          if (state[i]==='.') continue;
          for (const j of edges[state[i]][i]) {
            if (state[i]===state[j]) continue;
            const chars = state.split('');
            [chars[i], chars[j]] = [chars[j], chars[i]];
            const key = chars.join('');
            if (maps[side].has(key)) continue;
            maps[side].set(key, {previous:state, move:[i,j]});
            if (maps[1-side].has(key)) {
              const halves = [[], []];
              for (let s=0;s<2;s++) {
                let cursor=key;
                while (maps[s].get(cursor)) {
                  const step=maps[s].get(cursor);
                  halves[s].push(s===0 ? step.move : [step.move[1], step.move[0]]);
                  cursor=step.previous;
                }
              }
              const path = [...halves[0].reverse(), ...halves[1]];
              return {distance:path.length, path};
            }
            next.push(key);
          }
        }
      }
      fronts[side]=next;
    }
    throw new Error(`Unsolvable: ${level.name}`);
  }

  function verify(level,result) {
    const spec=rules.validate(level),width=spec.start[0].length,size=width*spec.start.length;
    const path=result?.path;
    if(!Array.isArray(path) || path.length>10000)throw new Error('Missing verified route.');
    let state=rules.initialState(spec);
    for(const move of path){
      if(!Array.isArray(move) || move.length!==2 || !move.every(i=>Number.isInteger(i) && i>=0 && i<size))throw new Error('Invalid solution route.');
      if(rules.key(state.board)===spec.target.join('|'))throw new Error('Invalid solution move.');
      const [from,to]=move;
      state=rules.transition(state,[Math.floor(from/width),from%width],[Math.floor(to/width),to%width]);
    }
    if(rules.key(state.board)!==spec.target.join('|'))throw new Error('The route does not solve this puzzle.');
    return {...spec,par:path.length,path:path.map(move=>move.slice())};
  }
  return {solve,verify};
}
export const PuzzleSolver=create(PuzzleRules);
PuzzleSolver.create=create;
