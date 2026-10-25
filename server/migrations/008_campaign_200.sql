-- The campaign now ends at level 200, and achievements are one per 30 levels plus first and complete.
DELETE FROM campaign_progress WHERE level_id > 200;
DELETE FROM imported_badges WHERE badge_id NOT IN ('first', 'levels-30', 'levels-60', 'levels-90', 'levels-120', 'levels-150', 'levels-180', 'complete');
