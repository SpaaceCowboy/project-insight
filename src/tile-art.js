// Shared tile appearance for the game and editor.
export const PuzzleArt = (() => {
const ICONS={
R:`<svg viewBox="0 0 48 48" fill="none"><path d="M24 8v32M24 8l-7 7M24 8l7 7M24 40l-7-7M24 40l7-7" stroke="white" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
B:`<svg viewBox="0 0 48 48" fill="none"><path d="M8 24h32M8 24l7-7M8 24l7 7M40 24l-7-7M40 24l-7 7" stroke="white" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
G:`<svg viewBox="0 0 48 48" fill="none"><path d="M10 38 38 10M38 10H25M38 10v13M10 38l13-3M10 38l3-13" stroke="white" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
Y:`<svg viewBox="0 0 48 48" fill="none"><path d="M10 10 38 38M10 10v13M10 10h13M38 38H25M38 38V25" stroke="white" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
W:`<svg viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="10" stroke="#3e4658" stroke-width="4"/><path d="M24 6v8M24 34v8M6 24h8M34 24h8" stroke="#3e4658" stroke-width="3.6" stroke-linecap="round"/></svg>`,
P:`<svg viewBox="0 0 48 48" fill="none"><path d="M24 7v34M24 7l-7 7M24 7l7 7M24 41l-7-7M24 41l7-7M7 24h34M7 24l7-7M7 24l7 7M41 24l-7-7M41 24l-7 7" stroke="white" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`
};
const META = {
  R: {cls: 'red', name: 'Red'},
  B: {cls: 'blue', name: 'Blue'},
  G: {cls: 'green', name: 'Green'},
  Y: {cls: 'yellow', name: 'Yellow'},
  W: {cls: 'white', name: 'White'},
  P: {cls: 'purple', name: 'Purple'}
};
const TILE_LIGHTS = {R:'#e69a99',B:'#88cedd',G:'#9fd6b5',Y:'#edcc82',P:'#bba9dc',W:'#e4ecdf'};
return {ICONS,META,TILE_LIGHTS};
})();
