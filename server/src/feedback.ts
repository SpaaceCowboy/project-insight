import type { FastifyBaseLogger, FastifyInstance, FastifyRequest } from 'fastify';
import { authentication, objectSchema, operationSchema } from './auth.js';
import type { Config } from './config.js';
import { transaction, type Db } from './db.js';
import { mailTransport } from './mail.js';

/** Hands the oldest pending report to the team inbox. False when nothing is due. Sent reports keep their row but lose their text. */
export async function deliverFeedback(db: Db, config: Config, log: FastifyBaseLogger, transport: { sendMail(m: object): Promise<any> } = mailTransport(config)) {
  if (config.feedbackDeliveryMode === 'store') return false;
  return transaction(db, async c => {
    await c.query("SET LOCAL idle_in_transaction_session_timeout = '45s'");
    const row = (await c.query(`SELECT f.*,u.username FROM feedback f LEFT JOIN users u ON u.id=f.user_id
      WHERE f.status='pending' AND f.next_attempt<=now() ORDER BY f.next_attempt LIMIT 1 FOR UPDATE OF f SKIP LOCKED`)).rows[0];
    if (!row) return false;
    try {
      const result = await transport.sendMail({ from: config.mailFrom, to: config.feedbackTo, messageId: `<${row.id}@insight-feedback>`,
        subject: row.kind === 'bug' ? '[INSIGHT] Bug report' : '[INSIGHT] Feedback',
        text: `${row.body}\n\n-- \nFrom: ${row.username ?? 'not signed in'}\nApp version: ${row.app_version || 'unknown'}\nSent: ${new Date(row.created_at).toISOString()}` });
      if (result.rejected?.length || !result.accepted?.length) throw new Error('SMTP_REJECTED');
      await c.query("UPDATE feedback SET status='accepted',attempts=attempts+1,body='' WHERE id=$1", [row.id]);
      log.info({ correlationId: row.id, status: 'smtp_accepted' }, 'feedback outcome');
    } catch {
      const attempt = row.attempts + 1;
      await c.query(`UPDATE feedback SET attempts=$1,status=$2,next_attempt=now()+($3::int * interval '1 second') WHERE id=$4`,
        [attempt, attempt >= 5 ? 'failed' : 'pending', attempt === 1 ? 60 : 600, row.id]);
      log.warn({ correlationId: row.id, status: attempt >= 5 ? 'failed' : 'retry_pending' }, 'feedback outcome');
    }
    return true;
  });
}

/** Share feedback / Report a bug: signed in or not, a few per hour. The text is mailed to the team, not shown to anyone else. */
export async function feedbackRoutes(app: FastifyInstance, db: Db, config: Config) {
  const auth = authentication(db, config);
  const deliver = async () => { try { while (await deliverFeedback(db, config, app.log)); } catch { app.log.warn('feedback delivery failed'); } };
  app.post('/v1/feedback', { config: { rateLimit: { max: 5, timeWindow: '1 hour' } }, schema: { body: objectSchema({
    operationId: operationSchema, kind: { type: 'string', enum: ['feedback', 'bug'] },
    text: { type: 'string', minLength: 1, maxLength: 4000, pattern: '\\S' }, appVersion: { type: 'string', maxLength: 40 },
  }, ['operationId', 'kind', 'text']) } }, async (req: FastifyRequest) => {
    if (req.headers.authorization) await auth(req);
    const b = req.body as { operationId: string; kind: string; text: string; appVersion?: string };
    // The operation ID is the row ID, so a resent request after a lost response stores one report.
    await db.query('INSERT INTO feedback(id,kind,body,user_id,app_version) VALUES($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING',
      [b.operationId, b.kind, b.text.trim(), req.account?.id ?? null, b.appVersion ?? '']);
    if (config.environment !== 'test' && config.feedbackDeliveryMode !== 'store') void deliver();
    return { accepted: true };
  });
  // Retries anything the mail server refused or that was waiting when the process restarted.
  if (config.environment !== 'test' && config.feedbackDeliveryMode !== 'store') {
    const timer = setInterval(() => void deliver(), 60000); timer.unref();
    app.addHook('onClose', async () => clearInterval(timer));
  }
}
