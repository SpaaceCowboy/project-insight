import {PuzzleRules as Rules} from './rules.js';

export const DRAFT_KEY = 'midori-creator-v1';
const empty = (rows = 5, cols = 5) => Array(rows).fill('.'.repeat(cols));
const rowsOf = board => board.map(row => [...row].join(''));
const equal = (a, b) => rowsOf(a).join('|') === rowsOf(b).join('|');
const merge = (stash, board) => stash.map((row, r) => [...row].map((type, c) => board[r]?.[c] ?? type).join(''));
export const freshCreator = () => ({version: 1, phase: 'BUILD', board: empty(3, 3), stash: empty(), start: null, target: null, construction: [], check: []});

function validBoard(board, size) {
  if (!Array.isArray(board) || board.length < 1 || board.length > 5 || typeof board[0] !== 'string' || board[0].length < 1 || board[0].length > 5 || !board.every(row => typeof row === 'string' && row.length === board[0].length && /^[RBGYPW.]+$/.test(row)) || (size && (board.length !== size || board[0].length !== size))) throw new Error('Invalid draft board.');
}
function validStart(board) {
  if (board.join('').replaceAll('.', '').length < 2) throw new Error('Place at least two tiles first.');
  const grid = Rules.parse(board);
  if (!grid.some((row, r) => row.some((_, c) => Rules.legalMoves(grid, r, c).length))) throw new Error('None of these tiles can move. Add tiles they can swap with.');
}
export function replay(start, path) {
  if (!Array.isArray(path) || path.length > 10000) throw new Error('Invalid draft moves.');
  let board = Rules.parse(start);
  for (const move of path) {
    if (!Array.isArray(move) || move.length !== 2 || !move.every(at => Array.isArray(at) && at.length === 2 && at.every(Number.isInteger)) || !Rules.isLegal(board, ...move)) throw new Error('Invalid draft move.');
    board = Rules.swapCells(board, ...move);
  }
  return rowsOf(board);
}

/** Pure committed transactions. Selection and animations never enter a saved draft. */
export function editCreator(state, action) {
  const {phase, board} = state;
  if (action.type === 'reset') {
    if (phase === 'BUILD') return {...freshCreator(), board: empty(board.length, board[0].length)};
    return {...state, board: state.start.slice(), construction: phase === 'SHAPE' ? [] : state.construction, check: []};
  }
  if (action.type === 'back') {
    if (phase === 'CHECK') return {...state, phase: 'SHAPE', board: state.target.slice(), target: null, check: []};
    if (phase === 'SHAPE') return {...freshCreator(), board: state.start.slice(), stash: merge(empty(), state.start)};
    return state;
  }
  if (phase === 'BUILD') {
    if (action.type === 'resize') {
      const {rows, cols} = action;
      if (![rows, cols].every(n => Number.isInteger(n) && n >= 1 && n <= 5)) throw new Error('Choose between 1 and 5 rows and columns.');
      return {...state, board: Rules.fit(state.stash, rows, cols)};
    }
    if (action.type === 'place' || action.type === 'relocate') {
      const inside = at => Array.isArray(at) && at.length === 2 && at.every(Number.isInteger) && at[0] >= 0 && at[0] < board.length && at[1] >= 0 && at[1] < board[0].length;
      if (!inside(action.at) || (action.type === 'relocate' && !inside(action.from))) throw new Error('Choose a cell on the grid.');
      if (action.type === 'place' && !/^[RBGYPW.]$/.test(action.tile)) throw new Error('Choose a tile from the palette.');
      const next = action.type === 'place' ? Rules.set(board, action.at, action.tile) : rowsOf(Rules.swapCells(Rules.parse(board), action.from, action.at));
      return {...state, board: next, stash: merge(state.stash, next)};
    }
    if (action.type === 'next') {
      validStart(board);
      const start = rowsOf(Rules.crop(Rules.parse(board)));
      return {...state, phase: 'SHAPE', start, board: start, construction: [], check: []};
    }
  } else {
    if (action.type === 'move') {
      if (phase === 'CHECK' && equal(board, state.target)) return state;
      const next = replay(board, [[action.from, action.at]]);
      const key = phase === 'SHAPE' ? 'construction' : 'check';
      if (state[key].length >= 10000) throw new Error('Move limit reached. Reset this stage to continue.');
      return {...state, board: next, [key]: [...state[key], [action.from, action.at]]};
    }
    if (action.type === 'next' && phase === 'SHAPE') {
      if (equal(board, state.start)) throw new Error('Move some tiles first: the target must differ from the start.');
      if (!equal(replay(state.start, state.construction), board)) throw new Error('Move tiles to choose your target again.');
      return {...state, phase: 'CHECK', target: board.slice(), board: state.start.slice(), check: []};
    }
  }
  return state;
}

export function restoreCreator(raw) {
  const data = JSON.parse(raw);
  if (!data || data.version !== 1 || !['BUILD', 'SHAPE', 'CHECK'].includes(data.phase)) throw new Error('Unsupported draft.');
  validBoard(data.board); validBoard(data.stash, 5);
  if (data.phase === 'BUILD') {
    if (data.start !== null || data.target !== null || data.construction?.length !== 0 || data.check?.length !== 0 || !equal(Rules.fit(data.stash, data.board.length, data.board[0].length), data.board)) throw new Error('Invalid build draft.');
  } else {
    validBoard(data.start); validStart(data.start);
    if (!equal(rowsOf(Rules.crop(Rules.parse(data.start))), data.start)) throw new Error('Invalid start bounds.');
    const shaped = replay(data.start, data.construction);
    if (data.phase === 'SHAPE') {
      if (data.target !== null || data.check?.length !== 0 || !equal(shaped, data.board)) throw new Error('Invalid target draft.');
    } else {
      validBoard(data.target);
      if (equal(data.start, data.target) || !equal(shaped, data.target) || !equal(replay(data.start, data.check), data.board)) throw new Error('Invalid preview draft.');
    }
  }
  // Whitelist fields instead of retaining arbitrary stored properties.
  return Object.fromEntries(Object.keys(freshCreator()).map(key => [key, data[key]]));
}
