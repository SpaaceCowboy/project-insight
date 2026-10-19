import { randomBytes } from 'node:crypto';
import { randomInt, randomUUID } from 'node:crypto';
import argon2 from 'argon2';
import { configFromEnv } from './config.js';
import { digest } from './crypto.js';
import { database, transaction } from './db.js';
import { requireValue } from './rules.js';
const config = configFromEnv(); const db = database(config.databaseUrl);
const [action, subject] = process.argv.slice(2);
try {
  if (action === 'invite') {
    const invite = randomBytes(16).toString('base64url');
    await db.query('INSERT INTO invitations(hash,remaining) VALUES($1,1)', [digest(invite, config.encryptionKey)]);
    process.stdout.write(`${invite}\n`); // Explicit operator output; never emitted by application logs.
  } else if (action === 'create-test-account') {
    requireValue(config.mailDeliveryMode === 'test-inbox', 'TEST_ONLY', 'Verified test accounts require MAIL_DELIVERY_MODE=test-inbox.');
    const email = subject ?? `tester-${randomBytes(4).toString('hex')}@insight.invalid`;
    const password = randomBytes(18).toString('base64url'); const userId = randomUUID();
    const username = `${(process.argv[4] ?? 'Quiet Cove')} #${String(randomInt(10000)).padStart(4,'0')}`;
    const hash = await argon2.hash(password, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
    await transaction(db, async c => {
      await c.query('INSERT INTO users(id,email,password_hash,username,verified) VALUES($1,$2,$3,$4,true)', [userId,email.toLowerCase(),hash,username]);
      await c.query("INSERT INTO operator_audit(action,subject) VALUES('create-test-account',$1)", [userId]);
    });
    // Deliberate operator credential output. Redirect to a chmod-600 file; never application logs.
    process.stdout.write(JSON.stringify({ email, password, userId, username }) + '\n');
  } else {
    requireValue(subject && /^[0-9a-f-]{36}$/i.test(subject), 'USAGE', 'Usage: operator invite | hide-world ID | hide-grid ID | suspend ID');
    const sql: Record<string, string> = {
      'hide-world': 'UPDATE worlds SET moderated=true WHERE id=$1',
      'hide-grid': 'UPDATE grids SET moderated=true WHERE id=$1',
      suspend: 'UPDATE users SET suspended=true WHERE id=$1',
    };
    requireValue(action && sql[action], 'USAGE', 'Unknown operator action.');
    await transaction(db, async c => {
      const result = await c.query(sql[action]!, [subject]);
      requireValue(result.rowCount, 'NOT_FOUND', 'Subject not found.');
      if (action === 'suspend') await c.query('UPDATE sessions SET revoked=true WHERE user_id=$1', [subject]);
      await c.query('INSERT INTO operator_audit(action,subject) VALUES($1,$2)', [action, subject]);
    });
    process.stdout.write('Action recorded.\n');
  }
} finally { await db.end(); }
