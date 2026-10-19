ALTER TABLE grids ADD COLUMN level_number smallint;
UPDATE grids g SET level_number = n.rn
  FROM (SELECT id, row_number() OVER (PARTITION BY world_id ORDER BY published_at, id)::smallint AS rn
        FROM grids WHERE published_at IS NOT NULL) n
  WHERE g.id = n.id;
ALTER TABLE grids ADD CONSTRAINT grids_level_number_range CHECK (level_number BETWEEN 1 AND 20);
ALTER TABLE grids ADD CONSTRAINT grids_level_number_published CHECK ((published_at IS NULL) = (level_number IS NULL));
CREATE UNIQUE INDEX grids_world_level_unique ON grids (world_id, level_number) WHERE published_at IS NOT NULL;
