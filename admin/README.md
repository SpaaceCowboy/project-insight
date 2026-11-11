# Midori control dashboard

Private operator console for players, payments and support: `https://cp.midoripuzzle.com`. A Fastify API plus a React (Vite, Tailwind) single-page app, one process, sharing the player API's PostgreSQL database and Redis. It imports a few modules from `../server/src` (`db`, `crypto`, `config`, `mail`, `nickname`, `rate-store`, `progression`) so rules like username validation and the recovery-code flow stay identical to the app's.

## What it does

Search and filter players; edit username and email; **suspend / unsuspend**; **delete (restorable)** and **restore**; **permanent delete**; send the 8-digit password-reset code; sign a player out everywhere; send an email; leave an in-game message; set Worlds access manually; read the audit log. Every action is one transaction, writes one `admin_audit` row (who, what, whom, why) and carries an operation ID, so a retry or double click applies once.

- **Soft delete** is `suspended + deleted_at`. Every existing "not suspended" check in the player API already blocks sign-in and hides the player and their levels. Restoring returns the account to its prior state (an account suspended before deletion comes back suspended). A future in-app "delete my account" should set `deleted_by='self'` the same way.
- **Permanent delete** removes the player, their private data and their published levels (and likes/bookmarks on them). Players who solved those levels keep their solved count and badges: `retained_completions` keeps the credit and `online.ts` / `discovery.ts` read it. Requires re-entering the admin password and typing the username. Nothing is purged automatically.
- **Payments** are manual entitlements for now (`entitlements`, `entitlement_events`, source `manual`). Google Play and Stripe webhooks should write the same rows with their `source` and `external_ref`.
- **In-game messages** are stored in `user_messages`. The player API has no inbox endpoint and the app has no screen yet; messages wait unread.

## Admin accounts

There is no registration endpoint. On the server:

```sh
docker compose exec -T admin node dist/admin/src/create-admin.js you@example.com          # prints the password once
docker compose exec -T admin node dist/admin/src/create-admin.js you@example.com --reset  # new password, signs it out everywhere
```

Create the file private first, then redirect into it (`-T` keeps the password out of terminal scrollback): `(umask 077; docker compose exec -T admin node dist/admin/src/create-admin.js you@example.com > cp-admin.json)`. Never send it to logs. `--reset` leaves a disabled admin disabled. Locally: `cd admin && npm run admin:create -- you@example.com`.

## Security notes

Email + password only (no 2FA, no IP allowlist yet). In place: argon2id, 14+ character generated passwords, login throttled per address and per email (Redis, plus an nginx `limit_req`), `__Host-` cookie (HttpOnly, Secure, SameSite=Strict), 8 h absolute / 30 min idle sessions, a per-session CSRF header on every write, a strict CSP, `noindex`, no raw URLs in logs, and step-up on permanent delete. Recommended next: TOTP, then an IP allowlist or Cloudflare Access in front.

## Develop

```sh
cd server && npm ci && cd ../admin && npm ci && (cd ui && npm ci)
# a migrated database (cd server && npm run migrate) and the same env as the API: DATABASE_URL, ENCRYPTION_KEY, MAIL_DELIVERY_MODE=disabled
npm run dev                      # API on :4000
cd ui && npm run dev             # UI on :5190, proxies /api to :4000
TEST_DATABASE_URL=postgresql://... npm run test:integration   # isolated schema per run
```

## Deploy (the native VPS: systemd + host nginx; deployed 11 November 2026)

Live at `https://cp.midoripuzzle.com`, behind Cloudflare (Full mode). The VPS's `/opt/insight-online/server` is **not** a git checkout, and its `dist/` is built elsewhere (release directories `/opt/insight-release-NNN`); never run `npm run build` in its `src/`, which is stale. The dashboard therefore ships as a prebuilt bundle and never touches the API's `dist/`.

```sh
# Build locally (from admin/): tsc output + the SPA
npm ci && npm run build && (cd ui && npm ci && npm run build)
tar cf - admin/dist admin/package.json admin/package-lock.json admin/ui/dist ... | ssh root@VPS 'tar xf - -C /opt/insight-online'   # keep dist/ and ui/dist layout
ssh root@VPS 'cd /opt/insight-online/admin && PATH=/opt/node/bin:$PATH npm ci --omit=dev && chown -R insight:insight . && systemctl restart insight-admin'
```

One-time setup, already done:
- Migration `012_admin.sql` copied to `/opt/insight-online/server/migrations/` and applied with `dist/migrate.js` (any API restart applies it too). Additive only.
- The six API files changed for retained completions (`auth.js discovery.js mail.js online.js rate-limit.js rate-store.js`) were copied over the live `dist/`; the previous `dist/` is `/opt/insight-rollback-before-admin/dist`.
- `server/deploy/insight-admin.service` -> `/etc/systemd/system/` (reads `/opt/insight-online/.env`; `ADMIN_PORT`, not `PORT`, because the env file sets `PORT=3000` and beats `Environment=`).
- nginx: `cp-proxy.conf` and `cp-cloudflare-realip.conf` -> `/etc/nginx/snippets/`; `cp-nginx.conf` -> `/etc/nginx/sites-enabled/zz-cp.conf`. The `zz-` prefix is load-bearing: the first-loaded 443 server is nginx's default, and `sites-enabled/insight` must stay it so the app (which connects by IP, no SNI) keeps getting the IP certificate. Refresh the Cloudflare ranges occasionally.
- Certificate: `/opt/certbot/bin/certbot certonly --webroot -w /var/www/insight-acme -d cp.midoripuzzle.com`; the existing `insight-certificate.timer` renews it.
- Admin account: `create-admin.js` as above, run with the API's env as user `insight`.

Rollback: `systemctl disable --now insight-admin`, remove `sites-enabled/zz-cp.conf` and reload nginx. To undo the API files, copy `/opt/insight-rollback-before-admin/dist/*.js` back and restart `insight-online` (migration 012 stays; it is additive).

Email: the dashboard reads the API's SMTP settings. With `MAIL_DELIVERY_MODE=disabled` (the current production value) the reset-code and email actions answer "Email delivery is disabled" and queue nothing.
