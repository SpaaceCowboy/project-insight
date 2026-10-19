import { buildApp } from './app.js';
import { configFromEnv } from './config.js';
import { database } from './db.js';
const config = configFromEnv(); const db = database(config.databaseUrl);
const app = await buildApp(db, config);
async function stop() { await app.close(); await db.end(); }
process.once('SIGTERM', () => { void stop(); }); process.once('SIGINT', () => { void stop(); });
await app.listen({ port: config.port, host: config.host });
