import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { authRoutes } from './auth.js';
import type { Config } from './config.js';
import type { Db } from './db.js';
import { onlineRoutes } from './online.js';
import { feedbackRoutes } from './feedback.js';
import { DomainError } from './rules.js';
import { responseSchema } from './contracts.js';

export async function buildApp(db: Db, config: Config, logging = true) {
  const app = Fastify({ logger: logging ? { level: 'info', serializers: {
    req: req => ({ method: req.method, route: req.routeOptions?.url }),
    res: res => ({ statusCode: res.statusCode }),
    err: error => ({ type: error.name, code: error.code, message: 'redacted', stack: '' }),
  }, redact: ['req.headers', 'body', 'password', 'email', 'token'] } : false,
  disableRequestLogging: true, ajv: { customOptions: { removeAdditional: false } }, bodyLimit: 256 * 1024, trustProxy: config.trustProxy, requestTimeout: 15000 });
  app.addHook('onResponse', async (req, reply) => { app.log.info({ correlationId: req.id, method: req.method, route: req.routeOptions.url, status: reply.statusCode, latencyMs: reply.elapsedTime }, 'request completed'); });
  app.addHook('onSend', async (req, reply, payload) => { reply.header('Cache-Control', 'no-store').header('X-Correlation-ID', req.id); return payload; });
  app.setErrorHandler((error: any, req, reply) => {
    if (error instanceof DomainError) return reply.code(error.statusCode).send({ code: error.code, message: error.message, correlationId: req.id });
    if (error.validation) return reply.code(400).send({ code: 'INVALID_REQUEST', message: 'Check the supplied fields.', correlationId: req.id });
    if (error.statusCode === 429) return reply.code(429).send({ code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.', correlationId: req.id });
    if ([400, 404, 405, 413, 415].includes(error.statusCode)) return reply.code(error.statusCode).send({ code: 'INVALID_REQUEST', message: error.statusCode === 413 ? 'The request is too large.' : 'Check the request format and content type.', correlationId: req.id });
    app.log.error({ correlationId: req.id, errorCode: error.code ?? 'INTERNAL' }, 'request failed');
    return reply.code(500).send({ code: 'INTERNAL', message: 'Something went wrong. Please retry.', correlationId: req.id });
  });
  await app.register(rateLimit, { max: 120, timeWindow: '1 minute' });
  await app.register(swagger, { openapi: { info: { title: 'INSIGHT Online', version: '1.0.0' }, components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer' } } } } });
  await app.register(swaggerUi, { routePrefix: '/docs' });
  app.addHook('onRoute', route => {
    const method = Array.isArray(route.method) ? route.method[0]! : route.method;
    const response = responseSchema(method, route.url);
    if (response) route.schema = { ...route.schema, response: { 200: response },
      ...(route.url.startsWith('/v1/') && !route.url.startsWith('/v1/auth/') && route.url !== '/v1/capabilities' && route.url !== '/v1/feedback' ? { security: [{ bearerAuth: [] }] } : {}) };
  });
  app.get('/health', async () => { await db.query('SELECT 1'); return { status: 'ok' }; });
  await authRoutes(app, db, config);
  await onlineRoutes(app, db, config);
  await feedbackRoutes(app, db, config);
  return app;
}
