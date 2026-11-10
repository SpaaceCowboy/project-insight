import type { CSSProperties } from 'react'

// Colours from Art.STD_TILE / STD_LIGHT in the app's Theme.kt: [light, deep, flat].
export const HUES: Record<string, [string, string, string]> = {
  R: ['#E09A91', '#AE546B', '#E69A99'],
  B: ['#93D2DB', '#3B88A6', '#88CEDD'],
  G: ['#A6D7AD', '#4B896B', '#9FD6B5'],
  Y: ['#F0D38B', '#B88A43', '#EDCC82'],
  P: ['#C9B8E1', '#8464A9', '#BBA9DC'],
  W: ['#F3F4DF', '#C3CFBC', '#E4ECDF'],
}
export const NAME: Record<string, string> = { R: 'Red', B: 'Blue', G: 'Green', Y: 'Yellow', P: 'Purple', W: 'White' }

// Symbols from LINES in the app's TileArt.kt, on its 48-unit grid.
const SYMBOL: Record<string, string> = {
  R: 'M24 8V40M17 15L24 8L31 15M17 33L24 40L31 33',
  B: 'M8 24H40M15 17L8 24L15 31M33 17L40 24L33 31',
  G: 'M12.69 35.31L35.31 12.69M25.41 12.69H35.31V22.59M22.59 35.31H12.69V25.41',
  Y: 'M12.69 12.69L35.31 35.31M22.59 12.69H12.69V22.59M25.41 35.31H35.31V25.41',
  P: 'M24 8V40M8 24H40M18 14L24 8L30 14M18 34L24 40L30 34M14 18L8 24L14 30M34 18L40 24L34 30M24 16L32 24L24 32L16 24Z',
  W: 'M24 6V14M24 34V42M6 24H14M34 24H42M14 24a10 10 0 1 0 20 0a10 10 0 1 0-20 0',
}
const STROKE: Record<string, number> = { R: 3.28, B: 3.28, G: 3.28, Y: 3.28, P: 2.42, W: 3.8 }

/** The game tile. Sized by the nearest `--cell`; purely visual, so the caller supplies any label. */
export function Tile({ type, className = '', style }: { type: string; className?: string; style?: CSSProperties }) {
  const [light, deep] = HUES[type]
  const pale = type === 'W'
  return (
    <span className={`tile ${className}`} style={{ '--light': light, '--deep': deep, ...style } as CSSProperties}>
      <svg viewBox="0 0 48 48" fill="none" strokeWidth={STROKE[type]} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {/* Cut into the face: light ink is shadowed from above, dark ink is lit from below. */}
        <path d={SYMBOL[type]} transform={`translate(0 ${pale ? 1.2 : -1.2})`} stroke={pale ? 'rgba(255,255,255,.7)' : 'rgba(0,0,0,.2)'} />
        <path d={SYMBOL[type]} stroke={pale ? 'rgba(69,71,76,.92)' : 'rgba(255,255,255,.9)'} />
      </svg>
    </span>
  )
}

/** A miniature of a board in flat hues, without symbols, as on the app's targets and level cards. */
export function Mini({ rows, cell, label }: { rows: string[]; cell: number; label: string }) {
  return (
    <span role="img" aria-label={label} className="grid" style={{ gridTemplateColumns: `repeat(${rows[0].length}, ${cell}px)`, gap: Math.max(2, cell / 6) }}>
      {rows.flatMap((row, r) => [...row].map((type, c) => (
        <span key={`${r}-${c}`} style={{ width: cell, height: cell, borderRadius: '25%', background: type === '.' ? 'transparent' : HUES[type][2] }} />
      )))}
    </span>
  )
}
