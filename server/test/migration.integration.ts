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
