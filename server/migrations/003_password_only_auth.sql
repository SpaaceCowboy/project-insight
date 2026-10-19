-- Existing accounts can immediately use Online without an email challenge.
ALTER TABLE users ALTER COLUMN verified SET DEFAULT true;
UPDATE users SET verified=true WHERE NOT verified;
UPDATE challenges SET consumed=true WHERE NOT consumed;
UPDATE email_outbox SET status='cancelled' WHERE status IN ('pending','failed');
