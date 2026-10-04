// One solver for editor validation and the built-in level checks.
(function(root) {
  function create(rules) {
    const moves=rules.moves;
    function solveLimited(level,options) {
      const remaining=options.remaining,width=level.start[0].length;
      if(!Array.isArray(remaining) || remaining.length!==level.start.length || !remaining.every((row,r)=>Array.isArray(row) && row.length===width && row.every((n,c)=>Number.isInteger(n) && ('.W'.includes(level.start[r][c]) ? n===0 : n>=0 && n<=6))))throw new Error('Invalid tile allowances.');
      const start=rules.initialState(level,remaining),queue=[{state:start,previous:null}],seen=new Map([[rules.key(start.board),[remaining.flat()]]]);
      const deadline=Date.now()+(options.timeout ?? Infinity);
      // Earlier states with at least as many moves on every tile dominate later ones.
      for(let i=0;i<queue.length;i++){
        if(queue.length>(options.maxStates ?? Infinity) || Date.now()>deadline)throw new Error('Search limit reached. This puzzle is not verified; try a smaller or simpler board.');
        const node=queue[i];
        if(rules.key(node.state.board)===level.target.join('|')){const path=[];for(let step=node;step.previous;step=step.previous)path.push(step.move);path.reverse();return {distance:path.length,path}}
        if(i%2048===0)options.progress?.(queue.length);
        for(let r=0;r<level.start.length;r++)for(let c=0;c<width;c++)for(const to of rules.legalMoves(node.state.board,r,c,node.state.remaining)){
          const state=rules.transition(node.state,[r,c],to),key=rules.key(state.board),left=state.remaining.flat(),records=seen.get(key) || [];
          if(records.some(before=>before.every((n,j)=>n>=left[j])))continue;
          records.push(left);seen.set(key,records);queue.push({state,previous:node,move:[r*width+c,to[0]*width+to[1]]});
        }
      }
      throw new Error('Unsolvable: '+level.name);
    }
    function solve(level,options={}) {
      level=rules.validate(level);
      if(options.remaining)return solveLimited(level,options);
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
      function replay(path,remaining=null){
        if(!Array.isArray(path) || path.length>10000)throw new Error('Missing verified route.');
        let state=rules.initialState(spec,remaining);
        const identities=Array.from({length:size},(_,i)=>i),needed=identities.map(()=>0);
        for(const move of path){
          if(!Array.isArray(move) || move.length!==2 || !move.every(i=>Number.isInteger(i) && i>=0 && i<size))throw new Error('Invalid solution route.');
          if(rules.key(state.board)===spec.target.join('|'))throw new Error('Invalid solution move.');
          const [from,to]=move;
          state=rules.transition(state,[Math.floor(from/width),from%width],[Math.floor(to/width),to%width]);
          needed[identities[from]]++;[identities[from],identities[to]]=[identities[to],identities[from]];
        }
        if(rules.key(state.board)!==spec.target.join('|'))throw new Error('The route does not solve this puzzle.');
        return needed;
      }
      const classicNeeded=replay(result?.path),limitedPath=result.limitedPath || result.path;
      const needed=limitedPath===result.path ? classicNeeded : replay(limitedPath);
      const allowanceFloor=spec.start.map((row,r)=>[...row].map((t,c)=>needed[r*width+c])),fitsLimits=needed.every(n=>n<=6);
      if(result.limitedPath && !fitsLimits)throw new Error('Limited route exceeds the six-move cap.');
      if(fitsLimits)replay(limitedPath,allowanceFloor.map((row,r)=>row.map((n,c)=>'.W'.includes(spec.start[r][c])?0:Math.max(3,n))));
      return {...spec,par:result.path.length,limitedPar:fitsLimits?limitedPath.length:null,solution_len:result.path.length,allowanceFloor,fitsLimits,path:result.path.map(move=>move.slice()),limitedPath:fitsLimits?limitedPath.map(move=>move.slice()):null};
    }
    return {solve,verify};
  }
  const solver=create(typeof module!=='undefined' && module.exports ? require('./puzzle-rules.js') : root.PuzzleRules);
  solver.create=create;
  if (typeof module!=='undefined' && module.exports) module.exports=solver;
  if (typeof window!=='undefined' || typeof module==='undefined') root.PuzzleSolver=solver;
})(globalThis);
