/** Run against a disposable Redis. Never FLUSHDB/FLUSHALL; cleanup is namespace-scoped. */
import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Redis } from 'ioredis';
import { createRateLimits, RedisRateLimitStore, ratePolicies } from '../src/rate-limit.js';
import type { Config } from '../src/config.js';
import { buildApp } from '../src/app.js';

const url = process.env.TEST_REDIS_URL;
if (!url) throw new Error('Set TEST_REDIS_URL to a disposable Redis instance.');
const namespace = `insight:rate:test:${randomUUID()}`;
const config: Config = { databaseUrl: 'unused', encryptionKey: '17'.repeat(32), host: '127.0.0.1', port: 0,
  smtpHost: 'unused', smtpPort: 1025, smtpSecure: false, mailFrom: 'test@example.test',
  environment: 'production', mailDeliveryMode: 'disabled', feedbackDeliveryMode: 'store', trustProxy: false,
  rateLimitRedisUrl: url, rateLimitNamespace: namespace };
const quiet: any = { info() {}, warn() {}, error() {} };
const inspector = new Redis(url, { lazyConnect: true, enableOfflineQueue: false, commandTimeout: 1000, connectTimeout: 1000, maxRetriesPerRequest: 0 });
inspector.on('error', () => {});
let first: RedisRateLimitStore, second: RedisRateLimitStore;
before(async () => {
  await inspector.connect();
  first = new RedisRateLimitStore(url, quiet, namespace); second = new RedisRateLimitStore(url, quiet, namespace);
  await Promise.all([first.connect(), second.connect()]);
});
after(async () => {
  await Promise.all([first?.close(), second?.close()]);
  let cursor = '0';
  do {
    const [next, keys] = await inspector.scan(cursor, 'MATCH', `${namespace}:*`, 'COUNT', 100);
    cursor = next;
    if (keys.length) await inspector.unlink(...keys);
  } while (cursor !== '0');
  inspector.disconnect();
});

test('real Redis coordinates atomic burst admission across independent clients', async () => {
  const policy = { capacity: 120, windowMs: 3_600_000 };
  const decisions = await Promise.all(Array.from({ length: 150 }, (_, i) => (i % 2 ? first : second).consume(`${namespace}:parallel`, policy)));
  assert.equal(decisions.filter(d => d.allowed).length, 120);
  assert.equal(decisions.filter(d => !d.allowed).length, 30);
  assert.ok(decisions.filter(d => !d.allowed).every(d => d.retryAfterSeconds >= 29));
  assert.ok((await inspector.pttl(`${namespace}:parallel`)) > 0);
});
test('closing and recreating an application client preserves exhausted quotas', async () => {
  const temp = new RedisRateLimitStore(url, quiet, namespace); await temp.connect();
  const key = `${namespace}:restart`, policy = { capacity: 1, windowMs: 60_000 };
  assert.equal((await temp.consume(key, policy)).allowed, true);
  await temp.close();
  assert.equal((await second.consume(key, policy)).allowed, false);
});
test('private Unix sockets share the same atomic counters as TCP clients', { skip: !process.env.TEST_REDIS_SOCKET_URL }, async () => {
  const socket = new RedisRateLimitStore(process.env.TEST_REDIS_SOCKET_URL!, quiet, namespace);
  try {
    await socket.connect();
    const key = `${namespace}:socket`, policy = { capacity: 1, windowMs: 60_000 };
    assert.equal((await first.consume(key, policy)).allowed, true);
    assert.equal((await socket.consume(key, policy)).allowed, false);
  } finally { await socket.close(); }
});
test('new identities cannot evict an existing quota in Redis', async () => {
  const key = `${namespace}:retained`, policy = { capacity: 1, windowMs: 60_000 };
  await first.consume(key, policy);
  for (let offset = 0; offset < 5100; offset += 100) {
    await Promise.all(Array.from({ length: 100 }, (_, i) => first.consume(`${namespace}:churn:${offset + i}`, policy)));
  }
  assert.equal((await second.consume(key, policy)).allowed, false);
});
test('denials do not extend the refill deadline or leave immortal keys', async () => {
  const key = `${namespace}:expiry`, policy = { capacity: 1, windowMs: 1000 };
  await first.consume(key, policy);
  const before = await inspector.pttl(key);
  assert.equal((await second.consume(key, policy)).allowed, false);
  assert.ok((await inspector.pttl(key)) <= before + 2);
  await new Promise(resolve => setTimeout(resolve, 1100));
  assert.equal((await first.consume(key, policy)).allowed, true);
});
test('the same account budget survives changes of both API instance and client IP', async () => {
  const a = await createRateLimits(config, quiet), b = await createRateLimits(config, quiet);
  const request = (ip: string) => ({ id: 'test-request', ip, method: 'GET', routeOptions: { url: '/v1/account' }, account: { id: 'verified-test-account' } }) as any;
  try {
    for (let i = 0; i < ratePolicies.read.capacity; i++) await a.account(request('192.0.2.1'));
    await assert.rejects(b.account(request('192.0.2.2')), (e: any) => e.statusCode === 429 && e.policy === 'read');
  } finally { await a.store.close(); await b.store.close(); }
});
test('real HTTP requests share a quota across separate application listeners', async () => {
  const db: any = { query: async () => ({ rows: [], rowCount: 0 }) };
  const httpConfig = { ...config, rateLimitNamespace: `${namespace}:http` };
  const a = await buildApp(db, httpConfig, false), b = await buildApp(db, httpConfig, false);
  try {
    const aUrl = await a.listen({ host: '127.0.0.1', port: 0 });
    const bUrl = await b.listen({ host: '127.0.0.1', port: 0 });
    const rounds = Array.from({ length: 14 }, async (_, i) => {
      const r = await fetch(`${i % 2 ? aUrl : bUrl}/v1/auth/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
      await r.arrayBuffer(); return r.status;
    });
    const initial = await Promise.all(rounds);
    assert.ok(initial.every(status => status === 400));
    for (let i = 14; i < 30; i++) assert.equal((await a.inject({ method: 'POST', url: '/v1/auth/register', payload: {}, remoteAddress: '127.0.0.1' })).statusCode, 400);
    const blocked = await fetch(`${bUrl}/v1/auth/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    assert.equal(blocked.status, 429); const json = await blocked.json() as any;
    assert.equal(json.policy, 'registerIp'); assert.ok(Number(blocked.headers.get('retry-after')) > 0);
  } finally { await a.close(); await b.close(); }
});
