export function bounds(board) {
  const cells=board.flatMap((row,r)=>[...row].flatMap((type,c)=>type==='.'?[]:[[r,c]]));
  if(!cells.length)return {minR:0,maxR:-1,minC:0,maxC:-1};
  return {minR:Math.min(...cells.map(cell=>cell[0])),maxR:Math.max(...cells.map(cell=>cell[0])),minC:Math.min(...cells.map(cell=>cell[1])),maxC:Math.max(...cells.map(cell=>cell[1]))};
}
