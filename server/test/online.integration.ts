import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { database, type Db } from '../src/db.js';
import { migrate } from '../src/migrate.js';
import { campaign } from '../src/campaign.js';
import { contentHash, replay, type Move, type Puzzle } from '../src/rules.js';
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
  const email = `${randomUUID()}@example.test`;
  const a = await call('POST', '/v1/auth/register', { email, password: 'long-test-password', name: `Player ${op().slice(0, 12)}` });
  assert.equal(a.user.verified, true);
  return { ...a, email };
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
  assert.equal((await call('GET', `/v1/worlds/${w.id}/grids`, undefined, player)).items[0].completed, false);
  const proof = { operationId: op(), kind: 'community', sessionId: session.sessionId, path: custom(1).path };
  const result = await call('POST', '/v1/completions', proof, player); assert.equal(result.awardedMilli, '100000');
  assert.deepEqual(await call('POST', '/v1/completions', proof, player), result);
  assert.equal((await call('GET', `/v1/worlds/${w.id}/grids`, undefined, player)).items[0].completed, true);
  assert.equal((await call('GET', `/v1/worlds/${w.id}/grids`, undefined, creator)).items[0].completed, false);
  const playerProgress = await call('GET', '/v1/progress', undefined, player);
  assert.deepEqual(playerProgress.communityDone, [d.id]); assert.deepEqual(playerProgress.done, []);
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

test('password-only registration, refresh recovery, and revocation', async () => {
  const a = await makeAccount();
  const refresh = { refreshToken: a.refreshToken, operationId: op() };
  const rotated = await call('POST', '/v1/auth/refresh', refresh);
  assert.deepEqual(await call('POST', '/v1/auth/refresh', refresh), rotated);
  await call('GET', '/v1/account', undefined, a, 401);
  await call('POST', '/v1/auth/logout', undefined, rotated);
  await call('POST', '/v1/auth/refresh', { refreshToken: rotated.refreshToken, operationId: op() }, undefined, 401);
  for (const route of ['verify/request', 'verify/confirm', 'recover/request', 'recover/confirm']) {
    await call('POST', '/v1/auth/' + route, { email: a.email }, undefined, 404);
  }
  assert.equal((await db.query('SELECT count(*)::int AS n FROM challenges')).rows[0].n, 0);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM email_outbox')).rows[0].n, 0);
  const duplicate = await call('POST', '/v1/auth/register', { email: a.email.toUpperCase(), password: 'different-password', name: 'Duplicate email' }, undefined, 409);
  assert.equal(duplicate.code, 'EMAIL_TAKEN');
  const wrong = await call('POST', '/v1/auth/login', { email: a.email, password: 'incorrect password' }, undefined, 401);
  assert.equal(wrong.message, 'Email or password is incorrect.');
  await call('POST', '/v1/auth/login', { email: a.email, password: 'long-test-password' });
});

test('email verification is not required, login is throttled, and OpenAPI is available', async () => {
  const malformed = await app.inject({ method: 'POST', url: '/v1/auth/login', headers: { 'content-type': 'application/json' }, payload: '' });
  assert.equal(malformed.statusCode, 400);
  assert.equal(malformed.json().code, 'INVALID_REQUEST');
  const a = await makeAccount(); await db.query('UPDATE users SET verified=false WHERE id=$1', [a.user.id]);
  await call('GET', '/v1/worlds', undefined, a);
  for (let n = 0; n < 8; n++) await call('POST', '/v1/auth/login', { email: 'unknown@example.test', password: 'bad' }, undefined, 401, '192.0.2.1');
  await call('POST', '/v1/auth/login', { email: 'unknown@example.test', password: 'bad' }, undefined, 429, '192.0.2.1');
  const spec = await call('GET', '/docs/json'); assert.ok(spec.paths['/v1/completions']);
});

test('open registration, Unicode unique nicknames, concurrent claims and idempotent profile rename', async () => {
  const email = `${op()}@example.test`;
  await call('POST', '/v1/auth/register', { email, password: 'long-test-password', name: '  My\u3000Nickname  ' });
  const registered = await call('POST', '/v1/auth/login', { email, password: 'long-test-password' });
  assert.equal(registered.user.username, 'My Nickname');
  const conflict = await call('POST', '/v1/auth/register', { email: `${op()}@example.test`, password: 'long-test-password', name: 'ｍｙ nickname' }, undefined, 409);
  assert.equal(conflict.code, 'NAME_TAKEN');
  const name = `Race ${op().slice(0, 12)}`;
  const race = await Promise.all([name, name.toUpperCase()].map((name, n) => app.inject({ method: 'POST', url: '/v1/auth/register', remoteAddress: `192.0.2.${20+n}`, payload: { email: `${op()}@example.test`, password: 'long-test-password', name } })));
  assert.deepEqual(race.map(r => r.statusCode).sort(), [200,409]);
  const a = await makeAccount(); const b = await makeAccount();
  const change = { operationId: op(), name: 'پازل\u200cباز 🎮' };
  await call('PATCH', '/v1/account/name', change, a);
  await call('PATCH', '/v1/account/name', change, a);
  assert.equal((await call('GET', '/v1/account', undefined, a)).user.username, change.name);
  assert.equal((await call('GET', `/v1/profiles/${a.user.id}`, undefined, b)).username, change.name);
  await call('PATCH', '/v1/account/name', { ...change, operationId: op() }, b, 409);
  await call('PATCH', '/v1/account/name', { operationId: op(), name: 'bad\u202ename' }, a, 400);
  await call('POST', '/v1/auth/register', { email: `${op()}@example.test`, password: 'long-test-password', name: 'Another player' });
});

function unfinished(p: Puzzle): Move[] {
  const length = p.start.length * p.start[0]!.length;
  for (let a = 0; a < length; a++) for (let b = 0; b < length; b++) {
    try { if (replay(p, [[a,b]], false).join('') !== p.target.join('')) return [[a,b]]; } catch { /* Try another legal move. */ }
  }
  throw new Error('Fixture needs an unfinished legal move');
}
async function publishIn(account: any, w: any, n = 40) {
  const d = await draft(account, n);
  await call('POST', `/v1/grids/${d.id}/publish`, { operationId: op(), worldId: w.id }, account);
  return d;
}

test('creator discovery aggregates profiles, ranks all modes and respects visibility and literal search', async () => {
  const a = await makeAccount(); const b = await makeAccount(); const viewer = await makeAccount();
  const tag = `Rank ${op().slice(0,8)}`;
  await call('PATCH', '/v1/account/name', {operationId:op(), name:`${tag} A%_\\`}, a);
  await call('PATCH', '/v1/account/name', {operationId:op(), name:`${tag} B`}, b);
  const wa = await world(a); const wb = await world(b);
  await publishIn(a,wa,41); await publishIn(b,wb,42); await publishIn(b,wb,43);
  await complete(a,1); await complete(a,2); await complete(b,3);
  // Completing campaign-identical community content must not inflate the profile's solved count.
  const same = await call('POST','/v1/grids/drafts',{operationId:op(),name:'Quiet Cove',start:campaign[0]!.start,target:campaign[0]!.target,path:routes[0]},b);
  await call('POST',`/v1/grids/${same.id}/publish`,{operationId:op(),worldId:wb.id},b);
  const play = await call('POST',`/v1/grids/${same.id}/sessions`,{operationId:op()},a);
  await call('POST','/v1/completions',{operationId:op(),kind:'community',sessionId:play.sessionId,path:routes[0]},a);
  const root = `/v1/creators?query=${encodeURIComponent(tag)}`;
  for (const [sort, expected] of [['level',a.user.id],['designed',b.user.id],['played',a.user.id]]) {
    const result = await call('GET',`${root}&sort=${sort}`,undefined,viewer);
    assert.equal(result.items[0].id,expected);
    for (const row of result.items) {
      const profile = await call('GET',`/v1/profiles/${row.id}`,undefined,viewer);
      for (const key of ['level','xpMilli','gridCount','worldCount','beatenCount']) assert.equal(row[key],profile[key],key);
      assert.equal('email' in row,false); assert.equal('password_hash' in row,false);
    }
  }
  for (const literal of ['%','_','\\']) {
    const result = await call('GET',`/v1/creators?query=${encodeURIComponent(`${tag} A${literal === '%' ? '%' : literal === '_' ? '%_' : '%_\\'}`)}`,undefined,viewer);
    assert.deepEqual(result.items.map((r:any)=>r.id),[a.user.id]);
  }
  await call('GET',`${root}&sort=unsupported`,undefined,viewer,400);
  await db.query('UPDATE worlds SET hidden=true WHERE id=$1',[wb.id]);
  assert.deepEqual((await call('GET',root,undefined,viewer)).items.map((r:any)=>r.id),[a.user.id]);
  await db.query('UPDATE worlds SET hidden=false,moderated=true WHERE id=$1',[wb.id]);
  assert.deepEqual((await call('GET',root,undefined,viewer)).items.map((r:any)=>r.id),[a.user.id]);
  await db.query('UPDATE worlds SET moderated=false WHERE id=$1',[wb.id]);
  await db.query('UPDATE users SET suspended=true WHERE id=$1',[a.user.id]);
  assert.deepEqual((await call('GET',root,undefined,viewer)).items.map((r:any)=>r.id),[b.user.id]);
});

test('world discovery has stable pagination, pair popularity and exact UTC calendar boundaries', async () => {
  const owner = await makeAccount(); const viewer = await makeAccount(); const second = await makeAccount();
  const tag = `Discovery ${op().slice(0,8)}`;
  const worlds = []; const grids = [];
  for(let n=0;n<23;n++) {
    const w=await world(owner); worlds.push(w); grids.push(await publishIn(owner,w,60+n));
    await db.query("UPDATE worlds SET name=$1,created_at='2020-01-01'::timestamptz WHERE id=$2",[`${tag} ${n}`,w.id]);
  }
  const root=`/v1/worlds?query=${encodeURIComponent(tag)}`;
  const first=await call('GET',root,undefined,viewer); const last=await call('GET',`${root}&page=1`,undefined,viewer);
  assert.equal(first.items.length,20); assert.equal(first.nextPage,1); assert.equal(last.items.length,3); assert.equal(last.nextPage,null);
  assert.deepEqual([...first.items,...last.items].map((r:any)=>r.id),worlds.map(w=>w.id).sort());
  for(const player of [viewer,second]) {
    const session=await call('POST',`/v1/grids/${grids[0].id}/sessions`,{operationId:op()},player);
    for(let repeat=0;repeat<2;repeat++) await call('POST',`/v1/play-sessions/${session.sessionId}/move`,{operationId:op(),path:unfinished(custom(60))},player);
  }
  const popular=await call('GET',root,undefined,viewer);
  assert.equal(popular.items[0].id,worlds[0].id); assert.equal(popular.items[0].popularity,2);
  for(const [period,unit] of [['today','day'],['week','week'],['month','month'],['year','year']]) {
    await db.query("UPDATE worlds SET created_at='2020-01-01'::timestamptz WHERE name LIKE $1",[`${tag}%`]);
    await db.query(`UPDATE worlds SET created_at=(date_trunc('${unit}',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') WHERE id=$1`,[worlds[0].id]);
    await db.query(`UPDATE worlds SET created_at=(date_trunc('${unit}',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')-interval '1 microsecond' WHERE id=$1`,[worlds[1].id]);
    const page=await call('GET',`${root}&period=${period}&sort=newest`,undefined,viewer);
    assert.deepEqual(page.items.map((r:any)=>r.id),[worlds[0].id],period);
  }
  await db.query('UPDATE worlds SET created_at=now() WHERE id=$1',[worlds[2].id]);
  assert.equal((await call('GET',`${root}&sort=newest`,undefined,viewer)).items[0].id,worlds[2].id);
  assert.equal((await call('GET','/v1/worlds?query=%25',undefined,viewer)).items.length,0);
  assert.equal((await call('GET','/v1/worlds?query=%5C',undefined,viewer)).items.length,0);
  await call('GET',`${root}&period=rolling`,undefined,viewer,400);
});

test('attempt outcomes deduplicate retries, reject contradictions, and expose distinct solver statistics', async () => {
  const owner=await makeAccount(); const player=await makeAccount(); const other=await makeAccount();
  const w=await world(owner); const d=await publishIn(owner,w,110);
  const session=await call('POST',`/v1/grids/${d.id}/sessions`,{operationId:op()},player);
  const endpoint=`/v1/play-sessions/${session.sessionId}/failures`;
  const failure={operationId:op(),attemptId:op(),path:unfinished(custom(110)),reason:'restart'};
  await call('POST',endpoint,failure,player);
  await call('POST',endpoint,failure,player);
  await call('POST',endpoint,{...failure,operationId:op()},player);
  assert.equal((await call('GET',`/v1/profiles/${player.user.id}`,undefined,player)).xpMilli,'0');
  assert.equal((await call('GET',`/v1/worlds/${w.id}/grids`,undefined,player)).items[0].failedAttemptCount,1);
  await call('POST',endpoint,{...failure,operationId:op()},other,404);
  await call('POST',endpoint,{...failure,operationId:op(),attemptId:op(),path:custom(110).path},player,400);
  await call('POST',endpoint,{...failure,operationId:op(),attemptId:op(),path:[[0,24]]},player,400);
  await call('POST','/v1/completions',{operationId:op(),kind:'community',sessionId:session.sessionId,attemptId:failure.attemptId,path:custom(110).path},player,409);
  await call('POST',endpoint,{...failure,operationId:op(),attemptId:op(),reason:'leave'},player);
  const solved={operationId:op(),kind:'community',sessionId:session.sessionId,attemptId:op(),path:custom(110).path};
  const reward=await call('POST','/v1/completions',solved,player);
  assert.deepEqual(await call('POST','/v1/completions',solved,player),reward);
  assert.equal((await call('POST','/v1/completions',{...solved,operationId:op()},player)).awardedMilli,'0');
  await call('POST',endpoint,{...failure,operationId:op(),attemptId:solved.attemptId},player,409);
  await call('POST','/v1/completions',{...solved,operationId:op(),attemptId:op()},player);
  const own=await call('POST',`/v1/grids/${d.id}/sessions`,{operationId:op()},owner);
  await call('POST','/v1/completions',{operationId:op(),kind:'community',sessionId:own.sessionId,path:custom(110).path},owner);
  await call('POST',`/v1/play-sessions/${own.sessionId}/failures`,{...failure,operationId:op(),attemptId:op()},owner);
  const stats=(await call('GET',`/v1/worlds/${w.id}/grids`,undefined,player)).items[0];
  assert.equal(stats.beatenCount,1); assert.equal(stats.failedAttemptCount,2);
  const raced=op();
  const responses=await Promise.all(['solved','failed'].map(outcome=>app.inject({method:'POST',url:outcome==='solved'?'/v1/completions':endpoint,
    headers:{authorization:`Bearer ${player.accessToken}`},payload:outcome==='solved'?{...solved,operationId:op(),attemptId:raced}:{...failure,operationId:op(),attemptId:raced}})));
  assert.deepEqual(responses.map(r=>r.statusCode).sort(),[200,409]);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM play_attempt_outcomes WHERE user_id=$1 AND attempt_id=$2',[player.user.id,raced])).rows[0].n,1);
});

test('worlds take free-text filtered names and levels are added atomically with numbers 1 to 20', async () => {
  const a = await makeAccount(); const other = await makeAccount();
  await call('POST', '/v1/worlds', { operationId: op(), name: 'Kill Zone', icon: 'R' }, a, 400);
  const w = await call('POST', '/v1/worlds', { operationId: op(), name: 'Fire Garden', icon: 'P' }, a);
  assert.equal(w.name, 'Fire Garden');
  await call('PATCH', `/v1/worlds/${w.id}`, { operationId: op(), name: 'Big B1tch', icon: 'P', hidden: false }, a, 400);
  const add = (n: number, name = '', account: any = a, status = 200, operationId = op()) => call('POST', `/v1/worlds/${w.id}/levels`, { operationId, name, ...custom(n) }, account, status);
  const first = await add(1);
  assert.equal(first.levelNumber, 1); assert.equal(first.name, 'Level 1');
  const replayed = { operationId: op() };
  const second = await call('POST', `/v1/worlds/${w.id}/levels`, { ...replayed, name: 'First Steps', ...custom(2) }, a);
  assert.equal(second.levelNumber, 2); assert.equal(second.name, 'First Steps');
  assert.deepEqual(await call('POST', `/v1/worlds/${w.id}/levels`, { ...replayed, name: 'First Steps', ...custom(2) }, a), second);
  await add(3, 'Murder Hill', a, 400);
  await add(3, '', other, 404);
  assert.equal((await call('GET', '/v1/grids/drafts', undefined, a)).items.length, 0, 'failed adds leave no draft behind');
  for (let n = 3; n <= 20; n++) assert.equal((await add(n)).levelNumber, n);
  await add(21, '', a, 409);
  assert.equal((await call('GET', '/v1/grids/drafts', undefined, a)).items.length, 0);
  const listed = await call('GET', `/v1/worlds/${w.id}/grids`, undefined, a);
  assert.deepEqual(listed.items.map((g: any) => g.levelNumber), Array.from({ length: 20 }, (_, i) => i + 1));
  assert.equal(listed.world.usedSlots, 20);
});

test('concurrent level adds receive distinct consecutive numbers', async () => {
  const a = await makeAccount(); const w = await world(a);
  const results = await Promise.all([1, 2, 3, 4, 5].map(n => app.inject({ method: 'POST', url: `/v1/worlds/${w.id}/levels`, headers: { authorization: `Bearer ${a.accessToken}` }, payload: { operationId: op(), name: '', ...custom(n) } })));
  assert.deepEqual(results.map(r => r.statusCode), [200, 200, 200, 200, 200]);
  assert.deepEqual(results.map(r => r.json().levelNumber).sort(), [1, 2, 3, 4, 5]);
});

test('publishing an old draft also assigns the next level number', async () => {
  const a = await makeAccount(); const w = await world(a);
  const d = await draft(a, 1); const published = await call('POST', `/v1/grids/${d.id}/publish`, { operationId: op(), worldId: w.id }, a);
  assert.equal(published.levelNumber, 1);
});

test('casual cycles seed online solves, reset safely, and retain normal rewards', async () => {
  const hidden = (await db.query('UPDATE worlds SET hidden=true WHERE NOT hidden RETURNING id')).rows;
  try {
    const creator = await makeAccount(); const player = await makeAccount(); const other = await makeAccount();
    const w = await world(creator); const own = await world(player);
    const publish = async (owner: any, worldId: string, n: number) => {
      const d = await draft(owner, n);
      await call('POST', `/v1/grids/${d.id}/publish`, { operationId: op(), worldId }, owner);
      return d;
    };
    const a = await publish(creator, w.id, 201); const b = await publish(creator, w.id, 202);
    await publish(player, own.id, 203);
    const select = (account = player, operationId = op()) => call('POST', '/v1/casual/sessions', { operationId }, account);
    const solve = (account: any, sessionId: string, n: number, attemptId = op()) => call('POST', '/v1/completions', { operationId: op(), kind: 'community', sessionId, attemptId, path: custom(n).path }, account);
    await call('POST', '/v1/casual/sessions', { operationId: op() }, undefined, 401);
    const online = await call('POST', `/v1/grids/${a.id}/sessions`, { operationId: op() }, player);
    await solve(player, online.sessionId, 201);
    const retry = op(); const first = await select(player, retry);
    assert.equal(first.grid.id, b.id);
    assert.deepEqual(await select(player, retry), first);
    const concurrent = await Promise.all([select(), select()]);
    assert.ok(concurrent.every(s => s.grid.id === b.id));
    await call('POST', '/v1/completions', { operationId: op(), kind: 'community', sessionId: first.sessionId, path: [] }, player, 400);
    assert.equal((await select()).grid.id, b.id);
    const result = await solve(player, first.sessionId, 202);
    assert.equal(result.awardedMilli, '100000');
    const reset = await select();
    assert.ok([a.id, b.id].includes(reset.grid.id));
    assert.equal((await db.query('SELECT cycle FROM casual_cycles WHERE user_id=$1', [player.user.id])).rows[0].cycle, 2);
    await solve(player, concurrent[0]!.sessionId, 202);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM casual_completions WHERE user_id=$1', [player.user.id])).rows[0].n, 0);
    const replay = await solve(player, reset.sessionId, reset.grid.id === a.id ? 201 : 202);
    assert.equal(replay.awardedMilli, reset.grid.id === b.id ? '0' : '10000');
    assert.equal((await call('GET', '/v1/progress', undefined, player)).communityDone.length, 2);
    const c = await publish(creator, w.id, 204);
    const remainingId = reset.grid.id === a.id ? b.id : a.id;
    await db.query('UPDATE grids SET hidden=true WHERE id=$1', [remainingId]);
    assert.equal((await select()).grid.id, c.id);
    await db.query('UPDATE grids SET hidden=false WHERE id=$1', [remainingId]);
    const live = await call('POST', `/v1/grids/${c.id}/sessions`, { operationId: op() }, player);
    await solve(player, live.sessionId, 204);
    const next = await select();
    assert.equal(next.grid.id, reset.grid.id === a.id ? b.id : a.id);
    const isolated = await select(other);
    assert.ok([a.id, b.id, c.id].includes(isolated.grid.id) || isolated.grid.ownerId === player.user.id);
    await db.query('UPDATE users SET suspended=true WHERE id=$1', [creator.user.id]);
    assert.equal((await select()).grid, null);
    await db.query('UPDATE users SET suspended=false WHERE id=$1', [creator.user.id]);
    await db.query('UPDATE worlds SET hidden=true WHERE id=$1', [w.id]);
    assert.equal((await select()).sessionId, null);
    await db.query('UPDATE worlds SET hidden=false,moderated=true WHERE id=$1', [w.id]);
    assert.equal((await select()).grid, null);
    await db.query('UPDATE worlds SET moderated=false WHERE id=$1', [w.id]);
    await db.query('UPDATE grids SET hidden=true WHERE world_id=$1', [w.id]);
    assert.equal((await select()).grid, null);
    await db.query('UPDATE grids SET hidden=false,moderated=true WHERE world_id=$1', [w.id]);
    assert.equal((await select()).grid, null);
  } finally {
    await db.query('UPDATE worlds SET hidden=false WHERE id=ANY($1::uuid[])', [hidden.map(r => r.id)]);
  }
});
