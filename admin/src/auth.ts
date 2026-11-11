import { randomUUID, timingSafeEqual } from 'node:crypto';
import argon2 from 'argon2';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Config } from '../../server/src/config.js';
import { digest, token } from '../../server/src/crypto.js';
import type { Db } from '../../server/src/db.js';
import type { RateLimitStore, RatePolicy } from '../../server/src/rate-store.js';
import { DomainError, requireValue } from '../../server/src/rules.js';
import { audit } from './ops.js';
import { objectSchema } from './schema.js';

// Same cost parameters as the player API (server/src/auth.ts).
const passwordCost = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;
export const MIN_ADMIN_PASSWORD = 14;
export const hashPassword = (password: string) => argon2.hash(password, passwordCost);

const SESSION_HOURS = 8;
const IDLE_MINUTES = 30;
// Per address and per email, so one attacker can neither guess one password forever nor lock out every admin from a single address.
const loginIp: RatePolicy = { capacity: 20, windowMs: 15 * 60_000 };
const loginEmail: RatePolicy = { capacity: 8, windowMs: 15 * 60_000 };

export interface AdminSession { id: string; email: string; sessionId: string; csrf: string }
declare module 'fastify' {
  interface FastifyRequest { admin?: AdminSession; /** Declared by the player API; the shared rate-limit module refers to it. */ account?: { id: string } }
}

export const cookieName = (config: Config) => (config.environment === 'production' ? '__Host-cp' : 'cp');
const csrfFor = (sessionToken: string, key: string) => digest(`csrf:${sessionToken}`, key);
const readCookie = (req: FastifyRequest, name: string) =>
  req.headers.cookie?.split(';').map(p => p.trim().split('=')).find(([n]) => n === name)?.[1];

function setSessionCookie(config: Config, value: string, maxAgeSeconds: number) {
  const prod = config.environment === 'production';
  return `${cookieName(config)}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAgeSeconds}${prod ? '; Secure' : ''}`;
}

async function throttle(store: RateLimitStore, key: string, policy: RatePolicy) {
  const decision = await store.consume(key, policy);
  if (!decision.allowed) throw Object.assign(new DomainError(429, 'RATE_LIMITED', 'Too many attempts. Try again later.'), { retryAfterSeconds: decision.retryAfterSeconds });
}

/** Resolves the session cookie, enforces the idle and absolute limits, and requires the CSRF header on anything that is not a read. */
export function requireAdmin(db: Db, config: Config) {
  return async (req: FastifyRequest) => {
    const value = readCookie(req, cookieName(config));
    requireValue(value && /^[A-Za-z0-9_-]{43}$/.test(value), 'AUTH_REQUIRED', 'Please log in.', 401);
    const row = (await db.query(`SELECT a.id,a.email,s.id AS session_id FROM admin_sessions s JOIN admins a ON a.id=s.admin_id
      WHERE s.token_hash=$1 AND NOT s.revoked AND NOT a.disabled AND s.expires_at>now() AND s.last_seen_at>now()-($2::int * interval '1 minute')`,
    [digest(value, config.encryptionKey), IDLE_MINUTES])).rows[0];
    requireValue(row, 'AUTH_REQUIRED', 'Please log in again.', 401);
    const csrf = csrfFor(value, config.encryptionKey);
    if (req.method !== 'GET') {
      const sent = String(req.headers['x-admin-csrf'] ?? '');
      requireValue(sent.length === csrf.length && timingSafeEqual(Buffer.from(sent), Buffer.from(csrf)), 'CSRF', 'Reload the page and try again.', 403);
    }
    // Touch at most once a minute; the idle window is 30.
    await db.query("UPDATE admin_sessions SET last_seen_at=now() WHERE id=$1 AND last_seen_at<now()-interval '1 minute'", [row.session_id]);
    req.admin = { id: row.id, email: row.email, sessionId: row.session_id, csrf };
  };
}

export async function authRoutes(app: FastifyInstance, db: Db, config: Config, store: RateLimitStore) {
  const key = config.encryptionKey;
  const need = requireAdmin(db, config);
  // Unknown emails still pay for one verification, so response time does not reveal which addresses are admins.
  const dummyHash = await hashPassword(token());

  app.post('/api/login', { schema: { body: objectSchema({ email: { type: 'string', maxLength: 254 }, password: { type: 'string', minLength: 1, maxLength: 256 } }) } }, async (req, reply) => {
    const b = req.body as { email: string; password: string };
    const email = b.email.trim().toLowerCase();
    await throttle(store, `admin:login:ip:${req.ip}`, loginIp);
    await throttle(store, `admin:login:email:${digest(email, key)}`, loginEmail);
    const admin = (await db.query('SELECT * FROM admins WHERE email=$1', [email])).rows[0];
    const valid = await argon2.verify(admin?.password_hash ?? dummyHash, b.password);
    if (!admin || !valid || admin.disabled) {
      if (admin) await audit(db, admin.id, 'admin.login_failed', null, null, {});
      throw new DomainError(401, 'LOGIN_FAILED', 'Email or password is incorrect.');
    }
    const sessionToken = token();
    await db.query(`INSERT INTO admin_sessions(id,admin_id,token_hash,expires_at) VALUES($1,$2,$3,now()+($4::int * interval '1 hour'))`,
      [randomUUID(), admin.id, digest(sessionToken, key), SESSION_HOURS]);
    await db.query('UPDATE admins SET last_login_at=now() WHERE id=$1', [admin.id]);
    await audit(db, admin.id, 'admin.login', null, null, {});
    reply.header('Set-Cookie', setSessionCookie(config, sessionToken, SESSION_HOURS * 3600));
    return { email: admin.email, csrf: csrfFor(sessionToken, key) };
  });
  app.get('/api/me', { preHandler: need }, async req => ({ email: req.admin!.email, csrf: req.admin!.csrf }));
  app.post('/api/logout', { preHandler: need }, async (req, reply) => {
    await db.query('UPDATE admin_sessions SET revoked=true WHERE id=$1', [req.admin!.sessionId]);
    reply.header('Set-Cookie', setSessionCookie(config, '', 0));
    return { ok: true };
  });
}
