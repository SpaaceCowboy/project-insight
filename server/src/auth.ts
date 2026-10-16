import { randomInt, randomUUID } from 'node:crypto';
import argon2 from 'argon2';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { PoolClient } from 'pg';
import type { Config } from './config.js';
import { database, transaction, type Db } from './db.js';
import { decrypt, digest, encrypt, token } from './crypto.js';
import { requireValue } from './rules.js';
import { safeName } from './vocabulary.js';

export const uuidSchema = { type: 'string', format: 'uuid' };
export const operationSchema = { ...uuidSchema };
const emailSchema = { type: 'string', minLength: 3, maxLength: 254, pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$' };
const passwordSchema = { type: 'string', minLength: 12, maxLength: 128 };
export function objectSchema(properties: Record<string, unknown>, required = Object.keys(properties)) { return { type: 'object', additionalProperties: false, properties, required }; }
export interface Account { id: string; username: string; verified: boolean; sessionId: string }
declare module 'fastify' { interface FastifyRequest { account?: Account } }
const passwords = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

async function issue(c: PoolClient, userId: string, key: string, id = randomUUID()) {
  const accessToken = token(); const refreshToken = token();
  await c.query(`INSERT INTO sessions(id,user_id,access_hash,refresh_hash,access_until,refresh_until)
    VALUES($1,$2,$3,$4,now()+interval '15 minutes',now()+interval '30 days')`, [id, userId, digest(accessToken, key), digest(refreshToken, key)]);
  const user = (await c.query('SELECT id,username,verified FROM users WHERE id=$1', [userId])).rows[0];
  return { accessToken, refreshToken, user };
}
async function challenge(c: PoolClient, userId: string, email: string, purpose: 'verify' | 'recover', key: string) {
  const recent = (await c.query("SELECT 1 FROM challenges WHERE user_id=$1 AND purpose=$2 AND created_at>now()-interval '1 minute'", [userId, purpose])).rowCount;
  if (recent) return;
  await c.query('UPDATE challenges SET consumed=true WHERE user_id=$1 AND purpose=$2', [userId, purpose]);
  const id = randomUUID(); const code = String(randomInt(10000000, 100000000));
  await c.query("INSERT INTO challenges(id,user_id,purpose,code_hash,expires_at) VALUES($1,$2,$3,$4,now()+interval '15 minutes')", [id, userId, purpose, digest(`${id}:${code}`, key)]);
  await c.query('INSERT INTO email_outbox(id,challenge_id,encrypted_payload) VALUES($1,$2,$3)', [randomUUID(), id, encrypt({ email, code, purpose }, key)]);
}
export function authentication(db: Db, config: Config) {
  return async (req: FastifyRequest) => {
    const bearer = req.headers.authorization?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];
    requireValue(bearer, 'AUTH_REQUIRED', 'Please log in.', 401);
    const row = (await db.query(`SELECT u.id,u.username,u.verified,s.id AS session_id FROM sessions s JOIN users u ON u.id=s.user_id
      WHERE access_hash=$1 AND access_until>now() AND refresh_until>now() AND NOT revoked AND NOT suspended`, [digest(bearer, config.encryptionKey)])).rows[0];
    requireValue(row, 'AUTH_REQUIRED', 'Please log in again.', 401);
    req.account = { id: row.id, username: row.username, verified: row.verified, sessionId: row.session_id };
  };
}
export async function verified(req: FastifyRequest) { requireValue(req.account?.verified, 'VERIFY_REQUIRED', 'Verify your email to use Online.', 403); }

export async function authRoutes(app: FastifyInstance, db: Db, config: Config) {
  const auth = authentication(db, config); const key = config.encryptionKey;
  // A dummy hash keeps absent-account logins on the same expensive verification path.
  const dummyHash = await argon2.hash(token(), passwords);
  const limited = { rateLimit: { max: 8, timeWindow: '15 minutes' } };
  app.post('/v1/auth/register', { config: limited, schema: { body: objectSchema({ email: emailSchema, password: passwordSchema, name: { type: 'string' }, invite: { type: 'string', minLength: 8, maxLength: 128 } }) } }, async req => {
    const b = req.body as any; const email = b.email.trim().toLowerCase(); const name = safeName(b.name);
    const passwordHash = await argon2.hash(b.password, passwords);
    await transaction(db, async c => {
      // Serializes duplicate registration without disclosing whether the address already exists.
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`register:${email}`]);
      const invitation = await c.query('SELECT hash,remaining FROM invitations WHERE hash=$1 FOR UPDATE', [digest(b.invite, key)]);
      requireValue(invitation.rowCount, 'INVITE_REQUIRED', 'A valid test invitation is required.', 403);
      if ((await c.query('SELECT id FROM users WHERE email=$1', [email])).rowCount) return;
      requireValue(invitation.rows[0].remaining > 0, 'INVITE_REQUIRED', 'A valid test invitation is required.', 403);
      let username = '';
      for (let i = 0; i < 100; i++) {
        username = `${name} #${String(randomInt(10000)).padStart(4, '0')}`;
        await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`username:${username}`]);
        if (!(await c.query('SELECT 1 FROM users WHERE username=$1', [username])).rowCount) break;
        username = '';
      }
      requireValue(username, 'NAME_BUSY', 'Please try another name.', 409);
      const id = randomUUID();
      await c.query('INSERT INTO users(id,email,password_hash,username) VALUES($1,$2,$3,$4)', [id, email, passwordHash, username]);
      await c.query('UPDATE invitations SET remaining=remaining-1 WHERE hash=$1', [digest(b.invite, key)]);
      await challenge(c, id, email, 'verify', key);
    });
    return { accepted: true, message: 'If registration is available, a verification code has been queued.' };
  });
  app.post('/v1/auth/login', { config: limited, schema: { body: objectSchema({ email: emailSchema, password: { type: 'string', minLength: 1, maxLength: 128 } }) } }, async req => {
    const b = req.body as any;
    return transaction(db, async c => {
      // Password reset and login serialize on the account row: old credentials cannot issue a post-reset session.
      const user = (await c.query('SELECT * FROM users WHERE email=$1 FOR UPDATE', [b.email.trim().toLowerCase()])).rows[0];
      const valid = await argon2.verify(user?.password_hash ?? dummyHash, b.password);
      requireValue(user && valid && !user.suspended, 'LOGIN_FAILED', 'Email or password is incorrect.', 401);
      return issue(c, user.id, key);
    });
  });
  for (const purpose of ['verify', 'recover'] as const) {
    app.post(`/v1/auth/${purpose}/request`, { config: limited, schema: { body: objectSchema({ email: emailSchema }) } }, async req => {
      const email = (req.body as any).email.trim().toLowerCase();
      await transaction(db, async c => {
        await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`challenge:${email}`]);
        const user = (await c.query('SELECT * FROM users WHERE email=$1', [email])).rows[0];
        if (user && !user.suspended && (purpose !== 'verify' || !user.verified)) await challenge(c, user.id, email, purpose, key);
      });
      return { accepted: true, message: 'If eligible, an email code has been queued.' };
    });
    app.post(`/v1/auth/${purpose}/confirm`, { config: limited, schema: { body: objectSchema({ email: emailSchema, code: { type: 'string', pattern: '^[0-9]{8}$' }, ...(purpose === 'recover' ? { password: passwordSchema } : {}) }) } }, async req => {
      const b = req.body as any;
      const passwordHash = purpose === 'recover' ? await argon2.hash(b.password, passwords) : null;
      // Wrong-code attempts must COMMIT, rather than being rolled back with the error response.
      const accepted = await transaction(db, async c => {
        const user = (await c.query('SELECT * FROM users WHERE email=$1', [b.email.trim().toLowerCase()])).rows[0];
        if (!user || user.suspended) return false;
        const ch = (await c.query(`SELECT * FROM challenges WHERE user_id=$1 AND purpose=$2 AND NOT consumed AND expires_at>now()
          ORDER BY created_at DESC LIMIT 1 FOR UPDATE`, [user.id, purpose])).rows[0];
        if (!ch || ch.attempts >= 5) return false;
        await c.query('UPDATE challenges SET attempts=attempts+1 WHERE id=$1', [ch.id]);
        if (ch.code_hash !== digest(`${ch.id}:${b.code}`, key)) return false;
        await c.query('UPDATE challenges SET consumed=true WHERE id=$1', [ch.id]);
        if (purpose === 'verify') await c.query('UPDATE users SET verified=true WHERE id=$1', [user.id]);
        else {
          await c.query('UPDATE users SET password_hash=$1 WHERE id=$2', [passwordHash, user.id]);
          await c.query('UPDATE sessions SET revoked=true WHERE user_id=$1', [user.id]);
        }
        return true;
      });
      requireValue(accepted, 'INVALID_CODE', 'The code is invalid, expired, or has too many attempts.');
      return { accepted: true };
    });
  }
  app.post('/v1/auth/refresh', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } }, schema: { body: objectSchema({ refreshToken: { type: 'string', minLength: 43, maxLength: 43 }, operationId: operationSchema }) } }, async req => {
    const b = req.body as any;
    const result = await transaction(db, async c => {
      const hash = digest(b.refreshToken, key);
      const s = (await c.query(`SELECT s.*,u.suspended FROM sessions s JOIN users u ON u.id=s.user_id
        WHERE (refresh_hash=$1 OR previous_refresh_hash=$1) FOR UPDATE OF s`, [hash])).rows[0];
      if (!s || s.revoked || s.suspended || new Date(s.refresh_until).getTime() <= Date.now()) return null;
      if (s.previous_refresh_hash === hash) {
        if (s.refresh_operation === b.operationId && Date.now() - new Date(s.rotated_at).getTime() < 120000) return decrypt(s.refresh_response, key);
        await c.query('UPDATE sessions SET revoked=true WHERE id=$1', [s.id]);
        return null;
      }
      const accessToken = token(); const refreshToken = token();
      const user = (await c.query('SELECT id,username,verified FROM users WHERE id=$1', [s.user_id])).rows[0];
      const response = { accessToken, refreshToken, user };
      await c.query(`UPDATE sessions SET access_hash=$1,refresh_hash=$2,access_until=now()+interval '15 minutes',
        previous_refresh_hash=$3,refresh_operation=$4,refresh_response=$5,rotated_at=now() WHERE id=$6`,
      [digest(accessToken, key), digest(refreshToken, key), hash, b.operationId, encrypt(response, key), s.id]);
      return response;
    });
    requireValue(result, 'AUTH_REQUIRED', 'Please log in again.', 401);
    return result;
  });
  app.post('/v1/auth/logout', { preHandler: auth }, async req => {
    await db.query('UPDATE sessions SET revoked=true WHERE id=$1', [req.account!.sessionId]);
    return { accepted: true };
  });
  app.get('/v1/account', { preHandler: auth }, async req => ({ user: req.account }));
}
