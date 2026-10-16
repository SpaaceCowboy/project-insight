import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decrypt, digest, encrypt, token } from '../src/crypto.js';
test('outbox/refresh encryption authenticates content and keys', () => {
  const key = 'ab'.repeat(32); const value = { code: '12345678', purpose: 'verify' };
  const ciphertext = encrypt(value, key);
  assert.deepEqual(decrypt(ciphertext, key), value);
  assert.equal(ciphertext.includes(value.code), false);
  assert.throws(() => decrypt(ciphertext, 'cd'.repeat(32)));
  const bytes = Buffer.from(ciphertext, 'base64'); bytes[bytes.length - 1] = bytes.at(-1)! ^ 1;
  assert.throws(() => decrypt(bytes.toString('base64'), key));
  assert.equal(token().length, 43); assert.notEqual(token(), token());
  assert.notEqual(digest('code', key), digest('code', 'cd'.repeat(32)));
});
