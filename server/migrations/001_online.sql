CREATE TABLE users (
 id uuid PRIMARY KEY, email text NOT NULL UNIQUE, password_hash text NOT NULL,
 username text NOT NULL UNIQUE, verified boolean NOT NULL DEFAULT false,
 suspended boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE invitations (hash text PRIMARY KEY, remaining integer NOT NULL CHECK (remaining >= 0));
CREATE TABLE sessions (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), access_hash text UNIQUE NOT NULL,
 refresh_hash text UNIQUE NOT NULL, access_until timestamptz NOT NULL, refresh_until timestamptz NOT NULL,
 previous_refresh_hash text UNIQUE, refresh_operation uuid, refresh_response text, rotated_at timestamptz,
 revoked boolean NOT NULL DEFAULT false
);
CREATE INDEX sessions_user ON sessions(user_id);
CREATE TABLE challenges (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), purpose text NOT NULL CHECK(purpose IN ('verify','recover')),
 code_hash text NOT NULL, attempts integer NOT NULL DEFAULT 0, expires_at timestamptz NOT NULL,
 consumed boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX challenges_user ON challenges(user_id,purpose,created_at DESC);
CREATE TABLE email_outbox (
 id uuid PRIMARY KEY, challenge_id uuid NOT NULL REFERENCES challenges(id), encrypted_payload text NOT NULL,
 attempts integer NOT NULL DEFAULT 0, next_attempt timestamptz NOT NULL DEFAULT now(),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','failed','cancelled'))
);
CREATE TABLE worlds (
 id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES users(id), name text NOT NULL,
 icon char(1) NOT NULL CHECK(icon IN ('R','B','G','Y','W','P')),
 hidden boolean NOT NULL DEFAULT false, moderated boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX worlds_owner ON worlds(owner_id);
CREATE TABLE grids (
 id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES users(id), world_id uuid REFERENCES worlds(id),
 name text NOT NULL, code text NOT NULL UNIQUE, start_board jsonb NOT NULL, target_board jsonb NOT NULL,
 content_hash text NOT NULL, published_at timestamptz, hidden boolean NOT NULL DEFAULT false,
 moderated boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(),
 CHECK ((published_at IS NULL) = (world_id IS NULL))
);
CREATE INDEX grids_world ON grids(world_id);
CREATE INDEX grids_owner ON grids(owner_id);
CREATE TABLE content_claims (content_hash text PRIMARY KEY, creator_id uuid REFERENCES users(id));
CREATE TABLE campaign_progress (user_id uuid NOT NULL REFERENCES users(id), level_id integer NOT NULL CHECK(level_id > 0), PRIMARY KEY(user_id,level_id));
CREATE TABLE imported_badges (user_id uuid NOT NULL REFERENCES users(id), badge_id text NOT NULL, PRIMARY KEY(user_id,badge_id));
CREATE TABLE completions (user_id uuid NOT NULL REFERENCES users(id), content_hash text NOT NULL, first_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,content_hash));
CREATE TABLE grid_completions (user_id uuid NOT NULL REFERENCES users(id), grid_id uuid NOT NULL REFERENCES grids(id), PRIMARY KEY(user_id,grid_id));
CREATE TABLE play_sessions (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), grid_id uuid NOT NULL REFERENCES grids(id),
 expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days'
);
CREATE TABLE qualifying_plays (user_id uuid NOT NULL REFERENCES users(id), grid_id uuid NOT NULL REFERENCES grids(id), PRIMARY KEY(user_id,grid_id));
CREATE INDEX plays_grid ON qualifying_plays(grid_id);
CREATE TABLE replay_rewards (user_id uuid NOT NULL REFERENCES users(id), content_hash text NOT NULL, day date NOT NULL, PRIMARY KEY(user_id,content_hash,day));
CREATE TABLE xp_ledger (
 id bigserial PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), reason text NOT NULL,
 source text NOT NULL, amount bigint NOT NULL CHECK(amount > 0), day date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id,reason,source)
);
CREATE INDEX xp_user_day ON xp_ledger(user_id,reason,day);
CREATE TABLE operations (
 user_id uuid NOT NULL REFERENCES users(id), id uuid NOT NULL, kind text NOT NULL,
 payload_hash text NOT NULL, response jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,id)
);
CREATE TABLE operator_audit (id bigserial PRIMARY KEY, action text NOT NULL, subject uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
