import {PuzzleRules,PuzzleSolver,PuzzleArt} from './data.js';

export const KEYS={dark:'insight-theme-v1',sound:'insight-sound-v1'};
// The web build only plays studio drafts handed over by the editor, so every key is editor-scoped.
const PLAYTEST={attemptsKey:'insight-editor-attempts-v2',sessionKey:'insight-editor-session-v2'};
const UNAVAILABLE={name:'Playtest unavailable',start:['RB'],target:['BR'],world:1};
export function readPreference(key,fallback=null){try{return localStorage.getItem(key) ?? fallback}catch{return fallback}}
function readJSON(key){try{return JSON.parse(localStorage.getItem(key))}catch{return null}}
export function attemptKey(config,index){return (config.custom?.id ?? 'none')+':'+index}
function readAttempts(config) {
  const data=readJSON(config.attemptsKey);
  if(data && Number.isInteger(data.last) && config.levels[data.last] && data.entries && !Array.isArray(data.entries) && typeof data.entries==='object') {
    const entries={};
    for(const [id,entry] of Object.entries(data.entries))if(entry && Number.isInteger(entry.level) && config.levels[entry.level] && /^[\w-]{1,80}:0$/.test(id))entries[id]=entry;
    return {last:data.last,entries};
  }
  const saved=readJSON(config.sessionKey);
  if(saved && Number.isInteger(saved.level) && config.levels[saved.level])return {last:saved.level,entries:{[attemptKey(config,saved.level)]:saved}};
  return {last:0,entries:{}};
}
export function restoreSession(config,saved) {
  try {
    if(!saved || !Number.isInteger(saved.level) || !config.levels[saved.level] || !Array.isArray(saved.path) || saved.path.length>10000)return null;
    if(saved.puzzleStamp!==config.stamp)return null;
    const spec=config.levels[saved.level];
    if((saved.revision || 1)!==(spec.revision || 1))return null;
    let attempt={level:saved.level,target:PuzzleRules.parse(spec.target),...PuzzleRules.initialState(spec),moves:0};
    const history=[];let color=PuzzleArt.TILE_LIGHTS.B;
    for(const move of saved.path) {
      if(!Array.isArray(move) || move.length!==2 || !move.every(pos=>Array.isArray(pos) && pos.length===2 && pos.every(Number.isInteger)))return null;
      const [a,b]=move;
      if(PuzzleRules.key(attempt.board)===PuzzleRules.key(attempt.target))return null;
      const next=PuzzleRules.transition(attempt,a,b);
      history.push({board:attempt.board,moves:attempt.moves,color,move});
      color=PuzzleArt.TILE_LIGHTS[attempt.board[a[0]][a[1]]];
      attempt={...attempt,...next,moves:attempt.moves+1};
    }
    return {attempt,history,color};
  } catch{return null}
}
export function snapshot(config,attempt,history) {
  return {revision:config.levels[attempt.level].revision || 1,level:attempt.level,path:history.map(step=>step.move),puzzleStamp:config.stamp};
}
export function stashAttempt(state) {
  const saved=snapshot(state.config,state.attempt,state.history);
  if(state.restart)saved.restart=snapshot(state.config,state.restart.attempt,state.restart.history);
  return {last:state.attempt.level,entries:{...state.attempts.entries,[attemptKey(state.config,state.attempt.level)]:saved}};
}
export function solved(attempt){return PuzzleRules.key(attempt.board)===PuzzleRules.key(attempt.target)}

export function startPuzzle(state,index,{restart=false}={}) {
  if(!state.config.levels[index])return state;
  const attempts=state.attempt?stashAttempt(state):state.attempts,config=state.config,spec=config.levels[index];
  const saved=attempts.entries[attemptKey(config,index)];
  const restored=restart?null:restoreSession(config,saved),resume=restored && !solved(restored.attempt);
  const attempt=resume?restored.attempt:{level:index,target:PuzzleRules.parse(spec.target),...PuzzleRules.initialState(spec),moves:0};
  const recovery=resume && !restored.history.length?restoreSession(config,saved.restart):null;
  return {...state,attempt,attempts,history:resume?restored.history:[],restart:recovery?.attempt.moves?recovery:null,color:resume?restored.color:PuzzleArt.TILE_LIGHTS.B};
}

// A missing or invalid editor handoff sets config.error; GameApp then sends the user back to the editor.
export function initializeGame() {
  let custom=null,error=null;
  try{
    if(!new URLSearchParams(location.search).has('editor'))throw new Error();
    const preview=JSON.parse(sessionStorage.getItem('insight-editor-preview-v1')),verified=PuzzleSolver.verify(preview,preview);
    if(!verified.par || typeof preview.id!=='string' || !/^[\w-]{1,80}$/.test(preview.id))throw new Error();
    custom={...verified,id:preview.id,world:1};
  }catch{error='Playtest unavailable. Open the editor and validate your puzzle again.'}
  const spec=custom?PuzzleRules.validate(custom):null;if(spec)delete spec.name;
  const config={...PLAYTEST,custom,error,levels:[custom || UNAVAILABLE],stamp:custom?JSON.stringify([custom.id,spec]):null};
  const attempts=custom?readAttempts(config):{last:0,entries:{}};
  const state={config,attempts,attempt:null,history:[],restart:null,color:PuzzleArt.TILE_LIGHTS.B,dark:readPreference(KEYS.dark)!=='light',sound:readPreference(KEYS.sound)!=='off'};
  const restored=custom?restoreSession(config,attempts.entries[attemptKey(config,attempts.last)]):null;
  return startPuzzle(state,restored && !solved(restored.attempt)?restored.attempt.level:0);
}
