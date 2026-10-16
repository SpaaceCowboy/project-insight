import nodemailer from 'nodemailer';
import type { FastifyBaseLogger } from 'fastify';
import type { Config } from './config.js';
import { decrypt } from './crypto.js';
import { transaction, type Db } from './db.js';

export function mailTransport(config: Config) {
  return nodemailer.createTransport({ host: config.smtpHost, port: config.smtpPort, secure: config.smtpSecure,
    requireTLS: config.environment === 'production' && !config.smtpSecure && config.mailDeliveryMode !== 'test-inbox',
    auth: config.smtpUser ? { user: config.smtpUser, pass: config.smtpPassword } : undefined,
    connectionTimeout: 10000, greetingTimeout: 5000, socketTimeout: 10000 });
}
/** One locked job at a time; an SMTP crash may resend the SAME code, never create a different challenge. */
export async function deliverMail(db: Db, config: Config, log: FastifyBaseLogger, transport = mailTransport(config)) {
  return transaction(db, async c => {
    await c.query("SET LOCAL idle_in_transaction_session_timeout = '45s'");
    const row = (await c.query(`SELECT o.*,ch.consumed,ch.expires_at FROM email_outbox o JOIN challenges ch ON ch.id=o.challenge_id
      WHERE o.status='pending' AND o.next_attempt<=now() ORDER BY o.next_attempt LIMIT 1 FOR UPDATE OF o SKIP LOCKED`)).rows[0];
    if (!row) return false;
    if (row.consumed || new Date(row.expires_at).getTime() <= Date.now()) {
      await c.query("UPDATE email_outbox SET status='cancelled' WHERE id=$1", [row.id]); return true;
    }
    const payload = decrypt<{ email: string; code: string; purpose: string }>(row.encrypted_payload, config.encryptionKey);
    const started = Date.now();
    try {
      const result = await transport.sendMail({ from: config.mailFrom, to: payload.email, messageId: `<${row.id}@insight-online>`,
        subject: payload.purpose === 'verify' ? 'Verify your INSIGHT account' : 'Recover your INSIGHT account',
        text: `Your INSIGHT code is ${payload.code}. It expires in 15 minutes. If you did not request this, ignore this message.` });
      if (result.rejected?.length || !result.accepted?.length) throw new Error('SMTP_REJECTED');
      await c.query("UPDATE email_outbox SET status='accepted',attempts=attempts+1,encrypted_payload='' WHERE id=$1", [row.id]);
      log.info({ correlationId: row.id, status: 'smtp_accepted', latencyMs: Date.now() - started }, 'email outcome');
    } catch {
      const attempt = row.attempts + 1;
      await c.query(`UPDATE email_outbox SET attempts=$1,status=$2,next_attempt=now()+($3::int * interval '1 second') WHERE id=$4`,
        [attempt, attempt >= 3 ? 'failed' : 'pending', attempt === 1 ? 60 : 300, row.id]);
      log.warn({ correlationId: row.id, status: attempt >= 3 ? 'failed' : 'retry_pending', latencyMs: Date.now() - started }, 'email outcome');
    }
    return true;
  });
}
