-- Google sign-in links a stable Google subject to an account. Password accounts keep their existing hash.
ALTER TABLE users ADD COLUMN google_sub text;
CREATE UNIQUE INDEX users_google_sub ON users(google_sub) WHERE google_sub IS NOT NULL;

-- Recovery codes wait in the outbox until the mail worker picks them up.
CREATE INDEX email_outbox_pending ON email_outbox(next_attempt) WHERE status = 'pending';
