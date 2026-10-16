/** Isolated HTTP fixture for Android form tests. Never copied into the production Docker image. */
import { randomUUID } from 'node:crypto';
import { buildApp } from '../src/app.js';
import { database } from '../src/db.js';
import { migrate } from '../src/migrate.js';
import { decrypt } from '../src/crypto.js';
import type { Config } from '../src/config.js';

if (!process.env.TEST_DATABASE_URL) throw new Error('Set TEST_DATABASE_URL to an isolated UTF-8 PostgreSQL database.');
const schema = `android_${randomUUID().replaceAll('-', '')}`;
const admin = database(process.env.TEST_DATABASE_URL);
await admin.query(`CREATE SCHEMA ${schema}`);
const url = new URL(process.env.TEST_DATABASE_URL); url.searchParams.set('options', `-c search_path=${schema}`);
const config: Config = { databaseUrl: url.toString(), encryptionKey: '28'.repeat(32), host: '127.0.0.1', port: 38861,
  smtpHost: 'localhost', smtpPort: 1025, smtpSecure: false, mailFrom: 'test@localhost', environment: 'test', trustProxy: false, mailDeliveryMode: 'test-inbox' };
const db = database(config.databaseUrl);
await migrate(db);
const app = await buildApp(db, config, false);
app.get('/test/code', async req => {
  const email = (req.query as { email: string }).email;
  const row = (await db.query(`SELECT o.encrypted_payload FROM email_outbox o JOIN challenges c ON c.id=o.challenge_id
    JOIN users u ON u.id=c.user_id WHERE u.email=$1 AND NOT c.consumed ORDER BY c.created_at DESC LIMIT 1`, [email])).rows[0];
  if (!row) throw new Error('No test challenge');
  return { code: decrypt<{ code: string }>(row.encrypted_payload, config.encryptionKey).code };
});
await app.listen({ host: config.host, port: config.port });
console.log('Android auth fixture ready on 127.0.0.1:38861 (isolated temporary schema)');
let stopping = false;
async function stop() {
  if (stopping) return; stopping = true;
  await app.close(); await db.end(); await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin.end();
  process.exit(0);
}
process.on('SIGINT', () => { void stop(); });
process.on('SIGTERM', () => { void stop(); });
