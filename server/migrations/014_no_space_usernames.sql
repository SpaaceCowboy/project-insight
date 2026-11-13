-- v0.2.31 (Problem 43): usernames can no longer contain spaces. DESTRUCTIVE AND PERMANENT: every account whose username has a space, and the
-- retired "Levels" account (its 100 puzzles are now the Journey, which the app ships in assets/levels.json), is hard-deleted exactly as
-- admin/src/ops.ts hardDelete() does it, in the same order: other players keep credit for solving the deleted puzzles (retained_completions),
-- everything else of the account goes. There is no ON DELETE CASCADE, so a table missed here makes the migration fail and roll back whole.
-- A CHECK constraint then keeps spaces out for good.

CREATE TEMP TABLE doomed ON COMMIT DROP AS
  SELECT id, username, (SELECT count(*)::int FROM grids g WHERE g.owner_id = u.id) AS levels
  FROM users u WHERE username ~ '\s' OR lower(username) = 'levels';

CREATE TEMP TABLE doomed_grids ON COMMIT DROP AS SELECT id FROM grids WHERE owner_id IN (SELECT id FROM doomed);

-- Other players keep credit for the deleted puzzles they solved.
INSERT INTO retained_completions(user_id, content_hash)
  SELECT DISTINCT gc.user_id, g.content_hash FROM grid_completions gc JOIN grids g ON g.id = gc.grid_id
  WHERE g.id IN (SELECT id FROM doomed_grids) AND gc.user_id NOT IN (SELECT id FROM doomed)
  ON CONFLICT DO NOTHING;

-- Children of the deleted puzzles (any player) and of the deleted players (any puzzle); play_attempt_outcomes points at play_sessions, so it goes first.
DELETE FROM play_attempt_outcomes WHERE grid_id IN (SELECT id FROM doomed_grids) OR user_id IN (SELECT id FROM doomed)
  OR session_id IN (SELECT id FROM play_sessions WHERE grid_id IN (SELECT id FROM doomed_grids) OR user_id IN (SELECT id FROM doomed));
DELETE FROM play_sessions WHERE grid_id IN (SELECT id FROM doomed_grids) OR user_id IN (SELECT id FROM doomed);
DELETE FROM casual_completions WHERE grid_id IN (SELECT id FROM doomed_grids) OR user_id IN (SELECT id FROM doomed);
DELETE FROM grid_bookmarks WHERE grid_id IN (SELECT id FROM doomed_grids) OR user_id IN (SELECT id FROM doomed);
DELETE FROM grid_likes WHERE grid_id IN (SELECT id FROM doomed_grids) OR user_id IN (SELECT id FROM doomed);
DELETE FROM grid_completions WHERE grid_id IN (SELECT id FROM doomed_grids) OR user_id IN (SELECT id FROM doomed);
DELETE FROM qualifying_plays WHERE grid_id IN (SELECT id FROM doomed_grids) OR user_id IN (SELECT id FROM doomed);
DELETE FROM grids WHERE id IN (SELECT id FROM doomed_grids);

DELETE FROM activity_days WHERE user_id IN (SELECT id FROM doomed);
DELETE FROM campaign_progress WHERE user_id IN (SELECT id FROM doomed);
DELETE FROM casual_cycles WHERE user_id IN (SELECT id FROM doomed);
DELETE FROM completions WHERE user_id IN (SELECT id FROM doomed);
DELETE FROM imported_badges WHERE user_id IN (SELECT id FROM doomed);
DELETE FROM operations WHERE user_id IN (SELECT id FROM doomed);
DELETE FROM replay_rewards WHERE user_id IN (SELECT id FROM doomed);
DELETE FROM xp_ledger WHERE user_id IN (SELECT id FROM doomed);
DELETE FROM entitlement_events WHERE user_id IN (SELECT id FROM doomed);
DELETE FROM entitlements WHERE user_id IN (SELECT id FROM doomed);
DELETE FROM user_messages WHERE user_id IN (SELECT id FROM doomed);
DELETE FROM direct_mail WHERE user_id IN (SELECT id FROM doomed);
DELETE FROM retained_completions WHERE user_id IN (SELECT id FROM doomed);
DELETE FROM sessions WHERE user_id IN (SELECT id FROM doomed);
DELETE FROM follows WHERE follower_id IN (SELECT id FROM doomed) OR followee_id IN (SELECT id FROM doomed);
DELETE FROM email_outbox WHERE challenge_id IN (SELECT id FROM challenges WHERE user_id IN (SELECT id FROM doomed));
DELETE FROM challenges WHERE user_id IN (SELECT id FROM doomed);
DELETE FROM feedback WHERE user_id IN (SELECT id FROM doomed);
UPDATE admin_audit SET detail = detail - 'from' - 'to' WHERE subject_user_id IN (SELECT id FROM doomed) AND action = 'user.rename';
-- The claim stays so the same puzzle cannot be re-published as an original; it just no longer names a person.
UPDATE content_claims SET creator_id = NULL WHERE creator_id IN (SELECT id FROM doomed);
DELETE FROM users WHERE id IN (SELECT id FROM doomed);

-- The same audit row an admin hard delete writes (no admin: the release did it). The username is not kept, as with any hard delete.
INSERT INTO admin_audit(admin_id, action, subject_user_id, reason, detail)
  SELECT NULL, 'user.hard_delete', id,
    CASE WHEN lower(username) = 'levels' THEN 'Problem 43: retired Levels account (its puzzles are now the Journey)' ELSE 'Problem 43: username with a space' END,
    jsonb_build_object('levelsDeleted', levels, 'migration', '014_no_space_usernames')
  FROM doomed;

ALTER TABLE users ADD CONSTRAINT users_username_no_space CHECK (username !~ '\s');
