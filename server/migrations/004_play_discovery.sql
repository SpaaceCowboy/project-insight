CREATE TABLE play_attempt_outcomes (
 user_id uuid NOT NULL REFERENCES users(id), attempt_id uuid NOT NULL,
 session_id uuid NOT NULL REFERENCES play_sessions(id), grid_id uuid NOT NULL REFERENCES grids(id),
 outcome text NOT NULL CHECK(outcome IN ('solved','failed')),
 reason text CHECK(reason IN ('restart','leave')), recorded_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,attempt_id),
 CHECK ((outcome='failed') = (reason IS NOT NULL))
);
CREATE INDEX attempt_failures_grid ON play_attempt_outcomes(grid_id) WHERE outcome='failed';
CREATE INDEX grid_solvers ON grid_completions(grid_id,user_id);
CREATE INDEX worlds_created ON worlds(created_at,id);
