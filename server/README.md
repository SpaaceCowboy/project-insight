# INSIGHT Online

Android Online test service with invitation-free registration and verified accounts. Campaign play remains free and offline. No billing or public launch is included.

## Local setup

Requires Node 22+, PostgreSQL 17 with a UTF-8 database, and Docker Compose for the bundled database/Mailpit. From the repository root:

```sh
cp server/.env.example .env
openssl rand -hex 32
```

Put that key in `ENCRYPTION_KEY`, set a random `POSTGRES_PASSWORD`, and use `SMTP_HOST=mailpit` for container development. Keep the key backed up securely: sessions, invitations, email challenges, and encrypted outbox jobs depend on it. Use URL-safe characters for the database password in Compose's connection URL.

```sh
docker compose --profile local up --build -d
```

Open Mailpit at http://localhost:8025 for test email codes. Registration requires no invitation. API: http://localhost:3000; OpenAPI UI: http://localhost:3000/docs; JSON contract: http://localhost:3000/docs/json. SMTP acceptance is logged as acceptance, never delivery confirmation. Email bodies are encrypted at rest until accepted, then discarded.

When using Mailpit, set `MAIL_DELIVERY_MODE=test-inbox`. The app then explicitly explains that email codes are in the operator's inbox. In that mode an operator can run `node dist/operator.js create-test-account` inside the API container to create a verified private tester and print generated credentials. Redirect that output to a private file; never commit it. This command is disabled in normal SMTP mode.

For a host-run service, start only `db` and `mailpit`; set `DATABASE_URL`, `ENCRYPTION_KEY`, and SMTP variables in the process environment, then:

```sh
cd server
npm ci
npm run migrate
npm run dev
```

The emulator's debug default is `http://10.0.2.2:3000`. For a physical device, use HTTPS or `adb reverse tcp:3000 tcp:3000` and build with `-PinsightApiUrl=http://127.0.0.1:3000`. Cleartext is permitted only for those local debug hosts. Release builds require HTTPS; an unset release URL shows an explicit unavailable state.

## Interfaces and invariants

- `/v1/auth/*`: register without an invitation, log in, request/confirm verification or recovery codes, refresh, logout. Passwords are 12–128 characters. Codes expire after 15 minutes and five wrong attempts. Requests/resends are rate-limited. Password reset revokes all sessions. Legacy clients may still send an invitation field; it is ignored.
- `/v1/account/name`: verified users can change their nickname with an idempotent PATCH. Nicknames are free text, 1–32 Unicode code points after NFKC/space normalization; controls and hidden direction overrides are rejected. Joining characters for Persian and emoji sequences are supported. A database unique index enforces uniqueness ignoring case and compatibility variants. Existing discriminator names remain until their owner changes them.
- `/v1/vocabulary`: reviewed first/second words for world and grid titles. Account nicknames do not use the picker or a generated discriminator.
- `/v1/profiles/:id`, `/v1/progress`, `/v1/progress/import`: public statistics and account progress. `communityDone` contains the requesting account's completed grid IDs; world-grid listings expose the requesting player's `completed` flag. Android saves a completion mark immediately after a legal solve and reconciles with verified server history. Campaign resets and account switches keep community history separate. Imported solves/badges are legacy claims and award no XP. They are not proof of a verified solve.
- `/v1/worlds`, `/v1/worlds/:id/grids`: discovery, ownership lists, creation, rename, icon, and visibility. `mine=true` includes private/empty worlds. Discovery uses visible grids and unique qualifying player/grid pairs, with ID tie-breaking; pages contain 20 worlds.
- `/v1/grids/drafts`, `/v1/grids/:id/publish`, `/v1/grids/:id`, `/v1/grids/code/:code`: checked private drafts, atomic publication, metadata/visibility changes, and code lookup. Drafts are limited to 100 per account as an operational bound. World count has no product limit. Hidden published grids retain their slot among a world's 20.
- `/v1/grids/:id/sessions`, `/v1/play-sessions/:id/move`, `/v1/completions`: server-issued play sessions, proof of a legal move, and complete solution replay. Sessions last seven days. Owner-hidden content allows existing sessions to finish; operator moderation/suspension blocks them. New sessions require visible content.

Authenticated mutations use a UUID `operationId`. Retrying the same operation returns its original response; reusing it with different input returns 409. Android persists command IDs before sending and completed solution proofs before removing local attempts. Queued requests are partitioned by account and never sent with another account's token. Permanent submission errors remain visible on the profile; transient failures retry with backoff.

Grid responses never include the creator's proof. Paths contain flat `[from,to]` cell indices, follow the source tile's movement rule, stop at the first solve, and contain at most 10,000 moves. Content identity trims shared outer holes. This prevents exact copies/padding from multiplying rewards; it is not a bot detector or a semantic puzzle-equivalence solver. Private tests should monitor automated farming before any public release.

## XP

All values are integer thousandths (`xpMilli` is a decimal string). First verified solve: 100 XP. Replay: 10 XP once per content hash per UTC day, up to 50 daily. Creation: 25 XP for the first global publication of a new content hash, up to 50 daily. Popularity: 0.001 XP once per other verified account/grid, after a legal move. Campaign content is seeded as existing content. Own published puzzle hashes earn no solve XP. Official Android Dev Mode does not submit activity or allow publishing.

Per-account advisory locks use a consistent ordering, including player/creator pairs. Reward ledger entries, content claims, counters, and operation responses commit together. The cap is level 100 at 106,920 XP. Three first solves daily reach it in approximately 357 days, assuming enough new puzzles. Bonuses shorten that estimate; it is a balance starting point, not a promise.

Legacy guest progress is claimed by the first account on a device. Later accounts have separate saves, attempts, badges, proofs, and caches. Saved progress resets do not delete server history or allow first rewards again. Verified future guest proofs can be submitted by the claiming account. Logging out offline clears device credentials but cannot guarantee immediate server revocation; the UI reports this explicitly.

## Tests

```sh
npm ci
npm test
npm run build
TEST_DATABASE_URL=postgresql://localhost/insight_test npm run test:integration
```

Integration tests create and drop only a randomly named schema inside the supplied database. They cover two-account publishing/play, idempotency, the twentieth-slot race, replay/creation caps, imports, auth recovery, refresh rotation, and throttling. Rules replay the same 206 campaign solutions used by Kotlin.

## Staging deployment and operations

1. Configure a staging DNS name and an HTTPS reverse proxy to the API's loopback port 3000. For example, Caddy: `online.example.com { reverse_proxy 127.0.0.1:3000 }`. Keep PostgreSQL and Mailpit off public interfaces. Do not enable the local Mailpit profile in staging.
2. Set `NODE_ENV=production`, real `MAIL_FROM`/SMTP credentials, `SMTP_SECURE=true` for implicit TLS (typically port 465), or port 587 with `SMTP_SECURE=false` for required STARTTLS. Only trust proxy addresses actually controlled by the deployment. Configure the reverse proxy's forwarding headers accordingly; arbitrary incoming forwarding headers are not trusted by default.
3. Back up PostgreSQL and `ENCRYPTION_KEY` before applying an update. Compose applies pending SQL migrations before starting the API. Migrations are forward-only and additive; rollback means restoring the prior application image while retaining the schema, not dropping tables. Test every schema change against a restored backup first.
4. Build a release with `-PinsightApiUrl=https://online.example.com`. Registration is open; verified email is still required for community features. Verify email receipt, account recovery, publication, a second account's solve, and both XP outcomes before distributing it.
5. Collect request status/latency/correlation IDs and email outcome logs. Alert on persistent 5xx responses, failed email jobs, database health, and aged pending jobs. Inspect queue counts with `SELECT status,count(*) FROM email_outbox GROUP BY status;`; an SMTP-accepted email may still fail to arrive, so verification completion is the actual user outcome.

```sh
docker compose exec api node dist/operator.js hide-world WORLD_UUID
docker compose exec api node dist/operator.js hide-grid GRID_UUID
docker compose exec api node dist/operator.js suspend USER_UUID
docker compose exec -T db pg_dump -U insight -d insight -Fc > insight-backup.dump
```

Operator actions are recorded in `operator_audit`; owners cannot undo moderation. Store backups encrypted off-host and periodically restore into an isolated database. Retain operation/reward records when performing maintenance: deleting them can break retry safety. Session/challenge housekeeping must never remove active refresh recovery records. Domain, certificates, mail delivery reputation, live secrets, billing, and public-release hardening remain deployment responsibilities.
