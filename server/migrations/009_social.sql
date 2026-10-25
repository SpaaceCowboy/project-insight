-- Bookmarks and likes on community puzzles, follows between players, and the days each player solved something (daily streak).
CREATE TABLE grid_bookmarks (user_id uuid NOT NULL REFERENCES users(id), grid_id uuid NOT NULL REFERENCES grids(id), created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,grid_id));
CREATE TABLE grid_likes (user_id uuid NOT NULL REFERENCES users(id), grid_id uuid NOT NULL REFERENCES grids(id), created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,grid_id));
CREATE INDEX grid_likes_grid ON grid_likes(grid_id);
CREATE INDEX grid_likes_created ON grid_likes(created_at);
CREATE TABLE follows (follower_id uuid NOT NULL REFERENCES users(id), followee_id uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(follower_id,followee_id), CHECK (follower_id <> followee_id));
CREATE INDEX follows_followee ON follows(followee_id);
-- day is the player's own calendar date when they solved a puzzle.
CREATE TABLE activity_days (user_id uuid NOT NULL REFERENCES users(id), day date NOT NULL, PRIMARY KEY(user_id,day));
