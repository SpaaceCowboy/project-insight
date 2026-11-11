// Tile artwork and wording, taken from the studio's tile-art.js and the app's Rulebook.kt.
export const ICONS = {
  R: 'M24 8v32M24 8l-7 7M24 8l7 7M24 40l-7-7M24 40l7-7',
  B: 'M8 24h32M8 24l7-7M8 24l7 7M40 24l-7-7M40 24l-7 7',
  G: 'M12.69 35.31 35.31 12.69M35.31 12.69H25.41M35.31 12.69V22.59M12.69 35.31H22.59M12.69 35.31V25.41',
  Y: 'M12.69 12.69 35.31 35.31M12.69 12.69H22.59M12.69 12.69V22.59M35.31 35.31H25.41M35.31 35.31V25.41',
  P: 'M24 8v32M8 24h32M18 14l6-6 6 6M18 34l6 6 6-6M14 18l-6 6 6 6M34 18l6 6-6 6M24 16l8 8-8 8-8-8 8-8',
};

export const TILES = {
  R: {cls: 'red', name: 'Red', title: 'Coral', rule: 'Red slides one cell up or down.'},
  B: {cls: 'blue', name: 'Blue', title: 'Lagoon', rule: 'Blue slides one cell left or right.'},
  G: {cls: 'green', name: 'Green', title: 'Sea Lettuce', rule: 'Green steps diagonally, up-right or down-left.'},
  Y: {cls: 'yellow', name: 'Yellow', title: 'Sand', rule: 'Yellow steps diagonally, up-left or down-right.'},
  P: {cls: 'purple', name: 'Purple', title: 'Anemone', rule: 'Purple jumps two cells up, down, left or right.'},
  W: {cls: 'white', name: 'White', title: 'Pearl', rule: 'White never moves itself; other tiles can only swap places with it.'},
};

export const TILE_ORDER = ['R', 'B', 'G', 'Y', 'P', 'W'];
