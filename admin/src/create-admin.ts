import { randomBytes, randomUUID } from 'node:crypto';
import { configFromEnv } from '../../server/src/config.js';
import { database, transaction } from '../../server/src/db.js';
import { hashPassword } from './auth.js';
import { audit } from './ops.js';

// Admin accounts exist only through this script (there is no registration endpoint).
//   npm run admin:create -- you@example.com            creates the account
//   npm run admin:create -- you@example.com --reset    new password for an existing account and signs it out everywhere
// The password is printed once to stdout. Create the file private BEFORE writing it:  (umask 077; npm run admin:create -- you@example.com > cp-admin.json)
// and never send it to application logs. A disabled admin stays disabled on --reset.
const [emailArg, flag] = process.argv.slice(2);
const email = emailArg?.trim().toLowerCase();
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || (flag && flag !== '--reset')) {
  process.stderr.write('Usage: admin:create <email> [--reset]\n'); process.exit(2);
}
const db = database(configFromEnv().databaseUrl);
try {
  const password = randomBytes(18).toString('base64url'); // 24 characters
  const hash = await hashPassword(password);
  await transaction(db, async c => {
    const existing = (await c.query('SELECT id,disabled FROM admins WHERE email=$1 FOR UPDATE', [email])).rows[0];
    if (flag === '--reset') {
      if (!existing) throw new Error('No admin with that email.');
      await c.query('UPDATE admins SET password_hash=$1 WHERE id=$2', [hash, existing.id]);
      await c.query('UPDATE admin_sessions SET revoked=true WHERE admin_id=$1', [existing.id]);
      await audit(c, existing.id, 'admin.password_reset', null, null, {});
      if (existing.disabled) process.stderr.write('Note: this admin is disabled and stays disabled; the new password will not work until it is enabled.\n');
    } else {
      if (existing) throw new Error('That admin already exists. Use --reset to issue a new password.');
      const id = randomUUID();
      await c.query('INSERT INTO admins(id,email,password_hash) VALUES($1,$2,$3)', [id, email, hash]);
      await audit(c, id, 'admin.create', null, null, {});
    }
  });
  process.stdout.write(JSON.stringify({ email, password }) + '\n');
} catch (error) {
  process.stderr.write(`${(error as Error).message}\n`); process.exitCode = 1;
} finally { await db.end(); }
