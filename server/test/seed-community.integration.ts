import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { buildApp } from '../src/app.js';
import { campaign } from '../src/campaign.js';
import type { Config } from '../src/config.js';
import { database } from '../src/db.js';
import { migrate } from '../src/migrate.js';
import { contentHash, replay } from '../src/rules.js';
import { applySeed, oneMoveSolution, prepareSeed, saveManifest, validateManifest, verifySeed } from '../src/seed-community.js';

const baseUrl = process.env.TEST_DATABASE_URL;
if (!baseUrl) throw new Error('Set TEST_DATABASE_URL to an isolated PostgreSQL database.');

test('seed dry-run, collision checks, lost responses, repeat execution and public discovery', { timeout: 180000 }, async () => {
  const schema = `test_${randomUUID().replaceAll('-', '')}`, admin = database(baseUrl);
  const url = new URL(baseUrl); url.searchParams.set('options', `-c search_path=${schema}`);
  const db = database(url.toString());
  const config: Config = { databaseUrl: url.toString(), encryptionKey: '37'.repeat(32), host: '127.0.0.1', port: 0,
    smtpHost: 'localhost', smtpPort: 1025, smtpSecure: false, mailFrom: 'test@localhost', environment: 'test', trustProxy: false };
  const directory = await mkdtemp(join(tmpdir(), 'insight-seed-')), file = join(directory, 'manifest.json');
  await admin.query(`CREATE SCHEMA ${schema}`);
  try {
    await migrate(db);
    const m = await prepareSeed(db, file);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM users')).rows[0].n, 0, 'Dry-run wrote accounts');
    assert.equal((await db.query('SELECT count(*)::int AS n FROM grids')).rows[0].n, 0);
    assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), m);
    validateManifest(m);
    assert(oneMoveSolution({ start: ['RB', 'GW'], target: ['GB', 'RW'] }));
    const puzzles = m.creators.flatMap(c => c.puzzles), campaignHashes = new Set(campaign.map(contentHash));
    assert.equal(new Set(puzzles.map(p => p.hash)).size, 80);
    for (const c of m.creators) {
      assert.deepEqual(c.puzzles.map(p => p.start.length), [2, 2, 3, 3, 4, 4, 5, 5]);
      assert.deepEqual(c.puzzles.map(p => p.path.length), [4, 4, 8, 8, 12, 12, 16, 16]);
      for (const p of c.puzzles) { assert.deepEqual(replay(p, p.path), p.target); assert(!campaignHashes.has(p.hash)); assert(!oneMoveSolution(p)); }
    }
    const corrupt = structuredClone(m); corrupt.creators[9]!.puzzles[7]!.path[0] = [0, 0];
    await assert.rejects(applySeed(db, config, file, corrupt));
    assert.equal((await db.query('SELECT count(*)::int AS n FROM users')).rows[0].n, 0, 'Invalid puzzle created accounts');

    const app = await buildApp(db, config, false);
    async function call(path: string, payload: object, token?: string) {
      const r = await app.inject({ method: 'POST', url: path, payload, headers: token ? { authorization: `Bearer ${token}` } : {} });
      assert.equal(r.statusCode, 200); return r.json();
    }
    try {
      // Check both identity collision cases before permitting any batch account writes.
      for (const field of ['name', 'email'] as const) {
        const c = m.creators[9]!;
        const outsider = await call('/v1/auth/register', { name: field === 'name' ? c.name : 'Unrelated account',
          email: field === 'email' ? c.email : 'outsider@example.test', password: 'different-test-password' });
        await assert.rejects(applySeed(db, config, file, m), /Identity collision/);
        assert.equal((await db.query('SELECT count(*)::int AS n FROM users')).rows[0].n, 1);
        await db.query('DELETE FROM sessions WHERE user_id=$1', [outsider.user.id]);
        await db.query('DELETE FROM users WHERE id=$1', [outsider.user.id]);
      }
      // Simulate registration committing immediately before the process loses its response.
      const c = m.creators[0]!; c.registrationStarted = true; await saveManifest(file, m);
      const auth = await call('/v1/auth/register', { name: c.name, email: c.email, password: c.password });
      // Simulate a publication committing with neither its ID nor response saved in the manifest.
      const p = c.puzzles[0]!;
      const published = await call('/v1/grids', { operationId: p.operationId, start: p.start, target: p.target, path: p.path }, auth.accessToken);
      const resumed = await prepareSeed(db, file);
      assert.equal(resumed.creators[0]!.userId, auth.user.id); assert.equal(resumed.creators[0]!.puzzles[0]!.result, undefined);
      await applySeed(db, config, file, resumed);
      assert.equal(resumed.creators[0]!.puzzles[0]!.result!.id, published.id);
      await verifySeed(db, resumed);
      const counts = async () => (await db.query(`SELECT (SELECT count(*)::int FROM users) AS users,
        (SELECT count(*)::int FROM grids) AS grids,(SELECT count(*)::int FROM operations) AS operations,
        (SELECT count(*)::int FROM xp_ledger) AS rewards,(SELECT sum(amount)::text FROM xp_ledger) AS xp`)).rows[0];
      const first = await counts(); assert.deepEqual(first, { users: 10, grids: 80, operations: 80, rewards: 20, xp: '500000' });
      assert.equal((await db.query("SELECT count(*)::int AS n FROM imported_badges WHERE badge_id='designed-1'")).rows[0].n, 10);
      assert.equal((await db.query('SELECT count(*)::int AS n FROM imported_badges')).rows[0].n, 10);
      await applySeed(db, config, file, await prepareSeed(db, file));
      assert.deepEqual(await counts(), first, 'Repeat execution duplicated content or rewards');
      // Matching another batch's existing content must fail before registering a replacement identity.
      const collision = structuredClone(resumed); collision.creators[0]!.puzzles[0]!.hash = puzzles[1]!.hash;
      assert.throws(() => validateManifest(collision));
      await db.query("UPDATE content_claims SET creator_id=NULL WHERE content_hash=$1", [puzzles[0]!.hash]);
      await assert.rejects(prepareSeed(db, file), /Content already claimed/);
      await db.query('UPDATE content_claims SET creator_id=$1 WHERE content_hash=$2', [auth.user.id, puzzles[0]!.hash]);
      // Exercise the actual Random handler only in the isolated database, after the no-activity assertions.
      const random = await call('/v1/casual/sessions', { operationId: randomUUID() }, auth.accessToken);
      assert(random.grid && random.grid.ownerId !== auth.user.id);
    } finally { await app.close(); }
  } finally {
    await db.end(); await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin.end();
    assert(resolve(directory).startsWith(resolve(tmpdir()) + sep)); await rm(directory, { recursive: true });
  }
});
