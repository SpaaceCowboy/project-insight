import {describe, expect, it} from 'vitest';
import {PuzzleRules as Rules} from './rules.js';
import {PuzzleSolver} from './solver.js';
import {LEVELS, SANDBOX} from './levels.js';

describe('rules', () => {
  it('keeps tiles on the board and out of holes', () => {
    const board = Rules.parse(['YG.', 'RGB', 'BR.']);
    expect(Rules.legalMoves(board, 0, 0)).toEqual([[1, 1]]);
    expect(Rules.legalMoves(board, 1, 2)).toEqual([[1, 1]]);
    expect(Rules.legalMoves(board, 1, 1)).toEqual([[2, 0]]);
    expect(Rules.legalMoves(Rules.parse(SANDBOX.start), 1, 1)).toEqual([]);
  });
});

describe('hero levels', () => {
  for (const level of LEVELS) {
    it(`#${level.id} ${level.name} solves at par`, () => {
      const result = PuzzleSolver.solve(level);
      expect(result.distance).toBe(level.par);
      expect(PuzzleSolver.verify(level, result).par).toBe(level.par);
    });
  }
});
