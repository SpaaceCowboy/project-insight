import {useRef,useState} from 'react';
import {PuzzleRules} from './data.js';
import {useStrokes} from './react-ui.jsx';

const MAX=5;
const copy=board=>board.map(row=>row.slice());
const fit=(board,rows,cols)=>Array.from({length:rows},(_,r)=>Array.from({length:cols},(_,c)=>board[r]?.[c] || '.'));
const same=(a,b)=>!!a && !!b && a[0]===b[0] && a[1]===b[1];
const clamp=value=>Math.max(1,Math.min(MAX,value));

// Build the start grid (S), move tiles to shape the target (T), then check the level (M comes later).
// Phases: 'build' → 'shape' → 'check'. Every move is reversible, so a target reached by moves is always solvable.
export default function useCreator(sound) {
  const [state,setState]=useState({phase:'build',board:fit([],3,3),start:null,target:null,holding:null,picked:null,arrived:[],note:''});
  const [drag,setDrag]=useState(null),ink=useStrokes();
  const gesture=useRef(null),boardRef=useRef(null),shellRef=useRef(null);
  const {phase,board,start,target,holding,picked}=state;
  const solved=phase==='check' && PuzzleRules.key(board)===PuzzleRules.key(target);
  const patch=values=>setState(previous=>({...previous,note:'',...values}));
  const cellAt=(x,y)=>{
    const node=document.elementFromPoint(x,y)?.closest('.cell');
    return node && boardRef.current.contains(node) ? [+node.dataset.r,+node.dataset.c] : null;
  };
  const cellNode=([r,c])=>boardRef.current.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
  const legal=(a,b)=>PuzzleRules.legalMoves(board,...a).some(pos=>same(pos,b));

  function setTile(position,type){patch({board:board.map((row,r)=>row.map((tile,c)=>r===position[0] && c===position[1]?type:tile))})}
  function place(type,position){setTile(position,type);sound.play('select',type)}
  function swapTiles(a,b){
    const type=board[a[0]][a[1]],from=cellNode(a).getBoundingClientRect(),to=cellNode(b).getBoundingClientRect(),next=PuzzleRules.swapCells(board,a,b);
    ink.add(shellRef.current,from,to,type);
    patch({board:next,picked:null,arrived:[a,b]});
    if(phase==='check' && PuzzleRules.key(next)===PuzzleRules.key(target))sound.play('win');else sound.play('move',type);
  }
  // Build phase: dropping on a tile swaps, dropping on an empty slot moves.
  function relocate(from,to){
    if(same(from,to))return;
    const moved=board[from[0]][from[1]],destination=board[to[0]][to[1]];
    patch({board:board.map((row,r)=>row.map((tile,c)=>same([r,c],to)?moved:same([r,c],from)?destination:tile))});
    sound.play('select',moved);
  }
  function choose(position){
    if(picked && legal(picked,position)){swapTiles(picked,position);return}
    patch({picked:same(picked,position)?null:position});sound.play('select',board[position[0]][position[1]]);
  }
  function tapCell(r,c){
    if(phase!=='build')choose([r,c]);else if(holding)place(holding,[r,c]);
  }
  function tapTile(type){patch({holding:holding===type?null:type});sound.play('select',type)}

  function down(event,item){
    if(event.button!==0 || gesture.current)return;
    event.preventDefault();event.currentTarget.focus({preventScroll:true});
    gesture.current={...item,pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,moved:false};
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function resizeDown(event){
    if(event.button!==0 || gesture.current)return;
    event.preventDefault();
    const rect=boardRef.current.getBoundingClientRect(),gap=parseFloat(getComputedStyle(boardRef.current).columnGap) || 0;
    // The board stays centred while it resizes, so its corner follows the pointer one-to-one.
    gesture.current={resize:true,pointerId:event.pointerId,snapshot:copy(board),cx:rect.left+rect.width/2,cy:rect.top+rect.height/2,ox:event.clientX-rect.right,oy:event.clientY-rect.bottom,gap,pitch:boardRef.current.querySelector('.cell').getBoundingClientRect().width+gap};
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function move(event){
    const item=gesture.current;if(!item || event.pointerId!==item.pointerId)return;event.preventDefault();
    if(item.resize){
      // Dimensions come from the original snapshot, so dragging back out restores cropped tiles.
      const cols=clamp(Math.round((2*(event.clientX-item.ox-item.cx)+item.gap)/item.pitch)),rows=clamp(Math.round((2*(event.clientY-item.oy-item.cy)+item.gap)/item.pitch));
      if(cols!==board[0].length || rows!==board.length)setState(previous=>({...previous,board:fit(item.snapshot,rows,cols)}));
      return;
    }
    if(!item.moved && Math.hypot(event.clientX-item.startX,event.clientY-item.startY)<8)return;
    item.moved=true;
    const hover=cellAt(event.clientX,event.clientY);
    setDrag({type:item.type,from:item.from,x:event.clientX,y:event.clientY,size:boardRef.current.querySelector('.cell').getBoundingClientRect().width,hover:phase==='build' || (hover && legal(item.from,hover))?hover:null});
  }
  function up(event){
    const item=gesture.current;if(!item || event.pointerId!==item.pointerId)return;
    gesture.current=null;setDrag(null);
    if(item.resize)return;
    const to=cellAt(event.clientX,event.clientY);
    if(!item.moved){
      if(phase!=='build')choose(item.from);else if(!item.from)tapTile(item.type);else if(holding)place(holding,item.from);
      return;
    }
    if(phase!=='build'){
      if(to && legal(item.from,to))swapTiles(item.from,to);else sound.play('deny');
      return;
    }
    if(to){if(item.from)relocate(item.from,to);else{place(item.type,to);patch({holding:null})}}
    else if(item.from){
      const rect=shellRef.current.getBoundingClientRect();
      if(event.clientX<rect.left || event.clientX>rect.right || event.clientY<rect.top || event.clientY>rect.bottom){setTile(item.from,'.');sound.play('deny')}
    }
  }
  function cancel(){gesture.current=null;setDrag(null)}
  function resizeBy(dr,dc){patch({board:fit(board,clamp(board.length+dr),clamp(board[0].length+dc))})}

  function pressStart(){
    if(phase!=='build'){patch({phase:'build',board:copy(start),start:null,target:null,picked:null,arrived:[]});return}
    if(board.flat().filter(type=>type!=='.').length<2){patch({note:'Place at least two tiles first.'});return}
    if(!board.some((row,r)=>row.some((type,c)=>type!=='.' && PuzzleRules.legalMoves(board,r,c).length))){patch({note:'None of these tiles can move. Add tiles they can swap with.'});return}
    patch({phase:'shape',start:copy(board),holding:null});
  }
  function pressTarget(){
    if(phase==='shape'){
      if(PuzzleRules.key(board)===PuzzleRules.key(start)){patch({note:'Move some tiles first: the target must differ from the start.'});return}
      patch({phase:'check',target:copy(board),board:copy(start),picked:null,arrived:[]});
    }else if(phase==='check')patch({phase:'shape',board:copy(target),target:null,picked:null,arrived:[]});
  }
  function keyDown(event){
    if(event.key==='Escape' && (holding || picked || drag)){event.stopPropagation();event.preventDefault();cancel();patch({holding:null,picked:null});return}
    const node=event.target.closest('.cell');
    if(phase==='build' && node && ['Delete','Backspace'].includes(event.key) && board[node.dataset.r][node.dataset.c]!=='.'){event.preventDefault();setTile([+node.dataset.r,+node.dataset.c],'.')}
  }
  return {state,drag,ink,solved,boardRef,shellRef,down,resizeDown,move,up,cancel,tapCell,resizeBy,pressStart,pressTarget,keyDown,tapTile,clearArrival:position=>setState(previous=>({...previous,arrived:previous.arrived.filter(item=>!same(item,position))}))};
}
