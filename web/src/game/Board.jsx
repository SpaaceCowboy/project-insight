import {PuzzleRules as Rules} from './rules.js';
import {ICONS, TILES} from './tileArt.js';
import {same} from './useBoard.js';

export function TileSymbol({type}) {
  if (type === 'W') return <svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><circle cx="24" cy="24" r="10" stroke="currentColor" strokeWidth="4" /><path d="M24 6v8M24 34v8M6 24h8M34 24h8" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" /></svg>;
  return <svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d={ICONS[type]} stroke="currentColor" strokeWidth={type === 'P' ? 3.4 : 4.2} strokeLinecap="round" strokeLinejoin="round" /></svg>;
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

function describe(type, r, c) {
  const directions = Rules.moves[type].map(([dr, dc]) => `${dr < 0 ? 'up' : dr > 0 ? 'down' : ''}${dc ? (dr ? '-' : '') + (dc < 0 ? 'left' : 'right') : ''}`).join(' or ');
  return `${TILES[type].name}, row ${r + 1}, column ${c + 1}${directions ? ', moves ' + directions : ', moved only by others'}`;
}

export function Board({game, label}) {
  const {board, ui, solved} = game;
  const legal = ui.selected ? Rules.legalMoves(board, ...ui.selected) : ui.drag ? ui.drag.legal : [];
  return <div ref={game.boardRef} role="group" aria-label={label} className={'board' + (solved ? ' solved' : '')}
    style={{'--cols': board[0].length, '--rows': board.length}}
    onPointerMove={game.pointerMove} onPointerUp={game.pointerUp} onPointerCancel={game.pointerCancel}>
    {board.flatMap((row, r) => row.map((type, c) => {
      const at = [r, c], key = r + ':' + c;
      if (type === '.') return <div key={key} className="cell hole" style={{'--order': r + c}} />;
      const states = [
        same(ui.selected, at) && 'selected', same(ui.drag?.from, at) && 'dragging',
        ui.moving?.some(position => same(position, at)) && 'moving', same(ui.rejected, at) && 'rejected',
        ui.arrived.some(position => same(position, at)) && 'arrived', ui.hint?.some(position => same(position, at)) && 'hinted',
      ].filter(Boolean).join(' ');
      return <div key={key} style={{'--order': r + c}} className={'cell' + (legal.some(position => same(position, at)) ? ' legal' : '') + (same(ui.drag?.hover, at) ? ' hover-target' : '')}>
        {same(ui.bloom?.at, at) && <span key={ui.bloom.id} className={'bloom ' + TILES[ui.bloom.type].cls} />}
        <button type="button" ref={game.tileRef(r, c)} className={`tile ${TILES[type].cls} ${states}`}
          onPointerDown={event => game.pointerDown(event, at)} onClick={event => { if (event.detail === 0) game.choose(at); }}
          aria-label={describe(type, r, c)} aria-pressed={same(ui.selected, at)}>
          <TileSymbol type={type} />
        </button>
      </div>;
    }))}
  </div>;
}
