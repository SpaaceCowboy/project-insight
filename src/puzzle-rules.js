// Shared rules; also available to Node checks and the editor worker.
function create() {
  const MOVES={R:[[-1,0],[1,0]],B:[[0,-1],[0,1]],G:[[-1,1],[1,-1]],Y:[[-1,-1],[1,1]],P:[[-2,0],[2,0],[0,-2],[0,2]],W:[]};
  function clone(g){return g.map(r=>r.slice())}
  function parse(rows){return rows.map(r=>[...r])}
  function key(g){return g.map(r=>r.join('')).join('|')}
  function active(g, r, c) {
    return r >= 0 && r < g.length && c >= 0 && c < g[r].length && g[r][c] !== '.';
  }
  function legalMoves(g, r, c) {
    if (!active(g, r, c)) return [];
    return MOVES[g[r][c]].map(([dr,dc])=>[r+dr,c+dc]).filter(([nr,nc])=>active(g,nr,nc));
  }
  function swapCells(g,a,b){const h=clone(g);[h[a[0]][a[1]],h[b[0]][b[1]]]=[h[b[0]][b[1]],h[a[0]][a[1]]];return h}
  function initialState(level) {
    return {board:parse(level.start)};
  }
  function transition(state, a, b) {
    if (!legalMoves(state.board,...a).some(([r,c])=>r===b[0] && c===b[1])) throw new Error('Invalid solution move.');
    return {board:swapCells(state.board,a,b)};
  }

  function validate(level,matchCounts=true) {
    if (!level || typeof level!=='object') throw new Error('Choose a puzzle file.');
    const {start,target}=level;
    if (!Array.isArray(start) || !Array.isArray(target) || start.length<1 || start.length>5 || start.length!==target.length || typeof start[0]!=='string') throw new Error('Boards must have 1–5 rows.');
    const width=start[0].length;
    if (width<1 || width>5 || ![...start,...target].every(row=>typeof row==='string' && row.length===width && /^[RBGYWP.]+$/.test(row))) throw new Error('Boards need 1–5 columns and supported tiles.');
    const a=start.join(''),b=target.join('');
    if (matchCounts && ![...a].some(t=>t!=='.')) throw new Error('Add at least one tile.');
    if ([...a].some((t,i)=>(t==='.')!==(b[i]==='.'))) throw new Error('Gaps must occupy the same cells on both boards.');
    if (matchCounts && [...a].sort().join('')!==[...b].sort().join('')) throw new Error('Start and Target need the same number of each tile.');
    const spec={name:typeof level.name==='string' ? level.name.trim().slice(0,60)||'Untitled puzzle' : 'Untitled puzzle',start:start.slice(),target:target.slice()};
    if(level.revision!==undefined){if(!Number.isInteger(level.revision) || level.revision<1)throw new Error('Invalid puzzle revision.');spec.revision=level.revision}
    return spec;
  }
  return {moves:MOVES,clone,parse,key,active,legalMoves,swapCells,validate,initialState,transition};
}
export const PuzzleRules=create();
PuzzleRules.create=create;
