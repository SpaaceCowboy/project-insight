import assert from 'node:assert/strict';
import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import { chmod, lstat, mkdir, open, readFile, rename } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import argon2 from 'argon2';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app.js';
import { campaign } from './campaign.js';
import { configFromEnv, type Config } from './config.js';
import { database, type Db } from './db.js';
import { contentHash, replay, type Move, type Puzzle } from './rules.js';

interface Publication { id: string; code: string; levelNumber: number; awardedMilli: string }
interface SeedPuzzle extends Puzzle { operationId: string; path: Move[]; hash: string; result?: Publication }
interface Creator {
  name: string; email: string; password: string; registrationStarted?: boolean; userId?: string; puzzles: SeedPuzzle[];
}
export interface SeedManifest {
  version: 1; batchId: string; target: string; createdAt: string; creators: Creator[]; verifiedAt?: string;
}
const sizes = [2, 2, 3, 3, 4, 4, 5, 5];
const steps = [4, 4, 8, 8, 12, 12, 16, 16];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const board = (cells: string[], size: number) => Array.from({ length: size }, (_, r) => cells.slice(r * size, (r + 1) * size).join(''));

export function oneMoveSolution(p: Puzzle): boolean {
  const start = p.start.join(''), target = p.target.join('');
  const differences = [...start].flatMap((tile, i) => tile === target[i] ? [] : [i]);
  if (differences.length !== 2) return false;
  for (const path of [[[differences[0]!, differences[1]!]], [[differences[1]!, differences[0]!]]] as Move[][]) {
    try { replay(p, path); return true; } catch { /* The existing rules decide whether the swap is legal. */ }
  }
  return false;
}

export function generatePuzzles(excluded: Set<string>): SeedPuzzle[] {
  const used = new Set([...campaign.map(contentHash), ...excluded]);
  return Array.from({ length: 80 }, (_, index) => {
    const size = sizes[index % 8]!, length = steps[index % 8]!;
    for (let attempt = 0; attempt < 1000; attempt++) {
      const palette = size === 2 ? 'RBGYW' : 'RBGYWP';
      let cells = Array.from({ length: size * size }, () => palette[randomInt(palette.length)]!);
      const target = board(cells, size), seen = new Set([cells.join('')]), shuffle: Move[] = [];
      while (shuffle.length < length) {
        const choices: { cells: string[]; move: Move }[] = [];
        for (let a = 0; a < cells.length; a++) for (let b = 0; b < cells.length; b++) {
          if (cells[a] === cells[b]) continue;
          const next = [...cells]; [next[a], next[b]] = [next[b]!, next[a]!];
          if (seen.has(next.join(''))) continue;
          try {
            replay({ start: board(cells, size), target: board(next, size) }, [[a, b]]);
            choices.push({ cells: next, move: [a, b] });
          } catch { /* Do not duplicate the server's movement rules. */ }
        }
        if (!choices.length) break;
        const choice = choices[randomInt(choices.length)]!;
        cells = choice.cells; shuffle.push(choice.move); seen.add(cells.join(''));
      }
      if (shuffle.length !== length) continue;
      const puzzle = { start: board(cells, size), target };
      if (oneMoveSolution(puzzle)) continue;
      const hash = contentHash(puzzle);
      if (used.has(hash)) continue;
      const path = shuffle.reverse().map(([a, b]): Move => [b, a]);
      replay(puzzle, path); used.add(hash);
      return { ...puzzle, path, hash, operationId: randomUUID() };
    }
    throw new Error(`Could not generate a unique ${size}x${size} puzzle.`);
  });
}

export function validateManifest(m: SeedManifest) {
  assert.equal(m.version, 1, 'Unsupported manifest'); assert.match(m.batchId, uuid);
  assert.equal(m.creators.length, 10, 'Expected ten creators');
  const hashes = new Set(campaign.map(contentHash)), operations = new Set<string>(), passwords = new Set<string>();
  m.creators.forEach((c, i) => {
    const number = String(i + 1).padStart(2, '0');
    assert.equal(c.name, `Seed Creator ${number}`); assert.equal(c.email, `seed-creator-${number}@insight.example.test`);
    assert(/^[A-Za-z0-9_-]{32}$/.test(c.password), 'Invalid credential format'); assert(!passwords.has(c.password), 'Repeated password'); passwords.add(c.password);
    if (c.userId) assert.match(c.userId, uuid);
    assert.equal(c.puzzles.length, 8);
    c.puzzles.forEach((p, n) => {
      assert.equal(p.start.length, sizes[n]); assert(p.start.every(row => row.length === sizes[n]));
      assert.equal(p.path.length, steps[n]); replay(p, p.path);
      const seen = new Set([p.start.join('')]);
      for (let k = 1; k <= p.path.length; k++) {
        const state = replay(p, p.path.slice(0, k), false).join('');
        assert(!seen.has(state), 'Repeated shuffle state'); seen.add(state);
      }
      assert(!oneMoveSolution(p), 'One-move solution'); assert.equal(p.hash, contentHash(p));
      assert(!hashes.has(p.hash), 'Duplicate content'); hashes.add(p.hash);
      assert.match(p.operationId, uuid); assert(!operations.has(p.operationId), 'Repeated operation'); operations.add(p.operationId);
      if (p.result) { assert.match(p.result.id, uuid); assert.match(p.result.code, /^[A-F0-9]{16}$/); assert.equal(p.result.levelNumber, n + 1); }
    });
  });
}

export async function saveManifest(file: string, manifest: SeedManifest) {
  await mkdir(dirname(file), { recursive: true, mode: 0o700 });
  await chmod(dirname(file), 0o700);
  const temp = `${file}.${randomUUID()}.tmp`, handle = await open(temp, 'wx', 0o600);
  try { await handle.writeFile(JSON.stringify(manifest, null, 2) + '\n'); await handle.sync(); }
  finally { await handle.close(); }
  await rename(temp, file);
  if (process.platform !== 'win32') {
    const directory = await open(dirname(file), 'r');
    try { await directory.sync(); } finally { await directory.close(); }
  }
}

async function targetIdentity(db: Db): Promise<string> {
  const row = (await db.query('SELECT current_database() AS db,current_schema() AS schema,inet_server_addr()::text AS host,inet_server_port() AS port')).rows[0];
  return JSON.stringify(row);
}

export async function prepareSeed(db: Db, file: string): Promise<SeedManifest> {
  const target = await targetIdentity(db);
  let manifest: SeedManifest;
  try {
    const info = await lstat(file);
    assert(info.isFile(), 'Manifest must be a private regular file'); await chmod(file, 0o600);
    try { manifest = JSON.parse(await readFile(file, 'utf8')); }
    catch { throw new Error('Cannot parse private manifest. Preserve it and repair it before retrying.'); }
  } catch (error: any) {
    if (error.code !== 'ENOENT') throw error;
    const hashes = (await db.query('SELECT content_hash FROM content_claims UNION SELECT content_hash FROM grids')).rows.map(r => r.content_hash as string);
    const puzzles = generatePuzzles(new Set(hashes));
    manifest = { version: 1, batchId: randomUUID(), target, createdAt: new Date().toISOString(), creators: Array.from({ length: 10 }, (_, i) => {
      const number = String(i + 1).padStart(2, '0');
      return { name: `Seed Creator ${number}`, email: `seed-creator-${number}@insight.example.test`, password: randomBytes(24).toString('base64url'), puzzles: puzzles.slice(i * 8, i * 8 + 8) };
    }) };
    validateManifest(manifest); await saveManifest(file, manifest);
  }
  validateManifest(manifest); assert.equal(manifest.target, target, 'Manifest belongs to a different database');
  await preflight(db, manifest);
  return manifest;
}

async function preflight(db: Db, m: SeedManifest) {
  for (const c of m.creators) {
    const rows = (await db.query('SELECT id,email,username,password_hash,suspended FROM users WHERE email=$1 OR lower(normalize(username,NFKC))=lower(normalize($2,NFKC))', [c.email, c.name])).rows;
    assert(rows.length <= 1, `Identity collision: ${c.name}`);
    const existing = rows[0];
    if (!existing) { assert(!c.userId, `Recorded account missing: ${c.name}`); continue; }
    assert(c.registrationStarted && existing.email === c.email && existing.username === c.name && !existing.suspended && (!c.userId || c.userId === existing.id), `Identity collision: ${c.name}`);
    assert(await argon2.verify(existing.password_hash, c.password), `Account is not owned by this batch: ${c.name}`);
    c.userId = existing.id;
    const grids = (await db.query('SELECT id,content_hash,level_number FROM grids WHERE owner_id=$1', [c.userId])).rows;
    for (const grid of grids) {
      const p = c.puzzles[grid.level_number - 1];
      const op = p && (await db.query('SELECT response FROM operations WHERE user_id=$1 AND id=$2 AND kind=$3', [c.userId, p.operationId, 'puzzle-create'])).rows[0];
      assert(p && p.hash === grid.content_hash && op?.response.id === grid.id, `Unrecorded publication: ${c.name}`);
    }
  }
  for (const c of m.creators) for (const p of c.puzzles) {
    const grids = (await db.query('SELECT id,owner_id FROM grids WHERE content_hash=$1', [p.hash])).rows;
    const claim = (await db.query('SELECT creator_id FROM content_claims WHERE content_hash=$1', [p.hash])).rows[0];
    const op = c.userId && (await db.query('SELECT response FROM operations WHERE user_id=$1 AND id=$2 AND kind=$3', [c.userId, p.operationId, 'puzzle-create'])).rows[0];
    assert(grids.every(g => g.owner_id === c.userId && g.id === op?.response.id), 'Content collision outside this batch');
    assert(!claim || (claim.creator_id === c.userId && grids.length === 1), 'Content already claimed outside this batch');
    assert(!p.result || (op && p.result.id === op.response.id && grids.length === 1), 'Recorded publication missing or changed');
  }
}

async function request(app: FastifyInstance, method: 'GET' | 'POST', url: string, payload?: object, accessToken?: string): Promise<any> {
  const r = await app.inject({ method, url, payload, headers: accessToken ? { authorization: `Bearer ${accessToken}` } : {} });
  if (r.statusCode !== 200) throw new Error(`${method} ${url}: ${r.statusCode} (${r.json().code ?? 'unexpected response'})`);
  return r.json();
}

export async function applySeed(db: Db, config: Config, file: string, m: SeedManifest) {
  validateManifest(m); assert.equal(m.target, await targetIdentity(db), 'Manifest belongs to a different database');
  await preflight(db, m); await saveManifest(file, m);
  for (const c of m.creators) {
    const app = await buildApp(db, config, false); let token: string | undefined;
    try {
      c.registrationStarted = true; await saveManifest(file, m);
      const auth = c.userId
        ? await request(app, 'POST', '/v1/auth/login', { email: c.email, password: c.password })
        : await request(app, 'POST', '/v1/auth/register', { email: c.email, password: c.password, name: c.name });
      token = auth.accessToken; assert.equal(auth.user.username, c.name);
      assert(!c.userId || c.userId === auth.user.id, 'Account identity changed');
      c.userId = auth.user.id; await saveManifest(file, m);
      for (const [index, p] of c.puzzles.entries()) {
        // Always retry the original request, including when its response was lost before the manifest save.
        const result = await request(app, 'POST', '/v1/grids', { operationId: p.operationId, start: p.start, target: p.target, path: p.path }, token);
        assert.equal(result.levelNumber, index + 1); assert.match(result.code, /^[A-F0-9]{16}$/);
        if (p.result) assert.deepEqual(result, p.result, 'Publication response changed');
        p.result = result; await saveManifest(file, m);
      }
      await verifyCreator(app, c, token!);
    } finally {
      try { if (token) await request(app, 'POST', '/v1/auth/logout', undefined, token); }
      finally { await app.close(); }
    }
  }
  await verifySeed(db, m);
  m.verifiedAt = new Date().toISOString(); await saveManifest(file, m);
}

async function verifyCreator(app: FastifyInstance, c: Creator, token: string) {
  const profile = await request(app, 'GET', `/v1/profiles/${c.userId}`, undefined, token);
  assert.equal(profile.gridCount, 8); assert.equal(profile.beatenCount, 0); assert.equal(profile.streak, 0);
  assert(profile.badges.includes('designed-1'));
  const listing = await request(app, 'GET', `/v1/grids?owner=${c.userId}&sort=number`, undefined, token);
  assert.deepEqual(listing.items.map((p: Publication) => p.id), c.puzzles.map(p => p.result!.id)); assert.equal(listing.nextPage, null);
  for (const p of c.puzzles) {
    const shared = await request(app, 'GET', `/v1/grids/code/${p.result!.code}`, undefined, token);
    assert.equal(shared.grid.id, p.result!.id);
  }
  const creators = await request(app, 'GET', `/v1/creators?query=${encodeURIComponent(c.name)}`, undefined, token);
  assert(creators.items.some((u: any) => u.id === c.userId && u.gridCount === 8));
  const found = new Set<string>(); let page: number | null = 0;
  while (page !== null) {
    const list = await request(app, 'GET', `/v1/grids?query=Seed%20Creator&sort=newest&page=${page}`, undefined, token);
    for (const p of list.items) { assert(!found.has(p.id), 'Pagination repeated a grid'); found.add(p.id); }
    page = list.nextPage;
  }
  assert(c.puzzles.every(p => found.has(p.result!.id)), 'Worlds pagination omitted a publication');
}

export async function verifySeed(db: Db, m: SeedManifest) {
  const users = m.creators.map(c => c.userId); assert(users.every(Boolean));
  assert.equal((await db.query('SELECT count(*)::int AS n FROM users WHERE id=ANY($1::uuid[]) AND NOT suspended', [users])).rows[0].n, 10);
  const grids = (await db.query(`SELECT g.*,u.suspended FROM grids g JOIN users u ON u.id=g.owner_id WHERE g.owner_id=ANY($1::uuid[])`, [users])).rows;
  assert.equal(grids.length, 80);
  for (const c of m.creators) for (const [i, p] of c.puzzles.entries()) {
    const grid = grids.find(g => g.id === p.result?.id);
    assert(grid && grid.owner_id === c.userId && grid.level_number === i + 1 && grid.code === p.result!.code && grid.published_at && !grid.hidden && !grid.moderated && !grid.suspended, 'Publication unavailable to Random');
    assert.deepEqual(grid.start_board, p.start); assert.deepEqual(grid.target_board, p.target); assert.equal(grid.content_hash, p.hash);
    replay({ start: grid.start_board, target: grid.target_board }, p.path);
  }
  // Read Random's eligibility predicates; opening an actual Random session would create play activity.
  for (const table of ['campaign_progress', 'completions', 'grid_completions', 'play_sessions', 'qualifying_plays', 'replay_rewards', 'play_attempt_outcomes', 'casual_cycles', 'casual_completions', 'activity_days', 'grid_likes', 'grid_bookmarks']) {
    assert.equal((await db.query(`SELECT count(*)::int AS n FROM ${table} WHERE user_id=ANY($1::uuid[])`, [users])).rows[0].n, 0, `Unexpected seed activity: ${table}`);
  }
  assert.equal((await db.query('SELECT count(*)::int AS n FROM follows WHERE follower_id=ANY($1::uuid[])', [users])).rows[0].n, 0);
  // Real players may follow/play the new catalogue while the batch is publishing, awarding normal creator XP.
  assert.equal((await db.query("SELECT count(*)::int AS n FROM xp_ledger WHERE user_id=ANY($1::uuid[]) AND reason NOT IN ('create','play')", [users])).rows[0].n, 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  assert(args.length >= 1 && args.length <= 2 && (!args[1] || args[1] === '--apply'), 'Usage: seed-community MANIFEST_PATH [--apply] (default: dry-run)');
  const file = resolve(args[0]!), config = configFromEnv(), db = database(config.databaseUrl), lock = await db.connect();
  try {
    assert((await lock.query("SELECT pg_try_advisory_lock(hashtextextended('insight-community-seed-v1',0)) AS locked")).rows[0].locked, 'Another seed run is active');
    const manifest = await prepareSeed(db, file);
    console.log(JSON.stringify({ mode: args[1] ? 'apply' : 'dry-run', batchId: manifest.batchId, creators: manifest.creators.map(c => ({ name: c.name, email: c.email, sizes: sizes.map(n => `${n}x${n}`), published: c.puzzles.filter(p => p.result).length })), puzzles: 80, manifest: file }, null, 2));
    if (args[1] === '--apply') { await applySeed(db, config, file, manifest); console.log('Verified: 10 creators, 80 publications, no seeded play or social activity.'); }
  } finally {
    await lock.query("SELECT pg_advisory_unlock(hashtextextended('insight-community-seed-v1',0))"); lock.release(); await db.end();
  }
}
