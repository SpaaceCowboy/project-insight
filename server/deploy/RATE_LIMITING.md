# Rate limiting

This candidate adds a dedicated Redis dependency. Provision it **before** deploying the new API: production startup refuses a missing `RATE_LIMIT_REDIS_URL` or an unavailable store. No SQL migration is needed. Existing APKs continue to receive compatible error codes; cooldown scheduling requires the updated Android build.

## Enforcement

Application limits are token buckets: a bucket starts with its capacity and refills continuously over its period. A capacity of 5 over an hour allows an initial burst of 5, then one request every 12 minutes. It is not a strict rolling-hour quota. Rejected requests do not postpone the next available token. All applicable buckets stack; a rejected request may already have spent a token in an earlier, broader bucket.

Policy definitions are centralized in `server/src/rate-limit.ts`:

- Every non-health request: IP burst 600, full refill in 1 minute. IPv4-mapped IPv6 is canonicalized; IPv6 uses /64. Unknown URLs also share an IP burst of 30 with a 1-minute refill; changing the unknown URL does not create a new bucket.
- Interactive authentication: combined IP burst 120, refill in 15 minutes. Registration also has an IP burst of 30 with a 1-hour refill. These apply before parsing/validation, so invalid payloads cannot bypass them.
- Validated email authentication: endpoint + IP + normalized address burst 10, refill in 15 minutes. Login also has an address burst of 60 with a 15-minute refill, independent of IP. Recovery requests have an address burst of 3 with a 1-hour refill; confirmations have an address burst of 10 with a 15-minute refill. Known and nonexistent addresses consume the same budgets before lookup.
- Verified Google subjects: burst 30, refill in 1 minute. Only cryptographically verified subjects reach this bucket.
- Refresh: IP burst 120 and verified-account burst 30, each refilling in 1 minute. Rotating refresh tokens does not reset the account budget.
- Verified accounts: aggregate burst 600 with a 1-minute refill, plus a category bucket: reads 180, discovery 60, mutations 60, progress/proof sync 240. Each category refills in 1 minute. Account identity comes from the verified database session, never an incoming user ID or unverified token payload.
- Feedback: burst 5 with a 1-hour refill per verified account, or per IP when anonymous.
- At most four concurrent password-hashing/verification or Google-verification tasks per API process. Excess work gets a retryable 503 without entering an unbounded work queue.

Redis executes one Lua operation per bucket using Redis's clock. Keys contain a fixed policy name plus an HMAC identity, not a raw IP, email, token, Google subject or account ID. Identities use the existing private encryption key with a rate-policy prefix. Rotating that key also resets quotas. All deployments of the same API must share the Redis namespace and encryption key; staging must use its own Redis and namespace.

The dedicated Redis uses AOF (`appendfsync everysec`) and `maxmemory-policy noeviction`. API restarts preserve counters; a Redis process restart preserves flushed AOF state. An abrupt machine loss can lose approximately the last second of changes. Do not flush Redis, change its namespace, or configure an eviction policy to relieve pressure: those actions reset protection.

Development without `RATE_LIMIT_REDIS_URL` uses a bounded in-process store. It never evicts active identities; capacity exhaustion returns 503. It is intentionally unavailable as an automatic production fallback.

## Failure and client behavior

Quota rejection returns 429 with `Retry-After` (seconds), `X-RateLimit-Policy`, `X-Correlation-ID`, and JSON `code`, `message`, `correlationId`, `retryAfterSeconds`, `policy`.

Store errors/timeouts/OOM return 503 `RATE_LIMIT_UNAVAILABLE` with a 3-second retry. Redis operations have a 500 ms command timeout, no offline queue, no automatic command replay, and no request retry. The client reconnects in the background; the API recovers without restarting. Startup requires a successful connection and write. `/health` checks a short-lived Redis write and PostgreSQL; it fails when Redis can answer PING but cannot accept writes.

Android understands seconds, HTTP dates, and the JSON fallback. Advisory cooldowns are scoped to the policy/account/action and saved as hashes and deadlines in private preferences. Feedback throttling does not block progress sync. Background sync keeps its original operation IDs and queued records, then schedules work after the deadline with positive jitter. Without a server cooldown, existing exponential backoff remains.

The nginx snippets add broad per-IP, aggregate API, aggregate expensive-auth and connection ceilings. Rejections use the same 429 contract. Sanitized edge logs contain status, latency and correlation ID only; raw-IP/raw-request limiter notices are below this server's error-log threshold. API rejection logs identify the policy without recording identities. Configure log rotation for `/var/log/nginx/insight-rate-limits.log` and `insight-error.log` with the host's normal nginx rotation policy. Watch 429s by policy, 503s, `/health`, and Redis memory; an increase in legitimate rejections is a reason to tune, not to disable enforcement.

## Native VPS rollout

Keep this sequence within the normal encrypted-backup and application-rollback process in `DEPLOYMENT.md`. Thresholds are initial safety ceilings, not a production capacity measurement. Do not exercise bursts against production.

1. Provision the packaged Redis server binary and its `redis` OS account. The dedicated instance exposes only `/run/insight-rate-limit/redis.sock` (no TCP port), restricted to a dedicated `insight-rate-limit` group. Grant the API user membership in that group; do not grant Redis membership in the `insight` group, which can read the private API environment. It can coexist with another Redis. Keep the API on `127.0.0.1:3000` and `TRUST_PROXY=127.0.0.1`; nginx must overwrite `X-Forwarded-For` with `$remote_addr`.
2. Install and start the dedicated service from the candidate checkout:

   ```sh
   getent group insight-rate-limit >/dev/null || groupadd --system insight-rate-limit
   usermod --append --groups insight-rate-limit insight
   install -m 644 server/deploy/insight-rate-limit-redis.conf /etc/insight-rate-limit-redis.conf
   install -m 644 server/deploy/insight-rate-limit-redis.service /etc/systemd/system/insight-rate-limit-redis.service
   install -d -m 755 /etc/systemd/system/insight-online.service.d
   install -m 644 server/deploy/insight-online-rate-limit.conf /etc/systemd/system/insight-online.service.d/rate-limit.conf
   systemctl daemon-reload
   systemctl enable --now insight-rate-limit-redis
   runuser -u insight -- redis-cli -s /run/insight-rate-limit/redis.sock ping
   systemd-analyze verify /etc/systemd/system/insight-rate-limit-redis.service
   ```

3. Add `RATE_LIMIT_REDIS_URL=unix:///run/insight-rate-limit/redis.sock` and `RATE_LIMIT_NAMESPACE=insight:rate:v1` to the private API environment; preserve its owner/mode. Verify a write as the `insight` user, `CONFIG GET maxmemory-policy`, AOF persistence, socket ownership/mode, and no TCP binding before replacing the API. Never print the full environment.
4. Install `insight-rate-limit-zones.conf` as `/etc/nginx/conf.d/00-insight-rate-limits.conf`, and `insight-rate-limit-server.conf` as `/etc/nginx/snippets/insight-rate-limit-server.conf`. Add `include /etc/nginx/snippets/insight-rate-limit-server.conf;` inside the existing HTTPS server. Preserve its certificate, APK locations and existing proxy headers. Run `nginx -t` before reloading. The checked-in Docker nginx configuration already has the include.
5. Deploy the tested API with `npm ci` and `npm run build`, retain the prior source/build/lockfile, restart only `insight-online`, and verify `/health`, capabilities, normal sign-in and progress. The old APK may retry early after 429 but its outbox remains safe; publish the updated APK through the regular Android release process.
6. Roll back application code/build/dependencies to the retained version if necessary. Retain Redis data and environment entries. The prior application ignores the new settings. Proxy snippets can remain, or restore the saved nginx configuration and validate before reloading. No database rollback is required.

Docker Compose supplies the private Redis service, persistent volume, resource bounds and health dependency automatically. The HTTPS override mounts both nginx snippets. There is no published Redis port. Keep the volume during API rebuilds.

## Isolated verification

`bash server/deploy/verify-rate-limits.sh` runs as root **only on the Insight VPS**, from an isolated checkout. It requires Docker, native PostgreSQL, nginx, the existing Node toolchain and Android SDK. It refuses occupied test ports 16389/18898/18899; creates a random temporary role/database and its own private Redis container; and cleans them up on completion/failure. It leaves logs in its printed `/tmp/insight-rate-verify.*` directory. It never replaces/reloads production nginx, restarts the API, touches production data, runs an Android emulator or publishes an APK.

It runs the server build/unit/integration suites, real Redis concurrency/cross-instance/expiry tests, an AOF process-restart test, Redis OOM/readiness/recovery tests, a real-socket nginx burst/JSON/header/privacy test, Android unit tests and a debug compilation. Android uses the VPS cache with one Gradle worker and a bounded heap. These are correctness and burst checks; sustained production capacity and carrier-network fairness still require representative staging workloads before launch.

For an already disposable Redis, run `TEST_REDIS_URL=redis://127.0.0.1:16389/0 npm run test:rate-limit:redis` from `server/`. That suite cleans up only its generated namespace and never flushes the database.

## Validation record — 6 November 2026

The isolated VPS candidate passed 38 server unit tests, 26 PostgreSQL integration tests, 7 Redis integration tests (including the Unix socket), AOF restart and OOM/readiness/recovery probes, and a real nginx burst (61 accepted, 99 rejected with the documented contract). Final targeted checks passed all 13 rate-limit/config tests, 71 Android unit tests and the debug build after the client isolation and durable WorkManager handoff changes. Test containers, listeners, databases and roles were removed; production health remained OK. No production deployment or APK publication was performed. Evidence: `/tmp/insight-rate-verify.oVnS0i`, `/tmp/insight-rate-final-server-20261106.log`, `/tmp/insight-rate-final-android-20261106.log` on the VPS.

A separate local full-unit run exposed the existing randomized Google username fallback defect (`Player 455` fails the name filter). It is tracked in `readiness.md`; the username generator was not changed in this work.
