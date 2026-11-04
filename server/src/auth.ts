import { randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import argon2 from 'argon2';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { PoolClient } from 'pg';
import type { Config } from './config.js';
import { operation, transaction, type Db } from './db.js';
import { decrypt, digest, encrypt, token } from './crypto.js';
import { requireValue } from './rules.js';
import { claimNickname, nickname, suggestedName } from './nickname.js';
import type { GoogleVerifier } from './google.js';
import { googleVerifier } from './google.js';
import { deliverMail } from './mail.js';

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
/** Queues one recoverable code, replacing any earlier one. Returns false when a code was sent less than a minute ago. */
async function challenge(c: PoolClient, userId: string, email: string, purpose: 'recover', key: string) {
  const recent = (await c.query("SELECT 1 FROM challenges WHERE user_id=$1 AND purpose=$2 AND created_at>now()-interval '1 minute'", [userId, purpose])).rowCount;
  if (recent) return false;
  await c.query('UPDATE challenges SET consumed=true WHERE user_id=$1 AND purpose=$2', [userId, purpose]);
  const id = randomUUID(); const code = String(randomInt(10000000, 100000000));
  await c.query("INSERT INTO challenges(id,user_id,purpose,code_hash,expires_at) VALUES($1,$2,$3,$4,now()+interval '15 minutes')", [id, userId, purpose, digest(`${id}:${code}`, key)]);
  await c.query('INSERT INTO email_outbox(id,challenge_id,encrypted_payload) VALUES($1,$2,$3)', [randomUUID(), id, encrypt({ email, code, purpose }, key)]);
  return true;
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


export async function authRoutes(app: FastifyInstance, db: Db, config: Config, google?: GoogleVerifier) {
  const auth = authentication(db, config); const key = config.encryptionKey;
  const verifyGoogle = google ?? (config.googleClientId ? googleVerifier(config.googleClientId) : undefined);
  // A dummy hash keeps absent-account logins on the same expensive verification path.
  const dummyHash = await argon2.hash(token(), passwords);
  // Google-only accounts still carry a password hash, but of a random token that is never stored: password login stays impossible until a reset.
  const googleOnlyHash = await argon2.hash(token(), passwords);
  const limited = { rateLimit: { max: 8, timeWindow: '15 minutes' } };
  const mailEnabled = config.mailDeliveryMode !== 'disabled';
  const drainMail = async () => {
    if (!mailEnabled || config.environment === 'test') return;
    try { while (await deliverMail(db, config, app.log)); } catch { app.log.warn('mail delivery failed'); }
  };
  // Retries anything the mail server refused or that was waiting when the process restarted.
  if (mailEnabled && config.environment !== 'test') {
    const timer = setInterval(() => void drainMail(), 60000); timer.unref();
    app.addHook('onClose', async () => clearInterval(timer));
  }
  // Registration needs only an email, password and unique username.
  app.post('/v1/auth/register', { config: limited, schema: { body: objectSchema({ email: emailSchema, password: passwordSchema, name: { type: 'string', minLength: 1, maxLength: 128 } }, ['email', 'password', 'name']) } }, async req => {
    const b = req.body as any; const email = b.email.trim().toLowerCase(); const name = nickname(b.name);
    const passwordHash = await argon2.hash(b.password, passwords);
    return transaction(db, async c => {
      // Serialize duplicate registrations and return an actionable conflict.
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`register:${email}`]);
      requireValue(!(await c.query('SELECT id FROM users WHERE email=$1', [email])).rowCount, 'EMAIL_TAKEN', 'An account with this email already exists. Please log in or reset your password.', 409);
      await claimNickname(c, name);
      const id = randomUUID();
      await c.query('INSERT INTO users(id,email,password_hash,username,verified) VALUES($1,$2,$3,$4,true)', [id, email, passwordHash, name]);
      return issue(c, id, key);
    });
  });
  app.post('/v1/auth/login', { config: limited, schema: { body: objectSchema({ email: emailSchema, password: { type: 'string', minLength: 1, maxLength: 128 } }) } }, async req => {
    const b = req.body as any;
    return transaction(db, async c => {
      // Serialize credential checks on the account row.
      const user = (await c.query('SELECT * FROM users WHERE email=$1 FOR UPDATE', [b.email.trim().toLowerCase()])).rows[0];
      const valid = await argon2.verify(user?.password_hash ?? dummyHash, b.password);
      requireValue(user && valid && !user.suspended, 'LOGIN_FAILED', 'Email or password is incorrect.', 401);
      return issue(c, user.id, key);
    });
  });
  app.post('/v1/auth/google', { config: limited, schema: { body: objectSchema({
    idToken: { type: 'string', minLength: 20, maxLength: 8192 }, name: { type: 'string', minLength: 1, maxLength: 128 },
  }, ['idToken']) } }, async req => {
    requireValue(verifyGoogle, 'GOOGLE_UNAVAILABLE', 'Google sign-in is unavailable right now.', 503);
    const b = req.body as any;
    const profile = await verifyGoogle!(b.idToken);
    return transaction(db, async c => {
      // Serialize the Google identity and the email claim, in a stable order.
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`google:${profile.sub}`]);
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`register:${profile.email}`]);
      let user = (await c.query('SELECT * FROM users WHERE google_sub=$1 FOR UPDATE', [profile.sub])).rows[0];
      if (!user) user = (await c.query('SELECT * FROM users WHERE email=$1 FOR UPDATE', [profile.email])).rows[0];
      if (user) {
        requireValue(!user.suspended, 'LOGIN_FAILED', 'This account cannot be used.', 401);
        // A verified Google email proves ownership of an existing password account, so the two sign-in methods share it.
        requireValue(!user.google_sub || user.google_sub === profile.sub, 'GOOGLE_LINK_CONFLICT', 'This email is already linked to another Google account.', 409);
        if (!user.google_sub) await c.query('UPDATE users SET google_sub=$1, verified=true WHERE id=$2', [profile.sub, user.id]);
        return issue(c, user.id, key);
      }
      // A new public identity is chosen by the player, not taken from the Google profile without consent.
      if (!b.name) return { needsName: true, suggestedName: suggestedName(profile.name) };
      const name = nickname(b.name);
      await claimNickname(c, name);
      const id = randomUUID();
      await c.query('INSERT INTO users(id,email,password_hash,username,verified,google_sub) VALUES($1,$2,$3,$4,true,$5)',
        [id, profile.email, googleOnlyHash, name, profile.sub]);
      return issue(c, id, key);
    });
  });
  app.post('/v1/auth/recover/request', { config: limited, schema: { body: objectSchema({ email: emailSchema }) } }, async req => {
    requireValue(mailEnabled, 'MAIL_UNAVAILABLE', "Password reset by email isn't available right now.", 503);
    const email = (req.body as any).email.trim().toLowerCase();
    let queued = false;
    await transaction(db, async c => {
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`recover:${email}`]);
      const user = (await c.query('SELECT id,suspended FROM users WHERE email=$1', [email])).rows[0];
      if (user && !user.suspended) queued = await challenge(c, user.id, email, 'recover', key);
    });
    if (queued) void drainMail();
    // The same answer for every address, so the form cannot be used to discover accounts.
    return { accepted: true };
  });
  app.post('/v1/auth/recover/confirm', { config: { rateLimit: { max: 12, timeWindow: '15 minutes' } }, schema: { body: objectSchema({
    email: emailSchema, code: { type: 'string', pattern: '^[0-9]{8}$' }, password: passwordSchema,
  }, ['email', 'code', 'password']) } }, async req => {
    const b = req.body as any;
    // Hashing before the lookup keeps missing and existing addresses on similar work.
    const passwordHash = await argon2.hash(b.password, passwords);
    const result = await transaction(db, async c => {
      const user = (await c.query('SELECT * FROM users WHERE email=$1 FOR UPDATE', [b.email.trim().toLowerCase()])).rows[0];
      if (!user || user.suspended) return null;
      const ch = (await c.query(`SELECT * FROM challenges WHERE user_id=$1 AND purpose='recover' AND NOT consumed AND expires_at>now()
        ORDER BY created_at DESC LIMIT 1 FOR UPDATE`, [user.id])).rows[0];
      if (!ch || ch.attempts >= 5) return null;
      const attempt = ch.attempts + 1;
      await c.query('UPDATE challenges SET attempts=$1 WHERE id=$2', [attempt, ch.id]);
      const expected = digest(`${ch.id}:${b.code}`, key);
      if (expected.length !== ch.code_hash.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(ch.code_hash))) {
        // Wrong-code attempts COMMIT, so five guesses exhaust the code instead of being rolled back.
        if (attempt >= 5) await c.query('UPDATE challenges SET consumed=true WHERE id=$1', [ch.id]);
        return null;
      }
      await c.query("UPDATE challenges SET consumed=true WHERE user_id=$1 AND purpose='recover' AND NOT consumed", [user.id]);
      await c.query('UPDATE users SET password_hash=$1, verified=true WHERE id=$2', [passwordHash, user.id]);
      // A reset signs every old device out, then this request starts a fresh session.
      await c.query('UPDATE sessions SET revoked=true WHERE user_id=$1', [user.id]);
      return issue(c, user.id, key);
    });
    requireValue(result, 'INVALID_CODE', 'The code is invalid, expired, or has too many attempts.');
    return result;
  });
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
  app.patch('/v1/account/name', { preHandler: auth, schema: { body: objectSchema({ operationId: operationSchema, name: { type: 'string', minLength: 1, maxLength: 128 } }) } }, async req => {
    const b = req.body as any; const name = nickname(b.name);
    return operation(db, req.account!.id, b.operationId, 'nickname', digest(JSON.stringify(b), key), async c => {
      await claimNickname(c, name, req.account!.id);
      await c.query('UPDATE users SET username=$1 WHERE id=$2', [name, req.account!.id]);
      return { accepted: true };
    });
  });
}
