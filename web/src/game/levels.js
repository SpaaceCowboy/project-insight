// Three real Journey levels (numbers are their place in the game): the first swap, White, and the diagonals.
export const LEVELS = [
  {id: 1, name: 'The First Turn', start: ['BR', 'RB'], target: ['RB', 'RB'], par: 1},
  {id: 5, name: 'Hold the Light', start: ['RBWB', 'BRWR'], target: ['RRBR', 'BWBW'], par: 4},
  {id: 10, name: 'A New Direction', start: ['YG.', 'RGB', 'BR.'], target: ['RG.', 'RYB', 'BG.'], par: 2},
];

/** The app's Rulebook board: all six tiles, no target, nothing to solve. */
export const SANDBOX = {id: 'sandbox', name: 'Rulebook', start: ['RBG', 'PWY', 'BGR'], target: null};
