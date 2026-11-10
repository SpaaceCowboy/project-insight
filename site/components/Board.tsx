'use client'

import { useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'
import { legalMoves, type Level } from '@/lib/rules'
import { Mini, NAME, Tile } from './Tile'

type Stone = { id: number; type: string; r: number; c: number }

const toStones = (rows: string[]): Stone[] =>
  rows.flatMap((row, r) => [...row].map((type, c) => ({ type, r, c }))).filter((s) => s.type !== '.').map((s, id) => ({ ...s, id }))

function toBoard(stones: Stone[], rows: number, cols: number): string[] {
  const grid = Array.from({ length: rows }, () => Array<string>(cols).fill('.'))
  for (const s of stones) grid[s.r][s.c] = s.type
  return grid.map((row) => row.join(''))
}

const DIRECTION: Record<string, string> = {
  '-1,0': 'up', '1,0': 'down', '0,-1': 'left', '0,1': 'right',
  '-1,1': 'up and right', '1,-1': 'down and left', '-1,-1': 'up and left', '1,1': 'down and right',
  '-2,0': 'up two cells', '2,0': 'down two cells', '0,-2': 'left two cells', '0,2': 'right two cells',
}
const ARROWS: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }
const DRAG_SLOP = 8 // px before a press becomes a drag, as in the app

export function Board({ levels }: { levels: Level[] }) {
  const [index, setIndex] = useState(0)
  const level = levels[index]
  const [stones, setStones] = useState(() => toStones(level.start))
  const [selected, setSelected] = useState<number | null>(null)
  const [tabStop, setTabStop] = useState(0)
  const [rejected, setRejected] = useState<number | null>(null)
  const [drag, setDrag] = useState<{ id: number; dx: number; dy: number } | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const press = useRef<{ x: number; y: number; dragged: boolean } | null>(null)
  const buttons = useRef(new Map<number, HTMLButtonElement>())

  const rows = level.start.length
  const cols = level.start[0].length
  const board = toBoard(stones, rows, cols)
  const solved = board.join('|') === level.target.join('|')
  const changed = board.join('|') !== level.start.join('|')
  const last = index === levels.length - 1

  const at = (r: number, c: number) => stones.find((s) => s.r === r && s.c === c)
  const canReach = (s: Stone, r: number, c: number) => legalMoves(board, s.r, s.c).some(([mr, mc]) => mr === r && mc === c)

  function load(i: number) {
    setIndex(i)
    setStones(toStones(levels[i].start))
    setSelected(null)
    setTabStop(0)
    setAnnouncement('')
  }

  function swap(a: Stone, b: Stone) {
    const next = stones.map((s) => (s.id === a.id ? { ...s, r: b.r, c: b.c } : s.id === b.id ? { ...s, r: a.r, c: a.c } : s))
    setStones(next)
    setSelected(null)
    const done = toBoard(next, rows, cols).join('|') === level.target.join('|')
    setAnnouncement(done ? 'Beautifully solved.' : `${NAME[a.type]} swapped with ${NAME[b.type]}.`)
  }

  function refuse(s: Stone, why = 'cannot move there') {
    setRejected(s.id)
    setAnnouncement(`${NAME[s.type]} ${why}.`)
  }

  // Same order as the app: a legal destination swaps, otherwise a tile that can move takes the selection.
  function tap(s: Stone) {
    if (solved) return
    const held = stones.find((x) => x.id === selected)
    if (held && canReach(held, s.r, s.c)) return swap(held, s)
    if (held?.id === s.id) return setSelected(null)
    if (legalMoves(board, s.r, s.c).length) return setSelected(s.id)
    refuse(s, s.type === 'W' ? 'never moves by itself' : 'cannot move from here')
  }

  function onPointerDown(e: PointerEvent<HTMLButtonElement>) {
    if (solved || e.button !== 0) return
    press.current = { x: e.clientX, y: e.clientY, dragged: false }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  function onPointerMove(e: PointerEvent<HTMLButtonElement>, s: Stone) {
    const p = press.current
    if (!p || !e.currentTarget.hasPointerCapture(e.pointerId)) return
    const dx = e.clientX - p.x, dy = e.clientY - p.y
    if (!p.dragged && Math.hypot(dx, dy) < DRAG_SLOP) return
    p.dragged = true
    setDrag({ id: s.id, dx, dy })
  }
  function onPointerUp(e: PointerEvent<HTMLButtonElement>, s: Stone) {
    const p = press.current
    if (!p?.dragged) return // a tap: onClick handles it
    setDrag(null)
    // The drop counts only when the tile's centre is over a cell it can swap with.
    const gap = parseFloat(getComputedStyle(e.currentTarget).getPropertyValue('--gap'))
    const pitch = e.currentTarget.offsetWidth + gap
    const r = s.r + Math.round((e.clientY - p.y) / pitch), c = s.c + Math.round((e.clientX - p.x) / pitch)
    const under = at(r, c)
    if (under && under.id !== s.id) canReach(s, r, c) ? swap(s, under) : refuse(s)
  }
  function onClick(s: Stone) {
    const dragged = press.current?.dragged
    press.current = null
    if (!dragged) tap(s)
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, s: Stone) {
    const step = ARROWS[e.key]
    if (!step) return
    e.preventDefault()
    // The next tile in that direction, skipping holes.
    for (let r = s.r + step[0], c = s.c + step[1]; r >= 0 && r < rows && c >= 0 && c < cols; r += step[0], c += step[1]) {
      const next = at(r, c)
      if (next) { setTabStop(next.id); buttons.current.get(next.id)?.focus(); return }
    }
  }

  function label(s: Stone) {
    const moves = legalMoves(board, s.r, s.c).map(([r, c]) => DIRECTION[`${r - s.r},${c - s.c}`])
    const ability = moves.length ? `can move ${moves.join(' or ')}` : s.type === 'W' ? 'never moves by itself' : 'cannot move from here'
    return `${NAME[s.type]}, row ${s.r + 1}, column ${s.c + 1}, ${ability}`
  }

  return (
    <div className="board flex flex-col items-center gap-5">
      <p className="eyebrow">Journey {level.n} · {level.name}</p>

      <div className="flex items-center gap-3">
        <span className="text-xs text-muted">Target</span>
        <Mini rows={level.target} cell={16} label={`Target: ${level.target.map((row) => [...row].map((t) => NAME[t] ?? 'gap').join(', ')).join('; ')}`} />
      </div>

      <div className="plush p-5 sm:p-6" style={{ borderRadius: 24 }}>
        <div className="board-grid" role="group" aria-label="Puzzle board" style={{ '--rows': rows, '--cols': cols } as CSSProperties}>
          {stones.map((s) => {
            const dragging = drag?.id === s.id
            const x = `calc(${s.c} * (var(--cell) + var(--gap)) + ${dragging ? drag.dx : 0}px)`
            const y = `calc(${s.r} * (var(--cell) + var(--gap)) + ${dragging ? drag.dy : 0}px)`
            const lift = dragging ? ' scale(1.045)' : selected === s.id ? ' translateY(-5px) scale(1.035)' : ''
            return (
              <button
                key={`${index}-${s.id}`}
                ref={(el) => { if (el) buttons.current.set(s.id, el); else buttons.current.delete(s.id) }}
                type="button"
                className="slot"
                style={{ transform: `translate(${x}, ${y})${lift}` }}
                aria-label={label(s)}
                aria-pressed={selected === s.id}
                tabIndex={tabStop === s.id ? 0 : -1}
                data-dragging={dragging || undefined}
                data-reject={rejected === s.id || undefined}
                data-solved={solved || undefined}
                onAnimationEnd={() => setRejected(null)}
                onFocus={() => setTabStop(s.id)}
                onPointerDown={onPointerDown}
                onPointerMove={(e) => onPointerMove(e, s)}
                onPointerUp={(e) => onPointerUp(e, s)}
                onPointerCancel={() => { press.current = null; setDrag(null) }}
                onClick={() => onClick(s)}
                onKeyDown={(e) => onKeyDown(e, s)}
              >
                <Tile type={s.type} style={solved ? { animationDelay: `${(s.r + s.c) * 70}ms` } : undefined} />
              </button>
            )
          })}
        </div>
      </div>

      <p className="sr-only" aria-live="polite">{announcement}</p>

      <div className="flex min-h-28 flex-col items-center gap-4 text-center">
        {solved ? (
          <>
            <p className="text-xl">Beautifully solved.</p>
            <div className="flex flex-wrap justify-center gap-3">
              <button type="button" className="plush key" onClick={() => load(index)}>Replay</button>
              {last
                ? <a className="plush key key-primary" href="#download">Download the game</a>
                : <button type="button" className="plush key key-primary" onClick={() => load(index + 1)}>Next</button>}
            </div>
          </>
        ) : (
          <>
            <p className="max-w-xs text-sm text-muted">
              Tap a tile, then the tile it should swap with. Or drag it there. Arrow keys and Enter work too.
            </p>
            <button type="button" className="plush key" disabled={!changed} onClick={() => load(index)}>Restart</button>
          </>
        )}
      </div>
    </div>
  )
}
