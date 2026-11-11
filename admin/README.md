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
docker compose exec admin node dist/admin/src/create-admin.js you@example.com          # prints the password once
docker compose exec admin node dist/admin/src/create-admin.js you@example.com --reset  # new password, signs it out everywhere
```

Redirect the output to a chmod-600 file, never to logs. Locally: `cd admin && npm run admin:create -- you@example.com`.

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

## Deploy

`compose.yaml` defines the `admin` service (127.0.0.1:4000, starts after the API is healthy so migration `012_admin.sql` has run). `server/deploy/cp-nginx.conf` + `cp-proxy.conf` are the host-nginx server block and snippet; they need the DNS record for `cp.midoripuzzle.com` and a Let's Encrypt certificate (command in the file). Set real SMTP credentials and `MAIL_DELIVERY_MODE=smtp` (the VPS override defaults to the test inbox) or emails will not reach players.
