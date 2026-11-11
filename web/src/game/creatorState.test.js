import {describe, expect, it} from 'vitest';
import {editCreator as edit, freshCreator, replay, restoreCreator} from './creatorState.js';
import {PuzzleRules as Rules} from './rules.js';
const put = (state, tile, r, c) => edit(state, {type: 'place', tile, at: [r, c]});
const start = () => edit(put(put(freshCreator(), 'B', 1, 1), 'W', 1, 2), {type: 'next'});
const move = state => edit(state, {type: 'move', from: [0, 0], at: [0, 1]});
const roundtrip = state => restoreCreator(JSON.stringify(state));

describe('creator transactions', () => {
  it('starts empty and rejects insufficient or immobile starts', () => {
    expect(freshCreator().board).toEqual(['...', '...', '...']);
    expect(() => edit(freshCreator(), {type: 'next'})).toThrow('two tiles');
    const one = put(freshCreator(), 'W', 0, 0);
    expect(() => edit(one, {type: 'next'})).toThrow('two tiles');
    expect(() => edit(put(one, 'W', 0, 1), {type: 'next'})).toThrow('None');
    expect(() => edit(put(put(freshCreator(), 'R', 0, 0), 'B', 2, 2), {type: 'next'})).toThrow('None');
  });
  it('crops only outer emptiness and keeps internal gaps', () => {
    const state = put(put(put(freshCreator(), 'P', 1, 0), 'W', 1, 2), 'Y', 2, 2);
    expect(edit(state, {type: 'next'}).board).toEqual(['P.W', '..Y']);
    expect(start().board).toEqual(['BW']);
  });
  it('retains hidden tiles until removed or cleared, including repeated resizing', () => {
    let state = put(freshCreator(), 'G', 2, 2);
    state = edit(state, {type: 'resize', rows: 1, cols: 1});
    expect(roundtrip(state)).toEqual(state);
    state = put(state, 'B', 0, 0);
    state = edit(state, {type: 'resize', rows: 5, cols: 5});
    expect(state.board[2][2]).toBe('G');
    expect(state.board[0][0]).toBe('B');
    state = edit(state, {type: 'resize', rows: 1, cols: 1});
    state = edit(state, {type: 'reset'});
    expect(edit(state, {type: 'resize', rows: 3, cols: 3}).board).toEqual(['...', '...', '...']);
  });
  it('rearranges freely, swaps occupied cells and removes tiles', () => {
    let state = put(put(freshCreator(), 'R', 0, 0), 'Y', 2, 2);
    state = edit(state, {type: 'relocate', from: [0, 0], at: [2, 2]});
    expect(state.board).toEqual(['Y..', '...', '..R']);
    state = edit(state, {type: 'relocate', from: [2, 2], at: [0, 1]});
    expect(put(state, '.', 0, 0).board).toEqual(['.R.', '...', '...']);
  });
  it('requires a changed, legally reached target then returns to start', () => {
    const state = start();
    expect(() => edit(state, {type: 'next'})).toThrow('must differ');
    expect(() => edit(state, {type: 'move', from: [0, 1], at: [0, 0]})).toThrow('Invalid');
    const shaped = move(state), check = edit(shaped, {type: 'next'});
    expect(check.phase).toBe('CHECK'); expect(check.board).toEqual(['BW']); expect(check.target).toEqual(['WB']);
    expect(replay(check.start, check.construction)).toEqual(check.target);
    const solved = move(check);
    expect(solved.board).toEqual(solved.target); expect(solved.check).toHaveLength(1);
    expect(move(solved)).toBe(solved);
    expect(() => edit({...shaped, construction: []}, {type: 'next'})).toThrow('again');
  });
  it('resets each stage and navigates back to the appropriate board', () => {
    const shaped = move(start());
    expect(edit(shaped, {type: 'reset'})).toMatchObject({phase: 'SHAPE', board: ['BW'], construction: []});
    const check = edit(shaped, {type: 'next'}), solved = move(check);
    expect(edit(solved, {type: 'reset'})).toMatchObject({phase: 'CHECK', board: ['BW'], check: [], construction: shaped.construction});
    const back = edit(solved, {type: 'back'});
    expect(back).toMatchObject({phase: 'SHAPE', board: ['WB'], target: null, construction: shaped.construction});
    expect(edit(back, {type: 'back'})).toMatchObject({phase: 'BUILD', board: ['BW'], start: null, construction: []});
  });
  it('restores each stage, including construction and check progress', () => {
    for (const state of [freshCreator(), start(), move(start()), edit(move(start()), {type: 'next'}), move(edit(move(start()), {type: 'next'}))]) expect(roundtrip(state)).toEqual(state);
  });
  it('refuses corrupt versions, geometry, paths, hidden tiles and mismatched targets', () => {
    const check = edit(move(start()), {type: 'next'});
    for (const patch of [{version: 2}, {phase: 'OTHER'}, {board: ['X']}, {stash: ['X']}, {target: ['BW']}, {construction: [[[0, 1], [0, 0]]]}, {check: [[[0, 0], [99, 0]]]}, {board: ['WB']}]) expect(() => roundtrip({...check, ...patch})).toThrow();
    expect(() => roundtrip({...freshCreator(), board: ['R..', '...', '...']})).toThrow();
    expect(() => restoreCreator('not json')).toThrow();
    expect(() => replay(['BW'], [[[0, 0.5], [0, 1]]])).toThrow();
  });
});

describe('all six tile rules in creator boards', () => {
  const cases = [
    ['R', [0, 1], [2, 1]], ['B', [1, 0], [1, 2]],
    ['G', [0, 2], [2, 0]], ['Y', [0, 0], [2, 2]],
  ];
  for (const [tile, a, b] of cases) it(`${tile} moves only along its own axis`, () => {
    const grid = Rules.parse(['WWW', `W${tile}W`, 'WWW']);
    expect(Rules.legalMoves(grid, 1, 1)).toEqual([a, b]);
    expect(Rules.isLegal(grid, [1, 1], [0, 1])).toBe(tile === 'R');
  });
  it('purple jumps two cells even over a gap; never jumps onto a gap', () => {
    expect(Rules.legalMoves(Rules.parse(['P.W']), 0, 0)).toEqual([[0, 2]]);
    expect(Rules.legalMoves(Rules.parse(['PW.']), 0, 0)).toEqual([]);
    expect(replay(['P.W'], [[[0, 0], [0, 2]]])).toEqual(['W.P']);
  });
  it('white is passive but accepts a swap from another tile', () => {
    expect(Rules.legalMoves(Rules.parse(['BW']), 0, 1)).toEqual([]);
    expect(replay(['BW'], [[[0, 0], [0, 1]]])).toEqual(['WB']);
  });
});
