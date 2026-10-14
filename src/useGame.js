import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {PuzzleRules,PuzzleArt} from './data.js';
import {achievements,hasAchievementStorageWarning} from './achievement-store.js';
import {initializeGame,startPuzzle,stashAttempt,solved,canAccess,attemptKey,KEYS} from './game-state.js';
import {useDialogs,useFeedback,useAppearance,useStrokes} from './react-ui.jsx';
import useAudio from './useAudio.js';

export default function useGame() {
  const [state,setState]=useState(initializeGame),live=useRef(state);
  const dialogs=useDialogs('menuOverlay'),feedback=useFeedback(dialogs),ink=useStrokes(),activeDialog=useRef(dialogs.active);activeDialog.current=dialogs.active;
  const [ui,setUI]=useState({selected:null,drag:null,moving:null,rejected:null,arrived:[],announcement:'',burst:null});
  const [world,setWorld]=useState(state.config.levels[state.attempt.level].world),[settingsTab,setSettingsTab]=useState('play');
  const [collectionRequest,setCollectionRequest]=useState({tab:'collection'}),[notices,setNotices]=useState([]);
  const boardRef=useRef(null),shellRef=useRef(null),tiles=useRef(new Map()),tileRefs=useRef(new Map()),drag=useRef(null),dragFrame=useRef(null),pendingFocus=useRef(null);
  const persisted=useRef(new Map()),savedAttempt=useRef(null);
  const moveTimer=useRef(null),winTimer=useRef(null),rejectTimer=useRef(null),animations=useRef([]),disposed=useRef(false);
  const sound=useAudio(state.sound,storageWarning);
  useAppearance({dark:state.dark,color:state.color});
  function commit(next){live.current=next;setState(next)}
  function changeUI(change){setUI(previous=>({...previous,...change}))}
  function storageWarning(){feedback.notify('Browser storage unavailable; changes last for this session.',{tone:'warning',title:'Progress is temporary',duration:0})}
  function store(key,value){try{localStorage.setItem(key,value);persisted.current.set(key,value);return true}catch{storageWarning();return false}}
  function storeChanged(key,value){return persisted.current.get(key)===value || store(key,value)}
  function persist(current){
    if(current.config.error)return;
    const previous=savedAttempt.current;
    if(!previous || ['config','attempt','attempts','history','restart'].some(key=>previous[key]!==current[key])){
      const attempts=stashAttempt(current),saved=attempts.entries[attemptKey(current.config,current.attempt.level)];
      const attemptsSaved=storeChanged(current.config.attemptsKey,JSON.stringify(attempts)),sessionSaved=storeChanged(current.config.sessionKey,JSON.stringify(saved));
      if(attemptsSaved && sessionSaved)savedAttempt.current=current;
    }
    if(!current.config.custom){
      storeChanged(current.config.campaignKey,JSON.stringify({unlocked:current.unlocked}));
      storeChanged(current.config.progressKey,JSON.stringify(current.progress));
    }
  }
  useEffect(()=>{
    if(state.config.error){try{sessionStorage.setItem('insight-editor-message-v1',state.config.error)}catch{}location.replace('Editor.html');return}
    persist(state);
  },[state]);
  useEffect(()=>{
    const warning=()=>storageWarning();window.addEventListener('insight-storage-warning',warning);
    if(hasAchievementStorageWarning())storageWarning();
    return ()=>{window.removeEventListener('insight-storage-warning',warning)};
  },[]);
  useEffect(()=>{
    disposed.current=false;
    const flush=()=>persist(live.current),visibility=()=>{if(document.hidden){cancelDrag();flush()}};
    window.addEventListener('pagehide',flush);document.addEventListener('visibilitychange',visibility);
    return ()=>{
      disposed.current=true;window.removeEventListener('pagehide',flush);document.removeEventListener('visibilitychange',visibility);
      flush();cancelDrag(false);clearTimeout(moveTimer.current);clearTimeout(winTimer.current);clearTimeout(rejectTimer.current);animations.current.forEach(animation=>animation.cancel());
    };
  },[]);
  useLayoutEffect(()=>{if(pendingFocus.current){const position=pendingFocus.current;pendingFocus.current=null;focusTile(position==='first'?null:position)}});
  function tileAt(pos){return pos?tiles.current.get(pos.join(':')):tiles.current.values().next().value}
  function focusTile(pos){tileAt(pos)?.focus({preventScroll:true})}
  function tileRef(pos){
    const key=pos.join(':');
    if(!tileRefs.current.has(key))tileRefs.current.set(key,node=>{if(node)tiles.current.set(key,node);else tiles.current.delete(key)});
    return tileRefs.current.get(key);
  }
  function cancelDrag(updateUI=true){
    const previous=drag.current;drag.current=null;
    cancelAnimationFrame(dragFrame.current);dragFrame.current=null;
    if(!previous)return null;
    previous.node.style.removeProperty('transform');
    if(previous && boardRef.current?.hasPointerCapture(previous.pointerId))boardRef.current.releasePointerCapture(previous.pointerId);
    if(updateUI)changeUI({drag:null});return previous;
  }
  function cancelPending(){
    clearTimeout(moveTimer.current);moveTimer.current=null;clearTimeout(winTimer.current);animations.current.forEach(animation=>animation.cancel());animations.current=[];
    cancelDrag();changeUI({selected:null,moving:null,arrived:[]});
  }
  function openDialog(id,nested=false){
    clearTimeout(winTimer.current);cancelDrag();changeUI({selected:null});dialogs.open(id,{nested});
  }
  function enter(next,{keepDialogs=false}={}){
    cancelPending();ink.clear();commit(next);setWorld(next.config.levels[next.attempt.level].world);
    if(!keepDialogs){dialogs.close(true);pendingFocus.current='first'}
  }
  function start(index,restart=false){const current=live.current;const next=startPuzzle(current,index,{restart});if(next!==current)enter(next)}
  function restart(){
    const current=live.current,recovery=current.attempt.moves?{attempt:current.attempt,history:current.history,color:current.color}:current.restart;
    enter({...startPuzzle(current,current.attempt.level,{restart:true}),restart:recovery});sound.play('undo');
  }
  function undo(){
    const current=live.current;if(!current.history.length && !current.restart)return;
    if(current.restart){const previous=current.restart;enter({...current,...previous,restart:null});pendingFocus.current=previous.history.at(-1)?.move[1] || 'first';changeUI({announcement:'Restart undone. '+previous.attempt.moves+' moves.'})}
    else {
      const previous=current.history.at(-1),attempt={...current.attempt,board:previous.board,moves:previous.moves,achievementAttempt:{...current.attempt.achievementAttempt,undoUsed:true}};
      enter({...current,attempt,history:current.history.slice(0,-1),color:previous.color});pendingFocus.current=previous.move[0];changeUI({announcement:'Move undone. '+attempt.moves+' moves.'});
    }
    sound.play('undo');
  }
  function reject(position,message){
    clearTimeout(rejectTimer.current);changeUI({rejected:position,announcement:message});rejectTimer.current=setTimeout(()=>changeUI({rejected:null}),240);sound.play('deny');
  }
  function move(a,b,offset=null){
    const current=live.current;
    if(moveTimer.current || ui.moving || !PuzzleRules.legalMoves(current.attempt.board,...a).some(pos=>pos[0]===b[0] && pos[1]===b[1]))return;
    const from=tileAt(a),to=tileAt(b),fromRect=from.parentElement.getBoundingClientRect(),toRect=to.parentElement.getBoundingClientRect();
    const dx=toRect.left-fromRect.left,dy=toRect.top-fromRect.top,duration=matchMedia('(prefers-reduced-motion: reduce)').matches?0:185;
    changeUI({selected:null,drag:null,moving:[a,b],arrived:[]});
    const initial=offset?`translate(${offset[0]}px,${offset[1]}px) scale(1.045)`:'translate(0,0)';
    animations.current=[from.animate([{transform:initial},{transform:`translate(${dx}px,${dy}px)`}],{duration,fill:'forwards'}),to.animate([{transform:'translate(0,0)'},{transform:`translate(${-dx}px,${-dy}px)`}],{duration,fill:'forwards'})];
    sound.play('move',current.attempt.board[a[0]][a[1]]);
    moveTimer.current=setTimeout(()=>{
      moveTimer.current=null;
      if(disposed.current || live.current.attempt!==current.attempt)return;
      const previous={board:current.attempt.board,moves:current.attempt.moves,color:current.color,move:[a,b]};
      const attempt={...current.attempt,...PuzzleRules.transition(current.attempt,a,b),moves:current.attempt.moves+1};
      let next={...live.current,attempt,history:[...current.history,previous],restart:null,color:PuzzleArt.TILE_LIGHTS[current.attempt.board[a[0]][a[1]]]};
      ink.add(shellRef.current,fromRect,toRect,current.attempt.board[a[0]][a[1]]);
      animations.current.forEach(animation=>animation.cancel());animations.current=[];
      const arrived=[a,b].filter(([r,c])=>attempt.board[r][c]===attempt.target[r][c] && previous.board[r][c]!==attempt.board[r][c]);
      if(solved(attempt)){
        const index=attempt.level;
        const badges=achievements.record({level:index,custom:!next.config.achievements,developer:next.dev,attempt:attempt.achievementAttempt});
        if(badges.length)setNotices(items=>[...items,...badges]);
        next={...next,badges,progress:{done:{...next.progress.done,[index+1]:true}},unlocked:!next.config.custom && index===next.unlocked-1?Math.min(next.config.levels.length,next.unlocked+1):next.unlocked};
        if(!activeDialog.current)winTimer.current=setTimeout(()=>{
          if(disposed.current || live.current.attempt!==attempt || activeDialog.current)return;
          dialogs.open('winOverlay');changeUI({announcement:'Puzzle solved.',burst:{points:[{x:innerWidth/2,y:innerHeight*.48,count:24}]}});sound.play('win');
        },matchMedia('(prefers-reduced-motion: reduce)').matches?100:850);
      }
      pendingFocus.current=b;changeUI({moving:null,arrived,announcement:`Move ${attempt.moves}. ${PuzzleArt.META[attempt.board[b[0]][b[1]]].name} moved to row ${b[0]+1}, column ${b[1]+1}.`});commit(next);
    },duration+8);
  }
  function choose(position){
    const current=live.current;if(ui.moving || drag.current || solved(current.attempt))return;
    if(ui.selected && PuzzleRules.legalMoves(current.attempt.board,...ui.selected).some(pos=>pos[0]===position[0] && pos[1]===position[1])){move(ui.selected,position);return}
    if(ui.selected && ui.selected.join(':')!==position.join(':') && PuzzleRules.legalMoves(current.attempt.board,...ui.selected).length){reject(ui.selected,'That swap is not allowed.');return}
    const moves=PuzzleRules.legalMoves(current.attempt.board,...position),selected=ui.selected?.join(':')!==position.join(':')?position:null;
    changeUI({selected});
    sound.play('select',current.attempt.board[position[0]][position[1]]);changeUI({announcement:selected?'Selected '+PuzzleArt.META[current.attempt.board[position[0]][position[1]]].name+(moves.length?'.':'. No legal moves.'):'Tile not selected.'});
  }
  function pointerDown(event,position){
    if(event.button!==0 || ui.moving || drag.current || solved(live.current.attempt))return;
    event.preventDefault();event.currentTarget.focus({preventScroll:true});
    const moves=PuzzleRules.legalMoves(live.current.attempt.board,...position);
    // Geometry stays fixed for this gesture; resize and navigation cancel it.
    const targets=moves.map(pos=>({pos,rect:tileAt(pos).parentElement.getBoundingClientRect()}));
    drag.current={from:position,node:event.currentTarget,startX:event.clientX,startY:event.clientY,x:event.clientX,y:event.clientY,pointerId:event.pointerId,moved:false,hover:null,moves,targets};
    boardRef.current.setPointerCapture?.(event.pointerId);
  }
  function updateDrag(item){
    if(!item.moved && Math.hypot(item.x-item.startX,item.y-item.startY)<8)return;
    const started=!item.moved,previous=item.hover;
    if(started)sound.play('select',live.current.attempt.board[item.from[0]][item.from[1]]);
    item.moved=true;
    item.hover=item.targets.find(({rect})=>item.x>=rect.left && item.x<=rect.right && item.y>=rect.top && item.y<=rect.bottom)?.pos || null;
    item.node.style.transform=`translate3d(${item.x-item.startX}px,${item.y-item.startY}px,0) scale(1.045)`;
    // React owns selection and destination feedback; only this tile moves each frame.
    if(started || previous!==item.hover)changeUI({selected:null,drag:{from:item.from,moves:item.moves,hover:item.hover}});
  }
  function pointerMove(event){
    const item=drag.current;if(!item || item.pointerId!==event.pointerId)return;event.preventDefault();item.x=event.clientX;item.y=event.clientY;
    if(dragFrame.current!==null)return;
    dragFrame.current=requestAnimationFrame(()=>{dragFrame.current=null;if(drag.current===item)updateDrag(item)});
  }
  function pointerUp(event){
    if(!drag.current || drag.current.pointerId!==event.pointerId)return;event.preventDefault();
    // Release may arrive before the queued frame, so use its final coordinates.
    drag.current.x=event.clientX;drag.current.y=event.clientY;updateDrag(drag.current);
    const item=cancelDrag();
    if(!item.moved)choose(item.from);else if(item.hover)move(item.from,item.hover,[item.x-item.startX,item.y-item.startY]);else if(item.moves.length)reject(item.from,'That swap is not allowed.');else{sound.play('deny');changeUI({announcement:'No legal moves for that tile.'})}
  }
  function leaveEditor(){cancelPending();persist(live.current);location.href='Editor.html'}
  function next(){if(state.config.custom)leaveEditor();else if(state.attempt.level<state.config.levels.length-1)start(state.attempt.level+1);else restart()}
  function showLevels(){if(state.config.custom){leaveEditor();return}setWorld(state.config.levels[state.attempt.level].world);openDialog('levelsOverlay',!!dialogs.active)}
  function showWorlds(){if(state.config.custom){leaveEditor();return}openDialog('worldsOverlay',!!dialogs.active)}
  function chooseWorld(number){setWorld(number);openDialog('levelsOverlay',true)}
  // Levels opened from Worlds pops back to it; opened from the in-game menu it puts Worlds on top.
  function backToWorlds(){const below=dialogs.has('worldsOverlay');dialogs.close();if(!below)dialogs.open('worldsOverlay',{nested:true})}
  function showAchievements(tab='collection'){setCollectionRequest({tab});openDialog('achievementsOverlay',true)}
  function continuePlay(){if(solved(state.attempt))next();else{dialogs.close(true);pendingFocus.current='first'}sound.play('select')}
  function resume(){if(solved(state.attempt))openDialog('winOverlay');else dialogs.close(true)}
  function toggle(kind){const next={...live.current,[kind]:!live.current[kind]};store(KEYS[kind],kind==='dark'?(next.dark?'dark':'light'):(next[kind]?'on':'off'));commit(next);if(kind!=='sound' || next.sound)sound.play('select',undefined,kind==='sound' && next.sound)}
  function toggleDev(){
    const current=live.current;if(current.config.custom)return;
    let next={...current,dev:!current.dev};store(KEYS.dev,next.dev?'on':'off');
    if(next.dev){next.attempt={...next.attempt,achievementAttempt:{...next.attempt.achievementAttempt,eligible:false}};if(next.restart)next.restart={...next.restart,attempt:{...next.restart.attempt,achievementAttempt:{...next.restart.attempt.achievementAttempt,eligible:false}}}}
    if(!canAccess(next,next.attempt.level))next=startPuzzle(next,next.unlocked-1);
    enter(next,{keepDialogs:true});
  }
  useEffect(()=>{
    function keydown(event){
      if(event.defaultPrevented)return;
      if(dialogs.active){if(event.key==='Escape'){event.preventDefault();dialogs.close()}return}
      if(event.key==='Escape'){event.preventDefault();if(drag.current || ui.selected){cancelDrag();changeUI({selected:null})}else openDialog('pauseOverlay');return}
      if(event.ctrlKey || event.metaKey || event.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName))return;
      if(event.key.toLowerCase()==='r')restart();if(event.key.toLowerCase()==='u')undo();if(event.key.toLowerCase()==='l')showLevels();
      const tile=event.target.closest('.tile'),direction={ArrowUp:[-1,0],ArrowDown:[1,0],ArrowLeft:[0,-1],ArrowRight:[0,1]}[event.key];
      if(tile && direction){event.preventDefault();let r=+tile.dataset.r+direction[0],c=+tile.dataset.c+direction[1];while(r>=0 && r<state.attempt.board.length && c>=0 && c<state.attempt.board[0].length){if(tileAt([r,c])){focusTile([r,c]);break}r+=direction[0];c+=direction[1]}}
    }
    const resize=()=>cancelDrag();
    document.addEventListener('keydown',keydown);window.addEventListener('resize',resize);
    return ()=>{document.removeEventListener('keydown',keydown);window.removeEventListener('resize',resize)};
  });
  return {state,ui,dialogs,feedback,ink,sound,world,setWorld,settingsTab,setSettingsTab,collectionRequest,notices,dismissNotice:()=>setNotices(items=>items.slice(1)),boardRef,shellRef,tileRef,pointerDown,pointerMove,pointerUp,cancelDrag,choose,start,restart,undo,next,showLevels,showWorlds,chooseWorld,backToWorlds,showAchievements,continuePlay,resume,toggle,toggleDev,leaveEditor,openDialog,clearSelection:()=>changeUI({selected:null}),clearArrival:pos=>setUI(previous=>({...previous,arrived:previous.arrived.filter(item=>item.join(':')!==pos.join(':'))}))};
}
