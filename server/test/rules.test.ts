import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { campaign } from '../src/campaign.js';
import { contentHash, replay, type Move } from '../src/rules.js';
import { progression, threshold } from '../src/progression.js';
import { safeName } from '../src/vocabulary.js';
import { nickname } from '../src/nickname.js';

test('TypeScript rules replay every Kotlin campaign fixture', () => {
  const routes = JSON.parse(readFileSync(new URL('../../app/src/test/resources/solutions.json', import.meta.url), 'utf8')) as Move[][];
  assert.ok(campaign.length > 0); assert.equal(routes.length, campaign.length);
  campaign.forEach((p, i) => assert.deepEqual(replay(p, routes[i]!), p.target, `campaign ${i + 1}`));
});
test('reject malformed grids, illegal moves, moved holes, and trailing moves', () => {
  const p = { start: ['RB', 'YW'], target: ['YB', 'RW'] };
  assert.deepEqual(replay(p, [[0, 2]]), p.target);
  for (const path of [[[0, 1]], [[0, 24]], [[-1, 2]], [[0.5, 2]], [[0, 2], [2, 0]], []]) assert.throws(() => replay(p, path as Move[]));
  assert.throws(() => replay({ start: ['R.','BW'], target: ['.R','BW'] }, [[0, 1]]));
  assert.throws(() => replay({ start: ['RB','W'], target: ['BR','W'] }, [[0, 1]]));
  assert.throws(() => replay({ start: ['RX'], target: ['XR'] }, [[0, 1]]));
});
test('reward identities normalize unused borders', () => {
  assert.equal(contentHash({ start: ['RB','YW'], target: ['YB','RW'] }), contentHash({ start: ['....','.RB.','.YW.','....'], target: ['....','.YB.','.RW.','....'] }));
});
test('all level thresholds, fractional XP, and the level-100 cap', () => {
  assert.equal(threshold(100), 106_920_000n);
  for (let level = 2; level <= 100; level++) {
    assert.equal(progression(threshold(level) - 1n).level, level - 1);
    assert.equal(progression(threshold(level)).level, level);
    assert.equal(threshold(level) - threshold(level - 1), BigInt(100 + 20 * (level - 2)) * 1000n);
  }
  assert.equal(progression(1n).xpMilli, '1');
  assert.equal(progression(10n ** 20n).level, 100);
  assert.equal(progression(10n ** 20n).nextLevelMilli, null);
});
test('only reviewed word combinations are accepted', () => {
  assert.equal(safeName('Quiet Cove'), 'Quiet Cove');
  for (const text of ['quiet cove', 'QuietCove', 'Quiet Cove!', 'John Cove', 'Quiet\u200b Cove']) assert.throws(() => safeName(text));
});
test('free nicknames preserve Unicode, normalize spacing, and reject hidden/oversized names', () => {
  assert.equal(nickname('  Ｍｙ\u3000Name '), 'My Name');
  assert.equal(nickname('پازل\u200cباز 🎮'), 'پازل\u200cباز 🎮');
  assert.equal(nickname('🧩'.repeat(32)), '🧩'.repeat(32));
  for (const name of ['', '   ', '\u200c\u200d', 'bad\u202ename', 'a\u0000b', '🧩'.repeat(33)]) assert.throws(() => nickname(name));
});
