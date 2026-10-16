import { createHash } from 'node:crypto';

export type Board = string[];
export type Move = [number, number];
export interface Puzzle { start: Board; target: Board }
const moves: Record<string, readonly (readonly [number, number])[]> = {
  R: [[-1, 0], [1, 0]], B: [[0, -1], [0, 1]], G: [[-1, 1], [1, -1]],
  Y: [[-1, -1], [1, 1]], P: [[-2, 0], [2, 0], [0, -2], [0, 2]], W: [],
};

export class DomainError extends Error {
  constructor(public statusCode: number, public code: string, message: string) { super(message); }
}
export function requireValue(condition: unknown, code: string, message: string, status = 400): asserts condition {
  if (!condition) throw new DomainError(status, code, message);
}
export function validatePuzzle(puzzle: Puzzle): void {
  const { start, target } = puzzle;
  const validBoard = (b: Board) => Array.isArray(b) && b.length >= 1 && b.length <= 5 &&
    typeof b[0] === 'string' && b[0].length >= 1 && b[0].length <= 5 &&
    b.every(row => typeof row === 'string' && row.length === b[0]!.length && /^[RBGYWP.]+$/.test(row));
  requireValue(validBoard(start) && validBoard(target), 'INVALID_BOARD', 'Use a rectangular grid of 1–5 rows and columns.');
  requireValue(start.length === target.length && start[0]!.length === target[0]!.length, 'INVALID_BOARD', 'Grid dimensions differ.');
  requireValue(start.join('') !== target.join(''), 'UNCHANGED_TARGET', 'Start and target must differ.');
  const a = start.join(''); const b = target.join('');
  requireValue(a.split('').sort().join('') === b.split('').sort().join('') &&
    [...a].every((tile, i) => (tile === '.') === (b[i] === '.')) && a.replaceAll('.', '').length >= 2,
  'INVALID_BOARD', 'Tiles and fixed empty cells must match.');
}
export function replay(puzzle: Puzzle, path: Move[], complete = true): Board {
  validatePuzzle(puzzle);
  requireValue(Array.isArray(path) && path.length > 0 && path.length <= 10000, 'INVALID_PATH', 'Provide 1–10000 legal moves.');
  const width = puzzle.start[0]!.length;
  const cells = puzzle.start.join('').split('');
  const goal = puzzle.target.join('');
  for (const move of path) {
    requireValue(Array.isArray(move) && move.length === 2 && move.every(n => Number.isInteger(n) && n >= 0 && n < cells.length), 'ILLEGAL_MOVE', 'Invalid move coordinates.');
    requireValue(cells.join('') !== goal, 'ILLEGAL_MOVE', 'A completed attempt cannot contain further moves.');
    const [a, b] = move;
    const ar = Math.floor(a / width); const ac = a % width;
    const br = Math.floor(b / width); const bc = b % width;
    requireValue(cells[b] !== '.' && (moves[cells[a]!] ?? []).some(([r, c]) => ar + r === br && ac + c === bc), 'ILLEGAL_MOVE', 'Move does not follow the tile rule.');
    [cells[a], cells[b]] = [cells[b]!, cells[a]!];
  }
  if (complete) requireValue(cells.join('') === goal, 'NOT_SOLVED', 'The solution does not reach the target.');
  return puzzle.start.map((_, r) => cells.slice(r * width, (r + 1) * width).join(''));
}
/** Trim only shared outer holes; translation and unused borders cannot multiply rewards. */
export function contentHash(puzzle: Puzzle): string {
  validatePuzzle(puzzle);
  const occupied = puzzle.start.flatMap((row, r) => [...row].flatMap((c, col) => c === '.' ? [] : [[r, col] as const]));
  const top = Math.min(...occupied.map(([r]) => r)); const bottom = Math.max(...occupied.map(([r]) => r));
  const left = Math.min(...occupied.map(([, c]) => c)); const right = Math.max(...occupied.map(([, c]) => c));
  const crop = (b: Board) => b.slice(top, bottom + 1).map(row => row.slice(left, right + 1));
  return createHash('sha256').update(JSON.stringify([crop(puzzle.start), crop(puzzle.target)])).digest('hex');
}
