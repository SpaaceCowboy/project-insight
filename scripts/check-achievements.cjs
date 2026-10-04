const {rootPath,screenshotPath}=require('./check-paths.cjs');
const {dismissMenus,home,play,settings,settingClick,collection}=require('./check-ui-helpers.cjs');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {CORE_LEVELS:levels}=require('../src/data/levels.js');

(async()=>{
  const {createAchievements,newAttempt,restoreAttempt,ACHIEVEMENTS_KEY,APPEARANCE_KEY}=await import('../src/achievements.mjs');
  function memory(initial={}) {
    const values=new Map(Object.entries(initial));
    return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),values};
  }
  const fresh=(storage=memory())=>createAchievements({levels,storage});
  const result=(service,level,extras={})=>service.record({level,stars:3,limited:false,attempt:newAttempt(),...extras});
  const badge=(service,id)=>service.getSnapshot().badges.find(b=>b.id===id);
  assert.equal(fresh().getSnapshot().badges.length,15);
  // Every badge crosses its threshold once, using distinct levels in either mode.
  for(const target of fresh().getSnapshot().badges) {
    const service=fresh();
    const ids=levels.map((level,i)=>i).filter(i=>!target.world || levels[i].world===target.world);
    for(let n=0;n<target.goal;n++) {
      assert.equal(badge(service,target.id).earned,false,target.id+' before threshold');
      result(service,ids[n],{limited:target.id==='limits' || n%2===1});
      assert.equal(badge(service,target.id).progress,n+1,target.id+' distinct progress');
    }
    assert.equal(badge(service,target.id).earned,true,target.id+' threshold');
    assert(!result(service,ids[0]).some(b=>b.id===target.id),target.id+' is awarded once');
  }
  const repeated=fresh();
  assert.deepEqual(result(repeated,0).map(b=>b.id),['first','perfect-1'],'Simultaneous unlocks');
  for(let i=0;i<20;i++)result(repeated,0,{limited:i%2===0});
  assert.equal(badge(repeated,'flow').progress,1);
  assert.equal(badge(repeated,'perfect-10').progress,1);
  assert.equal(badge(repeated,'steady').progress,1);
  assert.equal(badge(repeated,'limits').progress,1);
  const excluded=fresh();
  for(let i=0;i<10;i++) {
    assert.deepEqual(result(excluded,i,{custom:true}),[]);
    assert.deepEqual(result(excluded,i,{attempt:newAttempt(false)}),[]);
  }
  assert.equal(excluded.getSnapshot().earnedCount,0);
  const skills=fresh();
  for(let i=0;i<10;i++)result(skills,i,{attempt:{...newAttempt(),undoUsed:true}});
  assert.equal(badge(skills,'steady').progress,0);
  assert.equal(badge(skills,'clean').progress,0);
  result(skills,10,{attempt:restoreAttempt(null)});
  assert.equal(badge(skills,'steady').progress,0,'Unknown legacy undo history gets no skill credit');
  result(skills,10,{limited:true});
  assert.equal(badge(skills,'steady').progress,1);
  assert.equal(badge(skills,'clean').progress,1);
  assert.equal(restoreAttempt(newAttempt(),false).eligible,false);
  assert.equal(restoreAttempt(newAttempt(false),true).eligible,false);
  const legacy=memory({
    'insight-100-fixed-v4':JSON.stringify({done:Object.fromEntries(Array.from({length:25},(_,i)=>[i+1,3]))}),
    'insight-limit-stars-v1':JSON.stringify({done:{1:3,26:2,107:3,0:3,27:4,28:'3'}})
  });
  const migrated=fresh(legacy);
  assert.equal(badge(migrated,'flow').progress,10);
  assert.equal(badge(migrated,'world-1').earned,true);
  assert.equal(badge(migrated,'precision').earned,true);
  assert.equal(badge(migrated,'halfway').progress,26);
  for(const id of ['steady','clean','limits'])assert.equal(badge(migrated,id).progress,0,'Old stars do not backfill skills');
  assert.equal(migrated.equip('background','mist'),true);
  assert.equal(migrated.equip('finish','frosted'),true);
  assert.equal(migrated.equip('background','aurora'),false);
  assert.equal(migrated.equip('finish','metal'),false);
  legacy.setItem('insight-100-fixed-v4',JSON.stringify({done:{106:3}}));
  assert.equal(badge(fresh(legacy),'halfway').progress,26,'Migration runs once');
  assert.deepEqual(fresh(legacy).getSnapshot().appearance,{background:'mist',finish:'frosted'});
  legacy.setItem('insight-100-fixed-v4','{}');legacy.setItem('insight-limit-stars-v1','{}');
  assert.equal(badge(fresh(legacy),'world-1').earned,true,'Campaign reset leaves lifetime results');
  const damaged=memory({[ACHIEVEMENTS_KEY]:JSON.stringify({version:1,migrated:true,results:{1:{classic:3,noUndo:'yes'},2:{limited:2,clean:true,limitedPerfect:true},3:{classic:8},107:{classic:3}},earned:{complete:10,first:-1}}),[APPEARANCE_KEY]:JSON.stringify({version:1,background:'aurora',finish:'missing'})});
  const repaired=fresh(damaged);
  assert.equal(badge(repaired,'halfway').progress,2);
  assert.equal(badge(repaired,'steady').progress,0);
  assert.equal(badge(repaired,'clean').progress,0);
  assert.equal(badge(repaired,'limits').progress,0);
  assert.deepEqual(repaired.getSnapshot().appearance,{background:'forest',finish:'original'});
  assert.doesNotThrow(()=>fresh(memory({[ACHIEVEMENTS_KEY]:'{broken'})));
  let warnings=0;
  const blocked=createAchievements({levels,storage:{getItem(){throw Error('Blocked')},setItem(){throw Error('Blocked')}},onStorageError:()=>warnings++});
  result(blocked,0);assert.equal(blocked.equip('finish','frosted'),true);
  assert.equal(blocked.getSnapshot().earnedCount,2);assert(warnings>0);

  const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
  const server=require('./check-server.cjs').createServer();
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  let browser;
  try {
    browser=await chromium.launch({executablePath:process.env.CHROME_PATH||`${process.env.ProgramFiles}/Google/Chrome/Application/chrome.exe`,headless:true});
    const page=await browser.newPage({viewport:{width:375,height:667},reducedMotion:'reduce'}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());
    const ready=async()=>page.waitForFunction(()=>document.documentElement.dataset.ready==='true');
    const reload=async()=>{await page.reload();await ready()};
    const read=key=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
    const flags=async()=>{const saved=await read('insight-session-r2');return saved.achievementAttempt};
    async function move(from,to,width) {
      for(const index of [from,to]){await page.locator(`.tile[data-r="${Math.floor(index/width)}"][data-c="${index%width}"]`).focus();await page.keyboard.press('Enter')}
    }
    const routes=JSON.parse(fs.readFileSync(rootPath('artifacts','level-checks.json'),'utf8'));
    async function solve(index) {
      const route=routes[index];
      for(const [i,[a,b]] of route.path.entries()){await move(a,b,route.width);await page.waitForFunction(n=>document.querySelector('#moves').textContent===String(n),i+1)}
      await page.locator('#winOverlay').waitFor({state:'visible'});
    }
    await page.goto(base+'/Puzzle.html');await ready();
    assert.equal(await page.locator('.achievement-notice').count(),0,'No popup on initial load');
    await collection(page);
    assert.equal(await page.locator('.badge-card').count(),4);
    assert.equal(await page.locator('.badge-card.earned').count(),0);
    assert.equal(await page.evaluate(()=>document.activeElement.id),'closeAchievements');
    await page.keyboard.press('Shift+Tab');
    assert.equal(await page.getByRole('button',{name:'Next achievements page'}).evaluate(el=>el===document.activeElement),true,'Collection focus wraps');
    await page.locator('#achievementTab-collection').focus();await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('#achievementTab-appearance').getAttribute('aria-selected'),'true');
    assert(await page.locator('[data-cosmetic=frosted]').isDisabled());
    assert(await page.locator('[data-cosmetic=mist]').isDisabled());
    await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.activeElement.id),'achievementsBtn');
    await settingClick(page,'modeBtn');
    await play(page);await solve(0);
    assert.match(await page.locator('#winAchievementSummary').textContent(),/2 achievements earned/);
    assert.match(await page.locator('#winAchievementSummary').textContent(),/Frosted/);
    await page.locator('.achievement-notice[data-achievement=first]').waitFor();
    assert.match(await page.locator('.achievement-notice').textContent(),/Achievement unlocked.*First Step/);
    assert.equal(await page.locator('.achievement-announcer').getAttribute('role'),'status');
    assert.equal(await page.locator('.achievement-notice').evaluate(el=>getComputedStyle(el).animationName),'none','Reduced motion disables popup animation');
    assert.equal(await page.locator('.achievement-announcer').evaluate(el=>getComputedStyle(el).pointerEvents),'none','Popup never blocks controls');
    assert.equal(await page.locator('.achievement-announcer button').count(),0,'Popup never adds a focus stop');
    assert.equal(await page.evaluate(()=>document.activeElement.closest('.achievement-announcer')===null),true,'Popup does not steal focus');
    for(const viewport of [{width:320,height:568},{width:375,height:667},{width:768,height:600},{width:1280,height:720},{width:844,height:390}]) {
      await page.setViewportSize(viewport);
      assert(await page.locator('#winOverlay .win-card').evaluate(el=>{
        const r=el.getBoundingClientRect();return r.top>=0 && r.bottom<=innerHeight && el.scrollHeight<=el.clientHeight+1;
      }),'Victory and unlock summary fit '+viewport.width+'×'+viewport.height);
      assert(await page.locator('.achievement-notice').evaluate(el=>{
        const r=el.getBoundingClientRect();return r.top>=0 && r.bottom<=innerHeight && r.left>=0 && r.right<=innerWidth;
      }),'Corner popup fits '+viewport.width+'×'+viewport.height);
      if(viewport.width===320 || viewport.width===1280)await page.screenshot({path:screenshotPath(`achievement-popup-${viewport.width}.png`)});
    }
    await page.waitForFunction(()=>document.querySelector('.achievement-notice')?.dataset.achievement==='perfect-1',null,{timeout:7000});
    assert.match(await page.locator('.achievement-notice').textContent(),/First Perfect.*Frosted unlocked/,'Multiple unlocks appear in sequence');
    // Hidden tabs retain a pending announcement until the player returns.
    await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'))});
    await page.locator('.achievement-notice').waitFor({state:'detached'});
    await page.waitForTimeout(5200);
    await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'))});
    await page.locator('.achievement-notice[data-achievement=perfect-1]').waitFor();
    await page.emulateMedia({reducedMotion:'no-preference'});
    assert.match(await page.locator('.achievement-notice').evaluate(el=>getComputedStyle(el).animationName),/achievementNoticeEnter/,'Default animation uses a gentle entrance');
    await page.screenshot({path:screenshotPath('achievement-popup-reward.png')});
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.locator('.achievement-notice').waitFor({state:'detached',timeout:7000});
    await page.setViewportSize({width:375,height:667});
    assert.deepEqual(await page.locator('body').evaluate(el=>[el.dataset.background,el.dataset.finish]),['forest','original'],'Rewards are never auto-equipped');
    await page.locator('#winAchievementsBtn').click();await page.locator('#achievementTab-appearance').click();
    await page.locator('[data-cosmetic=frosted]').click();
    assert.equal(await page.locator('body').getAttribute('data-finish'),'frosted');
    await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.activeElement.id),'winAchievementsBtn');
    await page.keyboard.press('Escape');await page.keyboard.press('u');
    assert.equal((await flags()).undoUsed,true);
    assert.equal(Object.keys((await read(ACHIEVEMENTS_KEY)).earned).length,2,'Undo victory keeps rewards');
    await reload();assert.equal((await flags()).undoUsed,true,'Undo flag survives reload');
    assert.equal(await page.locator('.achievement-notice').count(),0,'Reload does not replay announcements');
    await play(page);await page.locator('#restartBtn').click();
    assert.equal((await flags()).undoUsed,false,'Restart begins a fresh attempt');
    assert(await page.locator('#undoBtn').isDisabled(),'A zero-move restart has no recovery');
    // The undone one-move victory leaves zero moves, so use a longer level for restart recovery.
    await page.locator('#nextBtn').click();await move(...routes[1].path[0],routes[1].width);
    await page.waitForFunction(()=>document.querySelector('#moves').textContent==='1');
    await page.keyboard.press('u');await move(...routes[1].path[0],routes[1].width);
    await page.waitForFunction(()=>document.querySelector('#moves').textContent==='1');
    assert.equal((await flags()).undoUsed,true);
    await page.locator('#restartBtn').click();assert.equal((await flags()).undoUsed,false);
    await reload();await play(page);await page.locator('#undoBtn').click();
    assert.equal((await flags()).undoUsed,true,'Undo restart restores previous flags after reload');
    await home(page);await settingClick(page,'devModeBtn');
    assert.equal((await flags()).eligible,false);
    await settingClick(page,'devModeBtn');
    assert.equal((await flags()).eligible,false,'Turning Dev Mode off does not requalify an attempt');
    await play(page);await reload();await play(page);
    assert.equal((await flags()).eligible,false,'Developer exclusion survives reload');
    await page.locator('#restartBtn').click();assert.equal((await flags()).eligible,true);
    await page.locator('#undoBtn').click();assert.equal((await flags()).eligible,false,'Undo restart cannot launder eligibility');
    const beforeDev=await read(ACHIEVEMENTS_KEY);
    await move(...routes[1].path[1],routes[1].width);await page.locator('#winOverlay').waitFor({state:'visible'});
    assert.deepEqual(await read(ACHIEVEMENTS_KEY),beforeDev,'Disqualified solve earns nothing');
    assert.equal(await page.locator('#winAchievementsBtn').count(),0);
    assert.equal(await page.locator('.achievement-notice').count(),0,'Disqualified wins have no corner popup');
    await page.locator('#replayBtn').click();await solve(1);
    assert.equal((await read(ACHIEVEMENTS_KEY)).results[2].noUndo,true);
    assert.equal((await read(ACHIEVEMENTS_KEY)).results[2].limitedPerfect,true);
    await page.keyboard.press('Escape');await home(page);
    const lifetime=await read(ACHIEVEMENTS_KEY);
    await page.locator('#newGameBtn').click();
    await page.locator('#confirmAccept').click();
    assert.deepEqual(await read(ACHIEVEMENTS_KEY),lifetime,'New Game preserves all lifetime results');
    assert.equal(await page.locator('body').getAttribute('data-finish'),'frosted');
    await page.goto(base+'/Editor.html');await ready();
    assert.equal(await page.locator('body').getAttribute('data-finish'),'frosted','Cosmetics apply to editor');
    await page.goto(base+'/Puzzle.html');await ready();
    // Credit legacy milestones silently; skill records begin with new solves only.
    await page.evaluate(()=>{
      localStorage.removeItem('insight-achievements-v1');
      localStorage.setItem('insight-campaign-r2-classic',JSON.stringify({done:Object.fromEntries(Array.from({length:25},(_,i)=>[i+1,3]))}));
      localStorage.setItem('insight-campaign-r2-limits',JSON.stringify({done:{}}));
      localStorage.setItem('insight-campaign-v2',JSON.stringify({unlocked:106}));
      localStorage.setItem('insight-tile-limits-v1','off');
      localStorage.setItem('insight-attempts-r2',JSON.stringify({last:1,entries:{'classic:1':{revision:2,level:1,limits:false,allowances:null,path:[[[0,1],[0,0]]]}}}));
    });
    // Use the verified first move, rather than relying on a manually written legacy route.
    await page.evaluate(route=>{
      const entry={revision:2,level:1,limits:false,allowances:null,path:[route.path[0].map(n=>[Math.floor(n/route.width),n%route.width])]};
      localStorage.setItem('insight-attempts-r2',JSON.stringify({last:1,entries:{'classic:1':entry}}));
    },routes[1]);
    await reload();assert.equal((await flags()).noUndoKnown,false);
    assert.equal(await page.locator('#winAchievementsBtn').count(),0,'Migration has no celebration');
    assert.equal(await page.locator('.achievement-notice').count(),0,'Legacy credit stays silent');
    await play(page);
    await move(...routes[1].path[1],routes[1].width);await page.locator('#winOverlay').waitFor({state:'visible'});
    assert.equal((await read(ACHIEVEMENTS_KEY)).results[2].noUndo,undefined,'Legacy resumed attempt has unknown undo history');
    await page.locator('#replayBtn').click();await solve(1);
    assert.equal((await read(ACHIEVEMENTS_KEY)).results[2].noUndo,true);
    await page.keyboard.press('Escape');await home(page);await collection(page);
    await page.locator('#achievementTab-appearance').click();await page.locator('[data-cosmetic=mist]').click();
    assert.equal(await page.locator('body').getAttribute('data-background'),'mist');
    // All backgrounds and finishes are available after a complete lifetime result set.
    const completeStore=memory();const completed=fresh(completeStore);
    for(let i=0;i<levels.length;i++)result(completed,i,{limited:true});
    assert.equal(completed.getSnapshot().earnedCount,15);
    await page.evaluate(({record,appearance})=>{
      localStorage.setItem('insight-achievements-v1',record);localStorage.setItem('insight-appearance-v1',appearance);
    },{record:completeStore.getItem(ACHIEVEMENTS_KEY),appearance:JSON.stringify({version:1,background:'aurora',finish:'metal'})});
    await reload();await collection(page);
    assert.match(await page.locator('#achievementsOverlay .modal-head').textContent(),/15 \/ 15/);
    await page.locator('#achievementTab-appearance').click();
    assert.equal(await page.locator('.cosmetic-card:disabled').count(),0);
    for(const background of ['forest','mist','aurora']) {
      await page.locator('[data-cosmetic='+background+']').click();
      const dark=await page.locator('body').evaluate(el=>getComputedStyle(el).backgroundImage);
      await page.keyboard.press('Escape');await settingClick(page,'themeBtn');await collection(page);
      const light=await page.locator('body').evaluate(el=>getComputedStyle(el).backgroundImage);assert.notEqual(dark,light);
      await page.locator('#achievementTab-appearance').click();
      await page.keyboard.press('Escape');await settingClick(page,'themeBtn');await collection(page);await page.locator('#achievementTab-appearance').click();
    }
    await page.locator('[data-cosmetic=metal]').click();
    assert.equal(await page.locator('.ambient-lights span').first().evaluate(el=>getComputedStyle(el).animationName),'none');
    const viewports=[{width:320,height:568},{width:375,height:667},{width:768,height:600},{width:1280,height:720},{width:844,height:390}];
    async function fits() {
      const overflow=await page.locator('#achievementsOverlay').evaluate(el=>[...el.querySelectorAll('.modal,button,h3,p,progress')].filter(el=>el.getClientRects().length).filter(el=>{
        const r=el.getBoundingClientRect(),card=el.closest('.modal').getBoundingClientRect();return !(r.left>=0 && r.right<=innerWidth+.5 && r.top>=0 && r.bottom<=innerHeight+.5 && r.bottom<=card.bottom+.5);
      }).map(el=>({element:el.tagName,text:el.textContent,rect:el.getBoundingClientRect().toJSON(),viewport:[innerWidth,innerHeight]})));
      if(overflow.length)await page.screenshot({path:screenshotPath('achievements-overflow.png')});
      assert.deepEqual(overflow,[],'Achievement content fits one screen');
    }
    for(const viewport of viewports) {
      await page.setViewportSize(viewport);await fits();
      await page.screenshot({path:screenshotPath(`achievements-appearance-${viewport.width}x${viewport.height}.png`)});
      await page.locator('#achievementTab-collection').click();
      for(let i=0;i<4;i++) {await fits();if(i<3)await page.getByRole('button',{name:'Next achievements page'}).click()}
      await page.screenshot({path:screenshotPath(`achievements-collection-${viewport.width}x${viewport.height}.png`)});
      for(let i=0;i<3;i++)await page.getByRole('button',{name:'Previous achievements page'}).click();
      await page.locator('#achievementTab-appearance').click();
    }
    await page.keyboard.press('Escape');await page.keyboard.press('Escape');
    await home(page);
    await page.evaluate(()=>{
      localStorage.setItem('insight-achievements-v1','broken');localStorage.setItem('insight-appearance-v1',JSON.stringify({version:1,background:'invalid',finish:'metal'}));
      localStorage.setItem('insight-campaign-r2-classic','{}');localStorage.setItem('insight-campaign-r2-limits','{}');
    });
    await reload();assert.equal(await page.locator('body').getAttribute('data-finish'),'original');
    await play(page);await page.locator('#levelsBtn').click();await page.locator('#worldTab1').click();await page.locator('.level-card').first().click();
    await page.evaluate(()=>{Storage.prototype.setItem=()=>{throw new DOMException('Blocked','SecurityError')}});
    await solve(0);await page.locator('#winAchievementsBtn').click();await page.locator('#achievementTab-appearance').click();await page.locator('[data-cosmetic=frosted]').click();
    assert.equal(await page.locator('body').getAttribute('data-finish'),'frosted','Blocked storage still supports rewards in memory');
    assert.match(await page.locator('#toast').textContent(),/storage unavailable/);
    // The development reset leaves campaign data untouched and has an explicit restore.
    const resetPage=await browser.newPage();resetPage.on('pageerror',error=>errors.push(error.message));
    await resetPage.route('**/tools/achievement-progress.html',route=>route.fulfill({contentType:'text/html',body:fs.readFileSync(rootPath('tools','achievement-progress.html'),'utf8')}));
    await resetPage.goto(base+'/Puzzle.html');await resetPage.waitForFunction(()=>document.documentElement.dataset.ready==='true');
    const resetBefore={badges:completeStore.getItem(ACHIEVEMENTS_KEY),appearance:JSON.stringify({version:1,background:'aurora',finish:'metal'})};
    await resetPage.evaluate(saved=>{
      localStorage.setItem('insight-achievements-v1',saved.badges);localStorage.setItem('insight-appearance-v1',saved.appearance);
      localStorage.setItem('insight-campaign-r2-classic',JSON.stringify({done:{1:3}}));
    },resetBefore);
    await resetPage.goto(base+'/tools/achievement-progress.html');await resetPage.locator('#reset').click();
    assert.match(await resetPage.locator('#status').textContent(),/0 \/ 15/);
    await resetPage.getByRole('link',{name:'Return to game'}).click();await resetPage.waitForFunction(()=>document.documentElement.dataset.ready==='true');
    await collection(resetPage);assert.match(await resetPage.locator('#achievementsOverlay .modal-head').textContent(),/0 \/ 15/);
    assert.deepEqual(await resetPage.evaluate(()=>JSON.parse(localStorage.getItem('insight-campaign-r2-classic'))),{done:{1:3}},'Reset keeps campaign stars without crediting them again');
    await resetPage.goto(base+'/tools/achievement-progress.html');await resetPage.locator('#restore').click();
    assert.deepEqual(await resetPage.evaluate(()=>({badges:localStorage.getItem('insight-achievements-v1'),appearance:localStorage.getItem('insight-appearance-v1')})),resetBefore,'Reset backup restores all rewards and appearance');
    await resetPage.close();
    assert.deepEqual(errors,[]);
    console.log('Achievement checks passed: all 15 thresholds, queued corner announcements, migration, exclusion, undo/restart, permanent cosmetics, focus, storage and five viewports.');
  } finally {await browser?.close();await new Promise(resolve=>server.close(resolve))}
})().catch(error=>{console.error(error);process.exitCode=1});
