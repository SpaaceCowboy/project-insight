# INSIGHT / Midori — Launch Readiness (Infrastructure)

> Owner: solo dev. Scope: infrastructure, distribution, compliance, operations.
> Out of scope: game design, core gameplay mechanics.
> Last updated: 2026-11-04 · Repo: `github.com:SpaaceCowboy/project-insight` (branch `android`, `2fdbc40`)

---

## Current state snapshot (facts, verified 2026-11-04)

**App**
- `com.insightpuzzle.app`, v0.2.26 (versionCode 37), minSdk 26.
- Signed with a **debug keystore** (`/root/.android/debug.keystore` on the VPS). Blocking for Play.
- Google sign-in live; email recovery implemented but `MAIL_DELIVERY_MODE=disabled` (no SMTP).

**Server** (`13.140.89.146`, single VPS)
- Ubuntu 24.04 · 2 vCPU · 3.8 GB RAM · 38 GB disk at 53%.
- Fastify v5 (Node 22) under nginx (`server_name _`, cert covers the raw IP only).
- systemd: `insight-online` (`Restart=on-failure`, `MemoryMax` unset), `insight-backup.service/.timer`, `insight-certificate.service/.timer`.
- Postgres 16.15. Rate limits: global 120/min, auth 8/15 min.
- No fail2ban, no unattended-upgrades.

**Ops**
- Builds happen on the VPS itself (prod machine = build machine). No CI.
- No external monitoring, no alerting, no error tracking, no metrics.
- Backups: daily age-encrypted dumps **on the same disk**, never restore-tested, no offsite copy.
- Known incidents that shaped this plan: Google `www.googleapis.com` 403 (IP reputation; tokeninfo fallback live), backup service silent failure 03:33→09:41 (mode 644 regression), hotfixes ship straight to prod.

---

## Phase 0 — Decisions

- [x] **D1. Distribution:** Play Store primary. Sideload channel stays possible later (China) — revisit if that market matters.
- [ ] **D2. Signing:** release keystore + Play App Signing. Mandatory before any public build. Current testers will uninstall/reinstall once — cheap now because Google/guest progress transfer already works.
- [ ] **D3. Domain:** register one (pending). Needed for: privacy policy, support email, account-deletion web link, DKIM/SPF email.
- [ ] **D4. Timeline & monetization:** launch date unset; IAP/ads undecided. IAP adds receipt validation; ads add mediation. Decide before Phase 3/4 sizing.

---

## Phase 1 — Harden what exists (cheap, do first)

- [ ] External monitoring (UptimeRobot or Betterstack): `/health`, HTTPS expiry, APK URL.
- [ ] Alerts: backup-service failure, disk >80%, restart loops, 5xx rate, cert expiry within 7 days. Telegram or email channel.
- [ ] Backup restore drill: decrypt latest `.dump.age` into a scratch DB on the box, verify schema + row counts. Automate monthly.
- [ ] Offsite backup replication (R2/B2 — dumps are age-encrypted, safe to ship).
- [ ] Server baseline: `unattended-upgrades`, fail2ban, audit `/root/.ssh/authorized_keys`, set `MemoryMax` on `insight-online`, nginx security headers.
- [ ] Server-side error tracking (Sentry free tier; correlation IDs already in logs).
- [ ] Runbooks in Obsidian vault: restore-from-backup, rollback (`/opt/insight-rollback-*`), cert failure, disk full.

## Phase 2 — Release pipeline & Play Store

- [ ] Generate release keystore — offline, encrypted copies in 2+ places, never unencrypted on the shared VPS.
- [ ] CI on GitHub Actions: server `tsc` + 25 unit tests; app lint + release **AAB** + checksums as artifacts. Keystore in Actions secrets.
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
