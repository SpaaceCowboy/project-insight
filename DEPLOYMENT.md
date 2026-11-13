# Android v0.2.31 — no-space usernames and Problem 43 hotfixes (13 November 2026)

Published [v0.2.31 APK](https://13.140.89.146/INSIGHT-online.apk?v=0.2.31), version code **42**, and distributed it to the Firebase `testers` group as release `2lbig60mus720`, project `portfolio-51f12`. The public download matched the signed candidate. Package `com.insightpuzzle.app`, signing certificate and Google Web client are retained.

**Migration 014 deleted accounts (approved after a read-only count).** It hard-deleted every account with whitespace in its username plus `Levels`, the same way the admin hard delete does, and added `users_username_no_space`. On production that was `Levels` (100 puzzles) and `Seed Creator 01`–`10` (8 published puzzles each): users 22 → 11, grids 333 → 153, XP rows 491 → 392, 11 `user.hard_delete` audit rows (no admin, reason "Problem 43 …"). The 4 other players who had solved those puzzles keep the credit (41 `retained_completions` rows). No real player's name had a space. The Journey is unaffected: it is `levels.json`, and `tools/journey-levels.json` is now its source. Re-running the seed script would create `Seed_Creator_NN` accounts.

Backend deployment replaced `server/dist/{username,nickname,operator,seed-community}.js`, added migration 014 (applied by the service's `ExecStartPre`), and gave the admin service the same username rule (`admin/dist/server/src/{username,nickname}.js`). The admin UI was rebuilt and redeployed afterwards for the rename help text (no spaces). Before the swap, a build with the old text was byte-identical to the live UI, so nothing else changed. Bundle `index-qbsD6Qs9.js`; the previous UI is in `/opt/insight-rollback-admin-ui-052/`. The encrypted backup `/opt/insight-online/backups/insight-20261113T113725Z.dump.age` ran first; the previous modules are in `/opt/insight-rollback-before-052/`. One 502 during the restart, then health, migration, constraint and the 401 gates passed; insight-admin is active. The other live modules differ from a fresh build only in CRLF line endings and were left alone.

Validation on the VPS: 38 server unit tests, 31 server and 11 admin database integration tests (throwaway database `insight_release_052_test`, dropped afterwards), including migration 014 and the no-space rule; 79 Android unit tests in both build variants. Device suites were not run. Haptics and the navigation handle still need a physical phone; debug builds log `InsightNavBar` for the edge-swipe check.

Build source: `/opt/insight-release-052-android` (commit `0246401`); artifacts: `/root/insight-052-apks`; source archive `/root/insight-052-source-archive.tar.gz`, SHA-256 `4488fac540608eb147f6715a17695eb667890798e20b04dcc5632a9719fb8480`. Online APK SHA-256: `fb11ac62c021a6ec931a74ecd252e21d28cb5c7cdef3eba22b2c512d7c9fbeda`. Certificate SHA-256: `3008529664ef52092022f4a3a0fc77a43f56d18ccaa947ecdf0be5daabd28c9a`. Prior public APK: `/root/insight-apk-rollbacks/INSIGHT-online-v0.2.30-before-052.apk`.

# Android v0.2.30 — 100-level Journey, share links and hotfixes (12 November 2026)

Published [v0.2.30 APK](https://13.140.89.146/INSIGHT-online.apk?v=0.2.30), version code **41**, and distributed it to the Firebase `testers` group as release `27252lt740jpo`, project `portfolio-51f12`. The public download matched the signed candidate. Package `com.insightpuzzle.app`, signing certificate and Google Web client are retained; the embedded production HTTPS URL was verified.

Journey is now the 100 published puzzles of the account `Levels` (exported read-only from production into `tools/journey-levels.json`, converted by `tools/import-journey.mjs`; 98 routes are proven shortest, levels 78 and 96 are full 5x5 boards whose routes come from a beam search). The backend serves the same `levels.json`. Migration `013_journey_100.sql` deleted every `campaign_progress` row and the Journey badges (`first`, `levels-*`, `complete`) from `imported_badges`; accounts, XP, community puzzles and the other badges are untouched. `/v1/progress/import` now takes `journey: 2`; imports without it (older APKs) are accepted and change nothing, and the old 206-level milestone IDs stay accepted so those requests do not fail. The app clears its old Journey save once per device (`Store.journeyEdition`).

Share links: `https://www.midoripuzzle.com/p/<code>` (the bare domain redirects to `www`, and Android does not verify app links through a redirect, so links name `www`; the app accepts both hosts). The website (`web` branch; Vercel production deploys from it) serves `/.well-known/assetlinks.json` for `com.insightpuzzle.app` and `com.insightpuzzle.app.preview` and rewrites `/p/:code` to the site; Google's Digital Asset Links API returns both statements. Android 8.0 (API 26) has a platform bug where its verifier crashes when such an app is installed ("Intent Filter Verification Service has stopped"); it is a system dialog, fixed in 8.1. On the test AVD the verifier was disabled for the device suites.

Backend deployment replaced `server/dist/campaign.js`, `server/dist/online.js` and `app/src/main/assets/levels.json` and added migration 013, applied by the service's `ExecStartPre`. Encrypted backup `/opt/insight-online/backups/insight-20261112T192241Z.dump.age` ran first; previous modules and levels are in `/opt/insight-rollback-before-051/`. Counts before → after: 22 users, 333 grids, campaign rows 204 → 0, Journey badges 14 → 0, other badges 37 → 37, XP rows 490 → 490. Health, migration, live campaign (100 levels) and the 401 gates passed; no restarts after.

Validation: 38 server unit and 30 database integration tests (locally, PostgreSQL 18), including migration 013 and edition-gated imports; 79 Android unit tests replaying all 100 Journey routes; the full 34-test preview device suite and the full 34-test online fixture suite (fixture on the new backend code) on the Android 8 AVD `insight-qa-vps`. Device tests that played moves on the old first levels now use Journey 4 and 5, the largest-board check finds the largest board, and the preview demo's sample puzzles are Journey 4, 9 and 16. Haptics and the navigation bar are not verifiable on an emulator; physical-phone checks remain outstanding.

Build source: `/opt/insight-release-051-android`; artifacts: `/root/insight-051-apks`; source archive `/root/insight-051-source-archive.tar.gz`, SHA-256 `b2c2492333ffd7bec4cf690b7ccad53ef80e75843000a29fda98460c708b4b5b`. Online APK SHA-256: `1b7886074a497d7bc1fa4ffd647d8a7bf3e15417bb9ccd841f51200e8d3ca48e`. Certificate SHA-256: `3008529664ef52092022f4a3a0fc77a43f56d18ccaa947ecdf0be5daabd28c9a`. Prior public APK: `/root/insight-apk-rollbacks/INSIGHT-online-v0.2.29-before-051.apk`. Leftovers from v0.2.29 (the API 33 gesture emulator and the fixture server on port 38861) were stopped; the old test databases `insight_release_040_test` and `insight_release_050_test` still exist.

# Android v0.2.29 — swipe transitions and creator polish (11 November 2026)

Published [v0.2.29 APK](https://13.140.89.146/INSIGHT-online.apk?v=0.2.29), version code **40**, and distributed it to the Firebase `testers` group as release `6p2cm8f86j088`, project `portfolio-51f12`. The public download matched the signed candidate. Package `com.insightpuzzle.app`, signing certificate and Google Web client are retained; the embedded production HTTPS URL was verified.

This batch slides the old platform out while the next Journey level or online puzzle arrives, and morphs the target's tiles into the new target (matching colours glide; unmatched tiles fade out/in). After a solve the result bar sinks first, then the same slide opens the next puzzle; if an online next cannot connect, the bar returns for a retry. Journey one's first-play tips wait half a second after the screen settles, and the online tips now explain the target after the grid. Home's Designed and Solved counts come from a per-account cache and are written after every solve/publish, with a quiet refresh while Home is open. Restart and creator clear use the quiet corner-drag amplitude (80) for all three pulses. Dragging a creator tile repeatedly hides Android's navigation handle and excludes the screen from system gestures while the tile is in hand. The shelf and stage-button guide borders now clear the tiles and balance their top/bottom space. Another player's Follow and Achievements keys share one row, so three rows of puzzles fit like your own profile. The pagination loading circle is gone; only the offline retry mark remains. The pending-outbox query now returns failed submissions only, fixing the long-running `RateLimitFlowTest`.

The backend removes the default ten-puzzles-a-day cap: publication is unlimited unless an operator sets `CREATE_DAILY_LIMIT`, and `DEVELOPER_USER_IDS` remains exempt. No migration. Encrypted backup `/opt/insight-online/backups/insight-20261110T212232Z.dump.age` ran before rollout; the previous modules are at `/opt/insight-rollback-before-050/dist/`. Counts after deployment: 21 users, 218 grids, 199 campaign rows and 480 XP rows. Health, capabilities and the 401 authentication gates passed; the service restarted cleanly with no restarts after.

Validation: 38 server unit, 29 database integration and 7 Redis integration tests (6 passed, 1 skipped); 77 Android unit tests; the full 34-test preview device suite and the full 34-test online fixture suite (including `RateLimitFlowTest`); the signed online APK has version code 40, the original certificate, the expected embedded URL/client and a public SHA-256 matching the tested candidate; it installed and launched on the Android 8 AVD (`insight-qa-vps`). The API 33 gesture-navigation AVD could boot but its software-rendered System UI became unresponsive, so the gesture-handle drag path is not device-verified on a gesture-navigation build; physical-phone checks were not performed.

Build source: `/opt/insight-release-050-hotfix`; artifacts: `/root/insight-050-apks`; source archive `/root/insight-050-source-archive.tar.gz`, SHA-256 `ca9fb745987a287bb7262fa7c242e5d024a0ff0af75131555b00b098d2fbf4a1`. Online APK SHA-256: `9dcbea36bfbefaf4710e2aa11ea02a4baff1701228c71a45d74fc53e7ba22a2e`. Certificate SHA-256: `3008529664ef52092022f4a3a0fc77a43f56d18ccaa947ecdf0be5daabd28c9a`. Prior public APK: `/root/insight-apk-rollbacks/INSIGHT-online-v0.2.28-before-050.apk`.

# Android v0.2.28 — swipes, solved count and haptics (9 November 2026)

Published [v0.2.28 APK](https://13.140.89.146/INSIGHT-online.apk?v=0.2.28), version code **39**, and distributed it to the Firebase `testers` group (3 testers) as release `1embbaeavv6m8`, project `portfolio-51f12`. The public download matched the signed candidate. Package `com.insightpuzzle.app`, signing certificate and Google Web client are retained; the embedded production HTTPS URL was verified.

This batch stops a page swipe at the edge of the loaded puzzles rather than showing a blank or half-drawn page, and makes Worlds' "Solved" readout equal Profile's by excluding the player's own puzzles and campaign duplicates. The gesture handle is hidden again whenever the system restores it under gesture navigation; the creator's last two phases keep a dragged tile inside the outline; haptics are 11 ms at about 50% with a quiet tick per list row and a three-pulse restart/clear; the "pending submissions" line is gone; Players can be sorted by Most followed; a lost connection retries with 2–30 s backoff and failed screens reload; Rulebook sentences are shorter in all five languages. Developer-mode debug builds can publish again.

The backend adds `communityCount` to `/v1/progress`, `followerCount` and `sort=followed` to `/v1/creators`, and `DEVELOPER_USER_IDS` to exempt listed accounts from the daily publish limit. No migration. Encrypted backup `/opt/insight-online/backups/insight-20261109T143454Z.dump.age` ran before rollout; the previous modules are at `/opt/insight-rollback-before-049/dist/`. Counts after deployment: 21 users, 198 grids, 197 campaign rows, 477 XP rows and all 80 seed puzzles. Health, capabilities and the 401 authentication gates passed.

Validation: 38 server unit and 28 database integration tests; 73 Android unit tests; the signed online APK has version code 39, the original certificate and the expected embedded URL/client; the public SHA-256 matched. The APK installed and launched offline on the Android 8 AVD (`insight-qa-vps`), reached Home and stayed foreground with no app errors. The full device suite and the unresolved v0.2.27 `RateLimitFlowTest` were not rerun; physical-phone checks were not performed.

Build source: `/opt/insight-release-049-hotfix`; artifacts: `/root/insight-049-apks`; source archive SHA-256: `3a1bbf0b4e905e7c7af1688b2adf1f5a242551b109c64e9e121a229521d0f917`. Online APK SHA-256: `f9aae30553cb154c985c671995ed761ae6e815f4de1673369a17c96dcd38295b`. Certificate SHA-256: `3008529664ef52092022f4a3a0fc77a43f56d18ccaa947ecdf0be5daabd28c9a`. Prior public APK: `/root/insight-apk-rollbacks/INSIGHT-online-v0.2.27-before-049.apk`.

# Android v0.2.27 — shared rate limits and tester distribution (6 November 2026)

Published [v0.2.27 APK](https://13.140.89.146/INSIGHT-online.apk?v=0.2.27), version code **38**, and distributed it to the existing Firebase `testers` group (2 testers). Firebase release: `2bb24q5e4qa2g`, project `portfolio-51f12`. Both the public download and a fresh download from Firebase matched the signed candidate. Package `com.insightpuzzle.app`, signing certificate and Google Web client are retained; the embedded production HTTPS URL was verified.

The backend now uses Redis token buckets with stacked IP/account/action quotas, bounded authentication work, retryable store failures and policy-specific logs. nginx request/connection protection is installed. Android persists scoped server cooldowns and retains queued operation IDs while waiting. Native Redis runs as `insight-rate-limit-redis.service`, using only `/run/insight-rate-limit/redis.sock` (660, `redis:insight-rate-limit`), AOF and no eviction. The API user belongs to the dedicated socket group; Redis cannot read the private API environment. See [the rate-limit runbook](server/deploy/RATE_LIMITING.md).

An encrypted backup preceded provisioning: `/opt/insight-online/backups/insight-20261106T113026Z.dump.age`. Rollback copies of the original backend, environment, nginx config and APK are in `/opt/insight-rollback-048` (private). The original live backend directory is also retained at `/opt/insight-online/server.next-048` after an atomic directory exchange. The new backend has `.insight-release=048`. No SQL migration or production test account was created. The production campaign file stays untouched; all 206 boards and par values match both the candidate and the prior published APK despite byte-level metadata/formatting differences. A fresh post-deployment encrypted backup succeeded; the backup script remains executable.

Live local/public health, capabilities, authentication gates, invalid-request responses and all four services (API, Redis, nginx, PostgreSQL) passed. Preparation included the previously recorded 38 server unit, 26 database integration, 7 Redis integration and 71 Android unit checks; the release build and final signature/URL/client checks passed. **The new Android `RateLimitFlowTest` failed an assertion on the isolated Android 8 emulator. Further device regression and upgrade checks were not completed; publication proceeded after the user's explicit publish-now instruction.** This test remains unresolved; do not describe this release as having passed device verification. Test fixtures, emulators and temporary databases were stopped/removed. The separate pre-existing randomized Google username fallback defect remains tracked in `readiness.md`.

Build source: `/opt/insight-release-048-rate-limits`; APKs and metadata: `/root/insight-048-apks`; source archive SHA-256: `d0fc479f3a93487a79d7d6d554d5b3766cea08a868b03cd8d0c7d117552183db`. Online APK SHA-256: `74c1cefd0c0f858b62d85d2c26837700c59d588bffe1b82816f40c0def9c8e7d`. Certificate SHA-256: `3008529664ef52092022f4a3a0fc77a43f56d18ccaa947ecdf0be5daabd28c9a`. Vault updates were skipped at the user's instruction.

# Firebase App Distribution — tester update channel (4 November 2026)

Until Play internal testing exists, testers get builds through Firebase App Distribution instead of downloading the APK by hand. The Firebase project is `portfolio-51f12` (the existing Google Cloud project), the Android app is `com.insightpuzzle.app` with App ID `1:151163156759:android:6f1ac10b6f68910c5adf52`, and the tester group is `testers`. No Firebase SDK, `google-services.json` or SHA-1 is involved — this is a distribution channel only.

First release: v0.2.26 (37), release `5n0rs65vkltvg`. Testers accept the invite once and install; later builds arrive as updates in the App Tester app. Confirmed on 4 November: the invite arrived and the build installed over the sideloaded copy in place, with data intact. The build is signed with the current debug key — that stops being true when the release keystore lands, and testers will need one uninstall/reinstall at that point.

The service account key is `/etc/insight-ops/firebase-sa.json` on the VPS (root, 600) with a copy at `~/.config/insight/firebase-sa.json` for workstation uploads; it is project-scoped and revocable from GCP → IAM → Service accounts at any time. Distribution is `server/deploy/distribute-apk.sh <apk> ["notes"]`.

Two environment quirks. The CLI's uploader fails on Node 26 with `InvalidArgumentError: invalid onError method`, so it runs under Node 20–24. And this host resolves Google over IPv6 first while its IPv6 route answers with error pages — the first upload burned the CLI's full 300 s task timeout on a 17 MB binary (the upload had actually completed server-side, which is why the retry reported "already existing release"). With `NODE_OPTIONS=--dns-result-order=ipv4first`, now inside `distribute-apk.sh`, the same upload finishes in about seven seconds, so distribution stays on the VPS after publishing.

# Backup restore drill — first run and monthly automation (4 November 2026)

The newest dump (`insight-20261104T094153Z.dump.age`, 490,685 bytes) was decrypted through a pipe directly into `pg_restore`, so plaintext never landed on disk. It restored into a scratch `insight_restore_drill` database in 0.57 s and was verified before being dropped: the table list matched the live schema exactly (26 tables), and `users`, `grids`, `completions`, `xp_ledger`, `schema_migrations`, `campaign_progress` and `content_claims` matched exactly — 20, 172, 162, 340, 11, 119 and 377 rows. `schema_migrations` records `name`/`applied_at` rather than a `version` column; migration 011 is the newest.

`insight-restore-drill.timer` now runs `restore-drill.sh` on the first of each month at 04:30 UTC (randomised, persistent): restore the newest dump with `--exit-on-error`, refuse a table list that differs from live, refuse a database with no users or grids, drop the scratch database, and record a success timestamp in `/var/lib/insight-ops/restore-drill`. The box watcher alerts if the unit's last result is not success or the timestamp is older than 35 days.

Both paths were exercised: a deliberately wrong age key exited 1 and still dropped the scratch database, and a normal run through systemd logged `drill passed: … -> users=20 grids=172`. The drill is read-only against the live database — it reads `information_schema` and table counts from `insight`, nothing else.

# Box watcher — silent-failure alerts (4 November 2026)

`insight-watch.timer` runs `/opt/insight-ops/insight-watch.sh` every five minutes and messages Telegram when a condition appears or clears — never repeatedly while it persists. It checks the API on `127.0.0.1:3000` and again through nginx with TLS validated, the published APK's content length, `insight-online`/`nginx`/`postgresql` and the backup and certificate timers, the backup unit's last result plus newest dump age (27h limit), root disk (80%), available RAM (250 MB floor), the certificate nginx actually serves (3-day threshold — these are ~6-day IP certificates, renewed twice daily), five or more 5xx responses in six minutes, and the service's automatic restart count.

Configuration is `/etc/insight-ops/watch.env` (root, 600): the Telegram bot token and chat id, plus optional threshold overrides. State lives in `/var/lib/insight-ops` and holds the currently-open problems and the last restart count. `--dry-run` prints the current state without sending or saving anything; `--test` sends one message. If the token or chat id is missing, alerts are logged to the journal and suppressed rather than failing the unit.

Source of truth: `server/deploy/insight-watch.sh`, `insight-watch.service`, `insight-watch.timer`, `watch.env.example`. Installed at `/opt/insight-ops/insight-watch.sh` (755) with the units in `/etc/systemd/system`. Verified on 4 November with a test message, a simulated disk problem (`DISK_LIMIT=1`) and its resolution — the journal recorded `1 new` then `1 resolved`, and the state file returned to empty.

# Server hotfix — Google sign-in verification (4 November 2026)

Google sign-in reached the API and was refused with `GOOGLE_INVALID` for every real account. The token was fine: `google-auth-library` verifies an ID token by fetching Google's signing keys from `https://www.googleapis.com/oauth2/v3/certs`, and that host answered this VPS with Google's own `403 Forbidden` page over IPv6, which the host tried first, so no key could be loaded (see the correction below). `oauth2.googleapis.com` and `accounts.google.com` are reachable from the same machine, so the block is specific to `www.googleapis.com` and not a general egress problem.

`googleVerifier` now keeps the library path first and, when it throws, has Google validate the token at `https://oauth2.googleapis.com/tokeninfo?id_token=…` — signature, issuer and expiry are checked there — while the audience, expiry and verified email are still checked here. A token whose audience is not the Web client, whose issuer is not Google, whose expiry has passed, whose email is unverified, or whose call fails, is refused with the same `GOOGLE_INVALID`. The fallback disappears by itself if the block is lifted. Six new unit tests cover the fallback, the audience, issuer, expiry and unverified-email refusals (25 server unit tests in total, all passing).

The same rollout exposed a second problem: `server/deploy/native-backup.sh` is committed as mode 644, so the v0.2.26 deployment stripped its execute bit and `insight-backup.service` failed with `203/EXEC` from 03:33 until it was found here — two scheduled backups were missed. The file is executable again in git and on the server, and a fresh backup (`insight-20261104T094147Z.dump.age`) succeeded before this module was replaced. Check `systemctl show insight-backup.service -p Result` after any deployment that refreshes `server/`.

Deployed: `server/dist/google.js` alone; previous module kept at `/opt/insight-rollback-before-047/dist/google.js`. One 502 during restart before the health retry succeeded. `/v1/capabilities` still reports Google available, and a junk token still returns `401 GOOGLE_INVALID`. No Android build or APK changed.

Confirmed with a real Google account on 4 November: `/v1/auth/google` answered `200` in 322 ms (roughly 200 ms of that is the refused key fetch before the fallback) and the player reached the username step. If `www.googleapis.com` is ever reachable from this host again, the library path takes over and the extra round trip disappears on its own.

**Correction, later the same day:** the 403 is not a general block on `www.googleapis.com` — it happens only over IPv6, which this host tried first. `curl -4 https://www.googleapis.com/oauth2/v3/certs` returns `200`; `curl -6` returns Google's 403 page. The same broken IPv6 route made the first Firebase App Distribution upload exhaust its 300 s timeout. The API service now runs with `NODE_OPTIONS=--dns-result-order=ipv4first` (drop-in `/etc/systemd/system/insight-online.service.d/ipv4-first.conf`, source `server/deploy/insight-online-ipv4-first.conf`), so `google-auth-library` fetches the signing keys normally and the tokeninfo fallback is dormant: a JWT-shaped junk token now returns `401` in about 140 ms instead of 320–410 ms. The fallback stays as a guard in case this IP is refused for real.

# Android v0.2.26 — Google sign-in, email recovery and guest progress (4 November 2026)

Published [v0.2.26 APK](https://13.140.89.146/INSIGHT-online.apk?v=0.2.26), version code 37. The package ID, signing certificate, saved preferences and download address are unchanged.

This batch adds **Continue with Google** to the auth screen. A new Google account returns a suggested public username and is created only after the player confirms or edits it; a verified Google email that already belongs to a password account links to that account. Password accounts gain **Forgot password?**: an eight-digit email code (15 minutes, five attempts) sets a new password, revokes every old session and signs the player in automatically. The server stores only Google's stable subject; Google passwords never reach the app or service.

Journey progress saved while signed out now moves into the first account created on the device: solved levels and badges are sent through the existing import endpoint, while the unfinished attempt and last open level are copied locally so the player resumes where they left off. Imported levels still award no XP.

The backend adds migration `011_google_and_recovery.sql` (`users.google_sub`, a unique partial index, and a pending-outbox index), `google-auth-library`, and the `/v1/auth/google`, `/v1/auth/recover/request` and `/v1/auth/recover/confirm` routes. `/v1/capabilities` now reports the mail mode and Google availability. **Email delivery is intentionally disabled** (`MAIL_DELIVERY_MODE=disabled`): the app hides password recovery until Gmail SMTP credentials are installed and that setting is changed to `smtp`. Google Cloud still needs an **Android OAuth client** for package `com.insightpuzzle.app` and signing SHA-1 `B9:1D:DA:64:02:61:F0:5F:E1:F3:89:90:AE:B7:F0:88:CE:A3:D2:D0`; the Web client ID `23451949348-8sq17di0cd7qnubngpbae2l1m6c5v9vm.apps.googleusercontent.com` is configured in both the app and `.env`.

VPS validation: 19 server unit tests and 26 integration tests; 63 Android unit tests; the 31-test Android device suite against an isolated local fixture (including registration/login, email reset with auto-login, guest progress import, discovery, creator publishing, feedback, persistence and upgrade checks); and the final APK metadata, signature, embedded HTTPS URL and Google client ID. The server was backed up first (`/opt/insight-online/backups/insight-20261103T212915Z.dump.age`), migration 011 applied, and counts before/after were 20 users, 172 grids, 119 campaign rows and 340 XP rows. Health and `/v1/capabilities` were checked; an invalid Google token returns `GOOGLE_INVALID`, and recovery returns `MAIL_UNAVAILABLE` while mail is disabled.

The prior public APK is `/root/insight-apk-rollbacks/INSIGHT-online-v0.2.25-before-046.apk`; publication replaced the download atomically and verified its public SHA-256. Build source: `/opt/insight-release-046-android`; artifacts: `/root/insight-046-apks`. Physical-phone checks and real Google account-picker sign-in were not run; that flow still needs a device with Play Services and a Google account.

Online SHA-256: 00ac99d7f703222c956e970f920f4f2c061e23c19d173879cc53b2d81df83848. Preview SHA-256: bb2f1aeb20c385e3baae4aa9aa6d08e93b32d33e36b4efb7f9b8b875283e925d. Certificate SHA-256: 3008529664ef52092022f4a3a0fc77a43f56d18ccaa947ecdf0be5daabd28c9a.

# Android v0.2.25 — Home counts, a quicker Options and an icon that waits (2 November 2026)

Published [v0.2.25 APK](https://13.140.89.146/INSIGHT-online.apk?v=0.2.25), version code 36. This is an APK-only release: package ID, signing key, saved preferences, download address and the backend are unchanged.

This batch gives Home two readouts: Journey's key shows the campaign's solved total on a thin bar under its word ("142 / 206"), and Worlds' key shows "Designed" and "Solved" for a signed-in player. Both keys lift 8dp and settle once Home is uncovered, like the game board. The two trial looks in Options → About ("New colours", "Smooth 3D") are removed together with their drawing paths, so tiles and plates keep the standard face and side; the volume rows are shorter (12sp labels, 38dp track) and Options rows sit 10dp apart. The alternative launcher icon is now recorded as a wish and switched when the app leaves the foreground, because enabling another launcher entry while the task runs makes Android close that task; the Options row shows the wish at once. Worlds keeps its search at the top and its action keys at the bottom while the keyboard is up instead of lifting the page, and swiping to another page lets go of a search field's focus and hides the keyboard.

VPS validation passed: 63 Android unit tests; the 22-test preview device suite; four compact 360x640 / 200% text checks; an Android 8 check that chose the alternative launcher entry, left the app, confirmed the enabled alias switched from `LauncherDefault` to `LauncherAlt` while the process stayed alive, returned, and switched it back; and a signed v0.2.24-to-v0.2.25 upgrade whose `insight.xml` preferences were identical before and after and whose app launched. The backend was not touched — no module, migration, asset or restart — and stayed up.

The prior public APK is `/root/insight-apk-rollbacks/INSIGHT-online-v0.2.24-before-045.apk`; publication replaced the download atomically and verified its public SHA-256. Build source: `/opt/insight-release-045-android`; artifacts: `/root/insight-045-apks`. Physical-phone checks were not performed.

Online SHA-256: 3ff61f37807c89e9a3a9dd69c42fec5b37c1f081dc7e1e942b5e29fe84de1eb9. Preview SHA-256: a66cec0adec86e9874222a5817dec9b6b9c9d08c9f91ae06b4043b75a0d0ce0a. Certificate SHA-256: 3008529664ef52092022f4a3a0fc77a43f56d18ccaa947ecdf0be5daabd28c9a.

# Android v0.2.24 — Options stays open on Android 8–11, and the keyboard keeps the handle (2 November 2026)

Published [v0.2.24 APK](https://13.140.89.146/INSIGHT-online.apk?v=0.2.24), version code 35. This is an APK-only release: package ID, signing key, saved preferences, download address and the backend are unchanged.

This batch replaces v0.2.23, which crashed on Android 8–11 (API 26–30) as soon as the Options page composed its icon row: the alias name was read with `Class.getPackageName()`, which the platform only added in API 31, so the call threw `NoSuchMethodError` inside composition. The name is a literal again — the manifest merger resolves the aliases against the namespace, so `com.insightpuzzle.app.Launcher*` is correct in both the connected and the demonstration build — and both icon calls are guarded, so a refused lookup or switch is logged and leaves the row showing "not switched" instead of taking the page down. Compiling at all did not catch this: the stub is present at compileSdk 37, so only the API database and a device below 31 would have.

While the keyboard is up the navigation handle now comes back, so the keyboard sits above it as before, and it is hidden again when the keyboard closes; every screen still reserves the handle's room, so nothing is laid out again. This also stops the focus-driven re-hide from fighting the keyboard as it opens.

VPS validation passed: 63 Android unit tests; signed 0.2.24 online and preview builds with the original certificate, version code 35 and Android 8 minimum, both manifesting the two launcher aliases; publication replaced the download atomically and verified its public SHA-256. The backend was not touched and stayed up. The prior public APK is `/root/insight-apk-rollbacks/INSIGHT-online-v0.2.23-before-044.apk`. Build source: `/opt/insight-release-044-android`; artifacts: `/root/insight-044-apks`. Neither the emulator suite nor a physical phone was used, so the Options page below API 31 and the keyboard/handle behaviour have not been run on a device.

Online SHA-256: ba62d3c32519805d474586b0becae0a3457ebb9efeb63733eaacc2619306f041. Preview SHA-256: 81bda7069947f128c9d7faeaee5b69dfd348dce76d5db3ece0fe4194ec9ce98d. Certificate SHA-256: 3008529664ef52092022f4a3a0fc77a43f56d18ccaa947ecdf0be5daabd28c9a.

# Android v0.2.23 — Two looks to try, a second icon and a warmer start (2 November 2026)

Published [v0.2.23 APK](https://13.140.89.146/INSIGHT-online.apk?v=0.2.23), version code 34. This is an APK-only release: package ID, signing key, saved preferences, download address and the backend are unchanged.

Options → About gains two looks to try: "New colours" paints every tile one exact colour with a flat face and only its side shaded (colour-blind mode keeps its own colours when both are on), and "Smooth 3D" tapers the side of every plate and tile to nothing at its ends instead of a band of one thickness that stops at the rounded corners. Both are saved. Options gains "Alternative icon": the same icon with its background and mark colours swapped, declared as a second launcher alias, with the new entry enabled before the old one is disabled, MainActivity never disabled and the process not restarted — the launcher may take a few seconds to show it. The splash holds for at least 1300ms and at most 3000ms, waits for the local preload (username word lists, saved-data database, vibrator) alongside the sounds, and composes the first screens' shapes once beneath it so their fonts, shadows and clips are ready. A screen that leaves clears focus and hides the keyboard at once, so the screen it reveals is not laid out against an open keyboard, and Home no longer shrinks for the keyboard at all. The board's lift now happens on every appearance of the game screen rather than only on entering from outside a game — 8dp over 300ms — and settles only after its sheet and any screen sinking away above it have finished; the guide lamp follows it. A profile rebuilt after Back starts from the last copy held in memory, and the startup warm-up fetches the player's own profile too.

Verification fixed the icon switch's component name: the aliases are declared relative to the namespace, so both builds declare `com.insightpuzzle.app.Launcher*` even though the demonstration build's application id is `com.insightpuzzle.app.preview`; the app now derives the name from its own class package instead of the application id. (That derivation turned out to need API 31 and crashed Options on Android 8–11; v0.2.24 replaced it with a literal.)

`app/src/main/baseline-prof.txt` was added by this batch but has no effect in this APK: AGP ran no profile compilation and packaged no `assets/dexopt/baseline.prof` for the debug variant, so nothing was installed. It needs a release build or the ProfileInstaller dependency before it does anything.

VPS validation passed: 63 Android unit tests; signed 0.2.23 online and preview builds with the original certificate, version code 34 and Android 8 minimum, both manifesting the two launcher aliases; and publication replacing the download atomically with its public SHA-256 verified. The backend was not touched — no module, migration, asset or restart — and stayed up. The prior public APK is `/root/insight-apk-rollbacks/INSIGHT-online-v0.2.22-before-043.apk`. Build source: `/opt/insight-release-043-android`; artifacts: `/root/insight-043-apks`. The emulator device suite and physical-phone checks were not run, so the icon switch and the two looks have not been exercised on a device.

Online SHA-256: 2d8ed83629d8f593008396c4a4e3b596f384264289bcc0998c4a70df10aed8c3. Preview SHA-256: 4e2082095a559fcb6b32218ff8fed38b490a28ab4fc7308edef4e6fec35917ac. Certificate SHA-256: 3008529664ef52092022f4a3a0fc77a43f56d18ccaa947ecdf0be5daabd28c9a.

# Android v0.2.22 — Glued slurs refused, a quieter chrome (2 November 2026)

Published [v0.2.22 APK](https://13.140.89.146/INSIGHT-online.apk?v=0.2.22), version code 33, with the matching username filter on the backend. Package ID, signing key, saved preferences and download address are unchanged.

This batch refuses a username that is nothing but banned words glued together — "killjew", "dickass", "analsex" — which no whole-word rule could match, and reports the strongest rule among the pieces; a name with letters left over stays fine, so "Assassin" (ass + ass + "in") and "Hassan" still pass. The app and the server share the rule and the same case list. The gesture handle is now hidden from the first frame on every screen rather than only while a puzzle or the creator is open, and hidden again whenever the window regains focus after a dialog, the keyboard or another app; dialogs and sheets hide it in their own window, and every screen still reserves its room so nothing is laid out again. A puzzle opened from outside a game lifts 2dp instead of 24dp and settles over 220ms once its sheet has finished rising, so the settle is seen instead of happening behind the slide. The splash no longer waits for the first community pages: the preload runs in the background, because a blocking request cannot be cancelled and a slow server used to hold the splash.

The build added the `ExperimentalLayoutApi` opt-in the sort sheet's always-counted navigation-bar insets need, and the server filter's indexed reads were given explicit defaults so the strict compiler accepts them without changing a verdict.

VPS validation passed: 63 Android unit tests, including the glued-word cases in the shared fixture that the app and server both read; the signed 0.2.22 online and preview builds with the original certificate, version code 33 and Android 8 minimum; 18 server unit tests; and the deployed module answering NAME_HATE for "killjew", NAME_PROFANITY for "dickass" and null for "Assassin". The backend change is `server/dist/username.js` alone — no migration, no other module and no restart of anything but the service. Encrypted backup `/opt/insight-online/backups/insight-20261102T083536Z.dump.age` ran before rollout, and the previous module is kept at `/opt/insight-rollback-before-042/dist/username.js`. The service returned one 502 during restart before the health retry succeeded. Counts after deployment: 18 users, 161 puzzles, 91 campaign rows, 291 XP rows and all 80 seed puzzles; the four authenticated paths still answer 401 and feedback remains store-only. The prior public APK is `/root/insight-apk-rollbacks/INSIGHT-online-v0.2.21-before-042.apk`; publication replaced the download atomically and verified its public SHA-256. Build source: `/opt/insight-release-042-android`; artifacts: `/root/insight-042-apks`. The emulator device suite and physical-phone checks were not run.

Online SHA-256: a67618fb726f3c2f7a190e6e5bab674025b35cd1f67c1780f94a4b3e26240ff6. Preview SHA-256: ab399b01de45330c1dcc0c817672e816649366945e722974cbd710d69c4a051b. Certificate SHA-256: 3008529664ef52092022f4a3a0fc77a43f56d18ccaa947ecdf0be5daabd28c9a.

# Android v0.2.21 — One username line, a settling board and a steady safe area (1 November 2026)

Published [v0.2.21 APK](https://13.140.89.146/INSIGHT-online.apk?v=0.2.21), version code 32. This is an APK-only release: package ID, signing key, saved preferences, download address and the backend are unchanged.

This batch puts every username refusal on one line under the username box — the rule broken, shown as soon as it is, or the server's reason (taken, or a rule) after sending — and clears it when the name is edited. Login and Create account stay muted until the boxes they need are filled, and a username that breaks a rule is no longer repeated in the form's message line or sent for. A puzzle opened from outside a game lifts its outline and grid 24dp and settles them down over 320ms, skipped when motion is reduced and never between puzzles, on a swipe or on the way back from Options. Screens now reserve the navigation bar's room even while Journey or the creator hide the gesture handle, so hiding and revealing it never measures the screen again; the handle waits 400ms for the screen to settle and any open game keeps it hidden rather than only the top route. Bookmarked, Following and a new account's own puzzles show nothing instead of a placeholder line, and the three strings only those lines used left the translations.

The build added the `ExperimentalLayoutApi` opt-in that the always-counted navigation-bar insets need. Two device tests now read the open Journey page's last level and a tile's current bounds instead of assuming the old 32-level pages and a position measured before the level swipes; the first had also been failing on v0.2.20.

VPS validation passed: 63 Android unit tests, including the new checks that username refusals go to the username line and that sign-up needs every box while login needs two; the 22-test preview device suite; four compact 360x640 / 200% text checks; and a signed v0.2.20-to-v0.2.21 upgrade whose `insight.xml` preferences were identical before and after and whose app launched. The backend was not touched — no code module, migration, asset or restart — and has stayed up since the v0.2.20 rollout with no restarts.

The prior public APK is `/root/insight-apk-rollbacks/INSIGHT-online-v0.2.20-before-041.apk`; publication replaced the download atomically and verified its public SHA-256. Build source: `/opt/insight-release-041-android`; artifacts: `/root/insight-041-apks`. Physical-phone checks were not performed.

Online SHA-256: 74ce9112b081303dd864d3dfdeb01793a5b9aa2c6fabed22f1d69d842174d634. Preview SHA-256: 5988899108f0d834de2880bfc8459eb73021626efeba508f7040f90ccd3634c4. Certificate SHA-256: 3008529664ef52092022f4a3a0fc77a43f56d18ccaa947ecdf0be5daabd28c9a.

# Android v0.2.20 — Studio levels and the target tip (1 November 2026)

Published [v0.2.20 APK](https://13.140.89.146/INSIGHT-online.apk?v=0.2.20), version code 31, with the matching campaign asset on the backend. Package ID, signing key, saved preferences and download address are unchanged.

This batch makes the Android campaign follow the web campaign exactly: six studio levels appended by the web editor (worlds 10–11, Serenade through Magnum Opus) take Journey from 200 to 206 levels, and the completion achievement becomes "All 206 Journey Puzzles". Badges already earned are kept, so players who finished the 200-level campaign keep "complete" while the new levels extend their progress. The first-play tips gained a step that points at the target board right after the grid step, and a tap on the board during that step no longer advances them. Journey and the creator hide the system gesture handle while playing; Android shows its one-time "Viewing full screen" confirmation the first time a device enters that mode. Creator SHAPE-stage notes sit under the stage heading, tip plates keep one size and font across steps, the Next key's border clears its side wall, locked collection cards fade face and wall instead of clipping their shadow, and big keys stop rebounding past rest when released.

VPS validation passed: 61 Android unit tests replaying all 206 campaign solutions; a signed v0.2.19-to-v0.2.20 upgrade that kept its preferences and launched; the first-play guide and gameplay-gesture device regressions; and 18 server unit plus 20 integration tests. The backend change is the campaign asset alone (`app/src/main/assets/levels.json`); no migration ran and no code module was replaced.

Encrypted backup `/opt/insight-online/backups/insight-20261101T093552Z.dump.age` ran before rollout. The previous asset is `/opt/insight-rollback-before-040/levels.json`; the prior public APK is `/root/insight-apk-rollbacks/INSIGHT-online-v0.2.19-before-040.apk`. Counts after deployment: 16 users, 159 puzzles, 53 campaign rows, 250 XP rows and all 80 seed puzzles. `content_claims` stayed at 364 because the six studio levels were already claimed by their published community puzzles. The service returned one 502 during restart before the health retry succeeded. The emulator suite pre-confirmed Android's one-time immersive-mode prompt, as a player does once; physical-phone checks were not performed.

Online SHA-256: 0509a31994e1589a2d1af1f471c012353f6aa174f75f3e688e69defafac304e0. Preview SHA-256: df6c7695f3abff626ac80c1765e610b0b0e133eda0b37b7c12207cfbd63a1cc6. Certificate SHA-256: 3008529664ef52092022f4a3a0fc77a43f56d18ccaa947ecdf0be5daabd28c9a.

# Android v0.2.19 — Tips, lists and streaming audio (31 October 2026)

Published [v0.2.19 APK](https://13.140.89.146/INSIGHT-online.apk?v=0.2.19), version code 30, with the matching username-filter backend. Package ID, signing key, saved preferences and download address are unchanged.

This batch refines the first-play tips: borders follow the theme, text sits on plates when it would cross tiles, every line shrinks to fit instead of being cut off, and taps and the lamp give the same feedback as other keys. Creator tips can start a swipe-back in the bands above and below the grid. Players are now one continuous scrolling list that fetches its next server page 50 rows ahead, replacing eight-row pages; Worlds' search bar slides without recomposing the list, and quiet refreshes keep loaded pages and the reader's position. Journey pages take as many rows as fit rather than shrinking cards, and keep their place across rotation or text-size changes. Discovery cards keep their size and position during a swipe. The dark theme and splash use #1F1F1F, Rulebook's "White" is readable on the light page, and the game's like/bookmark buttons moved down 8dp. Forest and mountain ambience is replaced by a looping zen "streaming" track on the Ambience slider. The shared username filter gained a larger word list and `6` → `g` substitution.

A compile fix replaced Compose's removed `asFrameworkPaint` with `nativePaint` for the installed Compose UI 1.12.1.

VPS validation passed: 61 Android unit tests, the first-play guide and language device regression, a signed v0.2.18-to-v0.2.19 upgrade that kept data and launched, and 18 server unit plus 20 integration tests. The backend modules deployed are `username` and `username-words`; no migration was required.

Encrypted backup `/opt/insight-online/backups/insight-20261031T183029Z.dump.age` ran before rollout. The previous runtime is `/opt/insight-rollback-before-039`; the prior public APK is `/root/insight-apk-rollbacks/INSIGHT-online-v0.2.18-before-039.apk`. Counts after deployment: 15 users, 156 puzzles, 238 XP rows and all 80 seed puzzles. The service returned one 502 during restart before the health retry succeeded. Physical-phone checks and the full device suite were not run.

Online SHA-256: 183a0f11eaec0bfc3b2269f340c4be697d6e10186285744bf058f53463be200b. Preview SHA-256: 0b3edd9582d75447a5dfd6a852262a17630e7eb5c5a0d879aac92208da4928a3. Certificate SHA-256: 3008529664ef52092022f4a3a0fc77a43f56d18ccaa947ecdf0be5daabd28c9a.

# Android v0.2.18 — Midori, tap-through tips and achievements (28 October 2026)

Published [v0.2.18 APK](https://13.140.89.146/INSIGHT-online.apk?v=0.2.18), version code 29, with the matching backend. The displayed app name is now Midori (Midori Preview for the local demonstration); the original package ID, signing key, saved-preference keys and download address are retained for compatible updates.

Claude's batch adds tap-through gameplay/creator tips, single-touch handling with a short transition lock, deeper Home buttons and board frames, updated sheet shadows, additional design/player-level achievements, and list-based puzzle-code search. Entering a code now filters Worlds instead of immediately starting the puzzle. Level badges derive from XP without writing or importing badge records. Verification fixed profile responses to include the same level badges as progress, corrected an icon-lambda compile error, and updated the wordmark exemption in translation coverage. Device fixtures follow the new tips, Midori wordmark, filtered puzzle cards and touch-lock timing.

VPS validation passed: 55 Android unit tests including all 200 campaign solutions; 22 preview device tests; four compact 360x640 / 200% text / RTL checks; six isolated online flows; and a signed v0.2.17-to-v0.2.18 upgrade preserving campaign moves, account progress, achievements and creator proof. The backend build, 18 unit tests and 20 integration tests passed, including profile/progress level-badge consistency and case-insensitive code filtering. Source checksums, package/version, production HTTPS address, original signing certificate and the public download checksum were verified. Device checks used Android 8.

Encrypted backup /opt/insight-online/backups/insight-20261028T125110Z.dump.age was restored into a disposable database before deployment: 14 users, 140 puzzles, 45 campaign rows, 202 XP ledger rows and all 80 seed puzzles. A fresh encrypted backup ran immediately before rollout. The prior backend modules are retained at /opt/insight-rollback-before-038; the prior public APK is /root/insight-apk-rollbacks/INSIGHT-online-v0.2.17-before-midori.apk. No migration or production test activity was required. The service restart briefly returned one 502 before the health retry succeeded; subsequent health and authentication checks passed. Final counts remained 14 users, 140 puzzles and all 80 seed puzzles; the XP ledger advanced naturally from 202 to 204 rows. Store-only feedback remains enabled. VPS test processes were stopped and the isolated test database was dropped after verification. Physical-phone checks and native-speaker review were not performed.

Online SHA-256: 324f3761b0bae41797e8a0ea94149c1931aaa8bb88db259df942fe66d9a7ff11. Preview SHA-256: 6407c90d56775bfa9446b092a3d6a3111c4a01986263dcf0227d4d6a612d12d4. Certificate SHA-256: 3008529664ef52092022f4a3a0fc77a43f56d18ccaa947ecdf0be5daabd28c9a.

# Android v0.2.17 — Languages, guide and publishing limits (27 October 2026)

Published [v0.2.17 APK](https://13.140.89.146/INSIGHT-online.apk?v=0.2.17), version code 28, with the matching backend. The package, production HTTPS address, original signing certificate and public APK checksum were verified. No migration was required; migration 010 and store-only feedback remain unchanged.

Claude's batch adds English, Spanish, French, Italian and German UI text, saved language selection, a first-play guide, a startup splash with bounded preload, adjusted audio cues and levels, inline form errors, and new username validation. New usernames require 3–20 English letters, digits, spaces, underscores or hyphens and pass the shared content filter; existing accounts are not rechecked. New puzzle publication is capped at 10 per account per UTC day with idempotent retries. Bookmarks request 28 items per page; other discovery lists retain 24.

Release verification fixed the unsupported autofill styling reference by using the installed Compose autofill color setting, retained the username filter's constructor data, and updated the preview pagination fixture to exercise the daily cap before aging only its isolated test publications. A device regression checks the guide steps, saved guide/language preferences and live Spanish/English switching. Existing gesture checks needed two fixture updates: waiting for startup splash completion and using the outline gutter after target-area swipes were intentionally disabled. Tests now also assert that swiping over the target leaves the level unchanged. The affected preview, compact and online suites were rerun, retaining the passing signed-upgrade evidence.

VPS validation passed: 55 Android unit tests including all 200 campaign solutions; 22 preview device tests; four compact 360x640 / 200% text / RTL checks; six isolated online flows; and the signed v0.2.16-to-v0.2.17 upgrade preserving campaign moves, account progress, achievements and creator proof. The backend build, 18 unit tests and 18 integration tests passed. Final test gates and all reviewed source checksums were verified. Device checks used Android 8; Android 12+ system-splash appearance was not exercised.

Encrypted backup /opt/insight-online/backups/insight-20261027T184149Z.dump.age was restored into a disposable database before deployment: 13 users, 129 puzzles, 40 campaign rows, 181 XP ledger rows and all 80 seed puzzles. A fresh encrypted backup ran immediately before rollout. The prior backend modules are retained at /opt/insight-rollback-before-037; the prior public APK is /root/insight-apk-rollbacks/INSIGHT-online-v0.2.16-before-languages.apk. The service restart briefly returned one 502 before its health retry succeeded; later health and authentication gates passed. Final counts remained 13 users, 129 puzzles and all 80 seed puzzles. Test activity used isolated data, and VPS test processes were stopped after verification. Physical-phone checks and native-speaker translation review were not performed.

Online SHA-256: 08213dd33c6cb7b8a9e0b53710b6cd28b2b933e98231a254543100a2ade474d6. Preview SHA-256: a752a6c0671b5bded90221d102a359c109f78ac252998f85551983c588e899f9. Certificate SHA-256: 3008529664ef52092022f4a3a0fc77a43f56d18ccaa947ecdf0be5daabd28c9a.

# Android v0.2.17 — Problem 31 hotfixes (prepared; not yet built, tested or deployed)

Source for v0.2.17 (version code 28) is in the checkout. Nothing here has been compiled, run on a device, or deployed: this machine has no JDK or Android SDK, so the Android build, unit tests, emulator tests and the APK refresh still have to run on the Insight VPS (see AGENTS.md), and the backend change below is not on the server.

Android: first-play guide (Journey level one, replayable from the icon above the board's top right; Options → Guide icon), dark splash screen with preloading and ambience starting at launch, rounder sheet corners with a shadow, creator Target slide, no more "Unable to finish" dialog, Bookmarked asks for 28 per page, the current Journey level's side wall is white, a gap under the open Worlds search, lighter-grey empty creator squares, grey autofill tint, Okabe-Ito colour-blind palette with the palette's standard colour names, a landing-tile cue (zen drop, 70%) and the solved cue (minimal checkout, 90%), and English / Español / Français / Italiano / Deutsch.

Backend (needs a deploy, with the usual encrypted backup and rollback copy first): usernames are 3–20 English letters, numbers, spaces, _ and - with a profanity / hate / violence / reserved-name filter (server/src/username.ts, username-words.ts, built by tools/build-username-words.mjs from the LDNOOBW list, CC BY 4.0, plus reviewed additions); POST /v1/grids refuses the 11th puzzle of a UTC day with DAILY_LIMIT (CREATE_DAILY_LIMIT, default 10); GET /v1/grids accepts limit=24|28. Existing usernames are untouched. No migration.

Local checks that did run: server unit tests (18) and all 15 integration tests against a throwaway PostgreSQL 18. Cue files for zen_drop and minimal_checkout were generated from uisfx@0.4.0 with tools/build-cues.mjs (+3 dB by MP3 global gain / Opus output gain; the Ogg checksum routine reproduces the original file byte for byte). To verify on the VPS: Android unit tests (including NicknamesTest, TranslationsTest, FeedbackAssetsTest), the device tests, a signed v0.2.16 to v0.2.17 upgrade, and listening to the two new cues at several Effects settings.

# Android v0.2.16 — Creator memory and interface refinements (27 October 2026)

Published [v0.2.16 APK](https://13.140.89.146/INSIGHT-online.apk?v=0.2.16), version code 27, with the matching username-validation backend. The original signing certificate, package/version, production HTTPS address and served APK checksum were verified. No migration was needed; migration 010 and store-only feedback remain in place.

Claude's changes preserve creator tiles hidden by resizing, restore them with saved drafts, and animate the creator grid between building and game-sized phases. The batch also adds anchored puzzle code menus, seven-row bookmarks, discovery placeholder pages, sliding sign-in screens, animated icons, platform side lighting, media-stream effects volume and quieter offline status. Newly entered usernames are limited to 20 Unicode code points on both client and server; existing longer names remain intact.

VPS validation passed: 44 Android unit tests including all 200 campaign solutions; 21 preview device tests; four compact 360x640 / 200% text / RTL checks; six isolated online flows; and a signed v0.2.15-to-v0.2.16 upgrade preserving campaign moves, account progress, achievements and creator proof. The server build, 10 unit tests and 17 integration tests passed. Updated the publishing test to await the loaded numbered puzzle and open its actual accessible card, rather than relying on a standalone numeral elsewhere on the profile. The first online run failed that stale assertion; the full six-test rerun passed with a fresh isolated fixture.

The encrypted backup /opt/insight-online/backups/insight-20261027T100417Z.dump.age was restored into a disposable database before rollout: 13 users, 127 puzzles, 40 campaign rows, 162 XP ledger rows and all 80 seed puzzles. A fresh encrypted backup also ran immediately before backend deployment. Only nickname.ts and its compiled module were replaced; the previous runtime is retained at /opt/insight-rollback-before-036 with automatic rollback on deployment errors. The prior APK is retained at /root/insight-apk-rollbacks/INSIGHT-online-v0.2.15-before-creator-memory.apk. The service restart briefly returned one 502 before the health retry succeeded; subsequent health and authentication checks passed. Production data was not used for test activity. VPS test processes were stopped and the temporary test database dropped. Physical-phone checks were not performed.

Online SHA-256: d1ccf1394daa43500215b85ffb4784b76f7413f719d18522c921aa1a3da04c74. Preview SHA-256: 2dc3b5c947cef61d30522bd3a9612d30ccc59ed3e5094415cf9c4ca8c01ab5d2. Certificate SHA-256: 3008529664ef52092022f4a3a0fc77a43f56d18ccaa947ecdf0be5daabd28c9a.

# Android v0.2.15 — Raised boards and 24-item discovery (26 October 2026)

Published [v0.2.15 APK](https://13.140.89.146/INSIGHT-online.apk?v=0.2.15), version code 26, with the matching pagination backend. Original signing certificate, package/version, production HTTPS address and public APK SHA-256 were verified. Live health is good, with 13 accounts, 126 puzzles and all 80 seed puzzles. No migration was needed; migration 010 and store-only feedback remain in place.

Claude's batch adds raised board platforms and tile sides, bounded dragging, an animated result-bar restart, instant creator clearing while building, faster press feedback, updated solved-card styling, fuller player rows and a matching uppercase Home layout. Discovery loads immediately on entry and refresh; the backend and preview return 24 items per page. Verification fixed immediate-press cancellation when the normal button consumes touch-down. Its device regression confirms the press remains active and release produces exactly one click. Pagination fixtures were expanded to cross the new 24-item boundary and keep creator-number expectations correct.

VPS validation passed: 38 Android unit tests including all 200 campaign solutions; 21 preview device tests; four compact 360x640 / 200% text checks; six isolated online flows; and the signed v0.2.14-to-v0.2.15 upgrade preserving campaign moves, account progress, achievements and creator proof. The backend build, 10 unit tests and 17 integration tests passed. The 27-puzzle pagination test verifies 24 plus 3 distinct results and stable creator numbers. VPS source checksums matched the reviewed local fixes.

Before rollout, /opt/insight-online/backups/insight-20261026T192800Z.dump.age was restored successfully into a disposable database (13 accounts, 126 puzzles, 40 campaign rows, 157 XP rows and 80 seed puzzles). A fresh encrypted backup also ran immediately before deployment. Only online/discovery source and compiled modules were replaced, with the previous runtime retained at /opt/insight-rollback-before-035 and automatic rollback on deployment errors. The brief service restart returned one 502 before the health retry succeeded; subsequent health and authentication gates passed. Post-rollout counts retain all 13 accounts and 126 puzzles, with 158 XP rows from normal activity. No production test accounts, plays or social activity were generated.

The APK was published atomically after retaining /root/insight-apk-rollbacks/INSIGHT-online-v0.2.14-before-platforms.apk; its public checksum matches the tested candidate. Test processes were stopped and only the disposable test databases were removed. Android emulators remain VPS-only. Build source: /opt/insight-release-035-android; artifacts: /root/insight-035-apks; local validation: .build-tools/release035-validation.tar.gz. Matching source archive: .build-tools/Insight-v0.2.15-source.tar.gz, excluding credentials and keys. Physical-phone checks were not performed.

Online SHA-256: 4465f342fc1d9fedef7b671576c8683164053c5421e9668acd856a91523847be. Preview SHA-256: 660d244d0d1385e6f2d3a53361a2be36f0569bc4698b8644bcd2eba94e7045df. Certificate SHA-256: 3008529664ef52092022f4a3a0fc77a43f56d18ccaa947ecdf0be5daabd28c9a.

# Android v0.2.14 — Draggable sheets, raised controls and audio (26 October 2026)

Published [v0.2.14 APK](https://13.140.89.146/INSIGHT-online.apk?v=0.2.14), version code 25. Original signing certificate, package/version, production HTTPS address and the public APK checksum were verified. Live totals are 13 accounts, 126 puzzles and all 80 seed puzzles. This is an APK-only release: backend, migration 010 and store-only feedback remain unchanged.

Claude's batch adds layered screen sheets with a draggable Back chevron, raised controls and collection cards, profile geometry that fills the viewport, eight Journey rows (32 levels per page), more open Rulebook spacing, updated interface-audio assets and a consistent 10ms haptic one-shot. Verification fixed repeated routes selecting an older screen instead of the actual stack top by retaining the latest route occurrence when constructing visible layers. A device regression covers short drag cancellation, long drag dismissal, covered-screen accessibility and repeated Options navigation.

All validation ran on the Insight VPS: 38 Android unit tests including all 200 campaign solution proofs, 20 preview device tests, four compact 360x640 / 200% text checks, six isolated online flows, and an actual signed v0.2.13-to-v0.2.14 upgrade. Saved campaign moves, account progress, achievements and creator proof survived the update. The packaged MP3 cues decoded and started on Android 8. Physical-phone audio levels and haptic strength were not calibrated; Android 10+ Opus playback was not device-tested.

Build source: /opt/insight-release-034-android; artifacts: /root/insight-034-apks; local evidence: .build-tools/release034-validation.tar.gz. The VPS emulator and disposable fixture were stopped and only the release test database was removed. No production test accounts or activity were added. Future emulators remain VPS-only.

Publication retained /root/insight-apk-rollbacks/INSIGHT-online-v0.2.13-before-sheets.apk, atomically replaced the download and verified its public SHA-256. Installed-app rollback requires a higher version code; do not uninstall to force a downgrade. Matching source archive: .build-tools/Insight-v0.2.14-source.tar.gz, excluding private credentials and keys. Backend tests were not repeated because server code is unchanged.

Online SHA-256: dcf04ede85e321fbac19efd0d61686f22e8c3e51fa458d151e8043b5b6137441. Preview SHA-256: 603a1146455a409fbd97bf98e8db1bc4fd788159388f27d8ea2a8351688e2c52. Certificate SHA-256: 3008529664ef52092022f4a3a0fc77a43f56d18ccaa947ecdf0be5daabd28c9a.

# Android v0.2.13 — Paged collections and layout polish (26 October 2026)

Published [v0.2.13 APK](https://13.140.89.146/INSIGHT-online.apk?v=0.2.13), version code 24. Package/version, production HTTPS address, original signing certificate, bundled fonts/licences and public download SHA-256 were verified. This is an APK-only release: no backend replacement, service restart or migration. Feedback remains store-only. Post-deployment totals are 13 accounts, 124 puzzles and all 80 seed puzzles.

This batch adds sideways pages for Journey (28 levels), Worlds and bookmarks (24 puzzles), profiles (12 puzzles), and players (8 people), with community data fetched ahead. It refines page transitions, bare Back chevrons, matte backgrounds and raised buttons, volume knobs, off-grid game swipes and delayed restart glow, profile actions, search dismissal, creator target sizing, sound routing and 12ms touch feedback. Verification corrected an invalid Compose drawing import, kept the square Rulebook practice board usable at 200% text size by limiting and scrolling the rules, and removed the closed search field from the accessibility tree.

Validation passed: 38 Android unit tests including all 200 campaign solutions; 19 preview device checks including physical Journey paging; four compact 360x640 / 200% text checks; six isolated online flows across the initial suite and the two affected tests' final rerun; and the actual signed v0.2.12-to-v0.2.13 update preserving campaign moves, account progress, achievements and creator proof. The publishing test waits for the outgoing profile to leave before injecting its search gesture. Compact Home and Rulebook screenshots were inspected.

The final builds and remaining device checks ran on the KVM-capable Insight VPS, using a disposable Android 8 emulator and a separate PostgreSQL test database. Per the user's instruction, future emulators must run on the VPS, never on the local PC; this is recorded in AGENTS.md. Prefer the existing VPS build toolchain as well. SDK: /opt/android-sdk; Gradle cache: /opt/insight-gradle; release source: /opt/insight-release-033-android; final artifacts: /root/insight-033-apks. Test processes are stopped after verification. No test accounts or activity were added to production.

Publication retained /root/insight-apk-rollbacks/INSIGHT-online-v0.2.12-before-paging.apk, atomically replaced the public download and verified its SHA-256. An installed-app rollback needs a higher version code; do not uninstall to force a downgrade. Matching source archive: local .build-tools/Insight-v0.2.13-source.tar.gz, excluding keys, service secrets and seed credentials. Backend tests were not repeated because server code is unchanged. Physical-phone checks and haptic-strength calibration were not performed.

Online SHA-256: 6ef98bd6d990a7f8e50a8763c418edf4ce26ab6d4d4cdf38dbb98e2887388ba1. Preview SHA-256: 45687f97ffb88e702bf78efb0e6b552129ac794b4e03bbd1101f7a83e9c99762. Certificate SHA-256: 3008529664ef52092022f4a3a0fc77a43f56d18ccaa947ecdf0be5daabd28c9a.

# Android v0.2.12 — Navigation and gesture refinements (25 October 2026)

Published [v0.2.12 APK](https://13.140.89.146/INSIGHT-online.apk?v=0.2.12), version code 23. The public download checksum matches the signed production candidate. Package/version, production HTTPS address, original signing certificate and bundled font/licence were verified. The service is healthy with 13 accounts, 122 puzzles and all 80 seed puzzles present. No backend replacement, service restart or migration was needed; feedback remains private with `FEEDBACK_DELIVERY_MODE=store`.

This batch adds a centred Back chevron; Journey swipes between unlocked levels; creator backward swipes; distinct swipe/restart zones; animated result-bar dismissal; separate Worlds sort controls and pull-down search; side-by-side profile actions and two-tap logout; and 0–10 volume stops with detents. Journey resumes the last played level, including a solved replay. JetBrains Mono replaces the remaining serif text, Licences has its own page, and haptics use touch usage with explicit amplitude where supported.

Validation passed: 35 Android unit tests including all 200 campaign solutions; 18 preview device checks; four compact 360x640 / 200% text checks; three focused device checks for gesture boundaries, creator swipes and persisted accessible volume stops; and six isolated online flows across the suite and focused reruns. The Android 8 test helper now refreshes cached accessibility parents after Back, waits for sort-sheet focus restoration, and starts refresh gestures below the new search bar. Tests follow the current selected-sort labels, keyboard code submission, two-tap logout and last-played Journey behavior. Profile, Worlds and compact Home screenshots were inspected. An actual signed v0.2.11 to v0.2.12 update preserved campaign moves, account progress, achievements and creator proof.

Publication retained `/root/insight-apk-rollbacks/INSIGHT-online-v0.2.11-before-gestures.apk`, atomically replaced the download and verified its public SHA-256. Installed Android apps need a higher version code for a rollback update; do not uninstall to force a downgrade. Matching source archive: local `.build-tools/Insight-v0.2.12-source.tar.gz`, excluding keys, service secrets and seed credentials. Backend tests were not repeated because server files are unchanged. Physical-phone checks and haptic-strength calibration were not performed.

Online SHA-256: `1810fa050451301f93ee53dedc0a53b1c23e05ade8feb41371fbd79217ae22d5`. Preview SHA-256: `d4cef4d1194f1714322a337643264e653c796d3102bcb435599905f4b5bb37ef`. Certificate SHA-256: `3008529664ef52092022f4a3a0fc77a43f56d18ccaa947ecdf0be5daabd28c9a`.

# Android v0.2.11 — Typography and raised buttons (25 October 2026)

Published [v0.2.11 APK](https://13.140.89.146/INSIGHT-online.apk?v=0.2.11), version code 22. The original signing certificate, package/version, production HTTPS address, font assets and licence, and public download checksum were verified. The service is healthy with all 13 accounts, 118 puzzles and 80 seed puzzles present. This is an APK-only release: no backend replacement, service restart or database migration. Reports remain private with `FEEDBACK_DELIVERY_MODE=store`.

This batch replaces Source Sans 3 with bundled JetBrains Mono in four weights, enlarges the Home actions, adds raised button faces and press feedback, animates the Options/Profile icons, and slides Options and Profile pages from below. Verification fixed community exits clearing their target before restoring the campaign board, which could crash the outgoing game during a transition. A shared row constraint also prevents long values from hiding labels at 200% text size.

Validation passed: 33 Android unit tests including all 200 campaign solutions; the 18-test preview suite; six isolated online device flows; four compact 360x640 / 200% text checks; and two focused final navigation checks with animations enabled. Compact Home screenshots were inspected. The final signed v0.2.10 to v0.2.11 in-place update preserved campaign moves, account progress, achievements and the creator construction proof. Backend tests were not repeated because server files match v0.2.10. Physical-phone checks were not performed.

The prior public APK is retained at `/root/insight-apk-rollbacks/INSIGHT-online-v0.2.10-before-font.apk`. Publication replaced the download atomically and verified its public SHA-256. Existing Android installations require a higher version code for a rollback update; do not uninstall to force a downgrade. Matching source archive: local `.build-tools/Insight-v0.2.11-source.tar.gz`, excluding signing keys, service secrets and seed credentials.

Online SHA-256: `53fffa59ead29f55054b0b34274685ce88573c8db9113976450f5ebbbe7cd59e`. Preview SHA-256: `4964c959a99c58a6a1a23a0ee62cc082fc81973e7a499b45a5031bbc0e0e843c`. Certificate SHA-256: `3008529664ef52092022f4a3a0fc77a43f56d18ccaa947ecdf0be5daabd28c9a`.

# Android v0.2.10 — Navigation and stored reports (24 October 2026)

Published [v0.2.10 APK](https://13.140.89.146/INSIGHT-online.apk?v=0.2.10), version code 21, with matching backend changes and additive migration `010_feedback.sql`. The public download checksum, original signing certificate, production HTTPS address, API contracts and authentication gates were verified. Live service checks found no recent application errors or HTTP 5xx responses. All 13 accounts and 118 puzzles remain, including the 10 seed creators and their 80 puzzles.

This batch adds bidirectional list swipes and Random history; dedicated Bookmarked, Following and Followers screens; larger board outlines and creator controls; centred miniatures; revised result bars; and Share feedback / Report a bug forms. Tile swaps now require dropping over a legal destination. Reports work without signing in. As requested, `FEEDBACK_DELIVERY_MODE=store` retains reports privately without sending email or consuming retry attempts. Enable SMTP delivery only after configuring outgoing mail.

Verification aligned old gesture assertions with the deliberate drop rule, exercised Random history in both directions, and added a real signed-out form submission against the isolated service. Bookmark totals now exclude puzzles from suspended creators, matching the list's visibility. SMTP transactions retain the existing mail worker's timeout allowance; store mode is covered by assertions that reports retain their text and zero delivery attempts.

Validation passed: 33 Android unit tests including all 200 campaign solutions and new drag/history checks; ten server unit tests; 17 isolated PostgreSQL integration tests with focused reruns after fixes; 18 preview device checks across the suite and a focused rerun; three 360x640 / 200% text checks; and six isolated online device flows. Compact creator/result screenshots were inspected. An actual signed v0.2.9 to v0.2.10 update preserved saved campaign moves, account progress, achievements and the creator proof. Physical-phone checks were not performed.

An encrypted production backup was restored to a disposable database. Migration 010 preserved account, puzzle, solve, campaign, XP and social totals. Restored-copy smoke tests passed for seed profiles, registration/publication, follow lists, private bookmark counts and store-only report idempotency. Restore-tested backup: `/opt/insight-online/backups/insight-20261024T190112Z.dump.age`. Rollout backup: `/opt/insight-online/backups/insight-20261024T190730Z.dump.age`. Backend stage: `/opt/insight-release-030`. Prior runtime/environment: `/opt/insight-rollback-029`; code rollback retains the additive schema and any stored reports. Prior public APK: `/root/insight-apk-rollbacks/INSIGHT-online-v0.2.9-before-navigation.apk`. The download was replaced atomically. Existing Android installations need a higher version code for a rollback update; do not uninstall to force a downgrade.

Matching source archive: local `.build-tools/Insight-v0.2.10-source.tar.gz`, excluding signing keys, service secrets and seed credentials. Online SHA-256: `1c5fef0c93e9dff8936eb6d6edfe65257b0d290025dd5ed9977f9d986c583508`. Preview SHA-256: `420e08d95d6b99898f88ba8cfbfe1afc0bed819818debed605961377000e3161`. Certificate SHA-256: `3008529664ef52092022f4a3a0fc77a43f56d18ccaa947ecdf0be5daabd28c9a`.

# Android v0.2.9 — Journey and social features (24 October 2026)

Published [v0.2.9 APK](https://13.140.89.146/INSIGHT-online.apk?v=0.2.9), version code 20, with the matching social backend and additive migration `009_social.sql`. Live health, new API contracts/authentication gates, original signing certificate, package/version, production API address and public download checksum were verified. Existing production totals were preserved: three accounts, 33 published grids, 19 campaign rows, 44 XP entries totalling 2,450,003 milli-XP. No production test account was created.

Claude's batch adds likes, bookmarks, follows, local-day streaks and online/design/streak achievements; revises Journey/Levels/Now Playing navigation; enlarges targets and simplifies minis; crops creator borders; changes board height; adds Random swiping and source-list Next; and adds quiet offline marks, combined profile loading, and logout confirmation.

Verification fixed an empty-collection profile remaining blank because its loading state was not observed, reset social progress when switching accounts, and made impossible calendar dates fall back safely rather than reaching PostgreSQL. Tests were updated for cropped proof indices and logout confirmation. A new device flow checks likes/bookmarks/follows against the service, own-profile sections, online achievements and source-list Next; the Random test also performs an empty-space right swipe.

Validation passed: 29 Android unit tests including all 200 campaign solutions and creator cropping; ten server unit tests; 14 isolated PostgreSQL integration tests; 18 preview device checks across the suite and two focused reruns; three compact 360×640 / 200% text checks; and all five isolated online device flows. A signed v0.2.8 → v0.2.9 upgrade preserved campaign moves, account progress, badges and the creator construction proof. Physical-phone checks were not performed.

An encrypted production backup was restored to a temporary database. Migration 009 preserved accounts, puzzles, solves, campaign progress and XP totals; restored-copy smoke tests passed for registration, old imports, publishing, likes, bookmarks, follows, streaks and badges. Restore-test backup: `/opt/insight-online/backups/insight-20261024T153024Z.dump.age`. The rollout created another encrypted backup: `/opt/insight-online/backups/insight-20261024T154258Z.dump.age`. Backend stage: `/opt/insight-release-029`. Prior backend source/build: `/opt/insight-rollback-028`; code rollback retains the additive schema and any social data. Prior public APK: `/root/insight-apk-rollbacks/INSIGHT-online-v0.2.8-before-social.apk`. The download was replaced atomically. An installed Android app normally needs a higher version code for a rollback update; do not uninstall to force a downgrade.

Matching source archive: local `.build-tools/Insight-v0.2.9-source.tar.gz`, excluding signing keys and service secrets. Online APK SHA-256: `57c5f429346afcdd2d095f55b42f62ce0b8a3d4f7c53953a98e395607454eb82`. Preview: `d944516cbbd6fa1d83af18f3be8a9482f2f3198122e00595bec5ba3419ac0a31`. Certificate SHA-256: `3008529664ef52092022f4a3a0fc77a43f56d18ccaa947ecdf0be5daabd28c9a`.

# Android v0.2.8 — Sound and haptic feedback (24 October 2026)

Published [v0.2.8 APK](https://13.140.89.146/INSIGHT-online.apk?v=0.2.8), version code 19. The public download checksum matches the signed candidate and the API is healthy. This is an APK-only update: backend code, database migrations, and the service remain unchanged.

Claude's batch replaces the old tile notes and interface effects with the 20-cue uisfx Zen pack (CC0), adds a 6 ms vibration behind the Haptics setting, wires interface actions to their cues, and adds the creator processing loop controlled by Sound, Effects, and app visibility. Android 8–9 select MP3; Android 10+ select Ogg Opus. Existing forest/mountain ambience, campaign data, account/save storage, package IDs, and signing certificate are retained.

Validation completed: 25 Android unit tests including all 200 campaign solutions and audio asset checks; 18 applicable preview device checks across the initial run and rerun; three 360×640 / 200% text checks; and all four isolated online flows across the suite and focused discovery rerun. Every cue decoded and started through Android's MediaPlayer on Android 8. All 20 Opus files also passed stream-header/page-boundary/end-marker checks, and both full packs were verified inside the final APK. One emulator restart interrupted the original preview run; all remaining checks passed after restarting. Discovery's test now scrolls backward to its search field after a date selection scrolls it off-screen. No product code fix was required beyond the submitted batch.

A signed v0.2.7 → v0.2.8 update preserved saved campaign moves, account progress, badges, and the creator draft's publishing proof. Package/version, production API address, and original signing certificate were verified. Backend tests were not repeated because backend files are unchanged from v0.2.7. No physical-phone sound/vibration calibration or Android 10+ playback test was performed; the device decoder check used Android 8's MP3 variant.

Publication retains the prior APK at `/root/insight-apk-rollbacks/INSIGHT-online-v0.2.7-before-feedback.apk`, then atomically replaces the download and verifies its public SHA-256. The matching source archive is local `.build-tools/Insight-v0.2.8-source.tar.gz`, excluding keys and service secrets.

Online APK SHA-256: `4064c51b04e7da88cd5b186e224576021fde805e016dd6b4026b263e2c0d1b96`. Preview: `4296e18e7f85ba500e0f4195da321274acf8840e26b9f30c8e743e3e58868845`. Certificate SHA-256: `3008529664ef52092022f4a3a0fc77a43f56d18ccaa947ecdf0be5daabd28c9a`.

# Android v0.2.7 — Campaign and simplified screens (22 October 2026)

Published [v0.2.7 APK](https://13.140.89.146/INSIGHT-online.apk?v=0.2.7), version code 18. With explicit user approval, migration `008_campaign_200.sql` removed four retired imported-badge records. No campaign progress above level 200 existed. The live service is healthy and the public download checksum matches the signed candidate.

Claude's batch keeps the original first 200 boards and solutions, replaces the achievement catalogue with eight campaign milestones, enlarges Journey/Worlds on Home, simplifies Options/player lists/details, and uses two result bars below the board. Verification fixed those bars covering the bottom row on small screens: the result controls now occupy their own space below the play area. Older 206-level progress imports and retired badge names remain accepted and filtered, so existing APKs and queued imports can sync without validation failures or extra XP.

Validation: 23 Android unit tests, seven server unit tests, 13 isolated PostgreSQL integration tests, 17 preview device checks across the suite and focused reruns, and four isolated online device flows passed. The revised full 5×5 result layout passed at 360×640 / 200% text. Two preview queries failed after a test-only accessibility-reader change; restoring the existing reader made both focused reruns pass. A signed v0.2.6 → v0.2.7 upgrade preserved campaign moves, account progress, badges and creator proof. The final APK's version, original certificate and uploaded checksum were verified. Physical-phone and audio checks were not performed.

The staged backend was tested against a restored encrypted production backup: users, published grids, solves, current campaign progress, and XP totals were unchanged after migration. Backup: `/opt/insight-online/backups/insight-20261022T090137Z.dump.age`. Stage: `/opt/insight-release-027`. Deployment creates another encrypted backup and keeps prior backend files plus the four retired badge rows privately in `/opt/insight-rollback-026`; an error during deployment restores these automatically. APK publication retains `/root/insight-apk-rollbacks/INSIGHT-online-v0.2.6-before-campaign.apk` before atomic replacement. Existing Android installations require a higher version code for a future rollback update; do not uninstall to force a downgrade.

Matching source archive: local `.build-tools/Insight-v0.2.7-source.tar.gz`, excluding signing keys and service secrets. Online APK SHA-256: `125de6d64a83ffd453a5d94329a4a0a614ac413c248ad939f448afb1db884af8`. Preview: `e722b2b030d16caac2fd9ebc701568c91c4da9fd490a672a4b1af7d4c853fdfc`. Certificate SHA-256: `3008529664ef52092022f4a3a0fc77a43f56d18ccaa947ecdf0be5daabd28c9a`.

# Android v0.2.6 — Profiles and refresh (21 October 2026)

Published [v0.2.6 APK](https://13.140.89.146/INSIGHT-online.apk?v=0.2.6), version code 17, with Claude's updated profile card, inline profile puzzles, logout icon, pull-to-refresh, and direct Random play from Worlds. Back from a random game returns to Worlds; profile puzzles return to their profile.

Verification fixed inline puzzle loading waiting on an unattached lazy-list scroll state, made the logout icon expose its disabled state during account operations, and retained a screen-reader Refresh action alongside the gesture. The Android 8 login test now refreshes accessibility nodes in the focused window after screen changes.

Validation completed: 21 Android unit tests (all 206 campaign solutions), 17 preview device tests, four isolated online flows, and a compact 360×640 / 200% text profile-navigation check. Online coverage includes registration/logout/login, inline profile puzzle play and return, publication and shared codes, profile refresh, an actual downward swipe during a simulated outage, accessible retry with cached results, and direct Random play/recreation. Auth passed in a focused rerun after updating its screen queries; the other three online flows passed together. Profile screenshots were inspected. A signed v0.2.5 → v0.2.6 update preserved campaign moves, account progress, badges, and a creator construction proof. Package/version, original certificate, embedded API address, public download checksum, and live API health were verified.

APK-only deployment: no backend replacement, service restart, or database migration. Previous public APK: `/root/insight-apk-rollbacks/INSIGHT-online-v0.2.5-before-profile.apk`. Matching source archive: local `.build-tools/Insight-v0.2.6-source.tar.gz`, excluding signing keys and service secrets. Physical-device checks were not performed.

Online APK SHA-256: `e2c8c65ead640199dca1ca73e47036ef4a0fa65b88b8fdb9ed4479cb71fcc0be`.
Preview APK SHA-256: `15ad569521c2aacd32d32b14f1ad659b8d1ca79fd5b6b4943b79012a0232b6fa`.
Certificate SHA-256: `3008529664ef52092022f4a3a0fc77a43f56d18ccaa947ecdf0be5daabd28c9a`.

# Android v0.2.5 — Creator controls (21 October 2026)

Published [v0.2.5 APK](https://13.140.89.146/INSIGHT-online.apk?v=0.2.5), version code 16, with Claude's single Start → Target → Create control, stage-by-stage Back navigation, hold-to-reset, animated grid resizing, solid empty-cell outlines, and simplified creator previews.

Validation completed: 21 Android unit tests (including all 206 campaign solutions), 17 Android 8 preview device tests, four isolated online device tests, and two compact 360×640 / 200% text checks. A new creator regression checks short taps and tile holds versus background holds, reset in each stage, accessible reset actions, publishing-proof persistence, and Back behavior. The compact-screen appearance test now scrolls to the off-screen Options setting. Creator screenshots were inspected. A signed v0.2.4 → v0.2.5 update preserved campaign moves, account progress, badges, and a creator construction proof. The original certificate, package/version, production API address, served APK checksum, and live API health were verified.

APK-only deployment: no backend replacement, service restart, or database migration. The prior download is retained at `/root/insight-apk-rollbacks/INSIGHT-online-v0.2.4-before-creator.apk`. Matching source is retained locally at `.build-tools/Insight-v0.2.5-source.tar.gz`, excluding signing keys and service secrets. Physical-device checks were not performed.

Online APK SHA-256: `13e35507875d8eeae048155536b1a6cccfce271f82b0db5d3ab7d36843ca5152`.
Preview APK SHA-256: `6238d7a56e881c5944d343e6a7d758f476b3adeee30d5f577b0c58bda4eb21df`.
Certificate SHA-256: `3008529664ef52092022f4a3a0fc77a43f56d18ccaa947ecdf0be5daabd28c9a`.

# Android v0.2.4 — Direct Worlds discovery (21 October 2026)

Published [v0.2.4 APK](https://13.140.89.146/INSIGHT-online.apk?v=0.2.4), version code 15, with Claude's direct Worlds puzzle grid, player toggle, sort/search sheet, and Random/Create actions. Community navigation returns to Worlds with independent puzzle/player filters retained.

Validation completed: 21 Android unit tests (including all 206 campaign solutions), 16 Android 8 preview device tests, and all four isolated online device tests covering registration/login, direct publishing and shared codes, discovery filters and attempt accounting, and Casual recreation/offline retry. A signed v0.2.3 → v0.2.4 update preserved campaign moves, account progress, badges, and a creator construction proof. Package/version, existing signing certificate, embedded production API address, public API health/authentication gates, and the served APK checksum were verified. Worlds and player-list screenshots were inspected.

APK-only deployment: no backend replacement, service restart, or database migration. The previous public APK is retained at `/root/insight-apk-rollbacks/INSIGHT-online-v0.2.3-before-worlds.apk`. The matching source archive is retained locally at `.build-tools/Insight-v0.2.4-source.tar.gz`, excluding signing keys and service secrets. Physical-device checks were not performed.

Online APK SHA-256: `fe30427fa4e725889cb61958dccbe35c8dd3e6ce7ac5261ebb04673ebe6519c1`.
Preview APK SHA-256: `11a9533c8397f901980008c56cf1067a46ec4172b1ba4d4f80b6b431447183d9`.
Certificate SHA-256: `3008529664ef52092022f4a3a0fc77a43f56d18ccaa947ecdf0be5daabd28c9a`.

# Android v0.2.3 — Gameplay and collections (21 October 2026)

Published [v0.2.3 APK](https://13.140.89.146/INSIGHT-online.apk?v=0.2.3), version code 14, with Claude's gameplay, Rulebook session memory, collection-card and launcher changes, plus the reviewed v0.2.2 Options changes. Verification fixed the missing Dp import, restored large-text rule scrolling, made restart honor accessibility/motion/haptic settings, isolated the win popup from background controls, kept card numbers readable with enlarged text, and returned the final campaign action to level selection.

Validation completed: 21 Android unit tests (all 206 campaign solutions), 16 Android 8 preview device tests, a compact 360×640 / 200% text check, and all four isolated online device tests, including Unicode-password registration/login, rejected-password editing, direct publication and shared codes, community failure accounting, Casual recreation and offline retry. An actual signed v0.2.1 → v0.2.3 update preserved campaign moves, account progress, badges and a creator construction proof. Android 8 test queries refresh accessibility nodes in the focused window; discovery uses a fresh account to avoid resuming an old test attempt. Signature, package/version, API health and the served APK checksum were verified.

This is an APK-only deployment. Backend source, migrations, account data, save keys, application IDs, and the signing key remain compatible with the live v0.2.1 service. No production account is created by device testing.

Online APK SHA-256: `e57f296da6f688f7195bbf7f8a4d601019af47552fc66703d25666742b294df9`.
Preview APK SHA-256: `470094e7b41b3ce32dacbb38507f5470ce69d87085939d73beb4e1ec15531c1a`.
Certificate SHA-256: `3008529664ef52092022f4a3a0fc77a43f56d18ccaa947ecdf0be5daabd28c9a`.

The previous public v0.2.1 APK is retained at `/root/insight-apk-rollbacks/INSIGHT-online-v0.2.1-before-gameplay.apk`. Publication replaced the download atomically; the API remained active and healthy without a service restart or migration. The matching source archive is `/root/insight-apk-rollbacks/Insight-v0.2.3-source.tar.gz`. Testing used an emulator; physical-device checks were not performed.

# Android v0.2.2 — Options and Rulebook (21 October 2026)

Prepared privately, then superseded by the published v0.2.3 release above. Version **0.2.2**, code **13**, used the archived deployed v0.2.1 source. Claude's original v0.1.9 changes are preserved in a named Git stash; the release work is on `codex/options-v022`.

Options now has Options / Rulebook / About tabs. Colourblind mode persists and updates tiles and targets together. Cosmetics and the Reset progress control are removed without clearing saved progress or badges. The practice board uses gameplay controls without saving moves or awarding progress. Verification found and fixed clipping of Purple and White explanations on compact screens at 200% text; the rule list now scrolls when needed while the board remains visible.

Validation completed: 19 Android unit tests (including all 206 campaign solutions), 15 Android 8 preview device tests, and a compact 360×640 / 200% text regression test. Signed APK package/version/certificate and live API health/authentication gates were verified. The v0.2.1 → v0.2.2 in-place upgrade check and public APK replacement are pending.

Online APK SHA-256: `086e1f87bd97c1fdcdb234c4681aa22955eef1b3043bbb9b5be995a59de076ee`.
Preview APK SHA-256: `59cec42868e6b7abf9d1b06fc7dbecdea56fb25591d44f88736cefe6317832c6`.
Both use certificate `3008529664ef52092022f4a3a0fc77a43f56d18ccaa947ecdf0be5daabd28c9a` and preserve package IDs. This update needs no backend replacement, restart, or database migration. Use the atomic publication procedure with the prior APK retained as `/root/insight-apk-rollbacks/INSIGHT-online-v0.2.1-before-options.apk`.

# Android v0.2.1 — Problem 15 (21 October 2026)

Published APK: [Insight v0.2.1](https://13.140.89.146/INSIGHT-online.apk?v=0.2.1), version code **12**, installed label **Insight**. The preview label is **Insight Preview**. Both root APKs use the original certificate `3008529664ef52092022f4a3a0fc77a43f56d18ccaa947ecdf0be5daabd28c9a`.

Online APK SHA-256: `fa2445cb49a45a341387eccd2ca8b07aae7b6245400a80009270ae174ed93c51`.
Preview APK SHA-256: `154a4d2c8538ad2b257f959fb529bd270a6d642cb0cf3fe7001576d5236f1b64`.

The public APK was replaced atomically after verifying the uploaded checksum. The previous v0.2.0/code-11 APK is retained privately at `/root/insight-apk-rollbacks/INSIGHT-online-v0.2.0-before-problem15.apk` (SHA-256 `9b536908815e4cb5a4d6ffc444b4dfe2a9d48967e7c28c12e9d575f78452d638`). The API stayed active and healthy. No service restart, production test account, backend replacement, or database migration was performed.

The missing native v0.2.0 source was reconstructed from the published APK, while matching backend source/tests/assets were recovered from `/opt/insight-release-020`. The checkout retains the v0.2.0 flat puzzle API, numbered creator collections, construction-proof publication, shared-code navigation, filters, Casual and rulebook. Campaign IDs, all 206 boards, save keys and unlock rules are retained. Restored migration 007 records the already-deployed v0.2.0 schema; do not treat it as a new Problem 15 migration. The updated complete source is backed up privately on the VPS as `/root/insight-apk-rollbacks/Insight-v0.2.1-source.tar.gz`, without signing keys or service secrets.

Validation: 20 Android unit tests (all 206 campaign solutions), 14 applicable preview device tests, 4 isolated online navigation tests, 6 server unit tests, and 11 isolated PostgreSQL integration tests passed. Fresh/reset/full-completion Journey behavior, relaunch recovery, account switching, campaign resume after community play, own-profile achievements, guest login, pause navigation, direct publishing, shared codes, discovery filters, retries and Casual were exercised. An actual signed v0.2.0 → v0.2.1 APK update preserved seeded campaign moves, account progress, badges and a creator construction proof. Portrait checks covered short/tall screens, light/dark themes, 200% text, RTL, keyboard focus and accessibility labels, plus normal/themed launcher artwork. Testing used an Android 16 emulator.

For APK-only rollback, atomically copy the retained binary back to `/var/www/insight-downloads/INSIGHT-online.apk`; this restores the download for new installs. Android will not normally downgrade an existing code-12 installation to code 11. A compatible rollback update should keep the current signing key and use a higher version code. Never uninstall a user's app to force a downgrade.

## Historical records

The following sections describe older deployments; their client versions and world-based API are historical.

# Android v0.1.9 deployment snapshot (17 October 2026)

This branch records Android v0.1.9 (code 10) and its world-based backend through migration 006. The recorded service address was https://13.140.89.146. Later redesign deployments are outside this snapshot; pushing this branch does not change the live service.

The v0.1.8 update changes only Android: profiles and publishing, campaign labels, settings, creator touch handling, progress sync, and layered ambience. The server source and migrations match v0.1.7, so no server replacement or database migration was needed. Server unit/integration tests and Android unit tests passed; device UI/audio checks were not rerun. The APK retains the same signing certificate.

The v0.1.7 Casual update was deployed after a successful encrypted database backup. Migration `006_casual.sql` adds per-account Casual cycles and completion history. Validation passed: 10 server unit tests, 13 isolated-database integration tests, 14 Android unit tests, APK signature/version verification, and live health/authentication checks. Device UI tests were not rerun. The previous server build is retained at `/opt/insight-rollback-016/dist`; application rollback retains the additive schema.

The v0.1.6 publishing update was deployed after a successful encrypted database backup. Migration `005_level_numbers.sql` backfills publication order and enforces unique level numbers 1–20 within each world. The service supports atomic level addition, custom filtered world/level names and default Level N titles. The prior v0.1.5 server is retained at `/opt/insight-rollback-015/dist` for application rollback with the additive schema retained.

The discovery update applies additive migration `004_play_discovery.sql` after an encrypted database backup. It adds Worlds/Creators ranking, UTC creation-date filters, distinct solver statistics and idempotent attempt outcomes. Existing completion clients remain accepted; failure counts begin with this version. The previous server build is retained at `/opt/insight-rollback-014/dist`; application rollback keeps the additive schema and database history.

Registration uses email, password (12–128 characters), and a unique English username (3–20 characters: letters, numbers, spaces, `_` and `-`, no hateful, violent, profane or reserved words), then signs in immediately. Login uses email and password only. Email OTP, verification, invitations, and recovery-code endpoints are removed. Migration `003_password_only_auth.sql` enables existing accounts and cancels outstanding challenges when upgrading an existing database. The `verified` API field remains for compatibility and no longer gates access.

Errors appear in a dismissible dialog throughout the app, with specific messages for wrong credentials, taken usernames/emails, connectivity, timeouts, and unavailable servers. Failed login keeps the password editable. Local saves and cached community content survive connection failures.

The new VPS uses native PostgreSQL, nginx and `insight-online.service`, running the API as system user `insight`. Source is in `/opt/insight-online`; private environment is `/opt/insight-online/.env` (mode 640). Node is `/opt/node/bin/node`. API and PostgreSQL listen on loopback. Public ports 80/443 serve ACME validation and HTTPS. No email worker or Mailpit is needed.

The publicly trusted certificate is in `/etc/letsencrypt/live/13.140.89.146/`. `insight-certificate.timer` checks renewal twice daily and reloads nginx. Keep port 80 reachable for certificate validation.

`insight-backup.timer` creates daily encrypted database dumps in `/opt/insight-online/backups`, using `server/deploy/native-backup.sh`. Its private age recovery key is `/opt/insight-online/secrets/backup.agekey`. Preserve that key and arrange off-host copies when needed; backups currently remain on the VPS.

To update, back up the database, replace source and campaign assets while preserving `.env` and certificates, then:

```sh
cd /opt/insight-online/server
PATH=/opt/node/bin:$PATH npm ci
PATH=/opt/node/bin:$PATH npm run build
chown -R insight:insight /opt/insight-online/server /opt/insight-online/app
systemctl restart insight-online
curl --fail https://13.140.89.146/health
```

The service applies migrations before starting. Build Android with `-PinsightApiUrl=https://13.140.89.146`. Keep its signing key backed up: Android requires the same key to update an installed app while preserving local data. The APK is a private-test debug build.

The current APK download is `https://13.140.89.146/INSIGHT-online.apk?v=0.1.9` (version code 10). Its SHA-256 is `0ccf7dfaacf299ebf1c5cb1d884d9e989371906bec4f81de5efd4b8cf1782eb7`. nginx serves it from `/var/www/insight-downloads/INSIGHT-online.apk`. Prior APKs are retained on the server as `INSIGHT-online-v0.1.8.apk` and `INSIGHT-online-v0.1.7.apk`. This client hotfix requires no backend update or migration.

This build retains the v0.1.4 signing key (certificate SHA-256 `3008529664ef52092022f4a3a0fc77a43f56d18ccaa947ecdf0be5daabd28c9a`), allowing an in-place update from v0.1.4. The key is retained at `/root/.android/debug.keystore` and backed up locally in the git-ignored `.build-tools/insight-debug.keystore`. It differs from the former v0.1.3 APK's key; updating that installation in place requires its original key. Do not delete an existing installation to resolve a signing mismatch unless its local progress can be discarded or has been backed up.

# Historical deployment — previous VPS

The instructions below describe the former Docker deployment and its former email-code authentication. They do not apply to the current server or APK.

Deployed 16 October 2026. API: **https://31.57.24.70:8443**. Health: `/health`; API reference: `/docs`.

Install **INSIGHT-online.apk** for this backend. **INSIGHT-preview.apk** is a separate, entirely local demonstration with package `com.insightpuzzle.app.preview`; it never connects to the VPS. Both root APKs are signed debug test builds, compatible with Android 8+; hashes are in `APK-SHA256SUMS`.

## First login

A verified private-test account is provisioned. Its generated email/password are stored **only on the VPS**:

```sh
ssh root@31.57.24.70 'cat /opt/insight-online/secrets/account-owner.json'
```

Use those credentials in the connected APK's Log In screen. Additional QA/creator accounts are private fixtures; their published world lets you try community play immediately. No credentials, private keys, or environment secrets are committed to this repository or embedded in either APK.

**External email delivery is not configured.** Verification/recovery messages go to a private Mailpit inbox, and the APK explicitly reports this mode. To inspect that inbox:

```sh
ssh -L 8026:127.0.0.1:8026 root@31.57.24.70
```

Then open http://localhost:8026. Registration no longer requires an invitation: enter an email, a password of 12–128 characters, and a unique nickname of 1–20 characters. Verification still uses the eight-digit code from the private inbox. The connected APK already contains the service address, so installation needs no connection settings. Existing users can change their nickname on their profile; existing names are preserved until changed.

Nickname uniqueness ignores letter case and Unicode compatibility variants. Migration `002_unique_nicknames.sql` adds a unique index without changing existing accounts or progress. World and level names are free text screened by a blocked-word list (see `server/README.md`); the Make button opens a Worlds screen where players create worlds (name and tile icon) and add their level as the next number of 20. Completed community grids show a themed Solved badge; their history is kept per account and restored from the service.

Login errors appear beside the login button. An unsuccessful attempt keeps the masked password editable; Show/Hide lets the player check their entry. A verified account can still receive an incorrect-credentials error. Use **Forgot password?**, enter a new password, request a recovery email code, and confirm it in the app. Recovery codes use the same private inbox while external SMTP is unconfigured. Do not send passwords to an operator.

To enable real mail, edit the private `/opt/insight-online/.env`, set `MAIL_DELIVERY_MODE=smtp`, real `MAIL_FROM`, `SMTP_HOST`, port, TLS setting, username, and password. Recreate the API and reload its HTTPS proxy. Test actual receipt and recovery before inviting users expecting external email.

## Layout and updates

The stack lives in `/opt/insight-online`, under the Docker Compose project `insight-online`. PostgreSQL and the API bind only to loopback; the public nginx listener uses port 8443. The existing brokerage containers and ports 80/443 remain in use. Only the existing default HTTP listener's ACME challenge path was added for IP certificate validation; preserve that route when updating the existing proxy. Its previous configuration is saved privately on the VPS.

After updating INSIGHT source:

```sh
cd /opt/insight-online
docker compose -p insight-online -f compose.yaml -f server/deploy/compose.vps.yaml up --build -d
docker compose -p insight-online -f compose.yaml -f server/deploy/compose.vps.yaml exec https nginx -t
docker compose -p insight-online -f compose.yaml -f server/deploy/compose.vps.yaml exec https nginx -s reload
curl --fail https://31.57.24.70:8443/health
```

Reloading nginx refreshes Docker DNS after API replacement. Take a backup first; migrations run before API startup. Roll back the application image while retaining database history. Do not remove reward/idempotency records.

## Certificates and backups

The IP certificate is publicly trusted and uses Let's Encrypt's [short-lived certificate profile](https://letsencrypt.org/2026/01/15/6day-and-ip-general-availability). INSIGHT has a separate Certbot installation and certificate state; existing brokerage certificates are unchanged. `insight-certificate.timer` checks renewal twice daily and reloads only the INSIGHT proxy after replacement.

`insight-backup.timer` creates a daily age-encrypted database dump in `/opt/insight-online/backups`. Its recovery key is `/opt/insight-online/secrets/backup.agekey`, mode 600. Backups currently remain on this VPS; the owner must arrange a separate secure off-host copy and key custody. No key or credentials were exported by the agent.

```sh
systemctl list-timers insight-certificate.timer insight-backup.timer
systemctl status insight-certificate.service insight-backup.service
```

Do not run a Compose down command with `--volumes`: that deletes the database. Keep `/opt/insight-online/.env`, certificate state, and recovery material out of Git. Existing user/settings data in the Android app remains partitioned from preview accounts and caches.
