import { performance } from 'node:perf_hooks';
import { Redis, type RedisOptions } from 'ioredis';
import type { FastifyBaseLogger } from 'fastify';

// Token-bucket stores, kept apart from the request-aware policies in rate-limit.ts so other services (the admin dashboard) can use them alone.
export interface RatePolicy { capacity: number; windowMs: number }
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

