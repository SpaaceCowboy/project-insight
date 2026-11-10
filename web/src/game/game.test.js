import {describe, expect, it} from 'vitest';
import {readFileSync} from 'node:fs';
import {PuzzleRules as Rules} from './rules.js';
import {PuzzleSolver} from './solver.js';
import {LEVELS, SANDBOX} from './levels.js';

const shipped = JSON.parse(readFileSync(new URL('../../../app/src/main/assets/levels.json', import.meta.url), 'utf8'));
const serverRules = readFileSync(new URL('../../../server/src/rules.ts', import.meta.url), 'utf8');

describe('rules', () => {
  it('moves each tile the way the app and server do', () => {
    // The server's table, read from its source so the two cannot drift apart unnoticed.
    const table = serverRules.match(/const moves[^=]*=\s*(\{[\s\S]*?\});/)[1];
    expect(Rules.moves).toEqual(new Function('return ' + table)());
  });
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
    it(`#${level.id} ${level.name} matches the game and solves at par`, () => {
      const original = shipped[level.id - 1];
      expect({name: level.name, start: level.start, target: level.target, par: level.par})
        .toEqual({name: original.name, start: original.start, target: original.target, par: original.par});
      const result = PuzzleSolver.solve(level);
      expect(result.distance).toBe(level.par);
      expect(PuzzleSolver.verify(level, result).par).toBe(level.par);
    });
  }
});
