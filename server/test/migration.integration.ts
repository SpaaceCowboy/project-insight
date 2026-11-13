import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { database } from '../src/db.js';

test('campaign retirement preserves current progress, accounts and XP',async()=>{
  const schema='migration_'+randomUUID().replaceAll('-','');
  const admin=database(process.env.TEST_DATABASE_URL!);
  const url=new URL(process.env.TEST_DATABASE_URL!); url.searchParams.set('options',`-c search_path=${schema}`);
  let db: ReturnType<typeof database>|undefined;
  try {
    await admin.query(`CREATE SCHEMA ${schema}`); db=database(url.toString());
    const root=new URL('../migrations/',import.meta.url);
    for(const name of readdirSync(root).filter(n=>n.endsWith('.sql') && n<'008').sort()) await db.query(readFileSync(new URL(name,root),'utf8'));
    const id=randomUUID();
    await db.query('INSERT INTO users(id,email,password_hash,username,verified) VALUES($1,$2,$3,$4,true)',[id,id+'@example.test','unused','Migration player']);
    await db.query('INSERT INTO campaign_progress(user_id,level_id) SELECT $1,unnest(ARRAY[1,200,201,206])',[id]);
    await db.query("INSERT INTO imported_badges(user_id,badge_id) SELECT $1,unnest(ARRAY['first','world-1','flow','complete'])",[id]);
    await db.query("INSERT INTO xp_ledger(user_id,reason,source,amount) VALUES($1,'first','preserved',100000)",[id]);
    await db.query(readFileSync(new URL('008_campaign_200.sql',root),'utf8'));
    assert.deepEqual((await db.query('SELECT level_id FROM campaign_progress ORDER BY level_id')).rows.map(r=>r.level_id),[1,200]);
    assert.deepEqual((await db.query('SELECT badge_id FROM imported_badges ORDER BY badge_id')).rows.map(r=>r.badge_id),['complete','first']);
    assert.equal((await db.query('SELECT amount::text FROM xp_ledger')).rows[0].amount,'100000');
    assert.equal((await db.query('SELECT id FROM users')).rows[0].id,id);
  } finally { await db?.end(); await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); await admin.end(); }
});

test('the 100-level Journey clears Journey progress and badges only',async()=>{
  const schema='migration_'+randomUUID().replaceAll('-','');
  const admin=database(process.env.TEST_DATABASE_URL!);
  const url=new URL(process.env.TEST_DATABASE_URL!); url.searchParams.set('options',`-c search_path=${schema}`);
  let db: ReturnType<typeof database>|undefined;
  try {
    await admin.query(`CREATE SCHEMA ${schema}`); db=database(url.toString());
    const root=new URL('../migrations/',import.meta.url);
    for(const name of readdirSync(root).filter(n=>n.endsWith('.sql') && n<'013').sort()) await db.query(readFileSync(new URL(name,root),'utf8'));
    const id=randomUUID();
    await db.query('INSERT INTO users(id,email,password_hash,username,verified) VALUES($1,$2,$3,$4,true)',[id,id+'@example.test','unused','Journey player']);
    await db.query('INSERT INTO campaign_progress(user_id,level_id) SELECT $1,unnest(ARRAY[1,30,100,206])',[id]);
    await db.query("INSERT INTO imported_badges(user_id,badge_id) SELECT $1,unnest(ARRAY['first','levels-30','levels-180','complete','world-1','online-1'])",[id]);
    await db.query("INSERT INTO xp_ledger(user_id,reason,source,amount) VALUES($1,'first','preserved',100000)",[id]);
    await db.query(readFileSync(new URL('013_journey_100.sql',root),'utf8'));
    assert.equal((await db.query('SELECT count(*)::int AS n FROM campaign_progress')).rows[0].n,0);
    assert.deepEqual((await db.query('SELECT badge_id FROM imported_badges ORDER BY badge_id')).rows.map(r=>r.badge_id),['online-1','world-1']);
    assert.equal((await db.query('SELECT amount::text FROM xp_ledger')).rows[0].amount,'100000');
    assert.equal((await db.query('SELECT id FROM users')).rows[0].id,id);
  } finally { await db?.end(); await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); await admin.end(); }
});

test('flattening old worlds preserves puzzles, restrictions, codes, drafts and histories',async()=>{
  const schema='migration_'+randomUUID().replaceAll('-','');
  const admin=database(process.env.TEST_DATABASE_URL!);
  const url=new URL(process.env.TEST_DATABASE_URL!); url.searchParams.set('options',`-c search_path=${schema}`);
  let db: ReturnType<typeof database>|undefined;
  try {
    await admin.query(`CREATE SCHEMA ${schema}`); db=database(url.toString());
    const root=new URL('../migrations/',import.meta.url);
    for(const name of readdirSync(root).filter(n=>n.endsWith('.sql') && n<'007').sort()) await db.query(readFileSync(new URL(name,root),'utf8'));
    const owner=randomUUID(),viewer=randomUUID(),a=randomUUID(),b=randomUUID(),g1=randomUUID(),g2=randomUUID(),draft=randomUUID();
    for(const [id,name] of [[owner,'Owner'],[viewer,'Viewer']]) await db.query('INSERT INTO users(id,email,password_hash,username,verified) VALUES($1,$2,$3,$4,true)',[id,id+'@example.test','unused',name]);
    await db.query("INSERT INTO worlds(id,owner_id,name,icon,hidden,moderated) VALUES($1,$3,'Hidden','R',true,false),($2,$3,'Moderated','B',false,true)",[a,b,owner]);
    for(const [id,w,code,time] of [[g1,a,'AAAAAAAAAAAAAAAA','2025-01-01'],[g2,b,'BBBBBBBBBBBBBBBB','2025-02-01']]) await db.query(
      `INSERT INTO grids(id,owner_id,world_id,name,code,start_board,target_board,content_hash,published_at,level_number)
       VALUES($1::uuid,$2,$3,'Old title',$4,'["RW"]','["WR"]',$1::text,$5,1)`,[id,owner,w,code,time]);
    await db.query(`INSERT INTO grids(id,owner_id,name,code,start_board,target_board,content_hash) VALUES($1::uuid,$2,'Private draft','CCCCCCCCCCCCCCCC','["RW"]','["WR"]',$1::text)`,[draft,owner]);
    await db.query('INSERT INTO grid_completions(user_id,grid_id) VALUES($1,$2)',[viewer,g1]);
    await db.query('INSERT INTO imported_badges(user_id,badge_id) VALUES($1,$2)',[viewer,'world-1']);
    await db.query("INSERT INTO xp_ledger(user_id,reason,source,amount) VALUES($1,'first','preserved',100000)",[viewer]);
    await db.query(readFileSync(new URL('007_flat_puzzles.sql',root),'utf8'));
    const rows=(await db.query('SELECT * FROM grids WHERE owner_id=$1 ORDER BY level_number NULLS LAST',[owner])).rows;
    assert.deepEqual(rows.map(g=>g.id),[g1,g2,draft]); assert.deepEqual(rows.map(g=>g.level_number),[1,2,null]);
    assert.equal(rows[0].hidden,true); assert.equal(rows[1].moderated,true); assert.equal(rows[0].code,'AAAAAAAAAAAAAAAA');
    assert.equal(rows[2].published_at,null); assert.equal('name' in rows[0],false); assert.equal('world_id' in rows[0],false);
    assert.equal((await db.query('SELECT grid_id FROM grid_completions WHERE user_id=$1',[viewer])).rows[0].grid_id,g1);
    assert.equal((await db.query('SELECT badge_id FROM imported_badges WHERE user_id=$1',[viewer])).rows[0].badge_id,'world-1');
    assert.equal((await db.query('SELECT amount::text FROM xp_ledger WHERE user_id=$1',[viewer])).rows[0].amount,'100000');
    assert.equal((await db.query("SELECT to_regclass('worlds') AS table_name")).rows[0].table_name,null);
  } finally { await db?.end(); await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); await admin.end(); }
});

test('no-space usernames hard-delete spaced accounts and Levels, keep solvers\' credit, and forbid spaces', async () => {
  const schema = 'migration_' + randomUUID().replaceAll('-', '');
  const admin = database(process.env.TEST_DATABASE_URL!);
  const url = new URL(process.env.TEST_DATABASE_URL!); url.searchParams.set('options', `-c search_path=${schema}`);
  let db: ReturnType<typeof database> | undefined;
  try {
    await admin.query(`CREATE SCHEMA ${schema}`); db = database(url.toString());
    const root = new URL('../migrations/', import.meta.url);
    for (const name of readdirSync(root).filter(n => n.endsWith('.sql') && n < '014').sort()) await db.query(readFileSync(new URL(name, root), 'utf8'));
    const spaced = randomUUID(), levels = randomUUID(), keeper = randomUUID();
    for (const [id, name] of [[spaced, 'Wash It'], [levels, 'Levels'], [keeper, 'Keeper_1']])
      await db.query('INSERT INTO users(id,email,password_hash,username,verified) VALUES($1,$2,$3,$4,true)', [id, id + '@example.test', 'unused', name]);
    const g1 = randomUUID(), g2 = randomUUID(), g3 = randomUUID();
    for (const [id, owner, code, n] of [[g1, spaced, 'AAAAAAAAAAAAAAAA', 1], [g2, levels, 'BBBBBBBBBBBBBBBB', 1], [g3, keeper, 'CCCCCCCCCCCCCCCC', 1]])
      await db.query(`INSERT INTO grids(id,owner_id,code,start_board,target_board,content_hash,published_at,level_number) VALUES($1::uuid,$2,$3,'["RW"]','["WR"]',$1::text,now(),$4)`, [id, owner, code, n]);
    // The keeper solved and liked the deleted puzzles and follows a deleted player; the deleted player played, liked and solved the keeper's puzzle.
    await db.query('INSERT INTO grid_completions(user_id,grid_id) VALUES($1,$2),($1,$3),($4,$5)', [keeper, g1, g2, spaced, g3]);
    await db.query('INSERT INTO grid_likes(user_id,grid_id) VALUES($1,$2),($3,$4)', [keeper, g1, spaced, g3]);
    await db.query('INSERT INTO follows(follower_id,followee_id) VALUES($1,$2)', [keeper, spaced]);
    const s1 = randomUUID(), s2 = randomUUID();
    await db.query('INSERT INTO play_sessions(id,user_id,grid_id) VALUES($1,$2,$3),($4,$5,$6)', [s1, keeper, g1, s2, spaced, g3]);
    await db.query("INSERT INTO play_attempt_outcomes(user_id,attempt_id,session_id,grid_id,outcome,reason) VALUES($1,$2,$3,$4,'failed','leave'),($5,$6,$7,$8,'solved',NULL)",
      [keeper, randomUUID(), s1, g1, spaced, randomUUID(), s2, g3]);
    await db.query("INSERT INTO xp_ledger(user_id,reason,source,amount) VALUES($1,'first','preserved',100000),($2,'first','preserved',5)", [keeper, spaced]);
    await db.query(readFileSync(new URL('014_no_space_usernames.sql', root), 'utf8'));
    assert.deepEqual((await db.query('SELECT id FROM users')).rows.map(r => r.id), [keeper]);
    assert.deepEqual((await db.query('SELECT id FROM grids')).rows.map(r => r.id), [g3]);
    assert.deepEqual((await db.query('SELECT content_hash FROM retained_completions WHERE user_id=$1 ORDER BY content_hash', [keeper])).rows.map(r => r.content_hash), [g1, g2].sort());
    for (const table of ['grid_likes', 'grid_completions', 'follows', 'play_sessions', 'play_attempt_outcomes'])
      assert.equal((await db.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n, 0, table);
    assert.equal((await db.query('SELECT amount::text FROM xp_ledger')).rows[0].amount, '100000');
    const audit = (await db.query("SELECT subject_user_id, detail FROM admin_audit WHERE action='user.hard_delete' ORDER BY reason")).rows;
    assert.deepEqual(audit.map(a => a.subject_user_id).sort(), [spaced, levels].sort());
    assert.ok(audit.every(a => a.detail.levelsDeleted === 1));
    await assert.rejects(db.query("UPDATE users SET username='Keeper 1' WHERE id=$1", [keeper]), (e: any) => e.code === '23514');
  } finally { await db?.end(); await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); await admin.end(); }
});
