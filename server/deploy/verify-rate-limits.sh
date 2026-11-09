#!/usr/bin/env bash
# Run as root on the Insight VPS, from an isolated checkout. Never deploys code.
# Owns only its temporary DB/role, Docker container, and listeners on 16389/18898/18899.
set -euo pipefail
cd "$(dirname "$0")/../.."
export PATH="/opt/node/bin:$PATH"
export NODE_OPTIONS=--dns-result-order=ipv4first
runtime=$(mktemp -d /tmp/insight-rate-verify.XXXXXX)
test_role="insight_rl_$$"
test_database="$test_role"
test_container="insight-rate-test-$$"
role_created=false
database_created=false
upstream_pid=""
cleanup() {
    local result=$?
    trap - EXIT
    if [[ -f "$runtime/nginx.pid" ]]; then nginx -p "$runtime/" -c "$runtime/nginx.conf" -s quit || true; fi
    if [[ -n "$upstream_pid" ]]; then kill "$upstream_pid" 2>/dev/null || true; wait "$upstream_pid" 2>/dev/null || true; fi
    docker rm -f "$test_container" >/dev/null 2>&1 || true
    if $database_created; then runuser -u postgres -- dropdb "$test_database"; fi
    if $role_created; then runuser -u postgres -- dropuser "$test_role"; fi
    # Keep logs/evidence. Only processes and disposable DB/container state are removed.
    echo "Validation exit=$result; evidence=$runtime"
    exit "$result"
}
trap cleanup EXIT
for port in 16389 18898 18899; do
    if ss -ltnH "sport = :$port" | grep -q .; then echo "Test port $port is occupied; refusing to reuse it." >&2; exit 1; fi
done
test_password=$(openssl rand -hex 24)
printf "CREATE ROLE %s LOGIN PASSWORD '%s';\n" "$test_role" "$test_password" | runuser -u postgres -- psql -Xq -v ON_ERROR_STOP=1
role_created=true
runuser -u postgres -- createdb -O "$test_role" "$test_database"
database_created=true
export TEST_DATABASE_URL="postgresql://$test_role:$test_password@127.0.0.1:5432/$test_database"
export TEST_REDIS_URL=redis://127.0.0.1:16389/0
export TEST_REDIS_SOCKET_URL="unix://$runtime/redis/redis.sock"
mkdir -p "$runtime/redis"
docker run -d --name "$test_container" --memory=192m --cpus=0.5 \
    -p 127.0.0.1:16389:6379 -v "$runtime/redis:/data" \
    redis:7.4-alpine redis-server --appendonly yes --appendfsync everysec \
    --maxmemory 128mb --maxmemory-policy noeviction --save '' \
    --unixsocket /data/redis.sock --unixsocketperm 660 >/dev/null
wait_redis() {
    for attempt in $(seq 1 40); do
        if docker exec "$test_container" redis-cli ping 2>/dev/null | grep -q PONG; then return; fi
        sleep 0.25
    done
    echo 'Disposable Redis did not become ready.' >&2; return 1
}
wait_redis
(
    cd server
    npm ci --no-audit --no-fund
    npm run build
    npm test
    npm run test:integration
    npm run test:rate-limit:redis
) 2>&1 | tee "$runtime/server-tests.log"

# Restart the owned Redis process, proving AOF preservation beyond API restarts.
export TEST_PERSISTENCE_KEY="insight:rate:validation:$$"
(
    cd server
    node --import tsx --input-type=module <<'JS'
import assert from 'node:assert/strict';
import { RedisRateLimitStore } from './src/rate-limit.ts';
const log = { info() {}, error() {} };
const store = new RedisRateLimitStore(process.env.TEST_REDIS_URL, log, process.env.TEST_PERSISTENCE_KEY);
try { await store.connect(); assert.equal((await store.consume(process.env.TEST_PERSISTENCE_KEY, {capacity: 1, windowMs: 3600000})).allowed, true); }
finally { await store.close(); }
JS
)
docker restart "$test_container" >/dev/null
wait_redis
(
    cd server
    node --import tsx --input-type=module <<'JS'
import assert from 'node:assert/strict';
import { Redis } from 'ioredis';
import { RedisRateLimitStore } from './src/rate-limit.ts';
import { buildApp } from './src/app.ts';
const log = { info() {}, error() {} };
const namespace = process.env.TEST_PERSISTENCE_KEY;
const store = new RedisRateLimitStore(process.env.TEST_REDIS_URL, log, namespace);
const inspector = new Redis(process.env.TEST_REDIS_URL, {maxRetriesPerRequest: 0, commandTimeout: 1000});
inspector.on('error', () => {});
let app;
try {
  await store.connect();
  assert.equal((await store.consume(namespace, {capacity: 1, windowMs: 3600000})).allowed, false);
  console.log('PASS: Redis process restart preserves the exhausted quota through AOF.');
  const config = {encryptionKey: '17'.repeat(32), databaseUrl: 'unused', environment: 'production', trustProxy: false,
    mailDeliveryMode: 'disabled', feedbackDeliveryMode: 'store', rateLimitRedisUrl: process.env.TEST_REDIS_URL, rateLimitNamespace: namespace};
  app = await buildApp({query: async () => ({rows: []})}, config, false);
  // This is our disposable container, never the production Redis.
  await inspector.config('SET', 'maxmemory', '1');
  for (const url of ['/v1/capabilities', '/health']) {
    const r = await app.inject({method: 'GET', url});
    assert.equal(r.statusCode, 503); assert.equal(r.headers['retry-after'], '3');
    assert.equal(r.json().code, 'RATE_LIMIT_UNAVAILABLE');
  }
  await inspector.config('SET', 'maxmemory', '128mb');
  assert.equal((await app.inject({method: 'GET', url: '/health'})).statusCode, 200);
  console.log('PASS: Redis OOM fails closed, readiness fails, and recovery needs no API restart.');
} finally {
  await inspector.config('SET', 'maxmemory', '128mb');
  await inspector.unlink(namespace, `${namespace}:health`);
  await app?.close(); await store.close(); inspector.disconnect();
}
JS
) 2>&1 | tee "$runtime/redis-fault-tests.log"

# A separate nginx master and harmless HTTP fixture; no production API traffic.
sed "s|/var/log/nginx/|$runtime/|g" server/deploy/insight-rate-limit-server.conf > "$runtime/enforcement.conf"
cat > "$runtime/nginx.conf" <<NGINX
pid $runtime/nginx.pid;
error_log $runtime/master-error.log warn;
events { worker_connections 1024; }
http {
    access_log off;
    include $PWD/server/deploy/insight-rate-limit-zones.conf;
    server {
        listen 127.0.0.1:18899;
        server_name localhost;
        include $runtime/enforcement.conf;
        location / { proxy_pass http://127.0.0.1:18898; }
    }
}
NGINX
node --input-type=module -e 'import http from "node:http"; http.createServer((req,res)=>{req.resume();res.writeHead(200,{"Content-Type":"application/json"});res.end("{\"accepted\":true}");}).listen(18898,"127.0.0.1");' > "$runtime/upstream.log" 2>&1 &
upstream_pid=$!
nginx -p "$runtime/" -c "$runtime/nginx.conf" -t
nginx -p "$runtime/" -c "$runtime/nginx.conf"
node --input-type=module <<'JS' | tee "$runtime/nginx-tests.log"
import assert from 'node:assert/strict';
const responses = await Promise.all(Array.from({length: 160}, () => fetch('http://127.0.0.1:18899/probe')));
assert.ok(responses.some(r => r.status === 200));
assert.ok(responses.some(r => r.status === 429));
for (const response of responses) {
  if (response.status === 429) {
    const body = await response.json();
    assert.equal(body.code, 'RATE_LIMITED'); assert.equal(body.policy, 'edge');
    assert.equal(response.headers.get('retry-after'), '1');
    assert.equal(body.correlationId, response.headers.get('x-correlation-id'));
  } else { assert.equal(response.status, 200); await response.arrayBuffer(); }
}
console.log(`PASS: nginx real-socket burst: ${responses.filter(r=>r.status===200).length} accepted, ${responses.filter(r=>r.status===429).length} rejected with the API error contract.`);
JS
if grep -Eq '127\.0\.0\.1|/probe|"request"' "$runtime/insight-rate-limits.log"; then echo 'Unsafe edge telemetry.' >&2; exit 1; fi

export ANDROID_HOME=/opt/android-sdk
export ANDROID_SDK_ROOT=/opt/android-sdk
export GRADLE_USER_HOME=/opt/insight-gradle
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
./gradlew --no-daemon --max-workers=1 '-Dorg.gradle.jvmargs=-Xmx1400m -Dfile.encoding=UTF-8' -Pkotlin.compiler.execution.strategy=in-process \
    :app:testDebugUnitTest :app:assembleDebug 2>&1 | tee "$runtime/android-tests.log"
echo 'All isolated checks passed; no production code, database, proxy, or APK was changed.'
