import { randomInt } from 'node:crypto';
import { oneMoveSolution } from './seed-community.js';
import { contentHash, replay, type Board, type Move, type Puzzle } from './rules.js';

/**
 * Puzzles for the Worlds showcase recording: every one in a different shape, so a profile's three rows and every Worlds page look varied instead of a
 * wall of squares. Shapes are drawn in at most 5×5 ('#' a tile, '.' a fixed empty cell) and used in every rotation and reflection.
 */
const SHAPES: string[][] = [
  ['.#.', '###', '.#.'], ['..#..', '..#..', '#####', '..#..', '..#..'], ['#...#', '.#.#.', '..#..', '.#.#.', '#...#'], ['..#..', '.###.', '#####', '.###.', '..#..'],
  ['###', '#.#', '###'], ['####', '#..#', '#..#', '####'], ['#####', '#.#.#', '#####'], ['#..', '#..', '###'], ['#...', '#...', '#...', '####'],
  ['###', '.#.', '.#.'], ['#####', '..#..', '..#..'], ['#.#', '#.#', '###'], ['#..#', '#..#', '####'], ['#.#', '###', '#.#'],
  ['#...#', '#...#', '#####', '#...#', '#...#'], ['.##', '##.'], ['..###', '.##..', '##...'], ['##.', '.#.', '.##'], ['#..', '##.', '###'],
  ['#...', '##..', '###.', '####'], ['#.#', '.#.', '#.#'], ['..#..', '.###.', '#####', '..#..', '..#..'], ['.#.#.', '#####', '#####', '.###.', '..#..'],
  ['#####', '#...#', '#.#.#', '#...#', '#####'], ['#####', '.#.#.', '#####'], ['###', '#..', '###', '#..', '###'], ['###', '#..', '#..', '###'],
  ['###', '#.#', '#.#', '#.#', '###'], ['#.#.#', '#####'], ['#####', '....#', '###.#', '#...#', '#####'], ['#...#', '##.##', '#####', '##.##', '#...#'],
  ['#####', '.###.', '..#..', '.###.', '#####'], ['##.##', '##.##', '#####', '##.##', '##.##'], ['##', '##', '##'], ['####', '####'], ['#####', '#####'],
  ['####', '####', '####'], ['#####', '#####', '#####'], ['#####', '#####', '#####', '#####'], ['.##.', '####', '####', '.##.'], ['##..', '####', '..##'],
  ['.###.', '##.##', '#...#', '##.##', '.###.'], ['#.##', '####', '##.#'], ['###..', '#.###', '###.#', '..###'], ['.#..', '####', '..#.'],
  ['##...', '.##..', '..##.', '...##'], ['#.#.#', '.#.#.', '#.#.#'], ['####', '#...', '####', '...#', '####'], ['####', '####', '####', '####'],
];

const rotate = (s: string[]) => [...s[0]!].map((_, c) => s.map(row => row[c]).reverse().join(''));
const mirror = (s: string[]) => s.map(row => [...row].reverse().join(''));

/** Every orientation of every shape, grouped by shape; an orientation that another shape already has is left out, so no two masks match. */
export function shapeVariants(): string[][][] {
  const seen = new Set<string>();
  return SHAPES.map(shape => {
    const group: string[][] = [];
    let s = shape;
    for (let r = 0; r < 4; r++) {
      for (const v of [s, mirror(s)]) if (!seen.has(v.join('/'))) { seen.add(v.join('/')); group.push(v); }
      s = rotate(s);
    }
    return group;
  }).filter(g => g.length > 0);
}

/** [count] masks, each different; the first ones all come from different shapes (shapes are shuffled, then dealt one orientation at a time). */
export function showcaseMasks(count: number): string[][] {
  const groups = shapeVariants().map(g => [...g].sort(() => Math.random() - 0.5)).sort(() => Math.random() - 0.5);
  const out: string[][] = [];
  for (let round = 0; out.length < count; round++) {
    const before = out.length;
    for (const g of groups) if (g[round] && out.length < count) out.push(g[round]!);
    if (out.length === before) throw new Error(`Only ${out.length} distinct shapes for ${count} puzzles.`);
  }
  return out;
}

export interface ShowcasePuzzle extends Puzzle { path: Move[]; hash: string }

/** A solvable puzzle in [mask]: random tiles (White, which never moves, is rarer), scrambled by legal moves, no one-move solution, unused hash. */
export function shapedPuzzle(mask: string[], used: Set<string>): ShowcasePuzzle {
  const width = mask[0]!.length, open = mask.join('');
  const board = (cells: string[]): Board => mask.map((_, r) => cells.slice(r * width, (r + 1) * width).join(''));
  const tiles = [...open].filter(c => c === '#').length;
  const length = Math.min(16, Math.max(4, Math.round(tiles * 0.7)));
  for (let attempt = 0; attempt < 2000; attempt++) {
    let cells = [...open].map(c => c === '.' ? '.' : 'RRBBGGYYPPW'[randomInt(11)]!);
    const target = board(cells), seen = new Set([cells.join('')]), shuffle: Move[] = [];
    while (shuffle.length < length) {
      const choices: { cells: string[]; move: Move }[] = [];
      for (let a = 0; a < cells.length; a++) for (let b = 0; b < cells.length; b++) {
        if (cells[a] === '.' || cells[b] === '.' || cells[a] === cells[b]) continue;
        const next = [...cells]; [next[a], next[b]] = [next[b]!, next[a]!];
        if (seen.has(next.join(''))) continue;
        try { replay({ start: board(cells), target: board(next) }, [[a, b]]); choices.push({ cells: next, move: [a, b] }); } catch { /* the rules decide */ }
      }
      if (!choices.length) break;
      const choice = choices[randomInt(choices.length)]!;
      cells = choice.cells; shuffle.push(choice.move); seen.add(cells.join(''));
    }
    if (shuffle.length !== length) continue;
    const puzzle = { start: board(cells), target };
    if (oneMoveSolution(puzzle)) continue;
    const hash = contentHash(puzzle);
    if (used.has(hash)) continue;
    const path = shuffle.reverse().map(([a, b]): Move => [b, a]);
    replay(puzzle, path); used.add(hash);
    return { ...puzzle, path, hash };
  }
  throw new Error(`Could not fill the shape ${mask.join('/')}.`);
}

/**
 * The puzzle played on camera (clip 5): 3×3, with a Purple in a corner that can swap two cells along the top row as the first move, and that move
 * does not solve it (a solve would bring up the result bar).
 */
export function purplePuzzle(used: Set<string>): ShowcasePuzzle & { swap: Move } {
  for (let attempt = 0; attempt < 500; attempt++) {
    const p = shapedPuzzle(['###', '###', '###'], new Set(used));
    const cells = p.start.join('');
    if (cells[0] !== 'P' || cells[2] === 'P') continue;
    const swap: Move = [0, 2];
    const after = replay(p, [swap], false);
    if (after.join('') === p.target.join('') || cells[1] === 'P') continue;
    used.add(p.hash);
    return { ...p, swap };
  }
  throw new Error('Could not make the purple puzzle.');
}
