import { readdir, readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { configFromEnv } from './config.js';
import { database, transaction, type Db } from './db.js';
import { campaign } from './campaign.js';
import { contentHash } from './rules.js';
export async function migrate(db: Db) {
  await transaction(db, async c => {
    await c.query("SELECT pg_advisory_xact_lock(hashtextextended('insight-migrations',0))");
    await c.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
    for (const name of (await readdir(new URL('../migrations/', import.meta.url))).filter(n => n.endsWith('.sql')).sort()) {
      if ((await c.query('SELECT 1 FROM schema_migrations WHERE name=$1', [name])).rowCount) continue;
      await c.query(await readFile(new URL(`../migrations/${name}`, import.meta.url), 'utf8'));
      await c.query('INSERT INTO schema_migrations(name) VALUES($1)', [name]);
    }
    for (const puzzle of campaign) await c.query('INSERT INTO content_claims(content_hash) VALUES($1) ON CONFLICT DO NOTHING', [contentHash(puzzle)]);
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const db = database(configFromEnv().databaseUrl);
  try { await migrate(db); process.stdout.write('Migrations applied.\n'); } finally { await db.end(); }
}
