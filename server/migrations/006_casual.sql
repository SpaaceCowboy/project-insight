CREATE TABLE casual_cycles (
 user_id uuid PRIMARY KEY REFERENCES users(id),
 cycle integer NOT NULL DEFAULT 1
);
CREATE TABLE casual_completions (
 user_id uuid NOT NULL REFERENCES casual_cycles(user_id),
 grid_id uuid NOT NULL REFERENCES grids(id),
 PRIMARY KEY(user_id,grid_id)
);
ALTER TABLE play_sessions ADD COLUMN casual_cycle integer;
