// Shared tile appearance for the game and editor.
export const PuzzleArt = (() => {
const ICONS={
R:`<svg viewBox="0 0 48 48" fill="none"><path d="M24 8v32M24 8l-7 7M24 8l7 7M24 40l-7-7M24 40l7-7" stroke="white" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
B:`<svg viewBox="0 0 48 48" fill="none"><path d="M8 24h32M8 24l7-7M8 24l7 7M40 24l-7-7M40 24l-7 7" stroke="white" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
G:`<svg viewBox="0 0 48 48" fill="none"><path d="M12.69 35.31 35.31 12.69M35.31 12.69H25.41M35.31 12.69V22.59M12.69 35.31H22.59M12.69 35.31V25.41" stroke="white" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
Y:`<svg viewBox="0 0 48 48" fill="none"><path d="M12.69 12.69 35.31 35.31M12.69 12.69H22.59M12.69 12.69V22.59M35.31 35.31H25.41M35.31 35.31V25.41" stroke="white" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
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
// One [light, deep] pair per world; the first six echo the tile colours.
const WORLD_COLORS = [['#93d2db','#3b88a6'],['#e09a91','#ae546b'],['#a6d7ad','#4b896b'],['#f0d38b','#b88a43'],['#c9b8e1','#8464a9'],['#8fd9c9','#2f8a80'],['#f0b48c','#b8663f'],['#a4b4ec','#4a5aa8'],['#c5d98f','#7a9440'],['#e8a3cf','#a8508a'],['#f3f4df','#c3cfbc']];
return {ICONS,META,TILE_LIGHTS,WORLD_COLORS};
})();
