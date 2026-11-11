import { configFromEnv } from '../../server/src/config.js';
import { database } from '../../server/src/db.js';
import { buildAdminApp } from './app.js';

const config = configFromEnv();
const app = await buildAdminApp(database(config.databaseUrl), config);
await app.listen({ port: Number(process.env.ADMIN_PORT ?? 4000), host: config.host });
