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
const config: Config = { databaseUrl: url.toString(), encryptionKey: key, host: '127.0.0.1', port: 0, smtpHost: 'localhost', smtpPort: 1025, smtpSecure: false, mailFrom: 'test@localhost', environment: 'test', trustProxy: false, createDailyLimit: 30 };
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

async function create(account: any, n=1, operationId=op()) { return call('POST','/v1/grids',{operationId,...custom(n)},account); }
async function complete(account: any, levelId: number, operationId=op()) { return call('POST','/v1/completions',{operationId,kind:'campaign',levelId,path:routes[levelId-1]},account); }
test('older APK imports retain current progress without retired IDs or XP', async () => {
  const account = await makeAccount();
  const request = { operationId: op(), done: Array.from({length:206},(_,i)=>i+1), badges: ['first','first-clean','world-1','world-11','pristine','complete'] };
  const accepted = await call('POST','/v1/progress/import',request,account);
  assert.deepEqual(await call('POST','/v1/progress/import',request,account),accepted);
  const progress = await call('GET','/v1/progress',undefined,account);
  assert.equal(progress.done.length,200); assert.equal(progress.xpMilli,'0');
  assert.deepEqual(progress.badges.sort(),['first','levels-30','levels-60','levels-90','levels-120','levels-150','levels-180','complete'].sort());
  assert.equal((await call('GET',`/v1/profiles/${account.user.id}`,undefined,account)).campaignCount,200);
  await call('POST','/v1/progress/import',{operationId:op(),done:[207],badges:[]},account,400);
  await call('POST','/v1/progress/import',{operationId:op(),done:[],badges:['unknown']},account,400);
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
  await call('GET', '/v1/grids', undefined, a);
  for (let n = 0; n < 8; n++) await call('POST', '/v1/auth/login', { email: 'unknown@example.test', password: 'bad' }, undefined, 401, '192.0.2.1');
  await call('POST', '/v1/auth/login', { email: 'unknown@example.test', password: 'bad' }, undefined, 429, '192.0.2.1');
  const spec = await call('GET', '/docs/json'); assert.ok(spec.paths['/v1/completions']);
});

test('open registration, unique English nicknames, concurrent claims and idempotent profile rename', async () => {
  const email = `${op()}@example.test`;
  await call('POST', '/v1/auth/register', { email, password: 'long-test-password', name: '  My\u3000Nickname  ' });
  const registered = await call('POST', '/v1/auth/login', { email, password: 'long-test-password' });
  assert.equal(registered.user.username, 'My Nickname');
  const conflict = await call('POST', '/v1/auth/register', { email: `${op()}@example.test`, password: 'long-test-password', name: 'ｍｙ nickname' }, undefined, 409);
  assert.equal(conflict.code, 'NAME_TAKEN');
  const name = `Race ${Date.now()}`;
  const race = await Promise.all([name, name.toUpperCase()].map((name, n) => app.inject({ method: 'POST', url: '/v1/auth/register', remoteAddress: `192.0.2.${20+n}`, payload: { email: `${op()}@example.test`, password: 'long-test-password', name } })));
  assert.deepEqual(race.map(r => r.statusCode).sort(), [200,409]);
  const a = await makeAccount(); const b = await makeAccount();
  const change = { operationId: op(), name: `Puzzle Player ${Date.now() % 1000}` };
  await call('PATCH', '/v1/account/name', change, a);
  await call('PATCH', '/v1/account/name', change, a);
  assert.equal((await call('GET', '/v1/account', undefined, a)).user.username, change.name);
  assert.equal((await call('GET', `/v1/profiles/${a.user.id}`, undefined, b)).username, change.name);
  await call('PATCH', '/v1/account/name', { ...change, operationId: op() }, b, 409);
  await call('PATCH', '/v1/account/name', { operationId: op(), name: 'bad\u202ename' }, a, 400);
  await call('POST', '/v1/auth/register', { email: `${op()}@example.test`, password: 'long-test-password', name: 'Another player' });
  // Case, spacing-compatibility and the new rules: a rename or registration that breaks them is refused with its own code and explanation.
  for (const [name, code] of [['MY NICKNAME', 'NAME_TAKEN'], ['f u c k', 'NAME_PROFANITY'], ['ab', 'NAME_LENGTH'], ['Émile', 'NAME_CHARACTERS'], ['Admin', 'NAME_RESERVED']] as const) {
    const refused = await call('POST', '/v1/auth/register', { email: `${op()}@example.test`, password: 'long-test-password', name }, undefined, code === 'NAME_TAKEN' ? 409 : 400);
    assert.equal(refused.code, code, name);
    assert.ok(refused.message.length > 10);
  }
  await call('PATCH', '/v1/account/name', { operationId: op(), name: 'k1ll3r' }, a, 400);
});

test('worldless creation is atomic, needs only construction proof, and retries do not duplicate puzzles or XP',async()=>{
 const owner=await makeAccount(), viewer=await makeAccount(), operationId=op();
 const a=await create(owner,4,operationId);
 assert.equal(a.levelNumber,1); assert.equal(a.awardedMilli,'25000');
 assert.deepEqual(await create(owner,4,operationId),a);
 assert.equal((await call('GET','/v1/progress',undefined,owner)).communityDone.length,0);
 assert.equal((await call('GET',`/v1/profiles/${owner.user.id}`,undefined,viewer)).gridCount,1);
 const listing=await call('GET',`/v1/grids?owner=${owner.user.id}&sort=number`,undefined,viewer);
 assert.equal(listing.items[0].id,a.id); assert.equal(listing.items[0].completed,false);
 for(const key of ['name','worldId','worldName']) assert.equal(key in listing.items[0],false);
 assert.equal((await call('GET',`/v1/grids/code/${a.code}`,undefined,viewer)).grid.id,a.id);
 await call('POST','/v1/grids',{operationId:op(),...custom(4),path:[[0,1]]},owner,400);
 await call('POST','/v1/grids',{operationId:op(),...custom(4),path:[]},owner,400);
 await call('POST','/v1/grids',{operationId:op(),...custom(4)},undefined,401);
 await call('POST','/v1/worlds',{operationId:op(),name:'Old',icon:'R'},owner,404);
});

test('concurrent creation gives unique stable creator numbers beyond a page and pagination never repeats',async()=>{
 const a=await makeAccount();
 const results=await Promise.all(Array.from({length:27},(_,i)=>create(a,i+10)));
 assert.deepEqual(results.map(r=>r.levelNumber).sort((a,b)=>a-b),Array.from({length:27},(_,i)=>i+1));
 const url=`/v1/grids?owner=${a.user.id}&sort=number`;
 const first=await call('GET',url,undefined,a),last=await call('GET',url+'&page=1',undefined,a);
 assert.equal(first.items.length,24); assert.equal(last.items.length,3);
 assert.equal(new Set([...first.items,...last.items].map(g=>g.id)).size,27);
 assert.equal(first.nextPage,1); assert.equal(last.nextPage,null);
 // The app's Bookmarked list holds 28 per page and asks for as many, so its first fetch fills the whole page.
 const wide=await call('GET',url+'&limit=28',undefined,a);
 assert.equal(wide.items.length,27); assert.equal(wide.nextPage,null);
 await call('GET',url+'&limit=25',undefined,a,400);
 await call('PATCH',`/v1/grids/${first.items[0].id}`,{operationId:op(),hidden:true},a);
 assert.equal((await create(a,90)).levelNumber,28);
 assert.equal((await db.query("SELECT sum(amount)::text AS n FROM xp_ledger WHERE user_id=$1 AND reason='create'",[a.user.id])).rows[0].n,'50000');
});

test('a player can publish ten puzzles a UTC day; the eleventh is refused and a retry of the tenth still succeeds',async()=>{
 const limited=await buildApp(db,{...config,createDailyLimit:10},false); await limited.ready();
 try {
  const a=await makeAccount(); let last:any,lastId='';
  const publish=(n:number,operationId=op())=>limited.inject({method:'POST',url:'/v1/grids',remoteAddress:`10.9.${n}.1`,headers:{authorization:`Bearer ${a.accessToken}`},payload:{operationId,...custom(n+300)}});
  for(let n=0;n<10;n++){ lastId=op(); const r=await publish(n,lastId); assert.equal(r.statusCode,200,r.body); last=r.json(); }
  const refused=await publish(10); assert.equal(refused.statusCode,403); assert.equal(refused.json().code,'DAILY_LIMIT'); assert.match(refused.json().message,/daily limit of 10/);
  const retry=await publish(9,lastId); assert.equal(retry.statusCode,200); assert.deepEqual(retry.json(),last);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM grids WHERE owner_id=$1',[a.user.id])).rows[0].n,10);
  await db.query("UPDATE grids SET published_at=published_at - interval '2 days' WHERE owner_id=$1",[a.user.id]);
  assert.equal((await publish(11)).statusCode,200);
 } finally { await limited.close(); }
});

test('visibility, own profile collection, moderation and creator discovery agree',async()=>{
 const owner=await makeAccount(),viewer=await makeAccount(); const d=await create(owner,95);
 await call('PATCH',`/v1/grids/${d.id}`,{operationId:op(),hidden:true},viewer,404);
 await call('PATCH',`/v1/grids/${d.id}`,{operationId:op(),hidden:true},owner);
 assert.equal((await call('GET',`/v1/grids?owner=${owner.user.id}`,undefined,viewer)).items.length,0);
 assert.equal((await call('GET',`/v1/grids?owner=${owner.user.id}`,undefined,owner)).items[0].id,d.id);
 await call('GET',`/v1/grids/code/${d.code}`,undefined,viewer,404);
 await call('POST',`/v1/grids/${d.id}/sessions`,{operationId:op()},viewer,404);
 await call('PATCH',`/v1/grids/${d.id}`,{operationId:op(),hidden:false},owner);
 const creators=await call('GET','/v1/creators?query='+encodeURIComponent(owner.user.username),undefined,viewer);
 assert.equal(creators.items[0].gridCount,1); assert.equal('worldCount' in creators.items[0],false);
 await db.query('UPDATE grids SET moderated=true WHERE id=$1',[d.id]);
 await call('PATCH',`/v1/grids/${d.id}`,{operationId:op(),hidden:false},owner,404);
 assert.equal((await call('GET',`/v1/grids?owner=${owner.user.id}`,undefined,viewer)).items.length,0);
});

test('community sessions preserve distinct completions, attempt outcomes, XP and profile counts',async()=>{
 const owner=await makeAccount(),player=await makeAccount(); const d=await create(owner,110);
 const session=await call('POST',`/v1/grids/${d.id}/sessions`,{operationId:op()},player);
 const start=custom(110).start,target=custom(110).target;
 let partial: Move[]|undefined;
 for(let a=0;a<25&&!partial;a++) for(let b=0;b<25&&!partial;b++) {
   try { if(replay({start,target},[[a,b]],false).join('')!==target.join('')) partial=[[a,b]]; } catch {}
 }
 assert.ok(partial);
 const failure={operationId:op(),attemptId:op(),reason:'restart',path:partial};
 await call('POST',`/v1/play-sessions/${session.sessionId}/failures`,failure,player);
 await call('POST',`/v1/play-sessions/${session.sessionId}/failures`,{...failure,operationId:op()},player);
 const proof={operationId:op(),attemptId:op(),kind:'community',sessionId:session.sessionId,path:custom(110).path};
 const result=await call('POST','/v1/completions',proof,player); assert.equal(result.awardedMilli,'100000');
 assert.deepEqual(await call('POST','/v1/completions',proof,player),result);
 await call('POST',`/v1/play-sessions/${session.sessionId}/failures`,{...failure,attemptId:proof.attemptId,operationId:op()},player,409);
 const row=(await call('GET',`/v1/grids?owner=${owner.user.id}`,undefined,player)).items[0];
 assert.equal(row.completed,true); assert.equal(row.failedAttemptCount,1); assert.equal(row.beatenCount,1); assert.equal(row.popularity,1);
 const profile=await call('GET',`/v1/profiles/${player.user.id}`,undefined,player); assert.equal(profile.communityCount,1);
 assert.equal((await call('GET',`/v1/profiles/${owner.user.id}`,undefined,owner)).xpMilli,'25001');
});

test('puzzle discovery filters creators, numbers, literal search and UTC publication dates',async()=>{
 const a=await makeAccount(),b=await makeAccount(); const first=await create(a,120),second=await create(a,121);
 await db.query("UPDATE grids SET published_at='2020-01-01' WHERE id=$1",[first.id]);
 const url=`/v1/grids?owner=${a.user.id}`;
 assert.equal((await call('GET',url+'&period=today',undefined,b)).items[0].id,second.id);
 assert.equal((await call('GET',url+'&query=1',undefined,b)).items[0].id,first.id);
 assert.equal((await call('GET','/v1/grids?query='+encodeURIComponent(a.user.username),undefined,b)).items.length,2);
 assert.equal((await call('GET','/v1/grids?query=%25',undefined,b)).items.length,0);
 await call('GET',url+'&sort=unsupported',undefined,b,400);
 for(const [period,unit] of [['today','day'],['week','week'],['month','month'],['year','year']]) {
   await db.query(`UPDATE grids SET published_at=(date_trunc('${unit}',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') WHERE id=$1`,[first.id]);
   await db.query(`UPDATE grids SET published_at=(date_trunc('${unit}',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')-interval '1 microsecond' WHERE id=$1`,[second.id]);
   assert.deepEqual((await call('GET',url+'&period='+period,undefined,b)).items.map((g:any)=>g.id),[first.id]);
 }
});

test('Casual excludes own and hidden puzzles, records solves and cycles without clearing history',async()=>{
 const hidden=(await db.query('UPDATE grids SET hidden=true WHERE NOT hidden RETURNING id')).rows;
 try {
   const owner=await makeAccount(),player=await makeAccount(); const a=await create(owner,201); await create(player,202);
   const first=await call('POST','/v1/casual/sessions',{operationId:op()},player); assert.equal(first.grid.id,a.id);
   await call('POST','/v1/completions',{operationId:op(),kind:'community',sessionId:first.sessionId,attemptId:op(),path:custom(201).path},player);
   assert.equal((await call('POST','/v1/casual/sessions',{operationId:op()},player)).grid.id,a.id);
   assert.equal((await call('GET','/v1/progress',undefined,player)).communityDone.length,1);
   await call('PATCH',`/v1/grids/${a.id}`,{operationId:op(),hidden:true},owner);
   assert.equal((await call('POST','/v1/casual/sessions',{operationId:op()},player)).grid,null);
 } finally { await db.query('UPDATE grids SET hidden=false WHERE id=ANY($1::uuid[])',[hidden.map(r=>r.id)]); }
});

test('likes, bookmarks, follows, streaks and online badges', async () => {
  const maker = await makeAccount(), player = await makeAccount();
  const grid = await create(maker, 401);
  const session = await call('POST', `/v1/grids/${grid.id}/sessions`, { operationId: op() }, player);
  assert.deepEqual([session.grid.likeCount, session.grid.liked, session.grid.bookmarked], [0, false, false]);
  // Likes: idempotent per operation, own puzzles refused, counted in the list and the Most popular sort.
  const likeOp = op();
  assert.deepEqual(await call('POST', `/v1/grids/${grid.id}/like`, { operationId: likeOp, on: true }, player), { liked: true, likeCount: 1 });
  assert.deepEqual(await call('POST', `/v1/grids/${grid.id}/like`, { operationId: likeOp, on: true }, player), { liked: true, likeCount: 1 });
  await call('POST', `/v1/grids/${grid.id}/like`, { operationId: op(), on: true }, maker, 400);
  const liked = (await call('GET', `/v1/grids?sort=liked&owner=${maker.user.id}`, undefined, player)).items[0];
  assert.deepEqual([liked.likeCount, liked.liked, liked.bookmarked], [1, true, false]);
  const creators = (await call('GET', `/v1/creators?sort=liked&period=today&query=${encodeURIComponent(maker.user.username)}`, undefined, player)).items;
  assert.equal(creators[0].likeCount, 1);
  await db.query("UPDATE grid_likes SET created_at=now()-interval '400 days' WHERE grid_id=$1", [grid.id]);
  assert.equal((await call('GET', `/v1/creators?sort=liked&period=year&query=${encodeURIComponent(maker.user.username)}`, undefined, player)).items[0].likeCount, 0);
  // Bookmarks: only the caller's own list.
  await call('POST', `/v1/grids/${grid.id}/bookmark`, { operationId: op(), on: true }, player);
  assert.deepEqual((await call('GET', '/v1/grids?bookmarked=true', undefined, player)).items.map((g: any) => g.id), [grid.id]);
  assert.equal((await call('GET', '/v1/grids?bookmarked=true', undefined, maker)).items.length, 0);
  await call('POST', `/v1/grids/${grid.id}/bookmark`, { operationId: op(), on: false }, player);
  assert.equal((await call('GET', '/v1/grids?bookmarked=true', undefined, player)).items.length, 0);
  // Follows: counts on the profile, the private following list, no self-follow.
  assert.deepEqual(await call('POST', `/v1/users/${maker.user.id}/follow`, { operationId: op(), on: true }, player), { following: true, followerCount: 1 });
  await call('POST', `/v1/users/${player.user.id}/follow`, { operationId: op(), on: true }, player, 400);
  const profile = await call('GET', `/v1/profiles/${maker.user.id}`, undefined, player);
  assert.deepEqual([profile.followerCount, profile.following], [1, true]);
  assert.deepEqual((await call('GET', '/v1/following', undefined, player)).items.map((u: any) => u.id), [maker.user.id]);
  assert.equal((await call('GET', '/v1/following', undefined, maker)).items.length, 0);
  // Streak and badges: a community solve dated by the player's calendar, earlier days backfilled.
  const today = new Date().toISOString().slice(0, 10);
  await call('POST', '/v1/completions', { operationId: op(), kind: 'community', sessionId: session.sessionId, path: custom(401).path, day: today }, player);
  for (let i = 1; i < 7; i++) await db.query("INSERT INTO activity_days(user_id,day) VALUES($1,$2::date - $3::int)", [player.user.id, today, i]);
  await complete(player, 1);
  const progress = await call('GET', '/v1/progress', undefined, player);
  assert.deepEqual([progress.onlineSolved, progress.bestStreak], [1, 7]);
  assert.ok(progress.badges.includes('online-1') && progress.badges.includes('streak-7'));
  assert.equal((await call('GET', `/v1/profiles/${player.user.id}?today=${today}`, undefined, maker)).streak, 7);
  assert.ok((await call('GET', '/v1/progress', undefined, maker)).badges.includes('designed-1'));
});

test('followers list, profile list counts and private bookmark count', async () => {
  const maker = await makeAccount(), fan = await makeAccount();
  const grid = await create(maker, 402);
  await call('POST', `/v1/users/${maker.user.id}/follow`, { operationId: op(), on: true }, fan);
  await call('POST', `/v1/grids/${grid.id}/bookmark`, { operationId: op(), on: true }, fan);
  assert.deepEqual((await call('GET', '/v1/followers', undefined, maker)).items.map((u: any) => u.id), [fan.user.id]);
  assert.deepEqual(await call('GET', '/v1/followers?page=0', undefined, fan), { items: [], nextPage: null });
  const own = await call('GET', `/v1/profiles/${fan.user.id}`, undefined, fan);
  assert.deepEqual([own.followingCount, own.followerCount, own.bookmarkCount], [1, 0, 1]);
  // Someone else's bookmarks are never counted for you.
  assert.equal((await call('GET', `/v1/profiles/${fan.user.id}`, undefined, maker)).bookmarkCount, 0);
  await db.query('UPDATE users SET suspended=true WHERE id=$1', [maker.user.id]);
  assert.equal((await call('GET', `/v1/profiles/${fan.user.id}`, undefined, fan)).bookmarkCount, 0);
  assert.equal((await call('GET', '/v1/grids?bookmarked=true', undefined, fan)).items.length, 0);
  await db.query('UPDATE users SET suspended=false WHERE id=$1', [maker.user.id]);
  await call('GET', '/v1/followers', undefined, undefined, 401);
});

test('feedback is stored once, works signed out, is rate limited and mailed to the team', async () => {
  const player = await makeAccount();
  const anonymous = op(), signed = op();
  assert.deepEqual(await call('POST', '/v1/feedback', { operationId: anonymous, kind: 'bug', text: '  Tiles froze  ', appVersion: '0.2.9' }), { accepted: true });
  await call('POST', '/v1/feedback', { operationId: anonymous, kind: 'bug', text: 'Tiles froze', appVersion: '0.2.9' });
  await call('POST', '/v1/feedback', { operationId: signed, kind: 'feedback', text: 'Lovely game' }, player);
  await call('POST', '/v1/feedback', { operationId: op(), kind: 'feedback', text: '   ' }, undefined, 400);
  await call('POST', '/v1/feedback', { operationId: op(), kind: 'other', text: 'x' }, undefined, 400);
  const rows = (await db.query('SELECT id,kind,body,user_id FROM feedback WHERE id = ANY($1) ORDER BY kind', [[anonymous, signed]])).rows;
  assert.deepEqual(rows.map(r => [r.kind, r.body, r.user_id]), [['bug', 'Tiles froze', null], ['feedback', 'Lovely game', player.user.id]]);
  for (let i = 0; i < 5; i++) await call('POST', '/v1/feedback', { operationId: op(), kind: 'feedback', text: `spam ${i}` }, undefined, 200, '10.9.9.9');
  await call('POST', '/v1/feedback', { operationId: op(), kind: 'feedback', text: 'one too many' }, undefined, 429, '10.9.9.9');
  // Delivery: every pending report goes to FEEDBACK_TO, then its text is dropped.
  const sent: any[] = [];
  const transport = { sendMail: async (m: any) => { sent.push(m); return { accepted: [m.to], rejected: [] }; } };
  const { deliverFeedback } = await import('../src/feedback.js');
  const silent = { info() {}, warn() {} } as any;
  assert.equal(await deliverFeedback(db, { ...config, feedbackDeliveryMode: 'store' }, silent, transport), false);
  assert.equal(sent.length, 0);
  assert.equal((await db.query("SELECT count(*)::int AS n FROM feedback WHERE status='pending' AND attempts=0 AND body<>''")).rows[0].n, 7);
  while (await deliverFeedback(db, { ...config, feedbackTo: 'team@example.test' }, silent, transport));
  const mine = sent.filter(m => m.messageId === `<${anonymous}@insight-feedback>` || m.messageId === `<${signed}@insight-feedback>`);
  assert.equal(mine.length, 2);
  assert.ok(mine.every(m => m.to === 'team@example.test'));
  const bug = mine.find(m => m.subject === '[INSIGHT] Bug report');
  assert.ok(bug.text.startsWith('Tiles froze') && bug.text.includes('not signed in') && bug.text.includes('0.2.9'));
  assert.ok(mine.find(m => m.subject === '[INSIGHT] Feedback').text.includes(player.user.username));
  assert.equal((await db.query("SELECT count(*)::int AS n FROM feedback WHERE status<>'accepted' OR body<>''")).rows[0].n, 0);
});

test('XP level badges agree between progress and profiles without persisting or importing them', async () => {
 const a = await makeAccount();
 await db.query("INSERT INTO xp_ledger(user_id,reason,source,amount) VALUES($1,'test','level-badge',16500000)",[a.user.id]);
 const progress = await call('GET','/v1/progress',undefined,a);
 const profile = await call('GET',`/v1/profiles/${a.user.id}`,undefined,a);
 assert.equal(progress.level,37);
 assert.deepEqual(progress.badges.filter((b:string)=>b.startsWith('level-')),['level-10','level-20','level-30']);
 assert.deepEqual(profile.badges,progress.badges);
 assert.equal((await db.query("SELECT count(*)::int AS n FROM imported_badges WHERE user_id=$1 AND badge_id LIKE 'level-%'",[a.user.id])).rows[0].n,0);
});
test('full share codes filter the puzzle list case-insensitively', async () => {
 const a=await makeAccount(), grid=await create(a,731);
 const found=await call('GET',`/v1/grids?query=${grid.code.toLowerCase()}`,undefined,a);
 assert.deepEqual(found.items.map((g:any)=>g.id),[grid.id]);
 assert.equal(found.nextPage,null);
});