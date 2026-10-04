import {CORE_LEVELS,PuzzleRules,PuzzleSolver,PuzzleArt} from './data.js';
import {newAttempt,restoreAttempt} from './achievements.mjs';

export const WORLD_NAMES={1:'FIRST CONNECTIONS',2:'BORROWED PATHS',3:'LAST CHARGE',4:'CONVERGENCE',5:'COMPLEX MAPS'};
export const KEYS={classic:'insight-campaign-r2-classic',limited:'insight-campaign-r2-limits',campaign:'insight-campaign-v2',dev:'insight-dev-mode-v1',limits:'insight-tile-limits-v1',zen:'insight-mode-v1',dark:'insight-theme-v1',sound:'insight-sound-v1'};
export function readPreference(key,fallback=null){try{return localStorage.getItem(key) ?? fallback}catch{return fallback}}
function readJSON(key){try{return JSON.parse(localStorage.getItem(key))}catch{return null}}
export function readProgress(config,limited) {
  const done={};
  if(!config.custom)for(const [id,stars] of Object.entries(readJSON(limited?KEYS.limited:KEYS.classic)?.done || {}))
    if(/^[1-9]\d*$/.test(id) && +id<=config.levels.length && Number.isInteger(stars) && stars>=1 && stars<=3)done[id]=stars;
  return {done};
}
export function attemptKey(config,index,limited){return (config.custom?config.custom.id+':':'')+(limited?'limited:':'classic:')+index}
function readAttempts(config) {
  const data=readJSON(config.attemptsKey);
  if(data && Number.isInteger(data.last) && config.levels[data.last] && data.entries && !Array.isArray(data.entries) && typeof data.entries==='object') {
    const entries={};
    for(const [id,entry] of Object.entries(data.entries))if(entry && Number.isInteger(entry.level) && config.levels[entry.level] && typeof entry.limits==='boolean' && (config.custom?/^[\w-]{1,80}:(limited|classic):0$/.test(id) && id.endsWith(':'+(entry.limits?'limited':'classic')+':0'):id===attemptKey(config,entry.level,entry.limits)))entries[id]=entry;
    return {last:data.last,entries};
  }
  const saved=readJSON(config.sessionKey);
  if(saved && Number.isInteger(saved.level) && config.levels[saved.level] && typeof saved.limits==='boolean')return {last:saved.level,entries:{[attemptKey(config,saved.level,saved.limits)]:saved}};
  return {last:0,entries:{}};
}
export function restoreSession(config,saved,limited,eligible) {
  try {
    if(!saved || saved.limits!==limited || !Number.isInteger(saved.level) || !config.levels[saved.level] || !Array.isArray(saved.path) || saved.path.length>10000)return null;
    if(config.custom && saved.puzzleStamp!==config.stamp && saved.puzzleStamp!==config.legacyStamp)return null;
    const spec=config.levels[saved.level],allowances=saved.allowances;
    if((saved.revision || 1)!==(spec.revision || 1))return null;
    if(limited && (!Array.isArray(allowances) || allowances.length!==spec.start.length || !allowances.every((row,r)=>Array.isArray(row) && row.length===spec.start[r].length && row.every((n,c)=>Number.isInteger(n) && ('.W'.includes(spec.start[r][c])?n===0:n>=Math.max(3,spec.allowanceFloor[r][c]) && n<=6)))))return null;
    let attempt={level:saved.level,limits:limited,target:PuzzleRules.parse(spec.target),...PuzzleRules.initialState(spec,limited?allowances:null),moves:0,allowances:limited?allowances:null,achievementAttempt:restoreAttempt(saved.achievementAttempt,eligible)};
    const history=[];let color=PuzzleArt.TILE_LIGHTS.B;
    for(const move of saved.path) {
      if(!Array.isArray(move) || move.length!==2 || !move.every(pos=>Array.isArray(pos) && pos.length===2 && pos.every(Number.isInteger)))return null;
      const [a,b]=move;
      if(PuzzleRules.key(attempt.board)===PuzzleRules.key(attempt.target))return null;
      const next=PuzzleRules.transition(attempt,a,b);
      history.push({board:attempt.board,remaining:attempt.remaining,moves:attempt.moves,color,move});
      color=PuzzleArt.TILE_LIGHTS[attempt.board[a[0]][a[1]]];
      attempt={...attempt,...next,moves:attempt.moves+1};
    }
    return {attempt,history,color};
  } catch{return null}
}
export function snapshot(config,attempt,history) {
  return {revision:config.levels[attempt.level].revision || 1,level:attempt.level,limits:attempt.limits,allowances:attempt.allowances,path:history.map(step=>step.move),achievementAttempt:{...attempt.achievementAttempt},...(config.custom?{puzzleStamp:config.stamp}:{})};
}
export function stashAttempt(state) {
  const saved=snapshot(state.config,state.attempt,state.history);
  if(state.restart)saved.restart=snapshot(state.config,state.restart.attempt,state.restart.history);
  return {last:state.attempt.level,entries:{...state.attempts.entries,[attemptKey(state.config,state.attempt.level,state.limits)]:saved}};
}
export function solved(attempt){return PuzzleRules.key(attempt.board)===PuzzleRules.key(attempt.target)}
export function exhausted(attempt){return !solved(attempt) && !attempt.board.some((row,r)=>row.some((t,c)=>PuzzleRules.legalMoves(attempt.board,r,c,attempt.remaining).length))}
export function canAccess(state,index){return !!state.config.custom || state.dev || index<state.unlocked}
export function parFor(state){const level=state.config.levels[state.attempt.level];return state.limits?level.limitedPar ?? level.par:level.par}
export function starsFor(moves,par){return moves<=par?3:moves<=par+2?2:1}
export function starText(stars){return '★'.repeat(stars)+'☆'.repeat(3-stars)}

export function startPuzzle(state,index,{restart=false,limited=state.limits}={}) {
  if(!state.config.levels[index] || !canAccess(state,index))return state;
  const attempts=state.attempt?stashAttempt(state):state.attempts,config=state.config,spec=config.levels[index];
  const saved=attempts.entries[attemptKey(config,index,limited)],eligible=!config.custom && !state.dev;
  const restored=restart?null:restoreSession(config,saved,limited,eligible),resume=restored && !solved(restored.attempt);
  const previous=state.attempt?.level===index && state.attempt.limits===limited?state.attempt.allowances:restored?.attempt.allowances;
  const allowances=limited?previous || spec.start.map((row,r)=>[...row].map((type,c)=>{if('.W'.includes(type))return 0;const floor=Math.max(3,spec.allowanceFloor[r][c]);return floor+Math.floor(Math.random()*(7-floor))})):null;
  const attempt=resume?restored.attempt:{level:index,limits:limited,target:PuzzleRules.parse(spec.target),...PuzzleRules.initialState(spec,allowances),allowances,moves:0,achievementAttempt:newAttempt(eligible)};
  if(!eligible)attempt.achievementAttempt={...attempt.achievementAttempt,eligible:false};
  const recovery=resume && !restored.history.length?restoreSession(config,saved.restart,limited,eligible):null;
  return {...state,limits:limited,progress:limited===state.limits?state.progress:readProgress(config,limited),attempt,attempts,history:resume?restored.history:[],restart:recovery?.attempt.moves?recovery:null,color:resume?restored.color:PuzzleArt.TILE_LIGHTS.B,badges:[]};
}

export function initializeGame() {
  let custom=null,error=null;
  if(new URLSearchParams(location.search).has('editor'))try{
    const preview=JSON.parse(sessionStorage.getItem('insight-editor-preview-v1')),verified=PuzzleSolver.verify(preview,preview);
    if(!verified.par || typeof preview.id!=='string' || !/^[\w-]{1,80}$/.test(preview.id))throw new Error();
    custom={...verified,id:preview.id,world:1};
  }catch{error='Playtest unavailable. Open the editor and validate your puzzle again.'}
  const spec=custom?PuzzleRules.validate(custom):null;if(spec)delete spec.name;
  const config={custom,error,levels:custom?[custom]:CORE_LEVELS,sessionKey:custom?'insight-editor-session-v1':'insight-session-r2',attemptsKey:custom?'insight-editor-attempts-v1':'insight-attempts-r2',stamp:custom?JSON.stringify([custom.id,spec]):null,legacyStamp:custom?JSON.stringify([custom.id,custom.start,custom.target]):null};
  const limits=custom && !custom.fitsLimits?false:readPreference(KEYS.limits)!=='off',dev=!custom && readPreference(KEYS.dev)==='on';
  const attempts=readAttempts(config),progress=readProgress(config,limits);
  let unlocked=1;const saved=readJSON(KEYS.campaign);
  if(!custom && Number.isInteger(saved?.unlocked) && saved.unlocked>=1 && saved.unlocked<=config.levels.length)unlocked=saved.unlocked;
  else if(!custom){
    for(const mode of [false,true])for(const id of Object.keys(readProgress(config,mode).done))unlocked=Math.max(unlocked,+id+1);
    for(const entry of Object.values(attempts.entries)){const restored=restoreSession(config,entry,limits,!dev);if(restored)unlocked=Math.max(unlocked,restored.attempt.level+1)}
    unlocked=Math.min(unlocked,config.levels.length);
  }
  const state={config,limits,dev,unlocked,attempts,progress,attempt:null,history:[],restart:null,color:PuzzleArt.TILE_LIGHTS.B,badges:[],zen:readPreference(KEYS.zen)!=='star',dark:readPreference(KEYS.dark)!=='light',sound:readPreference(KEYS.sound)!=='off'};
  const restored=restoreSession(config,attempts.entries[attemptKey(config,attempts.last,limits)],limits,!custom && !dev),unfinished=config.levels.findIndex((level,i)=>!progress.done[i+1]);
  const initial=restored && !solved(restored.attempt)?restored.attempt.level:Math.max(0,unfinished);
  return startPuzzle(state,canAccess(state,initial)?initial:unlocked-1);
}
