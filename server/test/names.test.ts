import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { blockedWords } from '../src/blocked-words.js';
import { isBlocked, levelName, worldName } from '../src/names.js';

const cases = JSON.parse(readFileSync(new URL('../../app/src/test/resources/name-filter-cases.json', import.meta.url), 'utf8')) as { allowed: string[]; blocked: string[] };

test('blocked-word lists match the Android asset', () => {
  assert.deepEqual(JSON.parse(readFileSync(new URL('../../app/src/main/assets/blocked-words.json', import.meta.url), 'utf8')), blockedWords);
});
test('names filter allows ordinary words and blocks profanity, slurs, and dangerous terms', () => {
  for (const name of cases.allowed) assert.equal(worldName(name), name, name);
  for (const name of cases.blocked) assert.throws(() => worldName(name), /INVALID_NAME|isn't allowed/, name);
  assert.equal(isBlocked('Calm Pool'), false);
});
test('names enforce visible 1-32 character free text', () => {
  assert.equal(worldName('  Ｍｙ   World '), 'My World');
  for (const text of ['', '   ', 'x'.repeat(33), 'Quiet​ Cove', 'Bad‮Name']) assert.throws(() => worldName(text), undefined, text);
});
test('level names default to the level number and are filtered when given', () => {
  assert.equal(levelName('', 3), 'Level 3');
  assert.equal(levelName('  ', 7), 'Level 7');
  assert.equal(levelName('First Steps', 1), 'First Steps');
  assert.throws(() => levelName('Kill Zone', 1));
});
