import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { FastifyRequest } from 'fastify';
import { buildApp } from '../src/app.js';
import type { Config } from '../src/config.js';
import { configFromEnv } from '../src/config.js';
import { digest } from '../src/crypto.js';
import { createRateLimits, MemoryRateLimitStore, RateLimitError, RateLimits, ratePolicies, type RateLimitStore } from '../src/rate-limit.js';

const key = '17'.repeat(32);
const config: Config = { databaseUrl: 'unused', encryptionKey: key, host: '127.0.0.1', port: 0,
  smtpHost: 'unused', smtpPort: 1025, smtpSecure: false, mailFrom: 'audit@example.test',
  environment: 'test', mailDeliveryMode: 'disabled', feedbackDeliveryMode: 'store', trustProxy: '127.0.0.1' };
const quiet: any = { info() {}, warn() {}, error() {} };
function databaseStub() {
  let queries = 0;
  const query = async (sql: string, params: unknown[] = []) => {
    queries++;
    if (sql.includes('WHERE access_hash=')) {
      const id = params[0] === digest('a'.repeat(43), key) ? '11111111-1111-4111-8111-111111111111' : '22222222-2222-4222-8222-222222222222';
      return { rows: [{ id, username: 'Audit Player', verified: true, session_id: id }], rowCount: 1 };
    }
    if (sql === 'SELECT 1' || ['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql) || sql.startsWith('SELECT')) return { rows: [], rowCount: 0 };
    throw new Error('Unexpected database write');
  };
  return { db: { query, connect: async () => ({ query, release() {} }) } as any, queries: () => queries };
}
async function fixture(store: RateLimitStore = new MemoryRateLimitStore(() => 0)) {
  const stub = databaseStub();
  const app = await buildApp(stub.db, config, false, async () => ({ sub: 'google-test', email: 'audit@example.test' }), store);
  await app.ready();
  return { ...stub, app };
}

test('token buckets take immutable atomic snapshots under concurrent requests', async () => {
  const store = new MemoryRateLimitStore(() => 0);
  const results = await Promise.all(Array.from({ length: 130 }, () => store.consume('test', ratePolicies.authIp)));
  assert.equal(results.filter(r => r.allowed).length, 120);
  assert.equal(results.filter(r => !r.allowed).length, 10);
  assert.equal(results[0]!.remaining, 119);
  assert.equal(results.at(-1)!.retryAfterSeconds, 8);
});
test('smooth refill and denials never extend a cooldown', async () => {
  let now = 0;
  const store = new MemoryRateLimitStore(() => now);
  const policy = { capacity: 2, windowMs: 10_000 };
  assert.equal((await store.consume('test', policy)).allowed, true);
  assert.equal((await store.consume('test', policy)).allowed, true);
  assert.equal((await store.consume('test', policy)).retryAfterSeconds, 5);
  now = 2000;
  assert.equal((await store.consume('test', policy)).retryAfterSeconds, 3);
  now = 5000;
  assert.equal((await store.consume('test', policy)).allowed, true);
});
test('active quotas are not evicted when the development store fills', async () => {
  let now = 0;
  const store = new MemoryRateLimitStore(() => now, 1);
  const policy = { capacity: 1, windowMs: 1000 };
  await store.consume('first', policy);
  await assert.rejects(store.consume('second', policy), /RATE_STORE_CAPACITY/);
  assert.equal((await store.consume('first', policy)).allowed, false);
  now = 1002;
  assert.equal((await store.consume('second', policy)).allowed, true);
});
test('production cannot silently start with local counters', async () => {
  await assert.rejects(createRateLimits({ ...config, environment: 'production' }, quiet), /RATE_LIMIT_REDIS_URL/);
});
test('production configuration accepts private Redis sockets and rejects invalid endpoints', () => {
  const names = ['NODE_ENV', 'DATABASE_URL', 'ENCRYPTION_KEY', 'RATE_LIMIT_REDIS_URL', 'RATE_LIMIT_NAMESPACE', 'MAIL_DELIVERY_MODE', 'FEEDBACK_DELIVERY_MODE'];
  const original = Object.fromEntries(names.map(name => [name, process.env[name]]));
  try {
    process.env.NODE_ENV = 'production'; process.env.DATABASE_URL = 'unused'; process.env.ENCRYPTION_KEY = key;
    delete process.env.RATE_LIMIT_NAMESPACE; delete process.env.MAIL_DELIVERY_MODE; delete process.env.FEEDBACK_DELIVERY_MODE;
    for (const endpoint of ['redis://127.0.0.1:16389/0', 'rediss://private.example.test/0', 'unix:///run/insight-rate-limit/redis.sock']) {
      process.env.RATE_LIMIT_REDIS_URL = endpoint; assert.equal(configFromEnv().rateLimitRedisUrl, endpoint);
    }
    for (const endpoint of ['', 'https://example.test', 'unix://other-host/socket', 'unix:///', 'unix:///socket?unsafe=1']) {
      process.env.RATE_LIMIT_REDIS_URL = endpoint; assert.throws(() => configFromEnv(), /RATE_LIMIT_REDIS_URL/);
    }
    process.env.NODE_ENV = 'prod'; assert.throws(() => configFromEnv(), /NODE_ENV/);
    process.env.NODE_ENV = 'production'; process.env.RATE_LIMIT_REDIS_URL = 'redis://127.0.0.1:16389/0'; process.env.RATE_LIMIT_NAMESPACE = '';
    assert.equal(configFromEnv().rateLimitNamespace, undefined);
  } finally {
    for (const name of names) { if (original[name] === undefined) delete process.env[name]; else process.env[name] = original[name]; }
  }
});
test('CPU admission is bounded and released after both success and failure', async () => {
  const limits = new RateLimits(new MemoryRateLimitStore(), config, quiet);
  const release: (() => void)[] = [];
  const running = Array.from({ length: 4 }, () => limits.authWork(() => new Promise<void>(resolve => release.push(resolve))));
  await assert.rejects(limits.authWork(async () => {}), (e: any) => e instanceof RateLimitError && e.statusCode === 503 && e.retryAfterSeconds === 2);
  release.forEach(resolve => resolve()); await Promise.all(running);
  await assert.rejects(limits.authWork(async () => { throw new Error('worker failure'); }), /worker failure/);
  assert.equal(await limits.authWork(async () => 'released'), 'released');
});
test('different accounts on one IP have separate quotas; switching IP does not reset an account', async () => {
  const { app } = await fixture();
  try {
    const get = (token: string, ip: string) => app.inject({ method: 'GET', url: '/v1/account', remoteAddress: ip, headers: { authorization: `Bearer ${token.repeat(43)}` } });
    for (let i = 0; i < 180; i++) assert.equal((await get('a', '192.0.2.1')).statusCode, 200);
    const blocked = await get('a', '192.0.2.2');
    assert.equal(blocked.statusCode, 429); assert.equal(blocked.json().policy, 'read');
    assert.equal((await get('b', '192.0.2.1')).statusCode, 200);
    assert.equal(blocked.headers['retry-after'], String(blocked.json().retryAfterSeconds));
    assert.equal(blocked.headers['x-correlation-id'], blocked.json().correlationId);
  } finally { await app.close(); }
});
test('ingress still applies to sensitive routes and health has an independent budget', async () => {
  const { app } = await fixture();
  try {
    for (let i = 0; i < 600; i++) assert.equal((await app.inject({ method: 'GET', url: '/v1/capabilities', remoteAddress: '192.0.2.3' })).statusCode, 200);
    const blocked = await app.inject({ method: 'POST', url: '/v1/auth/login', payload: {}, remoteAddress: '192.0.2.3' });
    assert.equal(blocked.statusCode, 429); assert.equal(blocked.json().policy, 'ingress');
    assert.equal((await app.inject({ method: 'GET', url: '/health', remoteAddress: '192.0.2.3' })).statusCode, 200);
  } finally { await app.close(); }
});
test('unknown URL changes cannot evade a shared not-found budget', async () => {
  const { app } = await fixture();
  try {
    for (let i = 0; i < 30; i++) assert.equal((await app.inject({ method: 'GET', url: `/unknown/${i}`, remoteAddress: '192.0.2.4' })).statusCode, 404);
    const r = await app.inject({ method: 'GET', url: '/another-unknown', remoteAddress: '192.0.2.4' });
    assert.equal(r.statusCode, 429); assert.equal(r.json().policy, 'notFound');
  } finally { await app.close(); }
});
test('malformed auth is capped before validation, shared across auth routes', async () => {
  const { app, queries } = await fixture();
  try {
    for (let i = 0; i < 120; i++) assert.equal((await app.inject({ method: 'POST', url: '/v1/auth/login', payload: {}, remoteAddress: '192.0.2.5' })).statusCode, 400);
    const r = await app.inject({ method: 'POST', url: '/v1/auth/google', payload: {}, remoteAddress: '192.0.2.5' });
    assert.equal(r.statusCode, 429); assert.equal(r.json().policy, 'authIp'); assert.equal(queries(), 0);
  } finally { await app.close(); }
});
test('trusted forwarding, untrusted spoofing, IPv6 /64 and mapped IPv4 use canonical identities', async () => {
  const { app } = await fixture();
  try {
    const get = (ip: string, forwarded?: string) => app.inject({ method: 'GET', url: '/v1/capabilities', remoteAddress: ip, headers: forwarded ? { 'x-forwarded-for': forwarded } : {} });
    for (let i = 0; i < 600; i++) assert.equal((await get('192.0.2.6')).statusCode, 200);
    assert.equal((await get('192.0.2.6', '192.0.2.7')).statusCode, 429);
    assert.equal((await get('::ffff:192.0.2.6')).statusCode, 429);
    assert.equal((await get('127.0.0.1', '192.0.2.7')).statusCode, 200);
    for (let i = 0; i < 600; i++) assert.equal((await get('2001:db8:1::1')).statusCode, 200);
    assert.equal((await get('2001:db8:1::2')).statusCode, 429);
    assert.equal((await get('2001:db8:2::1')).statusCode, 200);
  } finally { await app.close(); }
});
test('store failures fail closed with a retryable sanitized 503, including readiness', async () => {
  const failing: RateLimitStore = { consume: async () => { throw new Error('secret-in-an-upstream-error'); }, health: async () => { throw new Error('secret'); }, close: async () => {} };
  const { app, queries } = await fixture(failing);
  try {
    for (const url of ['/v1/capabilities', '/health']) {
      const r = await app.inject({ method: 'GET', url });
      assert.equal(r.statusCode, 503); assert.equal(r.headers['retry-after'], '3');
      assert.equal(r.json().code, 'RATE_LIMIT_UNAVAILABLE'); assert.ok(!r.body.includes('secret'));
    }
    assert.equal(queries(), 0);
  } finally { await app.close(); }
});
test('identity quotas span IPs, normalize addresses, and never send raw identities to storage', async () => {
  const keys: string[] = [];
  const store = new MemoryRateLimitStore(() => 0);
  const capture: RateLimitStore = { consume: (key, policy) => { keys.push(key); return store.consume(key, policy); }, health: async () => {}, close: async () => {} };
  const limits = new RateLimits(capture, config, quiet);
  const req = (ip: string, email: string) => ({ id: 'audit', ip, method: 'POST', routeOptions: { url: '/v1/auth/recover/request' }, body: { email } }) as FastifyRequest;
  for (let i = 0; i < 3; i++) await limits.sensitive(req(`192.0.2.${i}`, i % 2 ? ' Person@Example.test ' : 'person@example.test'));
  await assert.rejects(limits.sensitive(req('192.0.2.99', 'person@example.test')), (e: any) => e.policy === 'recoveryAddress');
  assert.ok(keys.every(key => /^insight:rate:v1:[A-Za-z]+:[0-9a-f]{64}$/.test(key)));
  assert.ok(keys.every(key => !key.includes('person') && !key.includes('192.0.2')));
});
