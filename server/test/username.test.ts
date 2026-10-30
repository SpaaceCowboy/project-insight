import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { usernameWords } from '../src/username-words.js';
import { usernameProblem } from '../src/username.js';
import { nickname } from '../src/nickname.js';

const cases = JSON.parse(readFileSync(new URL('../../app/src/test/resources/username-cases.json', import.meta.url), 'utf8')) as { allowed: string[]; blocked: { name: string; problem: string }[] };

test('username word lists match the Android asset', () => {
  assert.deepEqual(JSON.parse(readFileSync(new URL('../../app/src/main/assets/username-words.json', import.meta.url), 'utf8')), usernameWords);
});
test('ordinary usernames pass, including words that merely contain a bad one', () => {
  for (const name of cases.allowed) assert.deepEqual(usernameProblem(name), { name, problem: null }, name);
});
test('problem usernames are refused with the right explanation', () => {
  for (const { name, problem } of cases.blocked) assert.equal(usernameProblem(name).problem, problem, name);
});
test('nickname() normalises spacing and throws the code of the first broken rule', () => {
  assert.equal(nickname('  Ｍｙ   Name '), 'My Name');
  assert.throws(() => nickname('f u c k'), (e: any) => e.code === 'NAME_PROFANITY' && /profanity/.test(e.message) && e.statusCode === 400);
  assert.throws(() => nickname('ab'), (e: any) => e.code === 'NAME_LENGTH');
  assert.throws(() => nickname('Émile'), (e: any) => e.code === 'NAME_CHARACTERS');
});
