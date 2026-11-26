import assert from 'node:assert/strict';
import { randomInt, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app.js';
import { configFromEnv, type Config } from './config.js';
import { database, type Db } from './db.js';
import { purplePuzzle, shapedPuzzle, showcaseMasks } from './showcase-puzzles.js';

/**
 * Fills a LOCAL database with the players the Worlds showcase video is recorded against: plain English names, 81 published puzzles, each in a different
 * shape (more than three Worlds pages of them), likes dated today (so "Most popular puzzles · Today" is full), follows and bookmarks. Everything goes through the player API, as
 * a real player would, except XP and Journey progress, which are written directly so levels and solved counts vary.
 *
 * Refuses any database that is not on this machine: this data must never reach a real server.
 * Usage: DATABASE_URL=postgres://…@127.0.0.1:…/db ENCRYPTION_KEY=… tsx src/seed-showcase.ts
 */
export const SHOWCASE_PASSWORD = 'showcase-recording-only';
export const showcaseEmail = (name: string) => `${name.toLowerCase()}@showcase.example.test`;
/**
 * Olivia is the profile that is followed (clip 3); Noah is the viewer who follows, likes and bookmarks (clip 5) and whose own profile and bookmarks are
 * shown (clip 6). Both have 12 puzzles, so their profiles show three full rows. Isabella owns the purple puzzle played in clip 5.
 */
export const SHOWCASE_NAMES = ['Olivia', 'Noah', 'Sarah', 'Liam', 'Emma', 'James', 'Ava', 'Lucas', 'Mia', 'Ethan', 'Sophia', 'Mason', 'Isabella', 'Logan',
  'Amelia', 'Jacob', 'Harper', 'Daniel', 'Ella', 'Henry', 'Grace', 'Jack', 'Chloe', 'Owen', 'Lily', 'Ryan', 'Zoe', 'Leo', 'Hannah', 'Adam', 'Nora', 'Oscar',
  'Ruby', 'Benjamin', 'Alice', 'Samuel', 'Ivy', 'Thomas', 'Lucy', 'Jake'];
const FULL_PROFILES = 2, FULL = 12, OTHER_CREATORS = 14, PUZZLES_EACH = 4;

export function assertLocal(databaseUrl: string) {
  const host = new URL(databaseUrl).hostname;
  assert(['127.0.0.1', 'localhost', '::1', '[::1]'].includes(host), `Refusing to seed showcase data into a non-local database (${host}).`);
}

async function request(app: FastifyInstance, method: 'GET' | 'POST', url: string, payload?: object, token?: string): Promise<any> {
  const r = await app.inject({ method, url, payload, headers: token ? { authorization: `Bearer ${token}` } : {} });
  if (r.statusCode !== 200) throw new Error(`${method} ${url}: ${r.statusCode} (${r.json().code ?? 'unexpected response'})`);
  return r.json();
}
const op = () => randomUUID();
const pick = <T>(items: T[], n: number) => [...items].sort(() => Math.random() - 0.5).slice(0, n);

export async function seedShowcase(db: Db, config: Config) {
  assertLocal(config.databaseUrl);
  const taken = (await db.query('SELECT count(*)::int AS n FROM users WHERE email LIKE $1', ['%@showcase.example.test'])).rows[0].n;
  assert.equal(taken, 0, 'Showcase players already exist: seed a fresh database.');
  const hashes = (await db.query('SELECT content_hash FROM content_claims UNION SELECT content_hash FROM grids')).rows.map(r => r.content_hash as string);
  const used = new Set(hashes);
  const players: { name: string; id: string; token: string; app: FastifyInstance }[] = [];
  try {
    for (const name of SHOWCASE_NAMES) {
      // One app per player keeps the per-client rate limits out of the way, as the community seed does.
      const app = await buildApp(db, config, false);
      const auth = await request(app, 'POST', '/v1/auth/register', { email: showcaseEmail(name), password: SHOWCASE_PASSWORD, name });
      assert.equal(auth.user.username, name);
      await db.query("INSERT INTO entitlements(user_id,product,status,source,note) VALUES($1,'worlds','active','manual','showcase recording')", [auth.user.id]);
      players.push({ name, id: auth.user.id, token: auth.accessToken, app });
    }
    const byName = (name: string) => players.find(p => p.name === name)!;
    // Publishers: Olivia and Noah with 12 each, the next 14 with 4 each, every puzzle in a shape of its own. The masks are dealt so Olivia's twelve and
    // Noah's twelve all come from different shapes.
    const counts = players.slice(0, FULL_PROFILES + OTHER_CREATORS).map((p, i) => [p, i < FULL_PROFILES ? FULL : PUZZLES_EACH] as const);
    const masks = showcaseMasks(counts.reduce((n, [, c]) => n + c, 0));
    const grids: { id: string; owner: string; code: string }[] = [];
    const publish = async (p: (typeof players)[number], puzzle: { start: string[]; target: string[]; path: [number, number][] }) => {
      const result = await request(p.app, 'POST', '/v1/grids', { operationId: op(), start: puzzle.start, target: puzzle.target, path: puzzle.path }, p.token);
      grids.push({ id: result.id, owner: p.id, code: result.code });
      return grids.at(-1)!;
    };
    for (const [p, count] of counts) for (const mask of masks.splice(0, count)) await publish(p, shapedPuzzle(mask, used));
    const purple = purplePuzzle(used);
    const played = await publish(byName('Isabella'), purple);
    const shapes = new Set((await db.query('SELECT start_board FROM grids WHERE owner_id = ANY($1)', [players.map(p => p.id)])).rows
      .map(r => (r.start_board as string[]).map(row => row.replace(/[^.]/g, '#')).join('/')));
    assert.equal(shapes.size, grids.length, 'Every showcase puzzle should have a shape of its own');
    // Varied levels and solved counts. Olivia sits high on "Highest level" without being first.
    for (const [i, p] of players.entries()) {
      const xp = p.name === 'Olivia' ? 9_400_000 : 300_000 + randomInt(12_000_000) - i * 40_000;
      await db.query("INSERT INTO xp_ledger(user_id,reason,source,amount) VALUES($1,'showcase','showcase',$2)", [p.id, Math.max(xp, 150_000)]);
      const solved = 5 + randomInt(60);
      await db.query('INSERT INTO campaign_progress(user_id,level_id) SELECT $1,g FROM generate_series(1,$2) g ON CONFLICT DO NOTHING', [p.id, solved]);
    }
    // Likes, all today. Noah leaves some for the recording (clip 5 likes and bookmarks the purple puzzle live).
    for (const p of players) {
      if (p.name === 'Noah') continue;
      for (const g of pick(grids.filter(g => g.owner !== p.id && g.id !== played.id), 6 + randomInt(14)))
        await request(p.app, 'POST', `/v1/grids/${g.id}/like`, { operationId: op(), on: true }, p.token);
    }
    // Follows: everybody follows a handful, so follower counts differ. Noah does not follow Olivia yet (clip 3 does it on camera).
    for (const p of players) {
      for (const other of pick(players.filter(o => o.id !== p.id && !(p.name === 'Noah' && o.name === 'Olivia')), 3 + randomInt(8)))
        await request(p.app, 'POST', `/v1/users/${other.id}/follow`, { operationId: op(), on: true }, p.token);
    }
    // Noah's bookmarks fill his Bookmarked button (clip 6); the purple puzzle is bookmarked on camera.
    const noah = byName('Noah');
    for (const g of pick(grids.filter(g => g.owner !== noah.id && g.id !== played.id), 9))
      await request(noah.app, 'POST', `/v1/grids/${g.id}/bookmark`, { operationId: op(), on: true }, noah.token);
    const third = await request(noah.app, 'GET', '/v1/grids?sort=popular&page=2', undefined, noah.token);
    assert(third.items.length > 0, 'Worlds should have at least three pages of puzzles');
    return { players: players.length, grids: grids.length, purple: { code: played.code, start: purple.start, target: purple.target, swap: purple.swap } };
  } finally {
    for (const p of players) await p.app.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const config = configFromEnv(); assertLocal(config.databaseUrl);
  const db = database(config.databaseUrl);
  try {
    const result = await seedShowcase(db, config);
    console.log(`Showcase seeded: ${result.players} players, ${result.grids} puzzles. Sign in as ${showcaseEmail('Noah')} or ${showcaseEmail('Olivia')} / ${SHOWCASE_PASSWORD}`);
    console.log('Clip 5 puzzle (Isabella):', JSON.stringify(result.purple));
  } finally { await db.end(); }
}
