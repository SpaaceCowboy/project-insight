// Tile artwork and wording, taken from the studio's tile-art.js and the app's Rulebook.kt.
// Each arrow is a shaft plus one chevron per head (arm, tip, arm), as in TileArt.kt's LINES.
export const ICONS = {
  R: 'M24 8V40M17 15l7-7 7 7M17 33l7 7 7-7',
  B: 'M8 24H40M15 17l-7 7 7 7M33 17l7 7-7 7',
  G: 'M12.69 35.31 35.31 12.69M25.41 12.69h9.9v9.9M22.59 35.31h-9.9v-9.9',
  Y: 'M12.69 12.69 35.31 35.31M22.59 12.69h-9.9v9.9M25.41 35.31h9.9v-9.9',
  P: 'M24 8v32M8 24h32M18 14l6-6 6 6M18 34l6 6 6-6M14 18l-6 6 6 6M34 18l6 6-6 6M24 16l8 8-8 8-8-8 8-8',
  W: 'M24 6v8M24 34v8M6 24h8M34 24h8M14 24a10 10 0 1 0 20 0 10 10 0 1 0-20 0',
};

// Rulebook.kt: the colour is the name, the sentence is what it does.
export const TILES = {
  R: {cls: 'red', name: 'Red', rule: 'swaps up or down'},
  B: {cls: 'blue', name: 'Blue', rule: 'swaps left or right'},
  G: {cls: 'green', name: 'Green', rule: 'swaps up-right or down-left'},
  Y: {cls: 'yellow', name: 'Yellow', rule: 'swaps up-left or down-right'},
  P: {cls: 'purple', name: 'Purple', rule: 'only swaps two cells up, down, left or right.'},
  W: {cls: 'white', name: 'White', rule: 'never moves itself; other tiles can swap with it.'},
};

export const TILE_ORDER = ['R', 'B', 'G', 'Y', 'P', 'W'];

/** TileArt.kt symbol(): stroke widths in the 48 box (the coloured tiles' arrows are etched at .78 weight). */
export const strokeWidth = type => type === 'W' ? 3.8 : type === 'P' ? 2.418 : 3.276;
