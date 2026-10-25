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

Registration uses email, password (12–128 characters), and a unique username (1–32 characters), then signs in immediately. Login uses email and password only. Email OTP, verification, invitations, and recovery-code endpoints are removed. Migration `003_password_only_auth.sql` enables existing accounts and cancels outstanding challenges when upgrading an existing database. The `verified` API field remains for compatibility and no longer gates access.

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

Then open http://localhost:8026. Registration no longer requires an invitation: enter an email, a password of 12–128 characters, and a unique nickname of 1–32 characters. Verification still uses the eight-digit code from the private inbox. The connected APK already contains the service address, so installation needs no connection settings. Existing users can change their nickname on their profile; existing names are preserved until changed.

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
