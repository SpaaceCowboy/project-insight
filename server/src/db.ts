import pg, { type PoolClient } from 'pg';
import { requireValue } from './rules.js';
export type Db = pg.Pool;
export function database(url: string): Db { return new pg.Pool({ connectionString: url, max: 10, connectionTimeoutMillis: 5000, statement_timeout: 10000, idle_in_transaction_session_timeout: 15000 }); }
export async function transaction<T>(db: Db, fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const c = await db.connect();
  try { await c.query('BEGIN'); const result = await fn(c); await c.query('COMMIT'); return result; }
  catch (error) { await c.query('ROLLBACK'); throw error; }
  finally { c.release(); }
}
/** Stable lock ordering also covers player→creator rewards without reciprocal-play deadlocks. */
export async function operation(db: Db, user: string, id: string, kind: string, payloadHash: string, fn: (c: PoolClient) => Promise<unknown>, peers: string[] = []): Promise<any> {
  return transaction(db, async c => {
    for (const account of [...new Set([user, ...peers])].sort()) await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [account]);
    const existing = (await c.query('SELECT kind, payload_hash, response FROM operations WHERE user_id=$1 AND id=$2', [user, id])).rows[0];
    if (existing) {
      requireValue(existing.kind === kind && existing.payload_hash === payloadHash, 'OPERATION_REUSED', 'Use a new operation ID for a different request.', 409);
      return existing.response;
    }
    const response = await fn(c);
    await c.query('INSERT INTO operations(user_id,id,kind,payload_hash,response) VALUES($1,$2,$3,$4,$5)', [user, id, kind, payloadHash, JSON.stringify(response)]);
    return response;
  });
}
