import { useId } from 'react';

/* The six stones, from the app's TileArt: light -> deep body at 145 degrees, a rim, and a line-art symbol showing how the tile moves. */
const HUES = {
  R: ['#E09A91', '#AE546B'], B: ['#93D2DB', '#3B88A6'], G: ['#A6D7AD', '#4B896B'],
  Y: ['#F0D38B', '#B88A43'], P: ['#C9B8E1', '#8464A9'], W: ['#F3F4DF', '#C3CFBC'],
} as const;
const ICONS: Record<keyof typeof HUES, string> = {
  R: 'M24 8v32M24 8l-7 7M24 8l7 7M24 40l-7-7M24 40l7-7',
  B: 'M8 24h32M8 24l7-7M8 24l7 7M40 24l-7-7M40 24l-7 7',
  G: 'M12.69 35.31 35.31 12.69M35.31 12.69H25.41M35.31 12.69V22.59M12.69 35.31H22.59M12.69 35.31V25.41',
  Y: 'M12.69 12.69 35.31 35.31M12.69 12.69H22.59M12.69 12.69V22.59M35.31 35.31H25.41M35.31 35.31V25.41',
  P: 'M24 7v34M24 7l-7 7M24 7l7 7M24 41l-7-7M24 41l7-7M7 24h34M7 24l7-7M7 24l7 7M41 24l-7-7M41 24l-7 7',
  W: 'M24 11a13 13 0 1 0 0 26 13 13 0 0 0 0-26ZM24 4v5M24 39v5M4 24h5M39 24h5',
};
export type Tile = keyof typeof HUES;

function Stone({ kind, x, y, size, symbol, ids }: { kind: Tile; x: number; y: number; size: number; symbol: boolean; ids: Record<Tile, string> }) {
  const ink = kind === 'W' ? '#3E4658' : '#FFFFFF';
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x="0" y={size * 0.06} width={size} height={size} rx={size * 0.23} fill="#000A173D" />
      <rect width={size} height={size} rx={size * 0.23} fill={`url(#${ids[kind]})`} stroke="#F0FFF073" strokeWidth={Math.max(0.6, size * 0.025)} />
      {symbol && (
        <g transform={`translate(${size * 0.28} ${size * 0.28}) scale(${(size * 0.44) / 48})`} fill="none" strokeLinecap="round" strokeLinejoin="round">
          {kind !== 'W' && <path d={ICONS[kind]} stroke="#0E2A3A" strokeOpacity=".5" strokeWidth="6.6" transform="translate(0 .5)" />}
          <path d={ICONS[kind]} stroke={ink} strokeWidth={kind === 'P' ? 3.4 : kind === 'W' ? 3.6 : 4.2} />
        </g>
      )}
    </g>
  );
}

function Gradients({ ids }: { ids: Record<Tile, string> }) {
  return (
    <defs>
      {(Object.keys(HUES) as Tile[]).map(k => (
        <linearGradient key={k} id={ids[k]} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={HUES[k][0]} /><stop offset="1" stopColor={HUES[k][1]} />
        </linearGradient>
      ))}
    </defs>
  );
}
const useIds = (): Record<Tile, string> => {
  const u = useId().replace(/:/g, '');
  return { R: `${u}R`, B: `${u}B`, G: `${u}G`, Y: `${u}Y`, P: `${u}P`, W: `${u}W` };
};

const GRID: Tile[][] = [['R', 'B', 'G'], ['Y', 'P', 'W'], ['G', 'R', 'B']];

/** The home screen's tilted 3x3 (-9 degrees); outer columns float out of phase. */
export function Hero({ size = 125, symbols = true, float = true }: { size?: number; symbols?: boolean; float?: boolean }) {
  const ids = useIds(); const gap = 5; const cell = (125 - gap * 2) / 3;
  return (
    <svg width={size} height={size} viewBox="-6 -10 137 140" role="img" aria-label="Midori tiles" className="overflow-visible">
      <Gradients ids={ids} />
      <g transform="rotate(-9 62.5 62.5)">
        {GRID.map((row, r) => row.map((k, c) => (
          <g key={`${r}${c}`} className={float && c === 0 ? 'float-a' : float && c === 2 ? 'float-b' : undefined}>
            <Stone kind={k} x={c * (cell + gap)} y={r * (cell + gap)} size={cell} symbol={symbols} ids={ids} />
          </g>
        )))}
      </g>
    </svg>
  );
}

/** A single stone used as a player's avatar: hue from the id, initial on top. */
export function Avatar({ id, name, size = 44 }: { id: string; name: string; size?: number }) {
  const ids = useIds();
  const kinds: Tile[] = ['R', 'B', 'G', 'Y', 'P'];
  let h = 0; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const kind = kinds[h % kinds.length]!;
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" aria-hidden="true" className="flex-none">
      <Gradients ids={ids} />
      <rect x="1" y="2.5" width="42" height="40" rx="10" fill="#000A173D" />
      <rect x="1" y="1" width="42" height="40" rx="10" fill={`url(#${ids[kind]})`} stroke="#F0FFF073" />
      <text x="22" y="27.5" textAnchor="middle" fontSize="18" fontWeight="600" fill="#0E2A3A" fillOpacity=".78" fontFamily="JetBrains Mono, monospace">{(name.trim()[0] ?? '?').toUpperCase()}</text>
    </svg>
  );
}

/* Hand-drawn line icons on a 24 grid: 1.8 strokes, round caps and joins, one colour. */
const icon = (d: string) => function Icon({ size = 20 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
};
export const BackIcon = icon('M15 5l-7 7 7 7');
export const ChevronIcon = icon('M9 5l7 7-7 7');
export const SearchIcon = icon('M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM20 20l-4-4');
export const CopyIcon = icon('M9 9h10v11H9zM5 15V4h10');
