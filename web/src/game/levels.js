// A short ladder of real Journey levels (numbers are their place in the game), one per new idea.
// game.test.js checks these against app/src/main/assets/levels.json.
export const LEVELS = [
  {id: 1, name: 'The First Turn', start: ['BR', 'RB'], target: ['RB', 'RB'], par: 1},
  {id: 2, name: 'Opposite Corners', start: ['RR', 'BB'], target: ['BR', 'BR'], par: 2},
  {id: 5, name: 'Hold the Light', start: ['RBWB', 'BRWR'], target: ['RRBR', 'BWBW'], par: 4},
  {id: 9, name: 'Quarter Turn', start: ['RYYR', 'GBGB'], target: ['RGYR', 'BYGB'], par: 2},
  {id: 10, name: 'A New Direction', start: ['YG.', 'RGB', 'BR.'], target: ['RG.', 'RYB', 'BG.'], par: 2},
  {id: 147, name: 'First Leap', start: ['BRP'], target: ['PRB'], par: 1},
];

/** The app's Rulebook board: all six tiles, no target, nothing to solve. */
export const SANDBOX = {id: 'sandbox', name: 'Rulebook', start: ['RBG', 'PWY', 'BGR'], target: null};
