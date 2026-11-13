import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../server/src/app.js';
import type { Config } from '../../server/src/config.js';
import { database, transaction, type Db } from '../../server/src/db.js';
import { migrate } from '../../server/src/migrate.js';
import { MemoryRateLimitStore } from '../../server/src/rate-store.js';
import { buildAdminApp } from '../src/app.js';
import { deliverDirectMail } from '../src/direct-mail.js';
import { hashPassword } from '../src/auth.js';

const baseUrl = process.env.TEST_DATABASE_URL;
if (!baseUrl) throw new Error('Set TEST_DATABASE_URL to an isolated PostgreSQL database.');
const schema = `test_${randomUUID().replaceAll('-', '')}`;
const root = database(baseUrl); const url = new URL(baseUrl); url.searchParams.set('options', `-c search_path=${schema}`);
const key = '17'.repeat(32);
const config: Config = { databaseUrl: url.toString(), encryptionKey: key, host: '127.0.0.1', port: 0, smtpHost: 'localhost', smtpPort: 1025, smtpSecure: false,
  mailFrom: 'Midori <test@localhost>', environment: 'test', trustProxy: false, createDailyLimit: 30 };
const sent: any[] = [];
const transport = { sendMail: async (m: any) => { sent.push(m); return { accepted: [m.to], rejected: [] }; } };
let db: Db; let player: FastifyInstance; let admin: FastifyInstance; let ip = 1; let cookie = ''; let csrf = ''; let adminId = '';
const PASSWORD = 'correct horse battery staple';
const op = () => randomUUID();
const nextIp = () => `10.1.${Math.floor(ip / 250)}.${ip++ % 250 + 1}`;

before(async () => {
  await root.query(`CREATE SCHEMA ${schema}`); db = database(config.databaseUrl); await migrate(db);
  player = await buildApp(db, config, false); await player.ready();
  admin = await buildAdminApp(db, config, false, new MemoryRateLimitStore(), transport); await admin.ready();
  adminId = randomUUID();
  await db.query('INSERT INTO admins(id,email,password_hash) VALUES($1,$2,$3)', [adminId, 'boss@example.test', await hashPassword(PASSWORD)]);
  const r = await admin.inject({ method: 'POST', url: '/api/login', payload: { email: 'Boss@Example.test', password: PASSWORD }, remoteAddress: nextIp() });
  assert.equal(r.statusCode, 200, r.body);
  cookie = String(r.headers['set-cookie']).split(';')[0]!; csrf = r.json().csrf;
});
after(async () => { await admin?.close(); await player?.close(); await db?.end(); await root.query(`DROP SCHEMA ${schema} CASCADE`); await root.end(); });

async function a(method: any, path: string, body?: any, status = 200) {
  const r = await admin.inject({ method, url: path, payload: body, headers: { cookie, ...(method === 'GET' ? {} : { 'x-admin-csrf': csrf }) }, remoteAddress: nextIp() });
  assert.equal(r.statusCode, status, `${method} ${path}: ${r.body}`); return r.json();
}
async function p(method: any, path: string, body?: any, who?: any, status = 200) {
  const r = await player.inject({ method, url: path, payload: body, headers: who ? { authorization: `Bearer ${who.accessToken}` } : {}, remoteAddress: nextIp() });
  assert.equal(r.statusCode, status, `${method} ${path}: ${r.body}`); return r.json();
}
async function makePlayer() {
  const email = `${randomUUID()}@example.test`;
  const s = await p('POST', '/v1/auth/register', { email, password: 'long-test-password', name: `Player_${op().slice(0, 12)}` });
  return { ...s, email, id: s.user.id as string, name: s.user.username as string };
}
const login = (email: string, status = 200) => p('POST', '/v1/auth/login', { email, password: 'long-test-password' }, undefined, status);
const cell = (n: number) => {
  const cells = [...'RBGYWPBGYWPBGYWPBGYWPBGYW'];
  for (let i = 1; i < cells.length; i++) cells[i] = 'RBGYWP'[(n * 7 + i * 3 + Math.floor(n / 6) + (i === n % 24 + 1 ? n : 0)) % 6]!;
  cells[0] = 'R'; cells[5] = 'W';
  const start = Array.from({ length: 5 }, (_, r) => cells.slice(r * 5, r * 5 + 5).join(''));
  [cells[0], cells[5]] = [cells[5]!, cells[0]!];
  return { start, target: Array.from({ length: 5 }, (_, r) => cells.slice(r * 5, r * 5 + 5).join('')), path: [[0, 5]] };
};
const audits = async (id: string) => (await db.query('SELECT action,reason,detail,admin_id FROM admin_audit WHERE subject_user_id=$1 ORDER BY id', [id])).rows;

test('login: generic failures, throttling, cookie + CSRF required, logout revokes', async () => {
  const bad = await admin.inject({ method: 'POST', url: '/api/login', payload: { email: 'boss@example.test', password: 'nope-nope-nope-nope' }, remoteAddress: nextIp() });
  const none = await admin.inject({ method: 'POST', url: '/api/login', payload: { email: 'nobody@example.test', password: 'nope-nope-nope-nope' }, remoteAddress: nextIp() });
  assert.equal(bad.statusCode, 401); assert.equal(none.statusCode, 401); assert.deepEqual(bad.json().message, none.json().message);
  assert.equal((await admin.inject({ method: 'GET', url: '/api/users', remoteAddress: nextIp() })).statusCode, 401);
  assert.equal((await admin.inject({ method: 'GET', url: '/api/users', headers: { cookie: 'cp=' + 'x'.repeat(43) }, remoteAddress: nextIp() })).statusCode, 401);
  // A valid session without the CSRF header cannot change anything.
  const target = await makePlayer();
  const noCsrf = await admin.inject({ method: 'POST', url: `/api/users/${target.id}/suspend`, headers: { cookie }, payload: { operationId: op(), reason: 'testing csrf' }, remoteAddress: nextIp() });
  assert.equal(noCsrf.statusCode, 403); assert.equal((await db.query('SELECT suspended FROM users WHERE id=$1', [target.id])).rows[0].suspended, false);
  // Guessing from one address runs out of budget (8 per email and address)...
  const hammer = (email: string, remoteAddress: string) => admin.inject({ method: 'POST', url: '/api/login', payload: { email, password: 'wrong-wrong-wrong' }, remoteAddress });
  let last = 0; for (let i = 0; i < 12; i++) last = (await hammer('boss@example.test', '10.9.9.9')).statusCode;
  assert.equal(last, 429);
  // ...but a stranger who knows an admin's email cannot lock that admin out from other addresses, and IPv6 counts per /64.
  for (let i = 0; i < 12; i++) assert.equal((await hammer('boss@example.test', nextIp())).statusCode, 401);
  let v6 = 0; for (let i = 0; i < 25; i++) v6 = (await hammer('nobody@example.test', `2001:db8:1:2:${i.toString(16)}::1`)).statusCode;
  assert.equal(v6, 429);
  // Logout revokes the session server-side, not just the cookie.
  const r = await admin.inject({ method: 'POST', url: '/api/login', payload: { email: 'boss@example.test', password: PASSWORD }, remoteAddress: nextIp() });
  const c2 = String(r.headers['set-cookie']).split(';')[0]!; const t2 = r.json().csrf;
  assert.equal((await admin.inject({ method: 'POST', url: '/api/logout', headers: { cookie: c2, 'x-admin-csrf': t2 }, remoteAddress: nextIp() })).statusCode, 200);
  assert.equal((await admin.inject({ method: 'GET', url: '/api/me', headers: { cookie: c2 }, remoteAddress: nextIp() })).statusCode, 401);
});

test('suspend / unsuspend block and restore the player; sessions are revoked; every action is audited', async () => {
  const u = await makePlayer();
  const body = { operationId: op(), reason: 'abusive username in chat' };
  await a('POST', `/api/users/${u.id}/suspend`, body);
  await p('GET', '/v1/account', undefined, u, 401); await login(u.email, 401);
  await a('POST', `/api/users/${u.id}/suspend`, { operationId: op(), reason: 'again' }, 409);
  await a('POST', `/api/users/${u.id}/unsuspend`, { operationId: op(), reason: 'appeal accepted' });
  await login(u.email);
  assert.deepEqual((await audits(u.id)).map(r => r.action), ['user.suspend', 'user.unsuspend']);
  assert.equal((await audits(u.id))[0]!.admin_id, adminId);
  assert.equal((await a('GET', `/api/users/${u.id}`)).status, 'active');
});

test('a retried operation runs once; the same ID with different input is refused', async () => {
  const u = await makePlayer(); const body = { operationId: op(), reason: 'spam links' };
  const first = await a('POST', `/api/users/${u.id}/suspend`, body);
  assert.deepEqual(await a('POST', `/api/users/${u.id}/suspend`, body), first);
  assert.equal((await audits(u.id)).length, 1);
  await a('POST', `/api/users/${u.id}/suspend`, { ...body, reason: 'a different reason' }, 409);
});

test('soft delete hides and blocks the player; restore brings it back; unsuspend cannot undo a delete', async () => {
  const u = await makePlayer(); const viewer = await makePlayer();
  await p('POST', '/v1/grids', { operationId: op(), ...cell(901) }, u);
  assert.equal((await p('GET', `/v1/profiles/${u.id}`, undefined, viewer)).id, u.id);
  await a('POST', `/api/users/${u.id}/soft-delete`, { operationId: op(), reason: 'player asked to leave' });
  const d = await a('GET', `/api/users/${u.id}`);
  assert.equal(d.status, 'deleted'); assert.equal(d.deleted_by, 'admin');
  await login(u.email, 401); await p('GET', '/v1/account', undefined, u, 401);
  await p('GET', `/v1/profiles/${u.id}`, undefined, viewer, 404);
  assert.equal((await p('GET', `/v1/grids?owner=${u.id}`, undefined, viewer)).items.length, 0);
  await a('POST', `/api/users/${u.id}/unsuspend`, { operationId: op(), reason: 'nope' }, 409);
  await a('POST', `/api/users/${u.id}/suspend`, { operationId: op(), reason: 'nope' }, 409);
  await a('POST', `/api/users/${u.id}/soft-delete`, { operationId: op(), reason: 'twice' }, 409);
  await a('POST', `/api/users/${u.id}/restore`, { operationId: op(), reason: 'player asked to return' });
  await login(u.email);
  assert.equal((await p('GET', `/v1/profiles/${u.id}`, undefined, viewer)).id, u.id);
  assert.equal((await p('GET', `/v1/grids?owner=${u.id}`, undefined, viewer)).items.length, 1);
});

test('restoring an account that was suspended before deletion leaves it suspended', async () => {
  const u = await makePlayer();
  await a('POST', `/api/users/${u.id}/suspend`, { operationId: op(), reason: 'harassment' });
  await a('POST', `/api/users/${u.id}/soft-delete`, { operationId: op(), reason: 'asked to delete' });
  await a('POST', `/api/users/${u.id}/restore`, { operationId: op(), reason: 'asked to return' });
  assert.equal((await a('GET', `/api/users/${u.id}`)).status, 'suspended');
  await login(u.email, 401);
});

test('hard delete: step-up is enforced, the player and their levels vanish, solvers keep their credit', async () => {
  const creator = await makePlayer(); const solver = await makePlayer(); const fan = await makePlayer();
  const level = await p('POST', '/v1/grids', { operationId: op(), ...cell(911) }, creator);
  const own = await p('POST', '/v1/grids', { operationId: op(), ...cell(912) }, solver); // the solver's own level must survive
  const s = await p('POST', `/v1/grids/${level.id}/sessions`, { operationId: op() }, solver);
  await p('POST', '/v1/completions', { operationId: op(), kind: 'community', sessionId: s.sessionId, attemptId: op(), path: cell(911).path }, solver);
  await db.query('INSERT INTO grid_likes(user_id,grid_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [fan.id, level.id]);
  await db.query('INSERT INTO grid_bookmarks(user_id,grid_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [fan.id, level.id]);
  await db.query('INSERT INTO follows(follower_id,followee_id) VALUES($1,$2),($2,$1) ON CONFLICT DO NOTHING', [fan.id, creator.id]);
  const feedbackId = randomUUID();
  await db.query("INSERT INTO feedback(id,kind,body,user_id) VALUES($1,'feedback','hi',$2)", [feedbackId, creator.id]);
  const before = await p('GET', '/v1/progress', undefined, solver);
  assert.equal(before.onlineSolved, 1); assert.equal(before.communityCount, 1); assert.ok(before.badges.includes('online-1'));
  const claimHash = (await db.query('SELECT content_hash FROM grids WHERE id=$1', [level.id])).rows[0].content_hash;

  const base = { operationId: op(), reason: 'player demanded deletion under privacy request', confirmUsername: creator.name, password: PASSWORD };
  await a('POST', `/api/users/${creator.id}/hard-delete`, { ...base, password: 'wrong password entirely' }, 403);
  await a('POST', `/api/users/${creator.id}/hard-delete`, { ...base, confirmUsername: 'someone else' }, 403);
  assert.equal((await db.query('SELECT 1 FROM users WHERE id=$1', [creator.id])).rowCount, 1);
  const done = await a('POST', `/api/users/${creator.id}/hard-delete`, base);
  assert.equal(done.levelsDeleted, 1); assert.equal(done.completionsRetained, 1);

  assert.equal((await db.query('SELECT 1 FROM users WHERE id=$1', [creator.id])).rowCount, 0);
  assert.equal((await db.query('SELECT 1 FROM grids WHERE id=$1', [level.id])).rowCount, 0);
  assert.equal((await db.query('SELECT 1 FROM grids WHERE id=$1', [own.id])).rowCount, 1);
  for (const t of ['grid_likes', 'grid_bookmarks', 'grid_completions', 'play_sessions', 'qualifying_plays'])
    assert.equal((await db.query(`SELECT 1 FROM ${t} WHERE grid_id=$1`, [level.id])).rowCount, 0, t);
  assert.equal((await db.query('SELECT 1 FROM follows WHERE follower_id=$1 OR followee_id=$1', [creator.id])).rowCount, 0);
  assert.equal((await db.query('SELECT 1 FROM feedback WHERE id=$1', [feedbackId])).rowCount, 0); // free text goes with the player
  assert.equal((await db.query('SELECT creator_id FROM content_claims WHERE content_hash=$1', [claimHash])).rows[0].creator_id, null);
  await login(creator.email, 401);
  // The point of the retention rule: the solver's figures and badge are exactly what they were.
  const after = await p('GET', '/v1/progress', undefined, solver);
  assert.equal(after.onlineSolved, 1); assert.equal(after.communityCount, 1); assert.ok(after.badges.includes('online-1'));
  assert.equal((await p('GET', `/v1/profiles/${solver.id}`, undefined, fan)).communityCount, 1);
  // ...and the audit trail outlives the account.
  const trail = await audits(creator.id); assert.equal(trail.at(-1)!.action, 'user.hard_delete');
  assert.deepEqual(trail.at(-1)!.detail, { levelsDeleted: 1, completionsRetainedForOthers: 1 });
  await a('GET', `/api/users/${creator.id}`, undefined, 404);
});

test('send-recovery queues the same 8-digit code the app flow uses, once a minute, and refuses blocked accounts', async () => {
  const u = await makePlayer(); sent.length = 0;
  await a('POST', `/api/users/${u.id}/send-recovery`, { operationId: op() }, 400); // the admin password is required
  await a('POST', `/api/users/${u.id}/send-recovery`, { operationId: op(), password: 'not the password at all' }, 403);
  assert.ok((await audits(u.id)).some(r => r.action === 'admin.stepup_failed'));
  assert.equal(sent.length, 0);
  assert.equal((await a('POST', `/api/users/${u.id}/send-recovery`, { operationId: op(), password: PASSWORD })).queued, true);
  assert.equal(sent.length, 1); assert.equal(sent[0].to, u.email);
  const code = String(sent[0].text).match(/\b(\d{8})\b/)![1];
  await a('POST', `/api/users/${u.id}/send-recovery`, { operationId: op(), password: PASSWORD }, 429); // within a minute: told so, not "sent"
  const reset = await p('POST', '/v1/auth/recover/confirm', { email: u.email, code, password: 'a-brand-new-password' });
  assert.ok(reset.accessToken);
  await a('POST', `/api/users/${u.id}/suspend`, { operationId: op(), reason: 'testing blocked reset' });
  await a('POST', `/api/users/${u.id}/send-recovery`, { operationId: op(), password: PASSWORD }, 409);
  assert.ok((await audits(u.id)).some(r => r.action === 'user.send_recovery'));
});

test('email edits, renames and entitlements are validated, unique and audited', async () => {
  const u = await makePlayer(); const other = await makePlayer();
  await a('POST', `/api/users/${u.id}/rename`, { operationId: op(), name: other.name, reason: 'support request' }, 409);
  await a('POST', `/api/users/${u.id}/rename`, { operationId: op(), name: 'x', reason: 'support request' }, 400);
  const renamed = await a('POST', `/api/users/${u.id}/rename`, { operationId: op(), name: 'Calm_Harbor', reason: 'support request' });
  assert.equal(renamed.username, 'Calm_Harbor');
  await a('POST', `/api/users/${u.id}/rename`, { operationId: op(), name: 'Quiet_Cove', reason: '   ' }, 400); // a blank reason is not a reason
  await a('POST', `/api/users/${u.id}/email`, { operationId: op(), email: `New.${u.email}`, reason: 'typo fixed', password: 'wrong wrong wrong' }, 403);
  await a('POST', `/api/users/${u.id}/email`, { operationId: op(), email: other.email.toUpperCase(), reason: 'typo', password: PASSWORD }, 409);
  const session = await login(u.email);
  await a('POST', `/api/users/${u.id}/email`, { operationId: op(), email: `New.${u.email}`, reason: 'typo fixed', password: PASSWORD });
  await p('GET', '/v1/progress', undefined, session, 401); // changing the address signs the player out
  assert.equal((await db.query('SELECT email FROM users WHERE id=$1', [u.id])).rows[0].email, `new.${u.email}`);
  await a('POST', `/api/users/${u.id}/entitlement`, { operationId: op(), status: 'active', note: 'goodwill grant after outage' });
  await a('POST', `/api/users/${u.id}/entitlement`, { operationId: op(), status: 'revoked', note: 'chargeback' });
  const d = await a('GET', `/api/users/${u.id}`);
  assert.equal(d.entitlements[0].status, 'revoked'); assert.equal(d.entitlements[0].source, 'manual');
  assert.equal((await db.query('SELECT count(*)::int AS n FROM entitlement_events WHERE user_id=$1', [u.id])).rows[0].n, 2);
  const emailAudit = (await audits(u.id)).find(r => r.action === 'user.change_email')!;
  assert.deepEqual(emailAudit.detail, { field: 'email' }); // never the address itself
  assert.equal((await a('GET', `/api/users?q=${encodeURIComponent('Calm_Harbor')}`)).total, 1);
  assert.equal((await a('GET', `/api/users?q=${u.id}`)).users[0].worlds, 'revoked');
});

test('direct email is sent to the stored address and its body is erased once accepted; in-game messages are stored', async () => {
  const u = await makePlayer(); sent.length = 0;
  const r = await a('POST', `/api/users/${u.id}/send-email`, { operationId: op(), subject: 'About your report', body: 'Thanks, we fixed it.' });
  assert.equal(sent.length, 1); assert.equal(sent[0].to, u.email); assert.equal(sent[0].subject, 'About your report');
  const row = (await db.query('SELECT status,body FROM direct_mail WHERE id=$1', [r.mailId])).rows[0];
  assert.deepEqual(row, { status: 'accepted', body: '' });
  const m = await a('POST', `/api/users/${u.id}/send-message`, { operationId: op(), subject: 'Welcome', body: 'Hello from the team' });
  assert.equal((await db.query('SELECT subject,read_at FROM user_messages WHERE id=$1', [m.messageId])).rows[0].read_at, null);
  assert.equal((await a('GET', `/api/users/${u.id}`)).stats.unreadMessages, 1);
  const log = await a('GET', `/api/audit?subject=${u.id}`);
  assert.deepEqual(log.map((x: any) => x.action).sort(), ['user.send_email', 'user.send_message']);
  assert.ok(!JSON.stringify(log).includes('Thanks, we fixed it'), 'bodies never enter the audit trail');
});

test('an admin action waits for in-flight player work on the same account instead of racing it', async () => {
  const u = await makePlayer();
  let done = false; let pending: Promise<unknown> = Promise.resolve();
  await transaction(db, async c => {
    await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [u.id]); // what every player write holds
    pending = a('POST', `/api/users/${u.id}/suspend`, { operationId: op(), reason: 'racing a player write' }).then(() => { done = true; });
    await new Promise(r => setTimeout(r, 400));
    assert.equal(done, false);
  });
  await pending; assert.equal(done, true);
});

test('an email that gives up after three failures loses its text and leaves an audit row', async () => {
  const u = await makePlayer(); const mail = { mailId: randomUUID() };
  await db.query("INSERT INTO direct_mail(id,user_id,subject,body,created_by) VALUES($1,$2,'Hello there','private words',$3)", [mail.mailId, u.id, adminId]);
  const failing = { sendMail: async () => { throw new Error('smtp down'); } }; const log = { info() {}, warn() {} } as any;
  for (let i = 0; i < 3; i++) { await db.query("UPDATE direct_mail SET next_attempt=now() WHERE id=$1", [mail.mailId]); await deliverDirectMail(db, config, log, failing); }
  const row = (await db.query('SELECT status,body FROM direct_mail WHERE id=$1', [mail.mailId])).rows[0];
  assert.equal(row.status, 'failed'); assert.equal(row.body, '');
  assert.ok((await audits(u.id)).some(r => r.action === 'user.email_failed'));
});
