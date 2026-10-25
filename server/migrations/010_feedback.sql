-- Feedback and bug reports from the app, kept until the mailer has handed them to the team's inbox.
CREATE TABLE feedback (id uuid PRIMARY KEY, kind text NOT NULL CHECK (kind IN ('feedback','bug')), body text NOT NULL, user_id uuid REFERENCES users(id),
  app_version text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(), status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','failed')),
  attempts int NOT NULL DEFAULT 0, next_attempt timestamptz NOT NULL DEFAULT now());
CREATE INDEX feedback_pending ON feedback(next_attempt) WHERE status='pending';
