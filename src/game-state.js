import {CORE_LEVELS,PuzzleRules,PuzzleSolver,PuzzleArt} from './data.js';
import {newAttempt,restoreAttempt} from './achievements.mjs';

export const WORLD_NAMES={1:'FIRST CONNECTIONS',2:'BORROWED PATHS',3:'LAST CHARGE',4:'CONVERGENCE',5:'COMPLEX MAPS'};
export const KEYS={dev:'insight-dev-mode-v1',dark:'insight-theme-v1',sound:'insight-sound-v1',game:'insight-active-game-v1'};
// Each campaign keeps its own solved levels, access and attempts. Revision 3 (no stars or Tile Limits) starts fresh
// under new keys and leaves older keys untouched. Only Game 1 earns achievements, which index its levels.
// Game 2 levels load on demand (loadGame).
export const GAMES={
  1:{achievements:true,levels:CORE_LEVELS,worldNames:WORLD_NAMES,progressKey:'insight-campaign-r3',campaignKey:'insight-campaign-v3',sessionKey:'insight-session-r3',attemptsKey:'insight-attempts-r3'},
  2:{achievements:false,levels:null,worldNames:null,progressKey:'insight-game2-progress-v2',campaignKey:'insight-game2-campaign-v2',sessionKey:'insight-game2-session-v2',attemptsKey:'insight-game2-attempts-v2'}
};
export function activeGame(){return readPreference(KEYS.game)==='2'?2:1}
export async function loadGame(id) {
  if(GAMES[id].levels)return;
  const {GAME2_LEVELS,GAME2_WORLDS}=await import('./data/levels-2.js');
  GAMES[id].levels=GAME2_LEVELS;GAMES[id].worldNames=GAME2_WORLDS;
}
export function readPreference(key,fallback=null){try{return localStorage.getItem(key) ?? fallback}catch{return fallback}}
function readJSON(key){try{return JSON.parse(localStorage.getItem(key))}catch{return null}}
export function readProgress(config) {
  const done={};
  if(!config.custom)for(const [id,value] of Object.entries(readJSON(config.progressKey)?.done || {}))
    if(/^[1-9]\d*$/.test(id) && +id<=config.levels.length && value===true)done[id]=true;
  return {done};
}
export function attemptKey(config,index){return (config.custom?config.custom.id+':':'')+index}
function readAttempts(config) {
  const data=readJSON(config.attemptsKey);
  if(data && Number.isInteger(data.last) && config.levels[data.last] && data.entries && !Array.isArray(data.entries) && typeof data.entries==='object') {
    const entries={};
    for(const [id,entry] of Object.entries(data.entries))if(entry && Number.isInteger(entry.level) && config.levels[entry.level] && (config.custom?/^[\w-]{1,80}:0$/.test(id):id===attemptKey(config,entry.level)))entries[id]=entry;
    return {last:data.last,entries};
  }
  const saved=readJSON(config.sessionKey);
  if(saved && Number.isInteger(saved.level) && config.levels[saved.level])return {last:saved.level,entries:{[attemptKey(config,saved.level)]:saved}};
  return {last:0,entries:{}};
}
export function restoreSession(config,saved,eligible) {
  try {
    if(!saved || !Number.isInteger(saved.level) || !config.levels[saved.level] || !Array.isArray(saved.path) || saved.path.length>10000)return null;
    if(config.custom && saved.puzzleStamp!==config.stamp)return null;
    const spec=config.levels[saved.level];
    if((saved.revision || 1)!==(spec.revision || 1))return null;
    let attempt={level:saved.level,target:PuzzleRules.parse(spec.target),...PuzzleRules.initialState(spec),moves:0,achievementAttempt:restoreAttempt(saved.achievementAttempt,eligible)};
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
  return {revision:config.levels[attempt.level].revision || 1,level:attempt.level,path:history.map(step=>step.move),achievementAttempt:{...attempt.achievementAttempt},...(config.custom?{puzzleStamp:config.stamp}:{})};
}
export function stashAttempt(state) {
  const saved=snapshot(state.config,state.attempt,state.history);
  if(state.restart)saved.restart=snapshot(state.config,state.restart.attempt,state.restart.history);
  return {last:state.attempt.level,entries:{...state.attempts.entries,[attemptKey(state.config,state.attempt.level)]:saved}};
}
export function solved(attempt){return PuzzleRules.key(attempt.board)===PuzzleRules.key(attempt.target)}
export function canAccess(state,index){return !!state.config.custom || state.dev || index<state.unlocked}

export function startPuzzle(state,index,{restart=false}={}) {
  if(!state.config.levels[index] || !canAccess(state,index))return state;
  const attempts=state.attempt?stashAttempt(state):state.attempts,config=state.config,spec=config.levels[index];
  const saved=attempts.entries[attemptKey(config,index)],eligible=config.achievements && !state.dev;
  const restored=restart?null:restoreSession(config,saved,eligible),resume=restored && !solved(restored.attempt);
  const attempt=resume?restored.attempt:{level:index,target:PuzzleRules.parse(spec.target),...PuzzleRules.initialState(spec),moves:0,achievementAttempt:newAttempt(eligible)};
  if(!eligible)attempt.achievementAttempt={...attempt.achievementAttempt,eligible:false};
  const recovery=resume && !restored.history.length?restoreSession(config,saved.restart,eligible):null;
  return {...state,attempt,attempts,history:resume?restored.history:[],restart:recovery?.attempt.moves?recovery:null,color:resume?restored.color:PuzzleArt.TILE_LIGHTS.B,badges:[]};
}

export function initializeGame(gameId=activeGame()) {
  let custom=null,error=null;
  if(new URLSearchParams(location.search).has('editor'))try{
    const preview=JSON.parse(sessionStorage.getItem('insight-editor-preview-v1')),verified=PuzzleSolver.verify(preview,preview);
    if(!verified.par || typeof preview.id!=='string' || !/^[\w-]{1,80}$/.test(preview.id))throw new Error();
    custom={...verified,id:preview.id,world:1};
  }catch{error='Playtest unavailable. Open the editor and validate your puzzle again.'}
  const spec=custom?PuzzleRules.validate(custom):null;if(spec)delete spec.name;
  if(!GAMES[gameId].levels){console.error('Game '+gameId+' levels are not loaded; opening Game 1.');gameId=1}
  const config={...GAMES[gameId],game:custom?0:gameId,custom,error,...(custom?{achievements:false,levels:[custom],sessionKey:'insight-editor-session-v2',attemptsKey:'insight-editor-attempts-v2'}:{}),stamp:custom?JSON.stringify([custom.id,spec]):null};
  const dev=!custom && readPreference(KEYS.dev)==='on';
  const attempts=readAttempts(config),progress=readProgress(config);
  let unlocked=1;const saved=readJSON(config.campaignKey);
  if(!custom && Number.isInteger(saved?.unlocked) && saved.unlocked>=1 && saved.unlocked<=config.levels.length)unlocked=saved.unlocked;
  else if(!custom){
    for(const id of Object.keys(progress.done))unlocked=Math.max(unlocked,+id+1);
    for(const entry of Object.values(attempts.entries)){const restored=restoreSession(config,entry,config.achievements && !dev);if(restored)unlocked=Math.max(unlocked,restored.attempt.level+1)}
    unlocked=Math.min(unlocked,config.levels.length);
  }
  const state={config,dev,unlocked,attempts,progress,attempt:null,history:[],restart:null,color:PuzzleArt.TILE_LIGHTS.B,badges:[],dark:readPreference(KEYS.dark)!=='light',sound:readPreference(KEYS.sound)!=='off'};
  const restored=restoreSession(config,attempts.entries[attemptKey(config,attempts.last)],config.achievements && !dev),unfinished=config.levels.findIndex((level,i)=>!progress.done[i+1]);
  const initial=restored && !solved(restored.attempt)?restored.attempt.level:Math.max(0,unfinished);
  return startPuzzle(state,canAccess(state,initial)?initial:unlocked-1);
}
