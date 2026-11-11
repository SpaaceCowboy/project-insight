import type { FastifyBaseLogger } from 'fastify';
import type { Config } from '../../server/src/config.js';
import { transaction, type Db } from '../../server/src/db.js';
import { mailTransport } from '../../server/src/mail.js';
import { audit } from './ops.js';

/** Sends the oldest due admin email. False when nothing is due. Modelled on deliverMail: locked row, 3 attempts, body blanked once accepted. */
export async function deliverDirectMail(db: Db, config: Config, log: FastifyBaseLogger, transport: { sendMail(m: object): Promise<any> } = mailTransport(config)) {
  return transaction(db, async c => {
    await c.query("SET LOCAL idle_in_transaction_session_timeout = '45s'");
    const row = (await c.query(`SELECT m.*,u.email,u.suspended,u.deleted_at FROM direct_mail m JOIN users u ON u.id=m.user_id
      WHERE m.status='pending' AND m.next_attempt<=now() ORDER BY m.next_attempt LIMIT 1 FOR UPDATE OF m SKIP LOCKED`)).rows[0];
    if (!row) return false;
    if (row.deleted_at) { await c.query("UPDATE direct_mail SET status='cancelled',body='' WHERE id=$1", [row.id]); return true; }
    const started = Date.now();
    try {
      const result = await transport.sendMail({ from: config.mailFrom, to: row.email, messageId: `<${row.id}@midori-admin>`, subject: row.subject, text: row.body });
      if (result.rejected?.length || !result.accepted?.length) throw new Error('SMTP_REJECTED');
      await c.query("UPDATE direct_mail SET status='accepted',attempts=attempts+1,body='' WHERE id=$1", [row.id]);
      log.info({ correlationId: row.id, status: 'smtp_accepted', latencyMs: Date.now() - started }, 'direct mail outcome');
    } catch {
      const attempt = row.attempts + 1;
      // A message that has given up keeps no text either.
      await c.query(`UPDATE direct_mail SET attempts=$1,status=$2,body=CASE WHEN $2::text='failed' THEN '' ELSE body END,next_attempt=now()+($3::int * interval '1 second') WHERE id=$4`,
        [attempt, attempt >= 3 ? 'failed' : 'pending', attempt === 1 ? 60 : 300, row.id]);
      if (attempt >= 3) await audit(c, row.created_by ?? null, 'user.email_failed', row.user_id, null, { mailId: row.id }); // otherwise nobody would ever learn it never arrived
      log.warn({ correlationId: row.id, status: attempt >= 3 ? 'failed' : 'retry_pending', latencyMs: Date.now() - started }, 'direct mail outcome');
    }
    return true;
  });
}
