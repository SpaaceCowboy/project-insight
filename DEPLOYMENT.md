# Private Online deployment

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

Nickname uniqueness ignores letter case and Unicode compatibility variants. Migration `002_unique_nicknames.sql` adds a unique index without changing existing accounts or progress. World and grid titles still use the reviewed word picker. Completed community grids show a themed Solved badge; their history is kept per account and restored from the service.

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
