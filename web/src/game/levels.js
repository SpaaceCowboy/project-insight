// Three real Journey levels (numbers are their place in the game since v0.2.30): the first swaps, the diagonals, and White.
export const LEVELS = [
  {id: 4, name: 'The First Turn', start: ['BRB', 'RBR'], target: ['RBR', 'BRB'], par: 3},
  {id: 5, name: 'A New Direction', start: ['R.', '.Y', 'Y.', '.R'], target: ['Y.', '.R', 'R.', '.Y'], par: 2},
  {id: 10, name: 'Hold the Light', start: ['BWWB', 'BWWB'], target: ['WBBW', 'WBBW'], par: 4},
];

/** The app's Rulebook board: all six tiles, no target, nothing to solve. */
export const SANDBOX = {id: 'sandbox', name: 'Rulebook', start: ['RBG', 'PWY', 'BGR'], target: null};
