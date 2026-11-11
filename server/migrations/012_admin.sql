-- Control dashboard (cp.midoripuzzle.com). Forward-only; nothing here changes existing columns' meaning.

-- Soft delete is "suspended + deleted_at": every existing NOT suspended check already blocks a deleted account.
-- deleted_was_suspended lets a restore return the account to the state it had before deletion.
ALTER TABLE users
  ADD COLUMN deleted_at timestamptz,
  ADD COLUMN deleted_by text CHECK (deleted_by IN ('self', 'admin')),
  ADD COLUMN deleted_was_suspended boolean,
  ADD CONSTRAINT users_deleted_consistent CHECK ((deleted_at IS NULL) = (deleted_by IS NULL) AND (deleted_at IS NULL OR suspended));

CREATE TABLE admins (
 id uuid PRIMARY KEY, email text NOT NULL UNIQUE, password_hash text NOT NULL,
 disabled boolean NOT NULL DEFAULT false, last_login_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE admin_sessions (
 id uuid PRIMARY KEY, admin_id uuid NOT NULL REFERENCES admins(id), token_hash text NOT NULL UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now(), last_seen_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL, revoked boolean NOT NULL DEFAULT false
);
CREATE INDEX admin_sessions_admin ON admin_sessions(admin_id);

-- subject_user_id has no foreign key on purpose: the trail must survive a hard delete. detail never holds bodies, emails, passwords or tokens.
CREATE TABLE admin_audit (
 id bigserial PRIMARY KEY, admin_id uuid REFERENCES admins(id), action text NOT NULL, subject_user_id uuid,
 reason text, detail jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_audit_subject ON admin_audit(subject_user_id, created_at DESC);
CREATE INDEX admin_audit_recent ON admin_audit(created_at DESC);

-- Same idea as operations: a retried or double-clicked action returns its first response instead of running twice.
CREATE TABLE admin_operations (
 admin_id uuid NOT NULL REFERENCES admins(id), id uuid NOT NULL, kind text NOT NULL,
 payload_hash text NOT NULL, response jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(admin_id, id)
);

-- Manual now; Google Play and Stripe webhooks will write the same rows later (source + external_ref).
CREATE TABLE entitlements (
 user_id uuid NOT NULL REFERENCES users(id), product text NOT NULL CHECK (product IN ('worlds')),
 status text NOT NULL CHECK (status IN ('none', 'active', 'revoked', 'refunded')),
 source text NOT NULL CHECK (source IN ('manual', 'google_play', 'stripe')), external_ref text, note text,
 updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id, product)
);
CREATE TABLE entitlement_events (
 id bigserial PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), product text NOT NULL, status text NOT NULL,
 source text NOT NULL, admin_id uuid REFERENCES admins(id), note text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX entitlement_events_user ON entitlement_events(user_id, created_at DESC);

-- A hard-deleted creator's levels disappear, but players who solved them keep the credit: their solved count and online-N badges read this.
CREATE TABLE retained_completions (
 user_id uuid NOT NULL REFERENCES users(id), content_hash text NOT NULL, retained_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id, content_hash)
);

-- Free-form email to one player. The address is read from users at send time; the body is blanked once the mail server accepts it.
CREATE TABLE direct_mail (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), subject text NOT NULL, body text NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'failed', 'cancelled')),
 attempts integer NOT NULL DEFAULT 0, next_attempt timestamptz NOT NULL DEFAULT now(),
 created_by uuid REFERENCES admins(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX direct_mail_due ON direct_mail(next_attempt) WHERE status = 'pending';

CREATE TABLE user_messages (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), subject text NOT NULL, body text NOT NULL,
 created_by uuid REFERENCES admins(id), created_at timestamptz NOT NULL DEFAULT now(), read_at timestamptz
);
CREATE INDEX user_messages_user ON user_messages(user_id, created_at DESC);
