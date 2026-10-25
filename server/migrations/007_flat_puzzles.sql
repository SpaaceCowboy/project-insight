-- Keep puzzle identities and histories while removing collection membership.
UPDATE grids g SET hidden=g.hidden OR w.hidden, moderated=g.moderated OR w.moderated
FROM worlds w WHERE w.id=g.world_id;
ALTER TABLE grids DROP CONSTRAINT grids_check;
ALTER TABLE grids DROP CONSTRAINT grids_level_number_range;
DROP INDEX grids_world_level_unique;
ALTER TABLE grids ALTER COLUMN level_number TYPE integer;
UPDATE grids g SET level_number=n.number FROM (
  SELECT id,row_number() OVER (PARTITION BY owner_id ORDER BY published_at,id)::integer AS number
  FROM grids WHERE published_at IS NOT NULL
) n WHERE g.id=n.id;
CREATE UNIQUE INDEX grids_owner_number_unique ON grids(owner_id,level_number) WHERE published_at IS NOT NULL;
ALTER TABLE grids DROP COLUMN world_id;
ALTER TABLE grids DROP COLUMN name;
DROP TABLE worlds;
