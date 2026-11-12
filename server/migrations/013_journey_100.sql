-- v0.2.30: the Journey is now the 100 puzzles of the account "Levels", in a new order, so every player's Journey progress and Journey achievements start
-- over. Accounts, XP, community puzzles, completions and social data are untouched.
DELETE FROM campaign_progress;
DELETE FROM imported_badges WHERE badge_id IN ('first', 'complete') OR badge_id LIKE 'levels-%';
