import assert from 'node:assert/strict';
import test from 'node:test';
import { DomainError } from '../src/rules.js';
import { googleVerifier, tokenInfoClaims, type GoogleClaims } from '../src/google.js';

const clientId = 'test-client.apps.googleusercontent.com';
const stub = (claims: GoogleClaims) => async () => claims;

/** Runs a fetcher against a stubbed global fetch and restores it afterwards. */
async function withFetch(body: unknown, status: number, run: () => Promise<unknown>) {
  const original = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = (async (url: string | URL) => {
    calls.push(String(url));
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  try { await run(); } finally { globalThis.fetch = original; }
  return calls;
}

const valid = { aud: clientId, iss: 'https://accounts.google.com', exp: String(Math.floor(Date.now() / 1000) + 600), sub: 'g-1', email: 'Player@Example.test', email_verified: 'true', name: 'Grace' };

test('an invalid token falls back to Google\'s tokeninfo and keeps the profile', async () => {
  // "not-a-jwt" is rejected by the library before it touches the network, so the fallback runs offline.
  const profile = await googleVerifier(clientId, stub({ sub: 'g-2', email: 'P@Example.test', name: 'Ada', verified: true }))('not-a-jwt');
  assert.deepEqual(profile, { sub: 'g-2', email: 'p@example.test', name: 'Ada' });
});

test('the fallback still refuses an unverified email', async () => {
  await assert.rejects(googleVerifier(clientId, stub({ sub: 'g-3', email: 'x@example.test', verified: false }))('not-a-jwt'),
    (error: DomainError) => error.code === 'GOOGLE_INVALID');
});

test('tokeninfo accepts a valid token for the configured client', async () => {
  const calls = await withFetch(valid, 200, async () => {
    const claims = await tokenInfoClaims('token', clientId);
    assert.equal(claims.sub, 'g-1');
    assert.equal(claims.email, 'Player@Example.test');
    assert.equal(claims.verified, true);
  });
  assert.equal(calls.length, 1);
  assert.match(calls[0]!, /^https:\/\/oauth2\.googleapis\.com\/tokeninfo\?id_token=token$/);
});

test('tokeninfo refuses a different audience, an expired token and a failed request', async () => {
  const cases: Array<[unknown, number]> = [
    [{ ...valid, aud: 'someone-else.apps.googleusercontent.com' }, 200],
    [{ ...valid, exp: String(Math.floor(Date.now() / 1000) - 60) }, 200],
    [{ error: 'invalid_token' }, 400],
  ];
  for (const [body, status] of cases) {
    await withFetch(body, status, async () => {
      await assert.rejects(tokenInfoClaims('token', clientId), (error: DomainError) => error.code === 'GOOGLE_INVALID');
    });
  }
});

test('tokeninfo reports an unverified email instead of vouching for it', async () => {
  let seen: GoogleClaims | undefined;
  await withFetch({ ...valid, email_verified: 'false' }, 200, async () => { seen = await tokenInfoClaims('token', clientId); });
  assert.equal(seen?.verified, false);
  // and the verifier turns that into the same refusal the library path gives
  await assert.rejects(googleVerifier(clientId, stub({ ...seen!, sub: 'g-4', email: 'x@example.test' }))('not-a-jwt'),
    (error: DomainError) => error.code === 'GOOGLE_INVALID');
});


test('tokeninfo refuses a token whose issuer is not Google', async () => {
  await withFetch({ ...valid, iss: 'https://evil.example' }, 200, async () => {
    await assert.rejects(tokenInfoClaims('token', clientId), (error: DomainError) => error.code === 'GOOGLE_INVALID');
  });
});
