import {rewindMoves, LEVEL_SLIDE_MS} from './boardMotion.js';
import {PuzzleRules as Rules} from './rules.js';
import {ICONS, TILES, strokeWidth} from './tileArt.js';
import {same} from './useBoard.js';

// The symbol fills 44% of the tile and is etched by 1.2% of the tile: 1.31 units of its own 48 box.
const ETCH = .012 / .44 * 48;

/**
 * TileArt.kt tile(): every symbol is cut into the face rather than drawn on it. Light ink is shaded along its
 * upper edge; White's dark ink catches a highlight along its lower edge instead.
 */
export function TileSymbol({type}) {
  const dark = type === 'W';
  return <svg viewBox="0 0 48 48" fill="none" strokeWidth={strokeWidth(type)} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={ICONS[type]} transform={`translate(0 ${dark ? ETCH : -ETCH})`} stroke={dark ? '#fff' : '#000'} strokeOpacity={dark ? .7 : .2} />
    <path d={ICONS[type]} stroke="currentColor" strokeOpacity={dark ? .92 : .9} />
  </svg>;
}

/** A tile face on its own, for cards and illustrations. */
export function TileFace({type, className = ''}) {
  return <span className={`tile ${TILES[type].cls} ${className}`} aria-hidden="true"><TileSymbol type={type} /></span>;
}

/** Flat target squares, like the app's mini: no symbols, holes stay empty. */
export function TargetMini({board, className = ''}) {
  return <span className={'mini ' + className} style={{'--cols': board[0].length}} aria-hidden="true">
    {board.flatMap((row, r) => [...row].map((type, c) => <span key={r + ':' + c} className={'mini-cell ' + (type === '.' ? 'hole' : TILES[type].cls)} />))}
  </span>;
}

const MINI = 16, MINI_GAP = 2.6, PITCH = MINI + MINI_GAP;
const frame = board => board.length ? [board[0].length * PITCH - MINI_GAP, board.length * PITCH - MINI_GAP] : [0, 0];

/**
 * TileArt.kt MorphTarget: the target between two boards. Squares both targets have slide from their old cell to
 * their new one, a square with no counterpart fades out, a new one fades in, and the frame resizes with them.
 */
export function MorphTarget({from, to}) {
  const [oldW, oldH] = frame(from), [newW, newH] = frame(to);
  const moves = new Map(rewindMoves(from, to, true).map(([a, b]) => [a.join(':'), b]));
  const taken = new Set([...moves.values()].map(position => position.join(':')));
  // A cell's centre measured from the middle of its own frame.
  const centre = (r, c, w, h) => [c * PITCH + MINI / 2 - w / 2, r * PITCH + MINI / 2 - h / 2];
  const square = (key, type, start, end, fade) => <span key={key} className={'mini-cell ' + TILES[type].cls}
    style={{'--x0': start[0] + 'px', '--y0': start[1] + 'px', '--x1': end[0] + 'px', '--y1': end[1] + 'px', '--o0': fade === 'in' ? 0 : 1, '--o1': fade === 'out' ? 0 : 1}} />;
  const squares = [];
  from.forEach((row, r) => [...row].forEach((type, c) => {
    if (type === '.') return;
    const start = centre(r, c, oldW, oldH), home = moves.get(r + ':' + c);
    squares.push(home ? square('o' + r + c, type, start, centre(...home, newW, newH)) : square('o' + r + c, type, start, start, 'out'));
  }));
  to.forEach((row, r) => [...row].forEach((type, c) => {
    if (type === '.' || taken.has(r + ':' + c)) return;
    const end = centre(r, c, newW, newH);
    squares.push(square('n' + r + c, type, end, end, 'in'));
  }));
  return <span className="mini morph" aria-hidden="true"
    style={{'--w0': oldW + 'px', '--h0': oldH + 'px', '--w1': newW + 'px', '--h1': newH + 'px', '--ms': LEVEL_SLIDE_MS + 'ms'}}>{squares}</span>;
}

function describe(type, r, c) {
  const directions = Rules.moves[type].map(([dr, dc]) => `${dr < 0 ? 'up' : dr > 0 ? 'down' : ''}${dc ? (dr ? '-' : '') + (dc < 0 ? 'left' : 'right') : ''}`).join(' or ');
  return `${TILES[type].name}, row ${r + 1}, column ${c + 1}${directions ? ', moves ' + directions : ', moved only by others'}`;
}

const gridStyle = board => ({'--cols': board[0].length, '--rows': board.length});

/** A board as it stood, with nothing to touch: the platform a swipe is leaving. */
export function StillBoard({board}) {
  return <div className="board" style={gridStyle(board)} aria-hidden="true">
    {board.flatMap((row, r) => [...row].map((type, c) => <div key={r + ':' + c} className={'cell' + (type === '.' ? ' hole' : '')}>
      {type !== '.' && <TileFace type={type} />}
    </div>))}
  </div>;
}

export function Board({game, label}) {
  const {board, ui, solved} = game;
  return <div ref={game.boardRef} role="group" aria-label={label} className={'board' + (solved && !ui.resetting ? ' solved' : '')}
    aria-busy={!!ui.moving} style={gridStyle(board)} onLostPointerCapture={game.pointerCancel}>
    {ui.bloom && <span key={ui.bloom.id} className={'board-ink ' + TILES[ui.bloom.type].cls} style={ui.bloom.style} aria-hidden="true" />}
    {board.flatMap((row, r) => row.map((type, c) => {
      const at = [r, c], key = r + ':' + c;
      if (type === '.') return <div key={key} className="cell hole" />;
      const states = [
        same(ui.selected, at) && 'selected', same(ui.drag?.from, at) && 'dragging',
        same(ui.drag?.hover, at) && 'hovered',
        ui.moving?.some(position => same(position, at)) && 'moving', same(ui.rejected, at) && 'rejected',
        ui.arrived.some(position => same(position, at)) && 'arrived',
      ].filter(Boolean).join(' ');
      const front = same(ui.selected, at) || same(ui.drag?.from, at) || same(ui.moving?.[0], at);
      const moving = ui.moving?.some(position => same(position, at));
      return <div key={key} style={{'--order': r + c}} className={'cell' + (front ? ' front' : moving ? ' in-motion' : '')}>
        <button type="button" ref={game.tileRef(r, c)} className={`tile ${TILES[type].cls} ${states}`}
          onPointerDown={event => game.pointerDown(event, at)} onClick={event => { if (event.detail === 0) game.choose(at); }}
          aria-label={describe(type, r, c)} aria-pressed={same(ui.selected, at)}>
          <TileSymbol type={type} />
        </button>
      </div>;
    }))}
  </div>;
}
