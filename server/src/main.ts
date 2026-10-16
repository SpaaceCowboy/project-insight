import { buildApp } from './app.js';
import { configFromEnv } from './config.js';
import { database } from './db.js';
import { deliverMail } from './mail.js';
const config = configFromEnv(); const db = database(config.databaseUrl);
const app = await buildApp(db, config);
let mailRunning = false;
const interval = setInterval(() => {
  if (mailRunning) return;
  mailRunning = true;
  deliverMail(db, config, app.log).catch(() => app.log.error({ status: 'worker_failed' }, 'email worker failed')).finally(() => { mailRunning = false; });
}, 2000);
interval.unref();
async function stop() { clearInterval(interval); await app.close(); await db.end(); }
process.once('SIGTERM', () => { void stop(); }); process.once('SIGINT', () => { void stop(); });
await app.listen({ port: config.port, host: config.host });
