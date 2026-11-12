import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { badgeIds, campaign, earnedBadges } from '../src/campaign.js';
import { contentHash, replay, type Move } from '../src/rules.js';
import { progression, threshold } from '../src/progression.js';
import { nickname } from '../src/nickname.js';

test('TypeScript rules replay every Kotlin campaign fixture', () => {
  const routes = JSON.parse(readFileSync(new URL('../../app/src/test/resources/solutions.json', import.meta.url), 'utf8')) as Move[][];
  assert.ok(campaign.length > 0); assert.equal(routes.length, campaign.length);
  campaign.forEach((p, i) => assert.deepEqual(replay(p, routes[i]!), p.target, `campaign ${i + 1}`));
});
test('100-level Journey awards only current milestones and ignores solves beyond it', () => {
  assert.equal(campaign.length, 100);
  assert.deepEqual(badgeIds, ['first','levels-30','levels-60','levels-90','complete']);
  assert.deepEqual(earnedBadges([101,206,999]), []);
  assert.deepEqual(earnedBadges(Array.from({length:30},(_,i)=>i+1).concat([1,101,999])), ['first','levels-30']);
  assert.deepEqual(earnedBadges(Array.from({length:100},(_,i)=>i+1)), badgeIds);
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
test('nicknames allow English letters, numbers, spaces, _ and -, normalise spacing, and are 3-20 characters', () => {
  assert.equal(nickname('  Ｍｙ　Name '), 'My Name');
  assert.equal(nickname('quiet_river-7'), 'quiet_river-7');
  for (const name of ['', '   ', 'ab', 'x'.repeat(21), '‌‍', 'bad‮name', 'a\u0000b', 'پازل باز', '🧩🧩🧩', 'Émile']) assert.throws(() => nickname(name), undefined, name);
});
