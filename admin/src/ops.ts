import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import { challenge } from '../../server/src/mail.js';
import { claimNickname, nickname } from '../../server/src/nickname.js';
import { progression } from '../../server/src/progression.js';
import { transaction, type Db } from '../../server/src/db.js';
import { requireValue } from '../../server/src/rules.js';

type Q = Pick<PoolClient, 'query'>;
export type Status = 'active' | 'suspended' | 'deleted';
export const ENTITLEMENT_STATUSES = ['none', 'active', 'revoked', 'refunded'] as const;

/** One row in the audit trail. `detail` carries field names and outcomes only: never bodies, emails, passwords or tokens. */
export async function audit(q: Q, adminId: string | null, action: string, subject: string | null, reason: string | null, detail: object = {}) {
  await q.query('INSERT INTO admin_audit(admin_id,action,subject_user_id,reason,detail) VALUES($1,$2,$3,$4,$5)', [adminId, action, subject, reason, JSON.stringify(detail)]);
}

/** A retried or double-clicked action returns its first response instead of running twice; reusing an ID for different input is a 409. */
export async function adminOperation<T>(db: Db, adminId: string, operationId: string, kind: string, input: unknown, fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const payloadHash = createHash('sha256').update(JSON.stringify(input)).digest('hex');
  return transaction(db, async c => {
    await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`admin-op:${adminId}:${operationId}`]);
    const existing = (await c.query('SELECT kind,payload_hash,response FROM admin_operations WHERE admin_id=$1 AND id=$2', [adminId, operationId])).rows[0];
    if (existing) {
      requireValue(existing.kind === kind && existing.payload_hash === payloadHash, 'OPERATION_REUSED', 'Use a new operation ID for a different request.', 409);
      return existing.response as T;
    }
    const response = await fn(c);
    await c.query('INSERT INTO admin_operations(admin_id,id,kind,payload_hash,response) VALUES($1,$2,$3,$4,$5)', [adminId, operationId, kind, payloadHash, JSON.stringify(response)]);
    return response;
  });
}

const statusOf = (u: { suspended: boolean; deleted_at: Date | null }): Status => (u.deleted_at ? 'deleted' : u.suspended ? 'suspended' : 'active');

/**
 * Every player write holds pg_advisory_xact_lock(hashtextextended(<account id>,0)) (db.ts), and a solve also locks the level's owner. Taking the same lock first
 * makes an admin action wait for in-flight player work instead of deadlocking with it or deleting a completion that was never retained. The key is the id as the
 * database spells it (lowercase), not the route parameter.
 */
async function lockUser(c: Q, id: string) {
  const found = (await c.query('SELECT id::text AS id FROM users WHERE id=$1', [id])).rows[0];
  requireValue(found, 'NOT_FOUND', 'Player not found.', 404);
  await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [found.id]);
  const user = (await c.query('SELECT * FROM users WHERE id=$1 FOR UPDATE', [id])).rows[0];
  requireValue(user, 'NOT_FOUND', 'Player not found.', 404);
  return user;
}
const revokeSessions = (c: Q, id: string) => c.query('UPDATE sessions SET revoked=true WHERE user_id=$1 AND NOT revoked', [id]);

// ---- reads -----------------------------------------------------------------------------------------------------------------------------

const likeEscape = (s: string) => s.replace(/[\\%_]/g, m => `\\${m}`);
export async function listUsers(db: Db, f: { q?: string; status?: Status; limit: number; offset: number }) {
  const where: string[] = []; const args: unknown[] = [];
  if (f.q) {
    args.push(`%${likeEscape(f.q.trim())}%`, f.q.trim());
    where.push(`(u.email ILIKE $${args.length - 1} OR u.username ILIKE $${args.length - 1} OR u.id::text=$${args.length})`);
  }
  if (f.status === 'active') where.push('NOT u.suspended');
  if (f.status === 'suspended') where.push('u.suspended AND u.deleted_at IS NULL');
  if (f.status === 'deleted') where.push('u.deleted_at IS NOT NULL');
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = (await db.query(`SELECT count(*)::int AS n FROM users u ${clause}`, args)).rows[0].n as number;
  const rows = (await db.query(`SELECT u.id,u.email,u.username,u.suspended,u.deleted_at,u.deleted_by,u.created_at,(u.google_sub IS NOT NULL) AS google,
      (SELECT status FROM entitlements e WHERE e.user_id=u.id AND e.product='worlds') AS worlds
    FROM users u ${clause} ORDER BY u.created_at DESC,u.id LIMIT $${args.length + 1} OFFSET $${args.length + 2}`, [...args, f.limit, f.offset])).rows;
  return { total, users: rows.map(r => ({ ...r, status: statusOf(r), worlds: r.worlds ?? 'none' })) };
}

export async function userDetail(db: Db, id: string) {
  const u = (await db.query('SELECT id,email,username,verified,suspended,deleted_at,deleted_by,deleted_was_suspended,created_at,(google_sub IS NOT NULL) AS google FROM users WHERE id=$1', [id])).rows[0];
  requireValue(u, 'NOT_FOUND', 'Player not found.', 404);
  const n = (await db.query(`SELECT
      (SELECT coalesce(sum(amount),0)::text FROM xp_ledger WHERE user_id=$1) AS xp,
      (SELECT count(*)::int FROM sessions WHERE user_id=$1 AND NOT revoked AND refresh_until>now()) AS sessions,
      (SELECT count(*)::int FROM campaign_progress WHERE user_id=$1) AS campaign,
      (SELECT count(*)::int FROM grids WHERE owner_id=$1 AND published_at IS NOT NULL) AS published,
      (SELECT count(*)::int FROM (SELECT g.content_hash FROM grid_completions gc JOIN grids g ON g.id=gc.grid_id WHERE gc.user_id=$1 AND g.owner_id<>$1
        UNION SELECT content_hash FROM retained_completions WHERE user_id=$1) h) AS community, -- same distinct-puzzle rule as the app (it also drops puzzles a beaten campaign level already counts)
      (SELECT max(day)::text FROM activity_days WHERE user_id=$1) AS "lastActive",
      (SELECT count(*)::int FROM user_messages WHERE user_id=$1 AND read_at IS NULL) AS "unreadMessages"`, [id])).rows[0];
  const entitlements = (await db.query('SELECT product,status,source,external_ref,note,updated_at FROM entitlements WHERE user_id=$1', [id])).rows;
  const feedback = (await db.query("SELECT id,kind,status,app_version,created_at FROM feedback WHERE user_id=$1 ORDER BY created_at DESC LIMIT 10", [id])).rows;
  const history = (await db.query(`SELECT a.id,a.action,a.reason,a.detail,a.created_at,ad.email AS admin FROM admin_audit a LEFT JOIN admins ad ON ad.id=a.admin_id
    WHERE a.subject_user_id=$1 ORDER BY a.id DESC LIMIT 30`, [id])).rows;
  const level = progression(BigInt(n.xp)).level;
  return { ...u, status: statusOf(u), stats: { ...n, xp: Number(BigInt(n.xp) / 1000n), level }, entitlements, feedback, history };
}

export async function auditLog(db: Db, f: { subject?: string; action?: string; limit: number; offset: number }) {
  const where: string[] = []; const args: unknown[] = [];
  if (f.subject) { args.push(f.subject); where.push(`a.subject_user_id=$${args.length}`); }
  if (f.action) { args.push(`${likeEscape(f.action)}%`); where.push(`a.action LIKE $${args.length}`); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  return (await db.query(`SELECT a.id,a.action,a.subject_user_id,a.reason,a.detail,a.created_at,ad.email AS admin FROM admin_audit a LEFT JOIN admins ad ON ad.id=a.admin_id
    ${clause} ORDER BY a.id DESC LIMIT $${args.length + 1} OFFSET $${args.length + 2}`, [...args, f.limit, f.offset])).rows;
}

// ---- status changes --------------------------------------------------------------------------------------------------------------------

export async function suspend(c: Q, admin: string, id: string, reason: string) {
  const u = await lockUser(c, id);
  requireValue(!u.deleted_at, 'DELETED', 'This account is deleted. Restore it first.', 409);
  requireValue(!u.suspended, 'ALREADY_SUSPENDED', 'This account is already suspended.', 409);
  await c.query('UPDATE users SET suspended=true WHERE id=$1', [id]);
  await revokeSessions(c, id);
  await audit(c, admin, 'user.suspend', id, reason);
  return { ok: true };
}
export async function unsuspend(c: Q, admin: string, id: string, reason: string) {
  const u = await lockUser(c, id);
  requireValue(!u.deleted_at, 'DELETED', 'This account is deleted. Restore it instead.', 409);
  requireValue(u.suspended, 'NOT_SUSPENDED', 'This account is not suspended.', 409);
  await c.query('UPDATE users SET suspended=false WHERE id=$1', [id]);
  await audit(c, admin, 'user.unsuspend', id, reason);
  return { ok: true };
}
/** Restorable removal: suspended + deleted_at, so every existing "NOT suspended" check in the player API already hides and blocks the account. */
export async function softDelete(c: Q, admin: string, id: string, reason: string) {
  const u = await lockUser(c, id);
  requireValue(!u.deleted_at, 'ALREADY_DELETED', 'This account is already deleted.', 409);
  await c.query("UPDATE users SET deleted_at=now(), deleted_by='admin', deleted_was_suspended=suspended, suspended=true WHERE id=$1", [id]);
  await revokeSessions(c, id);
  await audit(c, admin, 'user.soft_delete', id, reason, { wasSuspended: u.suspended });
  return { ok: true };
}
export async function restore(c: Q, admin: string, id: string, reason: string) {
  const u = await lockUser(c, id);
  requireValue(u.deleted_at, 'NOT_DELETED', 'This account is not deleted.', 409);
  await c.query('UPDATE users SET suspended=coalesce(deleted_was_suspended,false), deleted_at=NULL, deleted_by=NULL, deleted_was_suspended=NULL WHERE id=$1', [id]);
  await audit(c, admin, 'user.restore', id, reason, { staysSuspended: !!u.deleted_was_suspended });
  return { ok: true };
}
export async function signOutEverywhere(c: Q, admin: string, id: string, reason: string) {
  await lockUser(c, id);
  const r = await revokeSessions(c, id);
  await audit(c, admin, 'user.revoke_sessions', id, reason, { revoked: r.rowCount });
  return { ok: true, revoked: r.rowCount };
}

/**
 * Permanent. The player, their private data and their published levels go (with other players' likes, bookmarks and plays of those levels),
 * but other players keep credit for solving them: each solver's (content_hash) is copied to retained_completions first, and the solved
 * counts (online.ts, discovery.ts) read it. No ON DELETE CASCADE exists on the 20+ foreign keys to users, hence the explicit order.
 */
export async function hardDelete(c: Q, admin: string, id: string, reason: string, confirmUsername: string) {
  const u = await lockUser(c, id);
  requireValue(u.username === confirmUsername.trim(), 'STEP_UP_FAILED', 'Type the exact username to confirm.', 403); // inside the operation, so a retried delete replays instead of 404
  const retained = await c.query(`INSERT INTO retained_completions(user_id,content_hash)
    SELECT DISTINCT gc.user_id,g.content_hash FROM grid_completions gc JOIN grids g ON g.id=gc.grid_id WHERE g.owner_id=$1 AND gc.user_id<>$1 ON CONFLICT DO NOTHING`, [id]);
  const levels = (await c.query('SELECT count(*)::int AS n FROM grids WHERE owner_id=$1', [id])).rows[0].n as number;
  const mine = '(SELECT id FROM grids WHERE owner_id=$1)';
  // Children of the player's levels (any player) and of the player (any level); play_attempt_outcomes points at play_sessions, so it goes first.
  for (const t of ['play_attempt_outcomes', 'play_sessions', 'casual_completions', 'grid_bookmarks', 'grid_likes', 'grid_completions', 'qualifying_plays'])
    await c.query(`DELETE FROM ${t} WHERE grid_id IN ${mine} OR user_id=$1`, [id]);
  await c.query('DELETE FROM grids WHERE owner_id=$1', [id]);
  for (const t of ['activity_days', 'campaign_progress', 'casual_cycles', 'completions', 'imported_badges', 'operations', 'replay_rewards', 'xp_ledger',
    'entitlement_events', 'entitlements', 'user_messages', 'direct_mail', 'retained_completions', 'sessions'])
    await c.query(`DELETE FROM ${t} WHERE user_id=$1`, [id]);
  await c.query('DELETE FROM follows WHERE follower_id=$1 OR followee_id=$1', [id]);
  await c.query('DELETE FROM email_outbox WHERE challenge_id IN (SELECT id FROM challenges WHERE user_id=$1)', [id]);
  await c.query('DELETE FROM challenges WHERE user_id=$1', [id]);
  await c.query('DELETE FROM feedback WHERE user_id=$1', [id]); // free text the player wrote: it goes with them
  await c.query("UPDATE admin_audit SET detail=detail - 'from' - 'to' WHERE subject_user_id=$1 AND action='user.rename'", [id]); // old and new usernames
  // The claim stays so the same puzzle cannot be re-published as an original; it just no longer names a person.
  await c.query('UPDATE content_claims SET creator_id=NULL WHERE creator_id=$1', [id]);
  await c.query('DELETE FROM users WHERE id=$1', [id]);
  // admin_audit.subject_user_id has no foreign key, so this row (and the history before it) survives the delete.
  await audit(c, admin, 'user.hard_delete', id, reason, { levelsDeleted: levels, completionsRetainedForOthers: retained.rowCount });
  return { ok: true, levelsDeleted: levels, completionsRetained: retained.rowCount };
}

// ---- edits -----------------------------------------------------------------------------------------------------------------------------

export async function rename(c: PoolClient, admin: string, id: string, name: string, reason: string) {
  const u = await lockUser(c, id);
  const next = nickname(name);
  await claimNickname(c, next, id);
  await c.query('UPDATE users SET username=$1 WHERE id=$2', [next, id]);
  await audit(c, admin, 'user.rename', id, reason, { from: u.username, to: next }); // usernames are public identifiers
  return { ok: true, username: next };
}
export async function changeEmail(c: Q, admin: string, id: string, email: string, reason: string) {
  await lockUser(c, id);
  const next = email.trim().toLowerCase();
  const taken = await c.query('SELECT 1 FROM users WHERE email=$1 AND id<>$2', [next, id]);
  requireValue(!taken.rowCount, 'EMAIL_TAKEN', 'Another account already uses this email.', 409);
  await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`register:${next}`]); // the lock sign-up takes, so a racing registration cannot hit the unique index
  await c.query('UPDATE users SET email=$1 WHERE id=$2', [next, id]);
  await c.query('UPDATE challenges SET consumed=true WHERE user_id=$1 AND NOT consumed', [id]); // a code queued for the old address stops working
  await revokeSessions(c, id); // whoever was signed in under the old address is signed out
  await audit(c, admin, 'user.change_email', id, reason, { field: 'email' });
  return { ok: true };
}

// ---- payments (manual entitlement; Play / Stripe webhooks will write the same rows) ----------------------------------------------------

export async function setEntitlement(c: Q, admin: string, id: string, status: (typeof ENTITLEMENT_STATUSES)[number], note: string) {
  const u = await lockUser(c, id);
  requireValue(!u.deleted_at, 'DELETED', 'This account is deleted.', 409);
  await c.query(`INSERT INTO entitlements(user_id,product,status,source,note) VALUES($1,'worlds',$2,'manual',$3)
    ON CONFLICT (user_id,product) DO UPDATE SET status=$2,source='manual',external_ref=NULL,note=$3,updated_at=now()`, [id, status, note]);
  await c.query("INSERT INTO entitlement_events(user_id,product,status,source,admin_id,note) VALUES($1,'worlds',$2,'manual',$3,$4)", [id, status, admin, note]);
  await audit(c, admin, 'entitlement.set', id, note, { product: 'worlds', status });
  return { ok: true };
}

// ---- messages --------------------------------------------------------------------------------------------------------------------------

/** Queues a recovery code exactly as the player-facing "Forgot password" does (8 digits, 15 minutes); the caller then drains the outbox. */
export async function sendRecovery(c: Q, admin: string, id: string, key: string, mailEnabled: boolean) {
  const u = await lockUser(c, id);
  requireValue(mailEnabled, 'MAIL_UNAVAILABLE', 'Email delivery is disabled on this server.', 503);
  requireValue(!u.suspended && !u.deleted_at, 'ACCOUNT_BLOCKED', 'Suspended or deleted accounts cannot reset their password.', 409);
  const queued = await challenge(c as PoolClient, id, u.email, 'recover', key);
  requireValue(queued, 'TOO_SOON', 'A code was sent less than a minute ago. Wait a moment and try again.', 429);
  await audit(c, admin, 'user.send_recovery', id, null, { queued });
  return { ok: true, queued };
}
export async function sendMail(c: Q, admin: string, id: string, subject: string, body: string, mailEnabled: boolean) {
  const u = await lockUser(c, id);
  requireValue(mailEnabled, 'MAIL_UNAVAILABLE', 'Email delivery is disabled on this server.', 503);
  requireValue(!u.deleted_at, 'DELETED', 'This account is deleted.', 409);
  const row = (await c.query('INSERT INTO direct_mail(id,user_id,subject,body,created_by) VALUES(gen_random_uuid(),$1,$2,$3,$4) RETURNING id', [id, subject, body, admin])).rows[0];
  await audit(c, admin, 'user.send_email', id, null, { mailId: row.id, subjectLength: subject.length });
  return { ok: true, mailId: row.id as string };
}
export async function sendMessage(c: Q, admin: string, id: string, subject: string, body: string) {
  const u = await lockUser(c, id);
  requireValue(!u.deleted_at, 'DELETED', 'This account is deleted.', 409);
  const row = (await c.query('INSERT INTO user_messages(id,user_id,subject,body,created_by) VALUES(gen_random_uuid(),$1,$2,$3,$4) RETURNING id', [id, subject, body, admin])).rows[0];
  await audit(c, admin, 'user.send_message', id, null, { messageId: row.id, subjectLength: subject.length });
  return { ok: true, messageId: row.id as string };
}
