// node --test lib/rules.test.ts
// The levels a visitor plays in the hero must be solvable with these rules, within the campaign's own par.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { legalMoves, swap } from './rules.ts'

const { hero } = JSON.parse(readFileSync(new URL('./generated.json', import.meta.url), 'utf8'))

function shortest(start: string[], target: string[], limit: number): number | null {
  const goal = target.join('|')
  let frontier = [start]
  const seen = new Set([start.join('|')])
  for (let depth = 0; depth <= limit; depth++) {
    if (frontier.some((b) => b.join('|') === goal)) return depth
    const next: string[][] = []
    for (const b of frontier) for (let r = 0; r < b.length; r++) for (let c = 0; c < b[r].length; c++) {
      for (const to of legalMoves(b, r, c)) {
        const n = swap(b, [r, c], to)
        if (!seen.has(n.join('|'))) { seen.add(n.join('|')); next.push(n) }
      }
    }
    frontier = next
  }
  return null
}

test('hero levels are solvable in exactly their par', () => {
  assert.equal(hero.length, 3)
  for (const level of hero) assert.equal(shortest(level.start, level.target, level.par), level.par, level.name)
})
