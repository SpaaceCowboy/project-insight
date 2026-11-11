import {describe, expect, it} from 'vitest';
import {clampDrag, dropTarget, rewindMoves} from './boardMotion.js';
import {LEVELS} from './levels.js';
import {PuzzleRules as Rules} from './rules.js';

describe('Android board motion', () => {
  it('keeps correct duplicates still and rewinds every displaced tile to a unique matching home', () => {
    for (const level of LEVELS) {
      const start = Rules.parse(level.start);
      let board = start;
      for (let step = 0; step < 30; step++) {
        const options = board.flatMap((row, r) => row.flatMap((_, c) =>
          Rules.legalMoves(board, r, c).map(to => [[r, c], to])));
        const [a, b] = options[step % options.length];
        board = Rules.swapCells(board, a, b);
        const plan = rewindMoves(board, start);
        expect(new Set(plan.map(([, home]) => home.join(':'))).size).toBe(plan.length);
        for (const [at, home] of plan) {
          expect(start[home[0]][home[1]]).toBe(board[at[0]][at[1]]);
          if (start[at[0]][at[1]] === board[at[0]][at[1]]) expect(home).toEqual(at);
        }
      }
    }
  });
  it('uses the nearest matching home, breaking ties in row order as Android does', () => {
    expect(rewindMoves(['BRB', 'RBR'], ['RBR', 'BRB']))
      .toContainEqual([[0, 0], [0, 1]]);
  });
  it('accepts only a tile centre within 0.6 cells of a legal destination', () => {
    const home = {x: 44, y: 44};
    const targets = [{x: 140, y: 44, position: [0, 1]}];
    expect(dropTarget(home, [96, 0], targets, 88)).toEqual([0, 1]);
    expect(dropTarget(home, [96, 54], targets, 88)).toBeNull();
    expect(dropTarget(home, [0, 96], targets, 88)).toBeNull();
  });
  it('keeps the lifted tile within the platform on both axes', () => {
    expect(clampDrag([-300, 500], [[-40, 80], [-60, 90]])).toEqual([-40, 90]);
    expect(clampDrag([20, -30], [[-40, 80], [-60, 90]])).toEqual([20, -30]);
  });
});
