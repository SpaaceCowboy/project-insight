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
import { creators, recordAttempt, searchPattern } from './discovery.js';
import { acceptedDay, currentRun, longestRun, socialBadges } from './badges.js';

// Older APKs and saved import commands still contain the retired campaign and badge IDs.
const importBadgeIds = [...new Set([...badgeIds, 'flow', 'halfway', 'first-clean', 'steady', 'unbroken', 'flawless', 'clean-sweep', 'pristine', ...Array.from({ length: 11 }, (_, i) => `world-${i + 1}`)])];

const pathSchema = { type: 'array', minItems: 1, maxItems: 10000, items: { type: 'array', minItems: 2, maxItems: 2, items: { type: 'integer', minimum: 0, maximum: 24 } } };
const boardSchema = { type: 'array', minItems: 1, maxItems: 5, items: { type: 'string', minLength: 1, maxLength: 5, pattern: '^[RBGYWP.]+$' } };
const idParams = objectSchema({ id: uuidSchema });
const daySchema = { type: 'string', pattern: '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' };
const toggleBody = objectSchema({ operationId: operationSchema, on: { type: 'boolean' } });
const publishedVisible = 'g.published_at IS NOT NULL AND NOT g.hidden AND NOT g.moderated AND NOT u.suspended';
const gridSelect = `SELECT g.id,g.owner_id AS "ownerId",g.code,
 g.level_number AS "levelNumber",g.start_board AS start,g.target_board AS target,g.hidden,g.moderated,g.published_at AS "publishedAt",
 u.username FROM grids g JOIN users u ON u.id=g.owner_id`;
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
/** Counts behind the online, design and streak achievements. */
async function socialStats(c: PoolClient | Db, user: string) {
  const counts = (await c.query(`SELECT
    (SELECT count(DISTINCT gc.grid_id)::int FROM grid_completions gc JOIN grids g ON g.id=gc.grid_id WHERE gc.user_id=$1 AND g.owner_id<>$1) AS "onlineSolved",
    (SELECT count(*)::int FROM grids WHERE owner_id=$1 AND published_at IS NOT NULL) AS "designedCount"`, [user])).rows[0];
  return { onlineSolved: counts.onlineSolved as number, designedCount: counts.designedCount as number, bestStreak: longestRun(await activityDays(c, user)) };
}
async function activityDays(c: PoolClient | Db, user: string): Promise<string[]> {
  return (await c.query(`SELECT to_char(day,'YYYY-MM-DD') AS day FROM activity_days WHERE user_id=$1 ORDER BY day`, [user])).rows.map(r => r.day);
}
async function awardSocial(c: PoolClient, user: string) {
  for (const badge of socialBadges(await socialStats(c, user))) await c.query('INSERT INTO imported_badges(user_id,badge_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [user, badge]);
}
/** The caller's like and bookmark state plus the like count, for a grid shown in play. */
async function socialFields(c: PoolClient | Db, user: string, gridId: string) {
  return (await c.query(`SELECT (SELECT count(*)::int FROM grid_likes WHERE grid_id=$2) AS "likeCount",
    EXISTS(SELECT 1 FROM grid_likes WHERE grid_id=$2 AND user_id=$1) AS liked,
    EXISTS(SELECT 1 FROM grid_bookmarks WHERE grid_id=$2 AND user_id=$1) AS bookmarked`, [user, gridId])).rows[0];
}
async function sessionGrid(db: PoolClient | Db, user: string, sessionId: string) {
  const row = (await db.query(`SELECT g.*,s.casual_cycle FROM play_sessions s JOIN grids g ON g.id=s.grid_id
    JOIN users u ON u.id=g.owner_id WHERE s.id=$1 AND s.user_id=$2 AND s.expires_at>now() AND NOT u.suspended AND NOT g.moderated`, [sessionId, user])).rows[0];
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
    return { sessionId, grid: { ...grid, ...(await socialFields(c, account, grid.id)) } };
  }));
  app.get('/v1/capabilities', async () => ({ emailDelivery: 'disabled' }));

  app.get('/v1/progress', { preHandler: ready }, async req => {
    const done = (await db.query('SELECT level_id FROM campaign_progress WHERE user_id=$1 ORDER BY level_id', [user(req)])).rows.map(r => r.level_id);
    const communityDone = (await db.query('SELECT grid_id FROM grid_completions WHERE user_id=$1 ORDER BY grid_id', [user(req)])).rows.map(r => r.grid_id);
    const badges = new Set([...earnedBadges(done), ...(await db.query('SELECT badge_id FROM imported_badges WHERE user_id=$1', [user(req)])).rows.map(r => r.badge_id)]);
    return { done, communityDone, badges: [...badges], ...(await socialStats(db, user(req))), ...(await xp(db, user(req))) };
  });
  app.post('/v1/progress/import', { preHandler: ready, schema: { body: objectSchema({ operationId: operationSchema,
    done: { type: 'array', maxItems: Math.max(campaign.length, 206), uniqueItems: true, items: { type: 'integer', minimum: 1, maximum: Math.max(campaign.length, 206) } },
    badges: { type: 'array', maxItems: importBadgeIds.length, uniqueItems: true, items: { type: 'string', enum: importBadgeIds } } }) } }, req => write(req, 'import', async c => {
    const b = req.body as any;
    for (const id of b.done.filter((id: number) => id <= campaign.length)) await c.query('INSERT INTO campaign_progress(user_id,level_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [user(req), id]);
    for (const id of [...new Set([...b.badges.filter((id: string) => badgeIds.includes(id)), ...earnedBadges(b.done)])]) await c.query('INSERT INTO imported_badges(user_id,badge_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [user(req), id]);
    return { accepted: true, awardedMilli: '0' };
  }));

  app.get('/v1/profiles/:id', { preHandler: ready, schema: { params: idParams, querystring: objectSchema({ today: daySchema }, []) } }, async req => {
    const id = (req.params as any).id;
    // The viewer's local date decides whether the streak is still alive; without it, the server's UTC date.
    const today = acceptedDay((req.query as any).today);
    const person = (await db.query('SELECT id,username FROM users WHERE id=$1 AND NOT suspended', [id])).rows[0];
    requireValue(person, 'NOT_FOUND', 'Profile unavailable.', 404);
    const done = (await db.query('SELECT level_id FROM campaign_progress WHERE user_id=$1', [id])).rows.map(r => r.level_id);
    const badges = [...new Set([...earnedBadges(done), ...(await db.query('SELECT badge_id FROM imported_badges WHERE user_id=$1', [id])).rows.map(r => r.badge_id)])];
    const counts = (await db.query(`SELECT count(*)::int AS "gridCount" FROM grids g
      WHERE g.owner_id=$1 AND g.published_at IS NOT NULL AND NOT g.hidden AND NOT g.moderated`, [id])).rows[0];
    // Community count excludes hashes already represented by completed campaign grids.
    const completedHashes = new Set(done.map((n: number) => contentHash(campaign[n - 1]!)));
    const communityHashes = (await db.query('SELECT DISTINCT g.content_hash FROM grid_completions gc JOIN grids g ON g.id=gc.grid_id WHERE gc.user_id=$1 AND g.owner_id<>$1', [id])).rows.map(r => r.content_hash);
    const communityCount = communityHashes.filter(h => !completedHashes.has(h)).length;
    // Bookmarks are private: only your own profile counts them.
    const follow = (await db.query(`SELECT (SELECT count(*)::int FROM follows WHERE followee_id=$1) AS "followerCount",
      (SELECT count(*)::int FROM follows WHERE follower_id=$1) AS "followingCount",
      CASE WHEN $1=$2 THEN (SELECT count(*)::int FROM grid_bookmarks b JOIN grids g ON g.id=b.grid_id JOIN users bu ON bu.id=g.owner_id AND NOT bu.suspended
        WHERE b.user_id=$1 AND g.published_at IS NOT NULL AND NOT g.hidden AND NOT g.moderated) ELSE 0 END AS "bookmarkCount",
      EXISTS(SELECT 1 FROM follows WHERE followee_id=$1 AND follower_id=$2) AS following`, [id, user(req)])).rows[0];
    const streak = currentRun(await activityDays(db, id), today);
    return { ...person, gridCount: counts.gridCount, campaignCount: done.length, communityCount, beatenCount: done.length + communityCount, badges,
      followerCount: follow.followerCount, followingCount: follow.followingCount, bookmarkCount: follow.bookmarkCount, following: follow.following, streak, ...(await xp(db, id)) };
  });

  app.post('/v1/users/:id/follow', { preHandler: ready, schema: { params: idParams, body: toggleBody } }, req => write(req, 'follow', async c => {
    const id = (req.params as any).id, on = (req.body as any).on;
    requireValue(id !== user(req), 'SELF_FOLLOW', 'You cannot follow yourself.');
    requireValue((await c.query('SELECT 1 FROM users WHERE id=$1 AND NOT suspended', [id])).rowCount, 'NOT_FOUND', 'Profile unavailable.', 404);
    if (on) await c.query('INSERT INTO follows(follower_id,followee_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [user(req), id]);
    else await c.query('DELETE FROM follows WHERE follower_id=$1 AND followee_id=$2', [user(req), id]);
    const followerCount = (await c.query('SELECT count(*)::int AS n FROM follows WHERE followee_id=$1', [id])).rows[0].n;
    return { following: on, followerCount };
  }));
  const likeable = async (c: PoolClient, id: string) => {
    const g = (await c.query(`SELECT g.id,g.owner_id FROM grids g JOIN users u ON u.id=g.owner_id WHERE g.id=$1 AND ${publishedVisible}`, [id])).rows[0];
    requireValue(g, 'NOT_FOUND', 'Grid unavailable.', 404);
    return g;
  };
  app.post('/v1/grids/:id/like', { preHandler: ready, schema: { params: idParams, body: toggleBody } }, req => write(req, 'grid-like', async c => {
    const g = await likeable(c, (req.params as any).id), on = (req.body as any).on;
    requireValue(g.owner_id !== user(req), 'OWN_PUZZLE', 'You cannot like your own puzzle.');
    if (on) await c.query('INSERT INTO grid_likes(user_id,grid_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [user(req), g.id]);
    else await c.query('DELETE FROM grid_likes WHERE user_id=$1 AND grid_id=$2', [user(req), g.id]);
    const likeCount = (await c.query('SELECT count(*)::int AS n FROM grid_likes WHERE grid_id=$1', [g.id])).rows[0].n;
    return { liked: on, likeCount };
  }));
  app.post('/v1/grids/:id/bookmark', { preHandler: ready, schema: { params: idParams, body: toggleBody } }, req => write(req, 'grid-bookmark', async c => {
    const g = await likeable(c, (req.params as any).id), on = (req.body as any).on;
    if (on) await c.query('INSERT INTO grid_bookmarks(user_id,grid_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [user(req), g.id]);
    else await c.query('DELETE FROM grid_bookmarks WHERE user_id=$1 AND grid_id=$2', [user(req), g.id]);
    return { bookmarked: on };
  }));

  app.get('/v1/grids', { preHandler: ready, schema: { querystring: objectSchema({
    owner: uuidSchema, query: { type: 'string', maxLength: 80, default: '' },
    sort: { type: 'string', enum: ['popular','newest','number','liked'], default: 'popular' },
    period: { type: 'string', enum: ['all','today','week','month','year'], default: 'all' },
    bookmarked: { type: 'boolean', default: false },
    page: { type: 'integer', minimum: 0, maximum: 100000, default: 0 }
  }, []) } }, async req => {
    const q = req.query as any;
    const unit = ({ today: 'day', week: 'week', month: 'month', year: 'year' } as Record<string,string>)[q.period];
    const period = unit ? `AND g.published_at >= (date_trunc('${unit}',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') AND g.published_at <= now()` : '';
    // Bookmarks list newest bookmark first; "liked" is the Most popular sort.
    const order = q.bookmarked ? '(SELECT b.created_at FROM grid_bookmarks b WHERE b.grid_id=g.id AND b.user_id=$1) DESC'
      : q.sort === 'number' ? 'g.level_number ASC' : q.sort === 'newest' ? 'g.published_at DESC' : q.sort === 'liked' ? '"likeCount" DESC' : 'popularity DESC';
    const rows = (await db.query(`SELECT p.*,
      EXISTS(SELECT 1 FROM grid_completions gc WHERE gc.grid_id=p.id AND gc.user_id=$1) AS completed,
      EXISTS(SELECT 1 FROM grid_likes l WHERE l.grid_id=p.id AND l.user_id=$1) AS liked,
      EXISTS(SELECT 1 FROM grid_bookmarks b WHERE b.grid_id=p.id AND b.user_id=$1) AS bookmarked
      FROM (SELECT g.id,g.owner_id AS "ownerId",g.code,g.level_number AS "levelNumber",g.start_board AS start,g.target_board AS target,
        g.hidden,g.moderated,g.published_at AS "publishedAt",u.username,
        (SELECT count(*)::int FROM qualifying_plays qp WHERE qp.grid_id=g.id) AS popularity,
        (SELECT count(*)::int FROM grid_likes l WHERE l.grid_id=g.id) AS "likeCount",
        (SELECT count(*)::int FROM grid_completions gc WHERE gc.grid_id=g.id AND gc.user_id<>g.owner_id) AS "beatenCount",
        (SELECT count(*)::int FROM play_attempt_outcomes a WHERE a.grid_id=g.id AND a.outcome='failed' AND a.user_id<>g.owner_id) AS "failedAttemptCount"
        FROM grids g JOIN users u ON u.id=g.owner_id
        WHERE g.published_at IS NOT NULL AND NOT u.suspended AND
          ((NOT g.hidden AND NOT g.moderated) OR (g.owner_id=$1 AND $2::uuid=$1))
          AND ($2::uuid IS NULL OR g.owner_id=$2) AND (CASE WHEN $4 ~ '^[0-9]+$' THEN g.level_number::text=$4 ELSE u.username ILIKE $3 END)
          AND (NOT $6::boolean OR EXISTS(SELECT 1 FROM grid_bookmarks b WHERE b.grid_id=g.id AND b.user_id=$1))
          ${period} ORDER BY ${order},g.id ASC LIMIT 21 OFFSET $5) p`,
      [user(req),q.owner ?? null,searchPattern(q.query),q.query,q.page*20,q.bookmarked])).rows;
    return { items: rows.slice(0,20), nextPage: rows.length > 20 ? q.page+1 : null };
  });
  app.post('/v1/grids', { preHandler: ready, schema: { body: objectSchema({ operationId: operationSchema,
    start: boardSchema, target: boardSchema, path: pathSchema }) } }, req => write(req, 'puzzle-create', async c => {
    const b = req.body as any; replay(b,b.path);
    const owner = user(req), id = randomUUID();
    // operation() holds the account lock, serializing creator numbers and retries.
    const number = (await c.query('SELECT coalesce(max(level_number),0)+1 AS n FROM grids WHERE owner_id=$1',[owner])).rows[0].n;
    let code = '';
    for (let i=0;i<10;i++) {
      code = randomBytes(8).toString('hex').toUpperCase();
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`code:${code}`]);
      if (!(await c.query('SELECT 1 FROM grids WHERE code=$1',[code])).rowCount) break;
      code = '';
    }
    requireValue(code,'CODE_BUSY','Could not allocate a code. Please retry.',503);
    const hash = contentHash(b);
    await c.query(`INSERT INTO grids(id,owner_id,code,start_board,target_board,content_hash,published_at,level_number)
      VALUES($1,$2,$3,$4,$5,$6,now(),$7)`,[id,owner,code,JSON.stringify(b.start),JSON.stringify(b.target),hash,number]);
    const original = await c.query('INSERT INTO content_claims(content_hash,creator_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[hash,owner]);
    const reward = original.rowCount ? await award(c,owner,'create',hash,CREATE_XP,CREATE_DAILY_CAP) : 0n;
    await awardSocial(c, owner);
    return { id,code,levelNumber:number,awardedMilli:reward.toString() };
  }));
  app.patch('/v1/grids/:id', { preHandler: ready, schema: { params: idParams, body: objectSchema({ operationId: operationSchema, hidden: { type: 'boolean' } }) } }, req => write(req, 'grid-update', async c => {
    const result = await c.query('UPDATE grids SET hidden=$1 WHERE id=$2 AND owner_id=$3 AND NOT moderated RETURNING id',[(req.body as any).hidden,(req.params as any).id,user(req)]);
    requireValue(result.rowCount,'NOT_FOUND','Puzzle unavailable or cannot be changed.',404);
    return { accepted:true };
  }));
  app.get('/v1/grids/code/:code', { preHandler: ready, schema: { params: objectSchema({ code: { type: 'string', pattern: '^[A-Fa-f0-9]{16}$' } }) } }, async req => {
    const grid = (await db.query(`${gridSelect} WHERE g.code=$1 AND ${publishedVisible}`, [(req.params as any).code.toUpperCase()])).rows[0];
    requireValue(grid, 'NOT_FOUND', 'Published grid not found.', 404); return { grid: { ...grid, ...(await socialFields(db, user(req), grid.id)) } };
  });
  app.post('/v1/grids/:id/sessions', { preHandler: ready, schema: { params: idParams, body: objectSchema({ operationId: operationSchema }) } }, req => write(req, 'session', async c => {
    const g = (await c.query(`${gridSelect} WHERE g.id=$1 AND ${publishedVisible}`, [(req.params as any).id])).rows[0];
    requireValue(g, 'NOT_FOUND', 'Grid unavailable.', 404);
    const id = randomUUID(); await c.query('INSERT INTO play_sessions(id,user_id,grid_id) VALUES($1,$2,$3)', [id, user(req), g.id]);
    return { sessionId: id, grid: { ...g, ...(await socialFields(c, user(req), g.id)) } };
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
    levelId: { type: 'integer', minimum: 1, maximum: campaign.length }, sessionId: uuidSchema, attemptId: uuidSchema, path: pathSchema, debug: { type: 'boolean', default: false },
    day: daySchema }, ['operationId', 'kind', 'path']) } }, async req => {
    const b = req.body as any;
    requireValue(!b.debug, 'DEBUG_ACTIVITY', 'Debug activity cannot earn XP.');
    requireValue(b.kind === 'campaign' ? !!b.levelId && !b.sessionId : !!b.sessionId && !b.levelId, 'INVALID_PUZZLE', 'Choose one campaign level or community session.');
    const g = b.kind === 'community' ? await sessionGrid(db, user(req), b.sessionId) : null;
    const p: Puzzle = g ? puzzle(g) : campaign[b.levelId - 1]!;
    replay(p, b.path); const hash = contentHash(p);
    return write(req, 'complete', async c => {
      // Any solve keeps the daily streak going, dated by the player's own calendar.
      await c.query('INSERT INTO activity_days(user_id,day) VALUES($1,$2) ON CONFLICT DO NOTHING', [user(req), acceptedDay(b.day)]);
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
      await awardSocial(c, user(req));
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
