/** Isolated HTTP fixture for Android form tests. Never copied into the production Docker image. */
import { randomUUID } from 'node:crypto';
import { buildApp } from '../src/app.js';
import { database } from '../src/db.js';
import { migrate } from '../src/migrate.js';
import type { Config } from '../src/config.js';
import { campaign } from '../src/campaign.js';
import { readFileSync } from 'node:fs';

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
const paths = JSON.parse(readFileSync(new URL('../../app/src/test/resources/solutions.json', import.meta.url), 'utf8'));
let fixtureWorld: any; let fixtureGrid: any;
let offline = false;
app.addHook('onRequest',async(req,reply)=>{
  if(offline && (req.url.startsWith('/v1/creators') || req.url.startsWith('/v1/casual/sessions'))) { reply.hijack(); req.raw.socket.destroy(); }
});
app.post('/test/outage',async req=>{ offline=!!(req.body as any).offline; return {accepted:true}; });
const fixtureLevel = paths.findIndex((p: any[]) => p.length > 1);
app.get('/test/discovery',async()=>({worldId:fixtureWorld.id,gridId:fixtureGrid.id,solution:paths[fixtureLevel]}));
app.get('/test/discovery-stats',async()=>({failures:(await db.query("SELECT count(*)::int AS n FROM play_attempt_outcomes WHERE grid_id=$1 AND outcome='failed'",[fixtureGrid.id])).rows[0].n}));
await app.ready();
async function seedCall(path: string, body: object, access?: string) {
  const response = await app.inject({ method: 'POST', url: path, payload: body, headers: access ? {authorization:`Bearer ${access}`} : {}, remoteAddress: '192.0.2.200' });
  if(response.statusCode !== 200) throw new Error(`Fixture ${path}: ${response.body}`);
  return response.json();
}
const fixturePassword = 'fixture-password';
const maker = await seedCall('/v1/auth/register',{email:'qa-maker@example.test',password:fixturePassword,name:'QA Maker'});
const designer = await seedCall('/v1/auth/register',{email:'qa-designer@example.test',password:fixturePassword,name:'QA Designer'});
await seedCall('/v1/auth/register',{email:'qa-player@example.test',password:fixturePassword,name:'QA Player'});
const world = await seedCall('/v1/worlds',{operationId:randomUUID(),name:'Calm Pool',icon:'R'},maker.accessToken);
fixtureWorld = world;
const second = await seedCall('/v1/worlds',{operationId:randomUUID(),name:'Warm Grove',icon:'B'},designer.accessToken);
for(const [owner,w,n,name] of [[maker,world,fixtureLevel,'Quiet Cove'],[designer,second,fixtureLevel+1,'Silver Grove'],[designer,second,fixtureLevel+2,'Warm Fern']] as const) {
  const puzzle = campaign[n]!;
  const grid = await seedCall('/v1/grids/drafts',{operationId:randomUUID(),name,start:puzzle.start,target:puzzle.target,path:paths[n]},owner.accessToken);
  await seedCall(`/v1/grids/${grid.id}/publish`,{operationId:randomUUID(),worldId:w.id},owner.accessToken);
  if(owner===maker) fixtureGrid=grid;
}
await seedCall('/v1/completions',{operationId:randomUUID(),kind:'campaign',levelId:1,path:paths[0]},maker.accessToken);
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
