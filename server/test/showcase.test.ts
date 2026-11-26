import { test } from 'node:test';
import assert from 'node:assert/strict';
import { replay } from '../src/rules.js';
import { oneMoveSolution } from '../src/seed-community.js';
import { purplePuzzle, shapeVariants, shapedPuzzle, showcaseMasks } from '../src/showcase-puzzles.js';

test('showcase shapes: no two masks match, and the first ones dealt are all different shapes', () => {
  const all = shapeVariants().flat().map(v => v.join('/'));
  assert.equal(new Set(all).size, all.length);
  assert.ok(all.length >= 100, `only ${all.length} masks`);
  assert.ok(all.every(m => !m.split('/').some(row => /^\.+$/.test(row))), 'no empty edge rows');
  const groupOf = new Map(shapeVariants().flatMap((g, i) => g.map(v => [v.join('/'), i] as const)));
  const first = showcaseMasks(24).map(m => groupOf.get(m.join('/')));
  assert.equal(new Set(first).size, 24);
});

test('showcase puzzles replay, keep their shape and have no one-move solution', () => {
  const used = new Set<string>();
  for (const mask of showcaseMasks(30)) {
    const p = shapedPuzzle(mask, used);
    assert.deepEqual(p.start.map(row => row.replace(/[^.]/g, '#')), mask);
    assert.deepEqual(replay(p, p.path), p.target);
    assert.equal(oneMoveSolution(p), false);
  }
  assert.equal(used.size, 30);
  const purple = purplePuzzle(used);
  assert.equal(purple.start[0]![0], 'P');
  assert.notDeepEqual(replay(purple, [purple.swap], false), purple.target);
});
