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
