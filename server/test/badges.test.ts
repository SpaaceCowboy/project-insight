import { test } from 'node:test';
import assert from 'node:assert/strict';
import { acceptedDay, currentRun, levelBadges, longestRun, socialBadges, socialBadgeIds } from '../src/badges.js';

test('streak runs count consecutive calendar days', () => {
  assert.equal(longestRun([]), 0);
  assert.equal(longestRun(['2026-01-01', '2026-01-02', '2026-01-04', '2026-01-05', '2026-01-06']), 3);
  assert.equal(longestRun(['2025-12-31', '2026-01-01', '2026-01-01']), 2);
  assert.equal(currentRun(['2026-03-01', '2026-03-02', '2026-03-03'], '2026-03-03'), 3);
  assert.equal(currentRun(['2026-03-01', '2026-03-02'], '2026-03-03'), 2);
  assert.equal(currentRun(['2026-03-01'], '2026-03-03'), 0);
});
test('client days are trusted only within a day of UTC', () => {
  const now = new Date('2026-05-10T12:00:00Z');
  assert.equal(acceptedDay('2026-05-11', now), '2026-05-11');
  assert.equal(acceptedDay('2026-05-09', now), '2026-05-09');
  assert.equal(acceptedDay('2026-05-13', now), '2026-05-10');
  assert.equal(acceptedDay(undefined, now), '2026-05-10');
  assert.equal(acceptedDay('2026-02-30', new Date('2026-03-01T12:00:00Z')), '2026-03-01');
});
test('online, design and streak badges follow their goals', () => {
  assert.equal(socialBadgeIds.length, 25);
  assert.deepEqual(levelBadges(9), []);
  assert.deepEqual(levelBadges(30), ['level-10', 'level-20', 'level-30']);
  assert.equal(socialBadges({ onlineSolved: 0, designedCount: 100, bestStreak: 0 }).length, 5);
  assert.deepEqual(socialBadges({ onlineSolved: 20, designedCount: 1, bestStreak: 14 }), ['online-1', 'online-10', 'online-20', 'designed-1', 'streak-7', 'streak-14']);
  assert.deepEqual(socialBadges({ onlineSolved: 0, designedCount: 0, bestStreak: 6 }), []);
});
