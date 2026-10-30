import type { FastifyInstance } from 'fastify';
import type { PoolClient } from 'pg';
import { authentication, objectSchema } from './auth.js';
import { campaign } from './campaign.js';
import type { Config } from './config.js';
import type { Db } from './db.js';
import { contentHash, requireValue } from './rules.js';
import { progression } from './progression.js';

export const searchPattern = (query: string) => `%${query.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_')}%`;
const campaignHashes = JSON.stringify(campaign.map((p, i) => ({ level_id: i + 1, hash: contentHash(p) })));

const periodUnits: Record<string, string> = { today: 'day', week: 'week', month: 'month', year: 'year' };

/**
 * Creator rows with the same public publication counts and campaign/community overlap rules as individual profiles.
 * [follower] limits the rows to people that account follows, [followee] to people following that account (with or without public puzzles); [period] limits counted likes.
 */
async function creatorRows(db: Db, o: { query: string; sort: string; period: string; page: number; follower?: string; followee?: string }) {
  const unit = periodUnits[o.period];
  const likedSince = unit ? `AND l.created_at >= (date_trunc('${unit}',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')` : '';
  const order = o.sort === 'designed' ? '"gridCount" DESC,xp DESC' : o.sort === 'played' ? '"beatenCount" DESC,xp DESC'
    : o.sort === 'liked' ? '"likeCount" DESC,xp DESC' : 'xp DESC';
  const join = o.follower ? 'JOIN follows f ON f.followee_id=u.id AND f.follower_id=$4 LEFT JOIN publications p ON p.owner_id=u.id'
    : o.followee ? 'JOIN follows f ON f.follower_id=u.id AND f.followee_id=$4 LEFT JOIN publications p ON p.owner_id=u.id' : 'JOIN publications p ON p.owner_id=u.id';
  const related = o.follower ?? o.followee;
  return (await db.query(`WITH
      campaign_hashes AS (SELECT * FROM json_to_recordset($1::json) AS x(level_id int,hash text)),
      public_grids AS (SELECT g.id,g.owner_id FROM grids g
        WHERE g.published_at IS NOT NULL AND NOT g.hidden AND NOT g.moderated),
      publications AS (SELECT owner_id,count(*)::int AS "gridCount" FROM public_grids GROUP BY owner_id),
      likes AS (SELECT pg.owner_id,count(*)::int AS n FROM grid_likes l JOIN public_grids pg ON pg.id=l.grid_id WHERE true ${likedSince} GROUP BY pg.owner_id),
      xp_totals AS (SELECT user_id,sum(amount) AS xp FROM xp_ledger GROUP BY user_id),
      campaign_totals AS (SELECT user_id,count(*)::int AS n FROM campaign_progress GROUP BY user_id),
      community_totals AS (SELECT gc.user_id,count(DISTINCT g.content_hash)::int AS n FROM grid_completions gc JOIN grids g ON g.id=gc.grid_id
        WHERE g.owner_id<>gc.user_id AND NOT EXISTS (SELECT 1 FROM campaign_progress cp JOIN campaign_hashes ch ON ch.level_id=cp.level_id
          WHERE cp.user_id=gc.user_id AND ch.hash=g.content_hash) GROUP BY gc.user_id)
      SELECT u.id,u.username,coalesce(p."gridCount",0)::int AS "gridCount",coalesce(x.xp,0)::text AS "xpMilli",coalesce(x.xp,0) AS xp,
        (coalesce(c.n,0)+coalesce(t.n,0))::int AS "beatenCount",coalesce(lk.n,0)::int AS "likeCount"
      FROM users u ${join} LEFT JOIN xp_totals x ON x.user_id=u.id
      LEFT JOIN campaign_totals c ON c.user_id=u.id LEFT JOIN community_totals t ON t.user_id=u.id LEFT JOIN likes lk ON lk.owner_id=u.id
      WHERE NOT u.suspended AND u.username ILIKE $2 ORDER BY ${order},u.id ASC LIMIT 25 OFFSET $3`,
    [campaignHashes, searchPattern(o.query), o.page * 24, ...(related ? [related] : [])])).rows
    .map(({ xp, ...row }) => ({ ...row, ...progression(BigInt(row.xpMilli)) }));
}

export async function creators(app: FastifyInstance, db: Db, config: Config) {
  app.get('/v1/creators', { preHandler: authentication(db, config), schema: { querystring: objectSchema({
    query: { type: 'string', maxLength: 80, default: '' },
    sort: { type: 'string', enum: ['level', 'designed', 'played', 'liked'], default: 'level' },
    period: { type: 'string', enum: ['all', 'today', 'week', 'month', 'year'], default: 'all' },
    page: { type: 'integer', minimum: 0, maximum: 100000, default: 0 },
  }, []) } }, async req => {
    const q = req.query as { query: string; sort: string; period: string; page: number };
    const rows = await creatorRows(db, q);
    return { items: rows.slice(0, 24), nextPage: rows.length > 24 ? q.page + 1 : null };
  });
  // Only the signed-in player's own lists: whom they follow, and who follows them. Nobody can see someone else's.
  const pageOnly = { querystring: objectSchema({ page: { type: 'integer', minimum: 0, maximum: 100000, default: 0 } }, []) };
  for (const [path, side] of [['/v1/following', 'follower'], ['/v1/followers', 'followee']] as const)
    app.get(path, { preHandler: authentication(db, config), schema: pageOnly }, async req => {
      const page = (req.query as { page: number }).page;
      const rows = await creatorRows(db, { query: '', sort: 'level', period: 'all', page, [side]: req.account!.id });
      return { items: rows.slice(0, 24), nextPage: rows.length > 24 ? page + 1 : null };
    });
}

/** Called under operation()'s account lock, so conflicting terminal reports serialize. */
export async function recordAttempt(c: PoolClient, user: string, attempt: string | undefined, session: string, grid: string, outcome: 'solved' | 'failed', reason?: string) {
  if (!attempt) return true; // Older installed clients do not send attempt identities.
  const prior = (await c.query('SELECT * FROM play_attempt_outcomes WHERE user_id=$1 AND attempt_id=$2', [user, attempt])).rows[0];
  if (prior) {
    requireValue(prior.session_id === session && prior.grid_id === grid && prior.outcome === outcome && (outcome !== 'failed' || prior.reason === reason),
      'ATTEMPT_CLOSED', 'This attempt has already ended.', 409);
    return false;
  }
  await c.query('INSERT INTO play_attempt_outcomes(user_id,attempt_id,session_id,grid_id,outcome,reason) VALUES($1,$2,$3,$4,$5,$6)', [user, attempt, session, grid, outcome, reason ?? null]);
  return true;
}
