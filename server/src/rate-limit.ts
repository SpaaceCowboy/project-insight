import { performance } from 'node:perf_hooks';
import { normalizeIP } from '@fastify/rate-limit';
import { Redis, type RedisOptions } from 'ioredis';
import type { FastifyBaseLogger, FastifyRequest } from 'fastify';
import type { Config } from './config.js';
import { digest } from './crypto.js';
import { DomainError, requireValue } from './rules.js';

export interface RatePolicy { capacity: number; windowMs: number }
const minute = 60_000;
/** Token-bucket capacities and full-refill periods. These are initial ceilings, not measured server capacity. */
export const ratePolicies = {
  ingress: { capacity: 600, windowMs: minute },
  authIp: { capacity: 120, windowMs: 15 * minute },
  authPair: { capacity: 10, windowMs: 15 * minute },
  loginAddress: { capacity: 60, windowMs: 15 * minute },
  googleIdentity: { capacity: 30, windowMs: minute },
  registerIp: { capacity: 30, windowMs: 60 * minute },
  recoveryAddress: { capacity: 3, windowMs: 60 * minute },
  recoveryConfirm: { capacity: 10, windowMs: 15 * minute },
  refreshIp: { capacity: 120, windowMs: minute },
  refreshAccount: { capacity: 30, windowMs: minute },
  account: { capacity: 600, windowMs: minute },
  read: { capacity: 180, windowMs: minute },
  discovery: { capacity: 60, windowMs: minute },
  write: { capacity: 60, windowMs: minute },
  sync: { capacity: 240, windowMs: minute },
  feedback: { capacity: 5, windowMs: 60 * minute },
  notFound: { capacity: 30, windowMs: minute },
} satisfies Record<string, RatePolicy>;
export type PolicyName = keyof typeof ratePolicies;
export interface RateDecision { allowed: boolean; remaining: number; retryAfterSeconds: number }
export interface RateLimitStore {
  consume(key: string, policy: RatePolicy): Promise<RateDecision>;
  health(): Promise<void>;
  close(): Promise<void>;
}

/** Development/tests only. Active entries are never evicted to make room for new identities. */
export class MemoryRateLimitStore implements RateLimitStore {
  private buckets = new Map<string, { tokens: number; at: number; expires: number }>();
  constructor(private now: () => number = () => performance.now(), private maxEntries = 50_000) {}
  async consume(key: string, policy: RatePolicy): Promise<RateDecision> {
    const now = this.now();
    const previous = this.buckets.get(key);
    const tokens = Math.min(policy.capacity, (previous?.tokens ?? policy.capacity) + Math.max(0, now - (previous?.at ?? now)) * policy.capacity / policy.windowMs);
    if (!previous && this.buckets.size >= this.maxEntries) {
      for (const [id, bucket] of this.buckets) if (bucket.expires <= now) this.buckets.delete(id);
      if (this.buckets.size >= this.maxEntries) throw new Error('RATE_STORE_CAPACITY');
    }
    const allowed = tokens >= 1;
    const remaining = allowed ? tokens - 1 : tokens;
    this.buckets.set(key, { tokens: remaining, at: now, expires: now + Math.ceil((policy.capacity - remaining) * policy.windowMs / policy.capacity) + 1 });
    return { allowed, remaining: Math.floor(remaining), retryAfterSeconds: allowed ? 0 : Math.max(1, Math.ceil((1 - tokens) * policy.windowMs / policy.capacity / 1000)) };
  }
  async health() {}
  async close() { this.buckets.clear(); }
}

// One atomic operation and Redis's clock: no application-clock skew, partial expiry,
// mutable counter snapshots, or INCR retries that charge the same request twice.
const consumeScript = `
local clock = redis.call('TIME')
local now = tonumber(clock[1]) * 1000 + math.floor(tonumber(clock[2]) / 1000)
local capacity = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local previous = redis.call('HMGET', KEYS[1], 'tokens', 'at')
local tokens = tonumber(previous[1]) or capacity
local at = tonumber(previous[2]) or now
tokens = math.min(capacity, tokens + math.max(0, now - at) * capacity / window)
local allowed = 0
local retry = 0
if tokens >= 1 then
  tokens = tokens - 1
  allowed = 1
else
  retry = math.max(1, math.ceil((1 - tokens) * window / capacity / 1000))
end
redis.call('HSET', KEYS[1], 'tokens', tostring(tokens), 'at', now)
redis.call('PEXPIRE', KEYS[1], math.ceil((capacity - tokens) * window / capacity) + 1000)
return {allowed, math.floor(tokens), retry}
`;

export class RedisRateLimitStore implements RateLimitStore {
  private redis: Redis;
  constructor(url: string, log: FastifyBaseLogger, private namespace = 'insight:rate:v1') {
    const options: RedisOptions = {
      lazyConnect: true, enableOfflineQueue: false, connectTimeout: 1000,
      commandTimeout: 500, maxRetriesPerRequest: 0, autoResendUnfulfilledCommands: false,
      retryStrategy: attempt => Math.min(1000, attempt * 100),
    };
    this.redis = url.startsWith('unix:')
      ? new Redis({ ...options, path: decodeURIComponent(new URL(url).pathname) })
      : new Redis(url, options);
    // Never log the Error: connection errors may contain credentials or addresses.
    let failed = false;
    this.redis.on('error', () => { if (!failed) log.error({ component: 'rate_limit_store', outcome: 'unavailable' }, 'rate limit store unavailable'); failed = true; });
    this.redis.on('ready', () => { log.info({ component: 'rate_limit_store', outcome: failed ? 'recovered' : 'ready' }, 'rate limit store ready'); failed = false; });
    this.redis.defineCommand('consumeInsightRate', { numberOfKeys: 1, lua: consumeScript });
  }
  async connect() { await this.redis.connect(); await this.health(); }
  async consume(key: string, policy: RatePolicy): Promise<RateDecision> {
    const result = await (this.redis as Redis & { consumeInsightRate(key: string, capacity: number, window: number): Promise<number[]> }).consumeInsightRate(key, policy.capacity, policy.windowMs);
    if (result.length !== 3 || result.some(n => !Number.isFinite(n))) throw new Error('RATE_STORE_RESPONSE');
    return { allowed: result[0] === 1, remaining: result[1]!, retryAfterSeconds: result[2]! };
  }
  async health() {
    // PING alone would report healthy while noeviction/OOM prevents enforcement.
    await this.redis.set(`${this.namespace}:health`, '1', 'PX', 5000);
  }
  async close() { this.redis.disconnect(); }
}

export class RateLimitError extends DomainError {
  constructor(readonly policy: string, readonly retryAfterSeconds: number, unavailable = false) {
    super(unavailable ? 503 : 429, unavailable ? 'RATE_LIMIT_UNAVAILABLE' : 'RATE_LIMITED',
      unavailable ? 'Online is temporarily unavailable. Please try again shortly.' : 'Too many requests. Please try again later.');
  }
}

const interactiveAuth = new Set(['/v1/auth/register', '/v1/auth/login', '/v1/auth/google', '/v1/auth/recover/request', '/v1/auth/recover/confirm']);
const discoveryRoutes = new Set(['/v1/grids', '/v1/creators', '/v1/following', '/v1/followers', '/v1/profiles/:id', '/v1/grids/code/:code']);
const syncRoutes = new Set(['/v1/completions', '/v1/progress/import', '/v1/play-sessions/:id/move', '/v1/play-sessions/:id/failures']);

export class RateLimits {
  private activeAuthWork = 0;
  private storeFailed = false;
  constructor(readonly store: RateLimitStore, private config: Config, private log: FastifyBaseLogger) {}
  private ip(req: FastifyRequest) { return normalizeIP(req.ip, 64); }
  async enforce(req: FastifyRequest, policy: PolicyName, identity: string) {
    // Fixed-cardinality policy labels and HMAC identities only; no raw email, IP, token, or user IDs in Redis/logs.
    const namespace = this.config.rateLimitNamespace ?? 'insight:rate:v1';
    const key = `${namespace}:${policy}:${digest(`${policy}:${identity}`, this.config.encryptionKey)}`;
    let decision: RateDecision;
    try {
      decision = await this.store.consume(key, ratePolicies[policy]);
      if (this.storeFailed) this.log.info({ component: 'rate_limit_store', outcome: 'recovered' }, 'rate limit enforcement recovered');
      this.storeFailed = false;
    } catch {
      if (!this.storeFailed) this.log.error({ component: 'rate_limit_store', outcome: 'unavailable', correlationId: req.id }, 'rate limit enforcement unavailable');
      this.storeFailed = true;
      throw new RateLimitError('store', 3, true);
    }
    if (!decision.allowed) {
      this.log.warn({ correlationId: req.id, policy, outcome: 'rejected', retryAfterSeconds: decision.retryAfterSeconds, route: req.routeOptions.url, method: req.method }, 'rate limit exceeded');
      throw new RateLimitError(policy, decision.retryAfterSeconds);
    }
  }
  async ingress(req: FastifyRequest) {
    if (req.method === 'GET' && req.routeOptions.url === '/health') return;
    await this.enforce(req, 'ingress', this.ip(req));
    const route = req.routeOptions.url ?? '';
    if (req.method === 'POST' && interactiveAuth.has(route)) {
      await this.enforce(req, 'authIp', this.ip(req));
      if (route === '/v1/auth/register') await this.enforce(req, 'registerIp', this.ip(req));
    }
    if (req.method === 'POST' && route === '/v1/auth/refresh') await this.enforce(req, 'refreshIp', this.ip(req));
  }
  /** After schema validation, before handlers and their expensive work. */
  async sensitive(req: FastifyRequest) {
    const route = req.routeOptions.url ?? '';
    if (req.method !== 'POST') return;
    if (interactiveAuth.has(route)) {
      const body = req.body as { email?: string };
      if (body.email) {
        const address = body.email.trim().toLowerCase();
        await this.enforce(req, 'authPair', `${route}:${this.ip(req)}:${address}`);
        if (route === '/v1/auth/login') await this.enforce(req, 'loginAddress', address);
        if (route === '/v1/auth/recover/request') await this.enforce(req, 'recoveryAddress', address);
        if (route === '/v1/auth/recover/confirm') await this.enforce(req, 'recoveryConfirm', address);
      }
    }
    if (route === '/v1/feedback' && !req.headers.authorization) await this.enforce(req, 'feedback', `anonymous:${this.ip(req)}`);
  }
  /** Called only after the bearer token was verified against the database. */
  async account(req: FastifyRequest) {
    const account = req.account!.id;
    await this.enforce(req, 'account', account);
    const route = req.routeOptions.url ?? '';
    const policy = route === '/v1/feedback' ? 'feedback' : req.method === 'GET' || req.method === 'HEAD'
      ? discoveryRoutes.has(route) ? 'discovery' : 'read'
      : syncRoutes.has(route) ? 'sync' : 'write';
    await this.enforce(req, policy, account);
  }
  async notFound(req: FastifyRequest) { await this.enforce(req, 'notFound', this.ip(req)); }
  /** Bound CPU/memory and Google verification concurrency without an unbounded queue. */
  async authWork<T>(work: () => Promise<T>): Promise<T> {
    if (this.activeAuthWork >= 4) throw new RateLimitError('authCapacity', 2, true);
    this.activeAuthWork++;
    try { return await work(); } finally { this.activeAuthWork--; }
  }
  async health() {
    try { await this.store.health(); } catch { throw new RateLimitError('store', 3, true); }
  }
}

export async function createRateLimits(config: Config, log: FastifyBaseLogger, suppliedStore?: RateLimitStore) {
  requireValue(config.environment !== 'production' || !!config.rateLimitRedisUrl, 'CONFIGURATION', 'RATE_LIMIT_REDIS_URL is required in production.', 500);
  const store = suppliedStore ?? (config.rateLimitRedisUrl ? new RedisRateLimitStore(config.rateLimitRedisUrl, log, config.rateLimitNamespace) : new MemoryRateLimitStore());
  if (store instanceof RedisRateLimitStore) {
    try { await store.connect(); } catch { await store.close(); throw new Error('Rate limit store unavailable at startup.'); }
  }
  return new RateLimits(store, config, log);
}

declare module 'fastify' { interface FastifyInstance { rateLimits: RateLimits } }
