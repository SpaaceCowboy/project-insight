// GameScreen.kt: Compose's default tween easing and gameplay timings.
export const SLIDE_MS = 185;
export const REWIND_MS = 320;
export const SLIDE_EASING = 'cubic-bezier(0.4, 0, 0.2, 1)';

/** Keep correct tiles still; send other tiles to the nearest unused home of their colour. */
export function rewindMoves(from, to) {
  const moves = [], loose = [], open = [];
  from.forEach((row, r) => [...row].forEach((type, c) => {
    if (type === '.') return;
    if (to[r][c] === type) moves.push([[r, c], [r, c]]);
    else loose.push([r, c]);
  }));
  to.forEach((row, r) => [...row].forEach((type, c) => {
    if (type !== '.' && from[r][c] !== type) open.push([r, c]);
  }));
  for (const at of loose) {
    let best = -1, distance = Infinity;
    open.forEach((home, i) => {
      const d = Math.abs(home[0] - at[0]) + Math.abs(home[1] - at[1]);
      if (to[home[0]][home[1]] === from[at[0]][at[1]] && d < distance) { best = i; distance = d; }
    });
    if (best === -1) throw new Error('Cannot rewind a board with different tiles');
    moves.push([at, open.splice(best, 1)[0]]);
  }
  return moves;
}

/** Android dropTarget: measure the dragged tile's centre, not the finger. */
export function dropTarget(home, offset, targets, cell) {
  const x = home.x + offset[0], y = home.y + offset[1];
  let nearest = null, distance = cell * .6;
  for (const target of targets) {
    const d = Math.hypot(target.x - x, target.y - y);
    if (d <= distance) { nearest = target.position; distance = d; }
  }
  return nearest;
}

export function clampDrag(raw, bounds) {
  return raw.map((value, axis) => Math.max(bounds[axis][0], Math.min(bounds[axis][1], value)));
}
