import { randomBytes, randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { PoolClient } from 'pg';
import { authentication, objectSchema, operationSchema, uuidSchema } from './auth.js';
import { badgeIds, campaign, earnedBadges } from './campaign.js';
import type { Config } from './config.js';
import { digest } from './crypto.js';
import { operation, type Db } from './db.js';
import { CREATE_DAILY_CAP, CREATE_XP, FIRST_XP, progression, REPLAY_DAILY_CAP, REPLAY_XP } from './progression.js';
import { contentHash, replay, requireValue, type Move, type Puzzle } from './rules.js';
import { levelName, worldName } from './names.js';
import { creators, recordAttempt, searchPattern } from './discovery.js';

const pathSchema = { type: 'array', minItems: 1, maxItems: 10000, items: { type: 'array', minItems: 2, maxItems: 2, items: { type: 'integer', minimum: 0, maximum: 24 } } };
const boardSchema = { type: 'array', minItems: 1, maxItems: 5, items: { type: 'string', minLength: 1, maxLength: 5, pattern: '^[RBGYWP.]+$' } };
const nameSchema = { type: 'string', maxLength: 40 };
const idParams = objectSchema({ id: uuidSchema });
const visible = 'NOT w.hidden AND NOT w.moderated AND NOT u.suspended';
const publishedVisible = `g.published_at IS NOT NULL AND NOT g.hidden AND NOT g.moderated AND ${visible}`;
const gridSelect = `SELECT g.id,g.owner_id AS "ownerId",g.world_id AS "worldId",g.name,g.code,
 g.level_number AS "levelNumber",g.start_board AS start,g.target_board AS target,g.hidden,g.moderated,g.published_at AS "publishedAt",
 w.name AS "worldName",u.username FROM grids g LEFT JOIN worlds w ON w.id=g.world_id JOIN users u ON u.id=g.owner_id`;
const worldSelect = `SELECT w.id,w.owner_id AS "ownerId",w.name,w.icon,w.hidden,w.moderated,u.username,
 (SELECT count(*)::int FROM grids g WHERE g.world_id=w.id AND g.published_at IS NOT NULL AND NOT g.hidden AND NOT g.moderated) AS "gridCount",
 (SELECT count(*)::int FROM grids g WHERE g.world_id=w.id AND g.published_at IS NOT NULL) AS "usedSlots",
 (SELECT count(*)::int FROM qualifying_plays p JOIN grids g ON g.id=p.grid_id WHERE g.world_id=w.id AND NOT g.hidden AND NOT g.moderated) AS popularity
 FROM worlds w JOIN users u ON u.id=w.owner_id`;
function puzzle(row: any): Puzzle { return { start: row.start_board, target: row.target_board }; }
async function award(c: PoolClient, user: string, reason: string, source: string, amount: bigint, cap?: bigint) {
  if (cap !== undefined) {
    const total = BigInt((await c.query("SELECT coalesce(sum(amount),0)::text AS amount FROM xp_ledger WHERE user_id=$1 AND reason=$2 AND day=(now() AT TIME ZONE 'UTC')::date", [user, reason])).rows[0].amount);
    amount = amount < cap - total ? amount : cap - total;
  }
  if (amount <= 0n) return 0n;
  const inserted = await c.query('INSERT INTO xp_ledger(user_id,reason,source,amount) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING', [user, reason, source, amount.toString()]);
  return inserted.rowCount ? amount : 0n;
}
async function xp(c: PoolClient | Db, user: string) {
  const total = (await c.query('SELECT coalesce(sum(amount),0)::text AS xp FROM xp_ledger WHERE user_id=$1', [user])).rows[0].xp;
  return progression(BigInt(total));
}
async function qualify(c: PoolClient, user: string, grid: any) {
  if (user === grid.owner_id) return;
  const added = await c.query('INSERT INTO qualifying_plays(user_id,grid_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [user, grid.id]);
  if (added.rowCount) await award(c, grid.owner_id, 'play', `${user}:${grid.id}`, 1n);
}
async function sessionGrid(db: PoolClient | Db, user: string, sessionId: string) {
  const row = (await db.query(`SELECT g.*,s.casual_cycle FROM play_sessions s JOIN grids g ON g.id=s.grid_id JOIN worlds w ON w.id=g.world_id
    JOIN users u ON u.id=g.owner_id WHERE s.id=$1 AND s.user_id=$2 AND s.expires_at>now() AND NOT u.suspended AND NOT g.moderated AND NOT w.moderated`, [sessionId, user])).rows[0];
  requireValue(row, 'SESSION_UNAVAILABLE', 'This play session is unavailable. Open the grid again.', 404);
  return row;
}

export async function onlineRoutes(app: FastifyInstance, db: Db, config: Config) {
  await creators(app, db, config);
  const ready = [authentication(db, config)];
  const user = (r: FastifyRequest) => r.account!.id;
  const write = (r: FastifyRequest, kind: string, fn: (c: PoolClient) => Promise<unknown>, peers: string[] = []) =>
    operation(db, user(r), (r.body as any).operationId, kind, digest(JSON.stringify({ params: r.params, body: r.body }), config.encryptionKey), fn, peers);
  app.post('/v1/casual/sessions', { preHandler: ready, schema: { body: objectSchema({ operationId: operationSchema }) } }, req => write(req, 'casual-session', async c => {
    const account = user(req);
    const initialized = await c.query('INSERT INTO casual_cycles(user_id) VALUES($1) ON CONFLICT DO NOTHING RETURNING cycle', [account]);
    if (initialized.rowCount) await c.query('INSERT INTO casual_completions(user_id,grid_id) SELECT user_id,grid_id FROM grid_completions WHERE user_id=$1 ON CONFLICT DO NOTHING', [account]);
    const eligible = gridSelect + ' WHERE ' + publishedVisible + ' AND g.owner_id<>$1';
    const remaining = eligible + ' AND NOT EXISTS(SELECT 1 FROM casual_completions cc WHERE cc.user_id=$1 AND cc.grid_id=g.id) ORDER BY random() LIMIT 1';
    let grid = (await c.query(remaining, [account])).rows[0];
    if (!grid && (await c.query(eligible + ' LIMIT 1', [account])).rowCount) {
      await c.query('UPDATE casual_cycles SET cycle=cycle+1 WHERE user_id=$1', [account]);
      await c.query('DELETE FROM casual_completions WHERE user_id=$1', [account]);
      grid = (await c.query(remaining, [account])).rows[0];
    }
    if (!grid) return { sessionId: null, grid: null };
    const sessionId = randomUUID();
    await c.query('INSERT INTO play_sessions(id,user_id,grid_id,casual_cycle) SELECT $1,$2,$3,cycle FROM casual_cycles WHERE user_id=$2', [sessionId, account, grid.id]);
    return { sessionId, grid };
  }));
  app.get('/v1/capabilities', async () => ({ emailDelivery: 'disabled' }));

  app.get('/v1/progress', { preHandler: ready }, async req => {
    const done = (await db.query('SELECT level_id FROM campaign_progress WHERE user_id=$1 ORDER BY level_id', [user(req)])).rows.map(r => r.level_id);
    const communityDone = (await db.query('SELECT grid_id FROM grid_completions WHERE user_id=$1 ORDER BY grid_id', [user(req)])).rows.map(r => r.grid_id);
    const badges = new Set([...earnedBadges(done), ...(await db.query('SELECT badge_id FROM imported_badges WHERE user_id=$1', [user(req)])).rows.map(r => r.badge_id)]);
    return { done, communityDone, badges: [...badges], ...(await xp(db, user(req))) };
  });
  app.post('/v1/progress/import', { preHandler: ready, schema: { body: objectSchema({ operationId: operationSchema,
    done: { type: 'array', maxItems: campaign.length, uniqueItems: true, items: { type: 'integer', minimum: 1, maximum: campaign.length } },
    badges: { type: 'array', maxItems: badgeIds.length, uniqueItems: true, items: { type: 'string', enum: badgeIds } } }) } }, req => write(req, 'import', async c => {
    const b = req.body as any;
    for (const id of b.done) await c.query('INSERT INTO campaign_progress(user_id,level_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [user(req), id]);
    for (const id of [...new Set([...b.badges, ...earnedBadges(b.done)])]) await c.query('INSERT INTO imported_badges(user_id,badge_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [user(req), id]);
    return { accepted: true, awardedMilli: '0' };
  }));

  app.get('/v1/profiles/:id', { preHandler: ready, schema: { params: idParams } }, async req => {
    const id = (req.params as any).id;
    const person = (await db.query('SELECT id,username FROM users WHERE id=$1 AND NOT suspended', [id])).rows[0];
    requireValue(person, 'NOT_FOUND', 'Profile unavailable.', 404);
    const done = (await db.query('SELECT level_id FROM campaign_progress WHERE user_id=$1', [id])).rows.map(r => r.level_id);
    const badges = [...new Set([...earnedBadges(done), ...(await db.query('SELECT badge_id FROM imported_badges WHERE user_id=$1', [id])).rows.map(r => r.badge_id)])];
    const counts = (await db.query(`SELECT
      (SELECT count(*)::int FROM worlds w WHERE owner_id=$1 AND NOT hidden AND NOT moderated AND EXISTS(SELECT 1 FROM grids g WHERE g.world_id=w.id AND g.published_at IS NOT NULL AND NOT g.hidden AND NOT g.moderated)) AS "worldCount",
      (SELECT count(*)::int FROM grids g JOIN worlds w ON w.id=g.world_id WHERE g.owner_id=$1 AND g.published_at IS NOT NULL AND NOT g.hidden AND NOT g.moderated AND NOT w.hidden AND NOT w.moderated) AS "gridCount"`, [id])).rows[0];
    // Community count excludes hashes already represented by completed campaign grids.
    const completedHashes = new Set(done.map((n: number) => contentHash(campaign[n - 1]!)));
    const communityHashes = (await db.query('SELECT DISTINCT g.content_hash FROM grid_completions gc JOIN grids g ON g.id=gc.grid_id WHERE gc.user_id=$1 AND g.owner_id<>$1', [id])).rows.map(r => r.content_hash);
    const communityCount = communityHashes.filter(h => !completedHashes.has(h)).length;
    return { ...person, worldCount: counts.worldCount, gridCount: counts.gridCount, campaignCount: done.length, communityCount, beatenCount: done.length + communityCount, badges, ...(await xp(db, id)) };
  });

  app.get('/v1/worlds', { preHandler: ready, schema: { querystring: objectSchema({ query: { type: 'string', maxLength: 80, default: '' }, owner: uuidSchema, mine: { type: 'boolean', default: false }, sort: { type: 'string', enum: ['popular','newest'], default: 'popular' }, period: { type: 'string', enum: ['all','today','week','month','year'], default: 'all' }, page: { type: 'integer', minimum: 0, maximum: 100000, default: 0 } }, []) } }, async req => {
    const q = req.query as any; const own = !!q.mine;
    const unit = ({ today: 'day', week: 'week', month: 'month', year: 'year' } as Record<string,string>)[q.period];
    const period = unit ? `AND w.created_at >= (date_trunc('${unit}',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') AND w.created_at <= now()` : '';
    const order = q.sort === 'newest' ? 'w.created_at DESC' : 'popularity DESC';
    const rows = (await db.query(`${worldSelect} WHERE ${own ? 'w.owner_id=$1' : `$1::uuid IS NOT NULL AND ${visible} AND EXISTS(SELECT 1 FROM grids g WHERE g.world_id=w.id AND g.published_at IS NOT NULL AND NOT g.hidden AND NOT g.moderated)`}
      AND ($2::uuid IS NULL OR w.owner_id=$2) AND w.name ILIKE $3
      ${period} ORDER BY ${order},w.id ASC LIMIT 21 OFFSET $4`, [user(req), q.owner ?? null, searchPattern(q.query ?? ''), (q.page ?? 0) * 20])).rows;
    return { items: rows.slice(0, 20), nextPage: rows.length > 20 ? (q.page ?? 0) + 1 : null };
  });
  app.post('/v1/worlds', { preHandler: ready, schema: { body: objectSchema({ operationId: operationSchema, name: nameSchema, icon: { type: 'string', enum: ['R', 'B', 'G', 'Y', 'W', 'P'] } }) } }, req => write(req, 'world-create', async c => {
    const b = req.body as any; const id = randomUUID();
    await c.query('INSERT INTO worlds(id,owner_id,name,icon) VALUES($1,$2,$3,$4)', [id, user(req), worldName(b.name), b.icon]);
    return (await c.query(`${worldSelect} WHERE w.id=$1`, [id])).rows[0];
  }));
  app.patch('/v1/worlds/:id', { preHandler: ready, schema: { params: idParams, body: objectSchema({ operationId: operationSchema, name: nameSchema, icon: { type: 'string', enum: ['R', 'B', 'G', 'Y', 'W', 'P'] }, hidden: { type: 'boolean' } }) } }, req => write(req, 'world-update', async c => {
    const b = req.body as any;
    const result = await c.query('UPDATE worlds SET name=$1,icon=$2,hidden=$3 WHERE id=$4 AND owner_id=$5 AND NOT moderated RETURNING id', [worldName(b.name), b.icon, b.hidden, (req.params as any).id, user(req)]);
    requireValue(result.rowCount, 'NOT_FOUND', 'World unavailable or cannot be changed.', 404);
    return { accepted: true };
  }));
  app.get('/v1/worlds/:id/grids', { preHandler: ready, schema: { params: idParams } }, async req => {
    const id = (req.params as any).id;
    const w = (await db.query(`${worldSelect} WHERE w.id=$1 AND (${visible} OR w.owner_id=$2)`, [id, user(req)])).rows[0];
    requireValue(w, 'NOT_FOUND', 'World unavailable.', 404);
    const items = (await db.query(`${gridSelect} WHERE g.world_id=$1 AND g.published_at IS NOT NULL
      AND ((${publishedVisible}) OR g.owner_id=$2) ORDER BY g.level_number,g.id`, [id, user(req)])).rows;
    const completed = new Set((await db.query('SELECT grid_id FROM grid_completions WHERE user_id=$1 AND grid_id=ANY($2::uuid[])', [user(req), items.map(g => g.id)])).rows.map(r => r.grid_id));
    const stats = (await db.query(`SELECT g.id,
      (SELECT count(*)::int FROM grid_completions gc WHERE gc.grid_id=g.id AND gc.user_id<>g.owner_id) AS "beatenCount",
      (SELECT count(*)::int FROM play_attempt_outcomes a WHERE a.grid_id=g.id AND a.outcome='failed' AND a.user_id<>g.owner_id) AS "failedAttemptCount"
      FROM grids g WHERE g.id=ANY($1::uuid[])`, [items.map(g => g.id)])).rows;
    const byId = new Map(stats.map(s => [s.id, s]));
    return { world: w, items: items.map(g => ({ ...g, ...byId.get(g.id), completed: completed.has(g.id) })) };
  });
  app.get('/v1/grids/drafts', { preHandler: ready }, async req => ({ items: (await db.query(`${gridSelect} WHERE g.owner_id=$1 AND g.published_at IS NULL ORDER BY g.created_at DESC LIMIT 100`, [user(req)])).rows }));
  async function insertDraft(c: PoolClient, owner: string, b: any, name: string) {
    replay(b, b.path);
    const count = (await c.query('SELECT count(*)::int AS count FROM grids WHERE owner_id=$1 AND published_at IS NULL', [owner])).rows[0].count;
    requireValue(count < 100, 'DRAFT_LIMIT', 'Publish an existing draft before saving more.', 409);
    const id = randomUUID(); let code = '';
    for (let i = 0; i < 10; i++) {
      code = randomBytes(8).toString('hex').toUpperCase();
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`code:${code}`]);
      if (!(await c.query('SELECT 1 FROM grids WHERE code=$1', [code])).rowCount) break;
      code = '';
    }
    requireValue(code, 'CODE_BUSY', 'Could not allocate a code. Please retry.', 503);
    await c.query('INSERT INTO grids(id,owner_id,name,code,start_board,target_board,content_hash) VALUES($1,$2,$3,$4,$5,$6,$7)', [id, owner, name, code, JSON.stringify(b.start), JSON.stringify(b.target), contentHash(b)]);
    return { id, code };
  }
  async function publishInto(c: PoolClient, owner: string, id: string, worldId: string) {
    const g = (await c.query('SELECT * FROM grids WHERE id=$1 AND owner_id=$2 AND NOT moderated FOR UPDATE', [id, owner])).rows[0];
    requireValue(g, 'NOT_FOUND', 'Draft unavailable.', 404);
    if (g.published_at) {
      requireValue(g.world_id === worldId, 'ALREADY_PUBLISHED', 'Published grids cannot move between worlds.', 409);
      return { id, code: g.code as string, name: g.name as string, levelNumber: g.level_number as number, awardedMilli: '0' };
    }
    const w = (await c.query('SELECT * FROM worlds WHERE id=$1 AND owner_id=$2 AND NOT moderated FOR UPDATE', [worldId, owner])).rows[0];
    requireValue(w, 'NOT_FOUND', 'World unavailable.', 404);
    const count = (await c.query('SELECT count(*)::int AS count FROM grids WHERE world_id=$1 AND published_at IS NOT NULL', [worldId])).rows[0].count;
    requireValue(count < 20, 'WORLD_FULL', 'This world already contains 20 levels. Create another world.', 409);
    const levelNumber = count + 1;
    const name = g.name === '' ? `Level ${levelNumber}` : g.name as string;
    await c.query('UPDATE grids SET world_id=$1,published_at=now(),level_number=$2,name=$3 WHERE id=$4', [worldId, levelNumber, name, id]);
    const original = await c.query('INSERT INTO content_claims(content_hash,creator_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [g.content_hash, owner]);
    const reward = original.rowCount ? await award(c, owner, 'create', g.content_hash, CREATE_XP, CREATE_DAILY_CAP) : 0n;
    return { id, code: g.code as string, name, levelNumber, awardedMilli: reward.toString() };
  }
  app.post('/v1/grids/drafts', { preHandler: ready, schema: { body: objectSchema({ operationId: operationSchema, name: nameSchema, start: boardSchema, target: boardSchema, path: pathSchema }) } }, req => write(req, 'draft-create', async c => {
    const b = req.body as any; const name = worldName(b.name);
    const { id, code } = await insertDraft(c, user(req), b, name);
    return { id, code, name, publishedAt: null };
  }));
  app.post('/v1/worlds/:id/levels', { preHandler: ready, schema: { params: idParams, body: objectSchema({ operationId: operationSchema, name: nameSchema, start: boardSchema, target: boardSchema, path: pathSchema }) } }, req => write(req, 'level-add', async c => {
    const b = req.body as any;
    const label = b.name.trim() === '' ? '' : levelName(b.name, 0);
    const { id } = await insertDraft(c, user(req), b, label);
    return publishInto(c, user(req), id, (req.params as any).id);
  }));
  app.post('/v1/grids/:id/publish', { preHandler: ready, schema: { params: idParams, body: objectSchema({ operationId: operationSchema, worldId: uuidSchema }) } }, req => write(req, 'publish', async c => {
    const { id, code, levelNumber, awardedMilli } = await publishInto(c, user(req), (req.params as any).id, (req.body as any).worldId);
    return { id, code, levelNumber, awardedMilli };
  }));
  app.patch('/v1/grids/:id', { preHandler: ready, schema: { params: idParams, body: objectSchema({ operationId: operationSchema, name: nameSchema, hidden: { type: 'boolean' } }) } }, req => write(req, 'grid-update', async c => {
    const b = req.body as any;
    const updated = await c.query('UPDATE grids SET name=$1,hidden=$2 WHERE id=$3 AND owner_id=$4 AND NOT moderated RETURNING id', [worldName(b.name), b.hidden, (req.params as any).id, user(req)]);
    requireValue(updated.rowCount, 'NOT_FOUND', 'Grid unavailable or cannot be changed.', 404);
    return { accepted: true };
  }));
  app.get('/v1/grids/code/:code', { preHandler: ready, schema: { params: objectSchema({ code: { type: 'string', pattern: '^[A-Fa-f0-9]{16}$' } }) } }, async req => {
    const grid = (await db.query(`${gridSelect} WHERE g.code=$1 AND ${publishedVisible}`, [(req.params as any).code.toUpperCase()])).rows[0];
    requireValue(grid, 'NOT_FOUND', 'Published grid not found.', 404); return { grid };
  });
  app.post('/v1/grids/:id/sessions', { preHandler: ready, schema: { params: idParams, body: objectSchema({ operationId: operationSchema }) } }, req => write(req, 'session', async c => {
    const g = (await c.query(`${gridSelect} WHERE g.id=$1 AND ${publishedVisible}`, [(req.params as any).id])).rows[0];
    requireValue(g, 'NOT_FOUND', 'Grid unavailable.', 404);
    const id = randomUUID(); await c.query('INSERT INTO play_sessions(id,user_id,grid_id) VALUES($1,$2,$3)', [id, user(req), g.id]);
    return { sessionId: id, grid: g };
  }));
  app.post('/v1/play-sessions/:id/move', { preHandler: ready, schema: { params: idParams, body: objectSchema({ operationId: operationSchema, path: pathSchema }) } }, async req => {
    const g = await sessionGrid(db, user(req), (req.params as any).id);
    return write(req, 'qualify', async c => {
      replay(puzzle(g), (req.body as any).path, false); await qualify(c, user(req), g); return { accepted: true };
    }, [g.owner_id]);
  });
  app.post('/v1/play-sessions/:id/failures', { preHandler: ready, schema: { params: idParams, body: objectSchema({ operationId: operationSchema, attemptId: uuidSchema, path: pathSchema, reason: { type: 'string', enum: ['restart','leave'] } }) } }, async req => {
    const b = req.body as any; const session = (req.params as any).id;
    const g = await sessionGrid(db, user(req), session);
    const board = replay(puzzle(g), b.path, false);
    requireValue(board.join('') !== g.target_board.join(''), 'ALREADY_SOLVED', 'A solved attempt cannot be marked as failed.');
    return write(req, 'failure', async c => {
      await recordAttempt(c, user(req), b.attemptId, session, g.id, 'failed', b.reason);
      await qualify(c, user(req), g);
      return { accepted: true };
    }, [g.owner_id]);
  });
  app.post('/v1/completions', { preHandler: ready, schema: { body: objectSchema({ operationId: operationSchema, kind: { type: 'string', enum: ['campaign', 'community'] },
    levelId: { type: 'integer', minimum: 1, maximum: campaign.length }, sessionId: uuidSchema, attemptId: uuidSchema, path: pathSchema, debug: { type: 'boolean', default: false } }, ['operationId', 'kind', 'path']) } }, async req => {
    const b = req.body as any;
    requireValue(!b.debug, 'DEBUG_ACTIVITY', 'Debug activity cannot earn XP.');
    requireValue(b.kind === 'campaign' ? !!b.levelId && !b.sessionId : !!b.sessionId && !b.levelId, 'INVALID_PUZZLE', 'Choose one campaign level or community session.');
    const g = b.kind === 'community' ? await sessionGrid(db, user(req), b.sessionId) : null;
    const p: Puzzle = g ? puzzle(g) : campaign[b.levelId - 1]!;
    replay(p, b.path); const hash = contentHash(p);
    return write(req, 'complete', async c => {
      if (g && !await recordAttempt(c, user(req), b.attemptId, b.sessionId, g.id, 'solved')) return { accepted: true, awardedMilli: '0', ...(await xp(c, user(req))) };
      if (g) {
        await qualify(c, user(req), g);
        await c.query('INSERT INTO casual_completions(user_id,grid_id) SELECT user_id,$2 FROM casual_cycles WHERE user_id=$1 AND ($3::integer IS NULL OR cycle=$3) ON CONFLICT DO NOTHING', [user(req), g.id, g.casual_cycle]);
        await c.query('INSERT INTO grid_completions(user_id,grid_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [user(req), g.id]);
      } else {
        await c.query('INSERT INTO campaign_progress(user_id,level_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [user(req), b.levelId]);
        const done = (await c.query('SELECT level_id FROM campaign_progress WHERE user_id=$1', [user(req)])).rows.map(r => r.level_id);
        for (const badge of earnedBadges(done)) await c.query('INSERT INTO imported_badges(user_id,badge_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [user(req), badge]);
      }
      let reward = 0n;
      const self = (await c.query('SELECT 1 FROM grids WHERE owner_id=$1 AND content_hash=$2 AND published_at IS NOT NULL LIMIT 1', [user(req), hash])).rowCount;
      if (!self) {
        const first = await c.query('INSERT INTO completions(user_id,content_hash) VALUES($1,$2) ON CONFLICT DO NOTHING', [user(req), hash]);
        if (first.rowCount) reward = await award(c, user(req), 'first', hash, FIRST_XP);
        else {
          const day = (await c.query("SELECT to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD') AS day")).rows[0].day;
          const repeated = await c.query('INSERT INTO replay_rewards(user_id,content_hash,day) VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [user(req), hash, day]);
          if (repeated.rowCount) reward = await award(c, user(req), 'replay', `${hash}:${day}`, REPLAY_XP, REPLAY_DAILY_CAP);
        }
      }
      return { accepted: true, awardedMilli: reward.toString(), ...(await xp(c, user(req))) };
    }, g ? [g.owner_id] : []);
  });
}
