import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { database, type Db } from '../src/db.js';
import { migrate } from '../src/migrate.js';
import { decrypt, digest } from '../src/crypto.js';
import { campaign } from '../src/campaign.js';
import { contentHash, type Move } from '../src/rules.js';
import type { Config } from '../src/config.js';

const baseUrl = process.env.TEST_DATABASE_URL;
if (!baseUrl) throw new Error('Set TEST_DATABASE_URL to an isolated PostgreSQL database.');
const schema = `test_${randomUUID().replaceAll('-', '')}`;
const admin = database(baseUrl); const url = new URL(baseUrl); url.searchParams.set('options', `-c search_path=${schema}`);
let db: Db; let app: FastifyInstance; let ip = 1;
const key = '17'.repeat(32);
const config: Config = { databaseUrl: url.toString(), encryptionKey: key, host: '127.0.0.1', port: 0, smtpHost: 'localhost', smtpPort: 1025, smtpSecure: false, mailFrom: 'test@localhost', environment: 'test', trustProxy: false };
const routes = JSON.parse(readFileSync(new URL('../../app/src/test/resources/solutions.json', import.meta.url), 'utf8')) as Move[][];
before(async () => { await admin.query(`CREATE SCHEMA ${schema}`); db = database(config.databaseUrl); await migrate(db); app = await buildApp(db, config, false); await app.ready(); });
after(async () => { await app?.close(); await db?.end(); await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin.end(); });
async function call(method: any, path: string, body?: any, account?: any, status = 200, address?: string) {
  const r = await app.inject({ method, url: path, payload: body, headers: account ? { authorization: `Bearer ${account.accessToken}` } : {}, remoteAddress: address ?? `10.0.${Math.floor(ip / 250)}.${ip++ % 250 + 1}` });
  assert.equal(r.statusCode, status, `${method} ${path}: ${r.body}`); return r.json();
}
const op = () => randomUUID();
async function makeAccount() {
  const email = `${randomUUID()}@example.test`; const invite = randomUUID();
  await db.query('INSERT INTO invitations(hash,remaining) VALUES($1,1)', [digest(invite, key)]);
  await call('POST', '/v1/auth/register', { email, password: 'long-test-password', name: 'Quiet Cove', invite });
  const pending = (await db.query("SELECT o.encrypted_payload FROM email_outbox o JOIN challenges c ON c.id=o.challenge_id JOIN users u ON u.id=c.user_id WHERE u.email=$1 ORDER BY c.created_at DESC LIMIT 1", [email])).rows[0];
  const { code } = decrypt<any>(pending.encrypted_payload, key);
  await call('POST', '/v1/auth/verify/confirm', { email, code });
  const a = await call('POST', '/v1/auth/login', { email, password: 'long-test-password' }); return { ...a, email };
}
function custom(n = 0) {
  const cells = [...'RBGYWPBGYWPBGYWPBGYWPBGYW'];
  for (let i = 1; i < cells.length; i++) cells[i] = 'RBGYWP'[(n * 7 + i * 3 + Math.floor(n / 6) + (i === n % 24 + 1 ? n : 0)) % 6]!;
  cells[0] = 'R'; cells[5] = 'W';
  const start = Array.from({ length: 5 }, (_, r) => cells.slice(r * 5, r * 5 + 5).join(''));
  [cells[0], cells[5]] = [cells[5]!, cells[0]!];
  return { start, target: Array.from({ length: 5 }, (_, r) => cells.slice(r * 5, r * 5 + 5).join('')), path: [[0, 5]] as Move[] };
}
async function draft(account: any, n = 1) { return call('POST', '/v1/grids/drafts', { operationId: op(), name: 'Quiet Cove', ...custom(n) }, account); }
async function world(account: any) { return call('POST', '/v1/worlds', { operationId: op(), name: 'Calm Pool', icon: 'R' }, account); }
async function complete(account: any, levelId: number, operationId = op()) { return call('POST', '/v1/completions', { operationId, kind: 'campaign', levelId, path: routes[levelId - 1] }, account); }

test('two accounts publish, discover, play, earn XP, and expose only public profile fields', async () => {
  const creator = await makeAccount(); const player = await makeAccount(); const w = await world(creator); const d = await draft(creator);
  const publish = { operationId: op(), worldId: w.id };
  const published = await call('POST', `/v1/grids/${d.id}/publish`, publish, creator);
  assert.equal(published.awardedMilli, '25000');
  assert.deepEqual(await call('POST', `/v1/grids/${d.id}/publish`, publish, creator), published);
  const found = await call('GET', '/v1/worlds?query=Calm', undefined, player); assert.equal(found.items[0].id, w.id);
  const session = await call('POST', `/v1/grids/${d.id}/sessions`, { operationId: op() }, player);
  const proof = { operationId: op(), kind: 'community', sessionId: session.sessionId, path: custom(1).path };
  const result = await call('POST', '/v1/completions', proof, player); assert.equal(result.awardedMilli, '100000');
  assert.deepEqual(await call('POST', '/v1/completions', proof, player), result);
  const ownerProfile = await call('GET', `/v1/profiles/${creator.user.id}`, undefined, player);
  assert.equal(ownerProfile.xpMilli, '25001'); assert.equal(ownerProfile.worldCount, 1); assert.equal(ownerProfile.gridCount, 1);
  assert.equal('email' in ownerProfile, false); assert.equal('password_hash' in ownerProfile, false);
  assert.equal((await call('GET', '/v1/worlds', undefined, player)).items[0].popularity, 1);
  await call('POST', `/v1/play-sessions/${session.sessionId}/move`, { operationId: op(), path: custom(1).path }, player);
  assert.equal((await call('GET', `/v1/profiles/${creator.user.id}`, undefined, creator)).xpMilli, '25001');
  const replayed = await call('POST', '/v1/completions', { ...proof, operationId: op() }, player); assert.equal(replayed.awardedMilli, '10000');
  assert.equal((await call('POST', '/v1/completions', { ...proof, operationId: op() }, player)).awardedMilli, '0');
  const ownSession = await call('POST', `/v1/grids/${d.id}/sessions`, { operationId: op() }, creator);
  assert.equal((await call('POST', '/v1/completions', { ...proof, operationId: op(), sessionId: ownSession.sessionId }, creator)).awardedMilli, '0');
  assert.equal((await call('GET', `/v1/profiles/${player.user.id}`, undefined, player)).communityCount, 1);
  await call('PATCH', `/v1/grids/${d.id}`, { operationId: op(), name: 'Soft Tide', hidden: true }, player, 404);
  await call('PATCH', `/v1/grids/${d.id}`, { operationId: op(), name: 'Soft Tide', hidden: true }, creator);
  await call('POST', `/v1/grids/${d.id}/sessions`, { operationId: op() }, player, 404);
  await call('GET', `/v1/grids/code/${d.code}`, undefined, player, 404);
  await call('PATCH', `/v1/grids/${d.id}`, { operationId: op(), name: 'Soft Tide', hidden: false }, creator);
  assert.equal((await call('GET', `/v1/grids/code/${d.code}`, undefined, player)).grid.id, d.id);
});

test('campaign imports grant no XP, completion retries deduplicate, replay caps serialize', async () => {
  const a = await makeAccount();
  await call('POST', '/v1/progress/import', { operationId: op(), done: [1], badges: ['first'] }, a);
  assert.equal((await call('GET', '/v1/progress', undefined, a)).xpMilli, '0');
  const id = op(); const first = await complete(a, 1, id); assert.equal(first.awardedMilli, '100000');
  assert.deepEqual(await complete(a, 1, id), first);
  await call('POST', '/v1/completions', { operationId: id, kind: 'campaign', levelId: 2, path: routes[1] }, a, 409);
  await Promise.all([2, 3, 4, 5, 6].map(n => complete(a, n)));
  const result = await Promise.all([1, 2, 3, 4, 5, 6].map(n => complete(a, n)));
  assert.equal(result.reduce((sum, r) => sum + BigInt(r.awardedMilli), 0n), 50000n);
  await db.query("UPDATE replay_rewards SET day=day-1 WHERE user_id=$1", [a.user.id]);
  await db.query("UPDATE xp_ledger SET source=split_part(source,':',1)||':'||to_char(day-1,'YYYY-MM-DD'),day=day-1 WHERE user_id=$1 AND reason='replay'", [a.user.id]);
  assert.equal((await complete(a, 1)).awardedMilli, '10000');
  const progress = await call('GET', '/v1/progress', undefined, a); assert.equal(progress.done.length, 6); assert.ok(progress.badges.includes('first'));
  await call('POST', '/v1/completions', { operationId: op(), kind: 'campaign', levelId: 1, path: routes[0], debug: true }, a, 400);
});

test('world twentieth-slot race is atomic; hidden grids retain their slots', async () => {
  const a = await makeAccount(); const w = await world(a);
  const drafts = [];
  for (let n = 1; n <= 21; n++) drafts.push(await draft(a, n));
  for (const d of drafts.slice(0, 19)) await call('POST', `/v1/grids/${d.id}/publish`, { operationId: op(), worldId: w.id }, a);
  const responses = await Promise.all(drafts.slice(19).map(d => app.inject({ method: 'POST', url: `/v1/grids/${d.id}/publish`, headers: { authorization: `Bearer ${a.accessToken}` }, payload: { operationId: op(), worldId: w.id } })));
  assert.deepEqual(responses.map(r => r.statusCode).sort(), [200, 409]);
  await call('PATCH', `/v1/grids/${drafts[0].id}`, { operationId: op(), name: 'Quiet Cove', hidden: true }, a);
  const failed = responses.findIndex(r => r.statusCode === 409);
  await call('POST', `/v1/grids/${drafts[19 + failed].id}/publish`, { operationId: op(), worldId: w.id }, a, 409);
  const worlds = await call('GET', '/v1/worlds?mine=true', undefined, a); assert.equal(worlds.items.find((x: any) => x.id === w.id).usedSlots, 20);
  assert.equal((await db.query("SELECT coalesce(sum(amount),0)::text AS xp FROM xp_ledger WHERE user_id=$1 AND reason='create'", [a.user.id])).rows[0].xp, '50000');
});

test('auth verification, wrong-code attempt persistence, refresh recovery, and revocation', async () => {
  const a = await makeAccount();
  const refresh = { refreshToken: a.refreshToken, operationId: op() };
  const rotated = await call('POST', '/v1/auth/refresh', refresh);
  assert.deepEqual(await call('POST', '/v1/auth/refresh', refresh), rotated);
  await call('GET', '/v1/account', undefined, a, 401);
  await call('POST', '/v1/auth/logout', undefined, rotated);
  await call('POST', '/v1/auth/refresh', { refreshToken: rotated.refreshToken, operationId: op() }, undefined, 401);
  await call('POST', '/v1/auth/recover/request', { email: a.email });
  const ch = (await db.query("SELECT c.*,o.encrypted_payload FROM challenges c JOIN email_outbox o ON o.challenge_id=c.id JOIN users u ON u.id=c.user_id WHERE u.email=$1 AND c.purpose='recover' ORDER BY c.created_at DESC LIMIT 1", [a.email])).rows[0];
  for (let i = 0; i < 5; i++) await call('POST', '/v1/auth/recover/confirm', { email: a.email, code: '00000000', password: 'new-test-password' }, undefined, 400);
  assert.equal((await db.query('SELECT attempts FROM challenges WHERE id=$1', [ch.id])).rows[0].attempts, 5);
  const { code } = decrypt<any>(ch.encrypted_payload, key);
  await call('POST', '/v1/auth/recover/confirm', { email: a.email, code, password: 'new-test-password' }, undefined, 400);
  await db.query('UPDATE challenges SET attempts=0 WHERE id=$1', [ch.id]);
  await call('POST', '/v1/auth/recover/confirm', { email: a.email, code, password: 'new-test-password' });
  await call('POST', '/v1/auth/login', { email: a.email, password: 'long-test-password' }, undefined, 401);
  await call('POST', '/v1/auth/login', { email: a.email, password: 'new-test-password' });
});

test('unverified accounts are gated, login is throttled, and OpenAPI is available', async () => {
  const malformed = await app.inject({ method: 'POST', url: '/v1/auth/login', headers: { 'content-type': 'application/json' }, payload: '' });
  assert.equal(malformed.statusCode, 400);
  assert.equal(malformed.json().code, 'INVALID_REQUEST');
  const a = await makeAccount(); await db.query('UPDATE users SET verified=false WHERE id=$1', [a.user.id]);
  await call('GET', '/v1/worlds', undefined, a, 403);
  for (let n = 0; n < 8; n++) await call('POST', '/v1/auth/login', { email: 'unknown@example.test', password: 'bad' }, undefined, 401, '192.0.2.1');
  await call('POST', '/v1/auth/login', { email: 'unknown@example.test', password: 'bad' }, undefined, 429, '192.0.2.1');
  const spec = await call('GET', '/docs/json'); assert.ok(spec.paths['/v1/completions']);
});
