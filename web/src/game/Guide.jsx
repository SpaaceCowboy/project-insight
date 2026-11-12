import {useEffect, useLayoutEffect, useState} from 'react';

// Guide.kt guideText, in the order GameModel.guideSteps plays them on a Journey level.
export const GUIDE_TEXT = {
  board: 'Drag a tile onto another to swap them.',
  target: 'Your goal is to make the board match this target.',
  hold: 'Hold the board anywhere but on a tile to restart.',
  swipe: 'Swipe to move between puzzles.',
};

// Guide.kt and GameScreen.kt measures, in CSS pixels.
const EDGE = 6, INSET = 56, LINE = 44, GAP = 5, STROKE = 7, BOARD_WALL = 10, BORDER_OUT_MS = 140;

/** How many lines `text` takes in a monospaced font when `perLine` characters fit a line (words are not split unless one is longer than a line). */
export function monoLines(text, perLine) {
  let lines = 1, used = 0;
  for (const word of text.split(' ')) {
    if (used === 0) used = word.length;
    else if (used + 1 + word.length <= perLine) used += 1 + word.length;
    else { lines++; used = word.length; }
    while (used > perLine) { lines++; used -= perLine; }
  }
  return lines;
}

/** The largest font, from `max` down to 9px, at which all of `text` fits the band. */
export function fitSize(text, width, height, max = 14) {
  let size = max;
  while (size > 9) {
    if (monoLines(text, Math.max(1, Math.floor(width / (size * .62)))) * size * 1.2 <= height) break;
    size -= .5;
  }
  return size;
}

function measure(host, platform, board, target) {
  const base = host.getBoundingClientRect();
  const rect = (node, grow = 0) => {
    const box = node.getBoundingClientRect();
    return {left: box.left - base.left - grow, top: box.top - base.top - grow, right: box.right - base.left + grow, bottom: box.bottom - base.top + grow};
  };
  // The grid is the rows x cols area grown by one gap, as GameScreen.kt reports it.
  return {shell: rect(platform), grid: rect(board, GAP), target: target ? rect(target) : null, cell: board.querySelector('.cell').getBoundingClientRect().width};
}

/** A fat border whose centre line runs round `rect` grown by `grow`, and round the `wall` under it. */
function border(rect, radius, grow = 0, wall = 0) {
  return {left: rect.left - grow - STROKE / 2, top: rect.top - grow - STROKE / 2, width: rect.right - rect.left + grow * 2 + STROKE,
    height: rect.bottom - rect.top + wall + grow * 2 + STROKE, borderRadius: radius + STROKE / 2};
}

function borders(step, {shell, grid, target, cell}) {
  if (step === 'board') return [border(grid, 18, 0, Math.max(0, cell * .095 - 1))];
  if (step === 'target') return target ? [border(target, 14, 6)] : [];
  if (step === 'hold') return [border(shell, 24, 3, BOARD_WALL)];
  // A swipe starts anywhere off the tiles; with no room above and below them the whole platform stands for it.
  const inner = {left: shell.left + EDGE, top: shell.top + EDGE, right: shell.right - EDGE, bottom: shell.bottom - EDGE};
  const above = {...inner, bottom: grid.top - EDGE / 2}, below = {...inner, top: grid.bottom + EDGE / 2};
  return above.bottom - above.top > EDGE * 2 && below.bottom - below.top > EDGE * 2 ? [border(above, 14), border(below, 14)] : [border(inner, 14)];
}

/**
 * The gameplay tips (Guide.kt GameGuide): fat borders round what a step explains, its sentence in the free strip
 * above the tiles and "Tap to continue" below them. It takes every tap on the stage: one anywhere moves on, one on
 * the lamp ends the tips, and one on the grid during the first step does nothing, so it is not mistaken for a move.
 * ponytail: the text always sits on the platform. A board that leaves under 56px above its tiles (five 88px rows)
 * needs Guide.kt's backed plates above the platform; none of the site's boards do.
 */
export default function Guide({step, platform, board, target, onAdvance, onEnd}) {
  const [host, setHost] = useState(null);
  const [at, setAt] = useState(null);
  // The step whose borders are on screen: it changes only once the old borders have faded out.
  const [shown, setShown] = useState(step), [lit, setLit] = useState(false);

  useLayoutEffect(() => {
    if (!host) return;
    const read = () => setAt(measure(host, platform.current, board.current, target.current?.firstElementChild));
    read();
    const watch = new ResizeObserver(read); watch.observe(host);
    host.focus({preventScroll: true});
    return () => watch.disconnect();
  }, [host]);
  useEffect(() => {
    if (step === shown) { const id = requestAnimationFrame(() => setLit(true)); return () => cancelAnimationFrame(id); }
    setLit(false);
    const id = setTimeout(() => { setShown(step); setLit(true); }, BORDER_OUT_MS);
    return () => clearTimeout(id);
  }, [step]);

  function tap(event) {
    if (event.detail === 0 || !at) { onAdvance(); return; }
    const base = host.getBoundingClientRect(), x = event.clientX - base.left, y = event.clientY - base.top;
    const inside = rect => x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    if (inside({left: at.shell.right - 52, top: at.shell.top + 4, right: at.shell.right - 4, bottom: at.shell.top + 52})) onEnd();
    else if (step !== 'board' || !inside(at.grid)) onAdvance();
  }
  function key(event) {
    if (event.key === 'Escape') onEnd();
    else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onAdvance(); }
  }

  const text = GUIDE_TEXT[step];
  const band = at && {left: at.shell.left + INSET, width: at.shell.right - at.shell.left - INSET * 2};
  return <div ref={setHost} className="guide" role="button" tabIndex={0} aria-label={`${text} Continue`} onClick={tap} onKeyDown={key}>
    {at && <>
      <span className={'guide-boxes' + (lit ? ' lit' : '')} aria-hidden="true">
        {borders(shown, at).map((style, i) => <i key={i} style={style} />)}
      </span>
      <span className="guide-text" aria-live="polite"
        style={{...band, top: at.shell.top + (at.grid.top - at.shell.top - LINE) / 2, height: LINE, fontSize: fitSize(text, band.width, LINE)}}>{text}</span>
      <span className="guide-hint" aria-hidden="true"
        style={{...band, top: at.grid.bottom + EDGE / 2, height: at.shell.bottom - EDGE - at.grid.bottom - EDGE / 2}}>Tap to continue</span>
    </>}
  </div>;
}
