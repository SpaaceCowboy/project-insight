# INSIGHT / Midori — Launch Readiness (Infrastructure)

> Owner: solo dev. Scope: infrastructure, distribution, compliance, operations.
> Out of scope: game design, core gameplay mechanics.
> Last updated: 2026-11-12 · Repo: `github.com:SpaaceCowboy/project-insight` (branch `android`; v0.2.30 released)

---

## Current state snapshot (updated 2026-11-09)

**App**
- `com.insightpuzzle.app`, v0.2.30 (versionCode 41), minSdk 26; Firebase release `27252lt740jpo` distributed to the existing 3-person tester group.
- Shared puzzle links (`https://www.midoripuzzle.com/p/<code>`) are verified App Links: `assetlinks.json` is served by the Vercel site from the `web` branch.
- Signed with a **debug keystore** (`/root/.android/debug.keystore` on the VPS). Blocking for Play.
- Google sign-in live; email recovery implemented but `MAIL_DELIVERY_MODE=disabled` (no SMTP).

**Server** (`13.140.89.146`, single VPS)
- Ubuntu 24.04 · 2 vCPU · 3.8 GB RAM · 38 GB disk at 61%.
- Fastify v5 (Node 22) under nginx (`server_name _`, cert covers the raw IP only).
- systemd: `insight-online` (`Restart=on-failure`, `MemoryMax` unset), `insight-backup.service/.timer`, `insight-certificate.service/.timer`.
- Postgres 16.15. Rate limits: shared Redis token buckets with stacked IP/account/action budgets, nginx request/connection ceilings, bounded authentication work and persistent Android cooldowns. Dedicated Redis uses a private group-restricted Unix socket, AOF and no eviction. Deployed in v0.2.27; sustained traffic tuning remains pending.
- No fail2ban, no unattended-upgrades.

**Ops**
- Builds happen on the VPS itself (prod machine = build machine). No CI.
- On-box watcher (`insight-watch.timer`, 5 min → Telegram): health, APK, units, backup, disk, RAM, cert, 5xx, restarts. No external liveness check, no error tracking, no metrics.
- IPv6 route to Google is broken (403s, stalled uploads); Node services run with `--dns-result-order=ipv4first`.
- Backups: daily age-encrypted dumps **on the same disk**, restore drill automated monthly, no offsite copy.
- Known incidents that shaped this plan: Google `www.googleapis.com` 403 (IP reputation; tokeninfo fallback live), backup service silent failure 03:33→09:41 (mode 644 regression), hotfixes ship straight to prod.

---

## Phase 0 — Decisions

- [x] **D1. Distribution:** Play Store primary. Sideload channel stays possible later (China) — revisit if that market matters.
- [ ] **D2. Signing:** release keystore + Play App Signing. Mandatory before any public build. Current testers will uninstall/reinstall once — cheap now because Google/guest progress transfer already works.
- [ ] **D3. Domain:** register one (pending). Needed for: privacy policy, support email, account-deletion web link, DKIM/SPF email.
- [ ] **D4. Timeline & monetization:** launch date unset; IAP/ads undecided. IAP adds receipt validation; ads add mediation. Decide before Phase 3/4 sizing.

---

## Phase 1 — Harden what exists (cheap, do first)

- [ ] External monitoring account (UptimeRobot/Betterstack): HTTPS keyword monitor on `/health`, alert to email. The on-box watcher cannot report the box being dead.
- [x] On-box watcher (`insight-watch.timer`, every 5 min → Telegram, state-change alerts only): API health both direct and through nginx, APK content length, service/timer state, backup last result + dump age (<27h), disk >80%, RAM floor, served cert <3 days, ≥5 5xx in 6 min, restart count. Config `/etc/insight-ops/watch.env` (600), state `/var/lib/insight-ops`. Verified with a simulated disk failure and its resolution.
- [x] Backup restore drill: first drill (4 Nov) restored the 09:41 dump in 0.57 s — 26 tables identical to live, row counts equal. `insight-restore-drill.timer` repeats it monthly and the watcher alerts on failure or >35-day staleness.
- [ ] Offsite backup replication (R2/B2 — dumps are age-encrypted, safe to ship).
- [ ] Server baseline: `unattended-upgrades`, fail2ban, audit `/root/.ssh/authorized_keys`, set `MemoryMax` on `insight-online`, nginx security headers.
- [ ] Server-side error tracking (Sentry free tier; correlation IDs already in logs).
- [ ] Runbooks in Obsidian vault: restore-from-backup, rollback (`/opt/insight-rollback-*`), cert failure, disk full.

## Phase 2 — Release pipeline & Play Store

- [ ] Generate release keystore — offline, encrypted copies in 2+ places, never unencrypted on the shared VPS.
- [ ] CI on GitHub Actions: server `tsc` + 38 unit tests; app lint + release **AAB** + checksums as artifacts. Keystore in Actions secrets.
- [ ] Fix the existing Google fallback-username flake before release: `suggestedName()` can generate `Player 455`, which `usernameProblem()` rejects as profanity. Observed during rate-limit validation on 6 November; this behavior is unchanged by the rate-limit work.
- [x] Tester update channel: Firebase App Distribution (project `portfolio-51f12`, group `testers`) — interim until Play internal testing. Runs on the VPS after publishing (~7 s); the CLI needs Node 20–24.
- [ ] In-app crash reporting (Crashlytics or Sentry Android), mapping files uploaded from CI.
- [ ] Play Console developer account ($25, ID verification). Decide personal vs organization (D-U-N-S) — personal accounts get the testing gate below.
- [ ] Closed-testing gate: new personal accounts must run a closed test with **~20 opted-in testers for 14 consecutive days** before production access. Verify the current number in Play Console — Google adjusts it. Line up testers now; this alone pushes launch ~3 weeks out.
- [ ] App entry: Data safety form, content-rating questionnaire, privacy policy page (hosted on the new domain).
- [ ] Play Integrity API on auth/progress-sync endpoints (rejects re-signed clones).
- [ ] Internal-testing track for fast iteration; staged rollout (20% → 50% → 100%) on launch day.

## Phase 3 — Accounts, email, compliance

- [ ] Email provider for recovery codes: Cloudflare Email Sending / Resend / SES / Postmark. SPF + DKIM + DMARC on the game domain.
- [ ] Enable `MAIL_DELIVERY_MODE`, templates, per-address rate limits.
- [ ] Account deletion: in-app path **and** web link (Play requirement for any app with accounts).
- [ ] Google OAuth: keep consent screen on Testing until launch week, then submit verification. Monitor tokeninfo-fallback usage; long-term, resolve the `www.googleapis.com` IP block (different IP range or egress route).
- [ ] Privacy policy + terms pages live on the domain.

## Phase 4 — Resilience & capacity

- [x] Deploy shared rate limiting and retry-aware Android client (v0.2.27). Backend health, store failure probes and uploaded binary hashes verified; see `server/deploy/RATE_LIMITING.md`.
- [x] Resolve the Android `RateLimitFlowTest` assertion: the pending-outbox `/outcomes` query now returns failed submissions only, so a queued 429 retry is not counted as a failure. It passed isolated and in the full 34-test online fixture suite for v0.2.29.
- [ ] Staging environment + smoke test in the deploy path (stop hotfixing prod directly).
- [ ] Load test (k6) against staging: auth, sync, leaderboards; tune rate limits from real numbers.
- [ ] Postgres: WAL archiving + PITR, autovacuum sanity, connection-pool sizing.
- [ ] Cloudflare in front of nginx: APK egress + basic WAF. Proxying egress may also dissolve the Google 403.
- [ ] Metrics: Grafana Cloud free tier (p50/p95, error %, active sessions) — want this during closed testing, not after.

## Phase 5 — Launch week

- [ ] Freeze: no deploys 48h pre-launch; promote internal-test build → closed → staged production rollout.
- [ ] Rollback plan exercised: Play rollback (app), `/opt/insight-rollback-*` (server modules), forward-only migrations + snapshot restore (DB).
- [ ] Alert thresholds reviewed against closed-test baselines; support inbox + triage script ready.

## Phase 6 — Steady state

- [ ] Monthly: restore drill, `npm audit`/dependency scan, certs, alert review.
- [ ] Quarterly: capacity review, key/secret inventory rotation.

---

## Open items / blockers

1. **Launch date** — sets everything; the Play 20×14 gate means submit the closed test ~3 weeks before.
2. **Monetization** — IAP/ads/none. Affects Play policy work and Phase 4 sizing.
3. **Domain choice + registrar/DNS** (Cloudflare DNS recommended, fits existing stack).
4. **Tester pool** — ~20 Google accounts for the closed test.
5. **Sideload for China** — later decision; revisit if Chinese-speaking reach matters.

## Next actions (this week, in order)

1. Register the domain → point DNS at Cloudflare.
2. Generate + escrow the release keystore.
3. Stand up monitoring + alerting (backup failure first).
4. Run the first restore drill.
5. Scaffold the GitHub Actions CI (server tests first; AAB build second).
