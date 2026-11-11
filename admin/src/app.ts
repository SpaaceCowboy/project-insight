import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import argon2 from 'argon2';
import Fastify, { type FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import type { Config } from '../../server/src/config.js';
import { digest } from '../../server/src/crypto.js';
import type { Db } from '../../server/src/db.js';
import { deliverMail } from '../../server/src/mail.js';
import { MemoryRateLimitStore, RedisRateLimitStore, type RateLimitStore } from '../../server/src/rate-store.js';
import { DomainError, requireValue } from '../../server/src/rules.js';
import { authRoutes, requireAdmin, throttle } from './auth.js';
import { deliverDirectMail } from './direct-mail.js';
import * as ops from './ops.js';
import { emailSchema, objectSchema, reasonSchema, uuidSchema } from './schema.js';

const op = { operationId: uuidSchema };
const passwordField = { type: 'string', minLength: 1, maxLength: 256 };
const idParams = { type: 'object', properties: { id: uuidSchema }, required: ['id'] };

export async function buildAdminApp(db: Db, config: Config, logging = true, suppliedStore?: RateLimitStore, mailTransport?: { sendMail(m: object): Promise<any> }) {
  const app = Fastify({ logger: logging ? { level: 'info', serializers: { req: r => ({ method: r.method, route: r.routeOptions?.url }), res: r => ({ statusCode: r.statusCode }),
    err: e => ({ type: e.name, code: e.code, message: 'redacted', stack: '' }) }, redact: ['req.headers', 'body', 'password', 'email', 'token'] } : false,
  // Raw URLs carry player IDs and search text (emails); log route templates and correlation IDs only.
  disableRequestLogging: true, bodyLimit: 64 * 1024, trustProxy: config.trustProxy, requestTimeout: 20000 });
  app.addHook('onResponse', async (req, reply) => { app.log.info({ correlationId: req.id, method: req.method, route: req.routeOptions.url, status: reply.statusCode, latencyMs: reply.elapsedTime }, 'request completed'); });
  app.addHook('onSend', async (req, reply, payload) => {
    reply.header('X-Correlation-ID', req.id).header('X-Content-Type-Options', 'nosniff').header('Referrer-Policy', 'no-referrer').header('X-Robots-Tag', 'noindex, nofollow')
      .header('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    if (req.url.startsWith('/api/')) reply.header('Cache-Control', 'no-store');
    return payload;
  });
  app.setErrorHandler((error: any, req, reply) => {
    if (error instanceof DomainError) {
      if (error.statusCode === 429 && (error as any).retryAfterSeconds) reply.header('Retry-After', (error as any).retryAfterSeconds);
      return reply.code(error.statusCode).send({ code: error.code, message: error.message, correlationId: req.id });
    }
    if (error.validation) return reply.code(400).send({ code: 'INVALID_REQUEST', message: 'Check the supplied fields.', correlationId: req.id });
    if ([400, 404, 405, 413, 415].includes(error.statusCode)) return reply.code(error.statusCode).send({ code: 'INVALID_REQUEST', message: 'Check the request format.', correlationId: req.id });
    app.log.error({ correlationId: req.id, errorCode: error.code ?? 'INTERNAL' }, 'request failed');
    return reply.code(500).send({ code: 'INTERNAL', message: 'Something went wrong. Retry; if it persists check the logs for the correlation ID.', correlationId: req.id });
  });

  const store = suppliedStore ?? (config.rateLimitRedisUrl
    ? new RedisRateLimitStore(config.rateLimitRedisUrl, app.log as never, `${config.rateLimitNamespace ?? 'insight:rate:v1'}:admin`) : new MemoryRateLimitStore());
  if (store instanceof RedisRateLimitStore) await store.connect();
  app.addHook('onClose', async () => store.close());
  app.get('/health', async () => { await store.health(); await db.query('SELECT 1'); return { status: 'ok' }; });

  const key = config.encryptionKey;
  const need = requireAdmin(db, config);
  const mailEnabled = config.mailDeliveryMode !== 'disabled';
  const drain = async () => {
    if (!mailEnabled || config.environment === 'test') return;
    // Separate guards: one poisoned recovery-code row must not starve the admin emails behind it.
    try { while (await deliverMail(db, config, app.log)); } catch { app.log.warn('recovery mail delivery failed'); }
    try { while (await deliverDirectMail(db, config, app.log)); } catch { app.log.warn('direct mail delivery failed'); }
  };
  if (mailEnabled && config.environment !== 'test') { const timer = setInterval(() => void drain(), 60000); timer.unref(); app.addHook('onClose', async () => clearInterval(timer)); }
  const drainNow = async () => { if (mailTransport) { while (await deliverMail(db, config, app.log, mailTransport as never)); while (await deliverDirectMail(db, config, app.log, mailTransport)); } else void drain(); };

  await authRoutes(app, db, config, store);

  // ---- reads
  app.get('/api/users', { preHandler: need, schema: { querystring: { type: 'object', additionalProperties: false, properties: {
    q: { type: 'string', maxLength: 100 }, status: { enum: ['active', 'suspended', 'deleted'] }, page: { type: 'integer', minimum: 0, maximum: 100000 } } } } }, async req => {
    const q = req.query as { q?: string; status?: ops.Status; page?: number };
    return ops.listUsers(db, { q: q.q, status: q.status, limit: 50, offset: (q.page ?? 0) * 50 });
  });
  app.get('/api/users/:id', { preHandler: need, schema: { params: idParams } }, async req => ops.userDetail(db, (req.params as { id: string }).id));
  app.get('/api/audit', { preHandler: need, schema: { querystring: { type: 'object', additionalProperties: false, properties: {
    subject: uuidSchema, action: { type: 'string', maxLength: 40 }, page: { type: 'integer', minimum: 0, maximum: 100000 } } } } }, async req => {
    const q = req.query as { subject?: string; action?: string; page?: number };
    return ops.auditLog(db, { subject: q.subject, action: q.action, limit: 100, offset: (q.page ?? 0) * 100 });
  });

  // Re-entering the admin password guards the actions that can take an account over (or destroy it). Throttled per admin; failures are audited.
  const stepUp = async (adminId: string, password: string, subject: string, what: string) => {
    await throttle(store, `admin:stepup:${adminId}`, { capacity: 10, windowMs: 15 * 60_000 });
    const me = (await db.query('SELECT password_hash FROM admins WHERE id=$1', [adminId])).rows[0];
    if (!(await argon2.verify(me.password_hash, password))) {
      await ops.audit(db, adminId, 'admin.stepup_failed', subject, null, { action: what });
      throw new DomainError(403, 'STEP_UP_FAILED', 'Your password is incorrect.');
    }
  };

  // ---- actions: one transaction, one audit row, one idempotency record each
  const act = <B extends { operationId: string }>(path: string, kind: string, properties: Record<string, unknown>,
    run: (c: import('pg').PoolClient, admin: string, id: string, body: B) => Promise<unknown>, after?: () => Promise<void>, withStepUp = false) =>
    app.post(`/api/users/:id/${path}`, { preHandler: need, schema: { params: idParams, body: objectSchema({ ...op, ...properties, ...(withStepUp ? { password: passwordField } : {}) }) } }, async req => {
      const id = (req.params as { id: string }).id; let body = req.body as B;
      if (withStepUp) { const { password, ...rest } = body as B & { password: string }; await stepUp(req.admin!.id, password, id, kind); body = rest as unknown as B; } // the password never reaches the idempotency record
      const result = await ops.adminOperation(db, req.admin!.id, body.operationId, `${kind}:${id}`, body, c => run(c, req.admin!.id, id, body));
      if (after) await after();
      return result;
    });
  const reason = { reason: reasonSchema };
  act<{ operationId: string; reason: string }>('suspend', 'suspend', reason, (c, a, id, b) => ops.suspend(c, a, id, b.reason));
  act<{ operationId: string; reason: string }>('unsuspend', 'unsuspend', reason, (c, a, id, b) => ops.unsuspend(c, a, id, b.reason));
  act<{ operationId: string; reason: string }>('soft-delete', 'soft-delete', reason, (c, a, id, b) => ops.softDelete(c, a, id, b.reason));
  act<{ operationId: string; reason: string }>('restore', 'restore', reason, (c, a, id, b) => ops.restore(c, a, id, b.reason));
  act<{ operationId: string; reason: string }>('revoke-sessions', 'revoke-sessions', reason, (c, a, id, b) => ops.signOutEverywhere(c, a, id, b.reason));
  act<{ operationId: string; name: string; reason: string }>('rename', 'rename', { name: { type: 'string', minLength: 1, maxLength: 128 }, ...reason }, (c, a, id, b) => ops.rename(c, a, id, b.name, b.reason));
  act<{ operationId: string; email: string; reason: string }>('email', 'email', { email: emailSchema, ...reason }, (c, a, id, b) => ops.changeEmail(c, a, id, b.email, b.reason), undefined, true);
  act<{ operationId: string; status: (typeof ops.ENTITLEMENT_STATUSES)[number]; note: string }>('entitlement', 'entitlement',
    { status: { enum: [...ops.ENTITLEMENT_STATUSES] }, note: reasonSchema }, (c, a, id, b) => ops.setEntitlement(c, a, id, b.status, b.note));
  act<{ operationId: string }>('send-recovery', 'send-recovery', {}, (c, a, id) => ops.sendRecovery(c, a, id, key, mailEnabled), drainNow, true);
  const text = { subject: { type: 'string', minLength: 1, maxLength: 150 }, body: { type: 'string', minLength: 1, maxLength: 5000 } };
  act<{ operationId: string; subject: string; body: string }>('send-email', 'send-email', text, (c, a, id, b) => ops.sendMail(c, a, id, b.subject, b.body, mailEnabled), drainNow);
  act<{ operationId: string; subject: string; body: string }>('send-message', 'send-message', text, (c, a, id, b) => ops.sendMessage(c, a, id, b.subject, b.body));

  // Permanent: re-enter the admin password and type the player's username. The check runs before anything is written.
  app.post('/api/users/:id/hard-delete', { preHandler: need, schema: { params: idParams, body: objectSchema({ ...op, ...reason,
    confirmUsername: { type: 'string', maxLength: 128 }, password: { type: 'string', minLength: 1, maxLength: 256 } }) } }, async req => {
    const id = (req.params as { id: string }).id; const b = req.body as { operationId: string; reason: string; confirmUsername: string; password: string };
    await stepUp(req.admin!.id, b.password, id, 'hard-delete');
    return ops.adminOperation(db, req.admin!.id, b.operationId, `hard-delete:${id}`, { id, reason: b.reason, h: digest(b.confirmUsername, key) }, c => ops.hardDelete(c, req.admin!.id, id, b.reason, b.confirmUsername));
  });

  // ---- the SPA (built by admin/ui); anything that is not /api or a file falls back to index.html
  const uiDir = process.env.ADMIN_UI_DIR ?? fileURLToPath(new URL('../ui/dist/', import.meta.url));
  const uiPresent = existsSync(uiDir);
  if (!uiPresent && config.environment === 'production') throw new Error(`The dashboard UI is missing: ${uiDir} (set ADMIN_UI_DIR or build admin/ui).`);
  // index.html is never cached (a deploy replaces the hashed bundles it names); the hashed assets are cached for good.
  if (uiPresent) await app.register(fastifyStatic, { root: uiDir, wildcard: false, index: ['index.html'], cacheControl: false, dotfiles: 'deny',
    setHeaders: (res, path) => res.header('Cache-Control', path.endsWith('index.html') ? 'no-cache' : path.includes('/assets/') ? 'public, max-age=31536000, immutable' : 'public, max-age=3600') });
  app.setNotFoundHandler(async (req, reply) => {
    if (uiPresent && req.method === 'GET' && !req.url.startsWith('/api/')) return reply.sendFile('index.html');
    return reply.code(404).send({ code: 'NOT_FOUND', message: 'Endpoint unavailable.', correlationId: req.id });
  });
  return app as FastifyInstance;
}
