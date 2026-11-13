// The hero's boards: a 2x2 warm-up, then real Journey levels (ids are their number in the game since v0.2.30).
// The last one uses all six tiles; "Try all six on the board" opens it.
export const LEVELS = [
  {id: 'first', name: 'First swaps', start: ['BR', 'RB'], target: ['RB', 'BR'], par: 2},
  {id: 50, name: 'Journey 50', start: ['YR', 'WB'], target: ['BW', 'RY'], par: 4},
  {id: 37, name: 'Journey 37', start: ['.R.', 'BGY', '.W.'], target: ['.R.', 'GWY', '.B.'], par: 6},
  {id: 19, name: 'Journey 19', start: ['B.R', 'WGY'], target: ['R.G', 'YWB'], par: 8},
  {id: 79, name: 'Journey 79', start: ['RYP', 'GBR', 'BWY'], target: ['YPY', 'BGB', 'RWR'], par: 7},
];
