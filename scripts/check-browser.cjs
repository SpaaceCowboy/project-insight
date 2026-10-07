const {rootPath,screenshotPath}=require('./check-paths.cjs');
const {dismissMenus,home,play,settings,settingClick,collection,movesIs}=require('./check-ui-helpers.cjs');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const {chromium} = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const {CORE_LEVELS}=require('../src/data/levels.js');
const {LEVEL_SOLUTIONS}=require('../src/data/level-solutions.js');
const {PuzzleRules}=require('../src/puzzle-rules.js');

(async () => {
  const server = require('./check-server.cjs').createServer();
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  try {
    browser = await chromium.launch({executablePath:process.env.CHROME_PATH || `${process.env.ProgramFiles}/Google/Chrome/Application/chrome.exe`,headless:true});
    const page = await browser.newPage({viewport:{width:1280,height:960},reducedMotion:'reduce'});
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/Puzzle.html`);await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');
    assert.equal(await page.locator('#menuOverlay').isVisible(),true);
    await settingClick(page,'devModeBtn');
    await home(page);
    await settingClick(page,'themeBtn');
    await settings(page,'sound');
    await page.locator('#volumeSlider').focus();
    await page.keyboard.press('End');
    assert.equal(await page.locator('#volumeValue').textContent(),'100%');
    assert.equal(await page.locator('#ambienceSlider').inputValue(),'80');
    assert.equal(await page.evaluate(()=>window.InsightAudio.ambienceVolume),.8,'Effects do not change ambience');
    await page.keyboard.press('Home');
    await page.waitForFunction(()=>[window.InsightAudio.voiceSound,...Object.values(window.InsightAudio.soundEffects)].every(sound=>sound.volume===0));
    assert.equal(await page.evaluate(()=>window.InsightAudio.ambienceVolume),.8);
    await page.locator('#volumeSlider').evaluate(el=>{el.value=80;el.dispatchEvent(new Event('input',{bubbles:true}));});
    await page.locator('#ambienceSlider').focus();
    await page.keyboard.press('End');
    await page.waitForFunction(()=>window.InsightAudio.ambientSound.volume===.7);
    await page.keyboard.press('Home');
    await page.waitForFunction(()=>window.InsightAudio.ambientSound.volume===0);
    assert.equal(await page.evaluate(()=>window.InsightAudio.masterVolume),.8,'Ambience does not change effects');
    await page.locator('#ambienceSlider').evaluate(el=>{el.value=80;el.dispatchEvent(new Event('input',{bubbles:true}));});
    await page.locator('#voiceToggle').uncheck();
    await page.locator('#voiceToggle').focus();
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'settingsSoundBtn','Sound controls remain in the settings focus order');
    await page.reload();await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');
    assert.equal(await page.locator('#volumeSlider').inputValue(),'80');
    assert.equal(await page.locator('#ambienceSlider').inputValue(),'80');
    assert.equal(await page.locator('#voiceToggle').isChecked(),false);
    assert.equal(await page.locator('body.light-mode').count(),1);
    assert.equal(await page.locator('#modeBtn,#limitsBtn,#resetProgress').count(),0,'No star or Tile Limits controls');
    await play(page);
    await page.locator('#soundBtn').click();
    const tile=(r,c)=>page.locator(`.tile[data-r="${r}"][data-c="${c}"]`);
    const state=(target=page)=>target.locator('.tile').evaluateAll(els=>els.map(el=>el.dataset.type).join(''));
    const snapshot=(target=page)=>target.evaluate(()=>({moves:JSON.parse(localStorage.getItem('insight-session-r3'))?.path.length ?? 0,
      color:document.body.style.getPropertyValue('--light-color'),
      tiles:[...document.querySelectorAll('.tile')].map(el=>el.dataset.type)}));
    async function move(a,b,width,target=page) {
      await target.locator(`.tile[data-r="${Math.floor(a/width)}"][data-c="${a%width}"]`).focus();
      await target.keyboard.press('Enter');
      await target.locator(`.tile[data-r="${Math.floor(b/width)}"][data-c="${b%width}"]`).focus();
      await target.keyboard.press('Enter');
    }
    async function choose(index,target=page) {
      await dismissMenus(target);await target.locator('#levelsBtn').click();
      await target.locator('#worldTab'+(Math.floor(index/25)+1)).click();
      await target.locator('.level-card').nth(index%25).click();
    }
    // Campaign progression, developer access, migration, and destructive reset.
    const campaign=await browser.newPage({viewport:{width:375,height:667},reducedMotion:'reduce'});
    campaign.on('pageerror',e=>errors.push(e.message));
    campaign.on('dialog',()=>assert.fail('Campaign actions must use styled confirmations'));
    await campaign.goto(page.url());await campaign.waitForFunction(()=>document.documentElement.dataset.ready==='true');
    assert.equal(await campaign.locator('#devModeBtn').getAttribute('aria-pressed'),'false');
    await campaign.locator('#menuLevelsBtn').click();
    assert.equal(await campaign.locator('.level-card:not(:disabled)').count(),1,'A fresh campaign starts with one level');
    await campaign.locator('#worldTab2').click();
    assert.equal(await campaign.locator('.level-card:not(:disabled)').count(),0,'Later worlds remain locked');
    await campaign.keyboard.press('Escape');
    await play(campaign);
    assert(await campaign.locator('#nextBtn').isDisabled(),'Next cannot skip an unsolved campaign level');
    await move(0,1,2,campaign);await campaign.locator('#winOverlay').waitFor({state:'visible'});
    assert.equal(await campaign.evaluate(()=>JSON.parse(localStorage.getItem('insight-campaign-v3')).unlocked),2,'Winning unlocks exactly the next level');
    await campaign.locator('#winNextBtn').click();
    assert.match(await campaign.locator('#levelNo').textContent(),/002/);
    assert(await campaign.locator('#nextBtn').isDisabled());
    const routeTwo=JSON.parse(fs.readFileSync(rootPath('artifacts','level-checks.json'),'utf8'))[1];
    await move(...routeTwo.path[0],routeTwo.width,campaign);
    await movesIs(campaign,1);
    const campaignAttempt=await snapshot(campaign);
    await campaign.reload();await campaign.waitForFunction(()=>document.documentElement.dataset.ready==='true');await play(campaign);
    assert.deepEqual(await snapshot(campaign),campaignAttempt,'Continue resumes a campaign attempt');
    await campaign.locator('#levelsBtn').click();
    assert.equal(await campaign.locator('.level-card:not(:disabled)').count(),2,'Unlocks persist after reload');
    assert.match(await campaign.locator('.level-card').first().textContent(),/Solved/,'Solved levels are marked without stars');
    await campaign.keyboard.press('Escape');await home(campaign);await settingClick(campaign,'devModeBtn');
    await campaign.reload();await campaign.waitForFunction(()=>document.documentElement.dataset.ready==='true');
    assert.equal(await campaign.locator('#devModeBtn').getAttribute('aria-pressed'),'true','Developer mode persists');
    await play(campaign);await choose(105,campaign);
    assert.match(await campaign.locator('#levelNo').textContent(),/106/);
    const finalRoute=JSON.parse(fs.readFileSync(rootPath('artifacts','level-checks.json'),'utf8'))[105];
    for(const [i,[from,to]] of finalRoute.path.entries()){
      await move(from,to,finalRoute.width,campaign);
      await movesIs(campaign,i+1);
    }
    await campaign.locator('#winOverlay').waitFor({state:'visible'});await campaign.keyboard.press('Escape');
    assert.equal(await campaign.evaluate(()=>JSON.parse(localStorage.getItem('insight-campaign-v3')).unlocked),2,'Developer wins ahead do not skip campaign progress');
    await home(campaign);await settingClick(campaign,'devModeBtn');
    assert.match(await campaign.locator('#levelNo').textContent(),/002/,'Leaving developer mode returns to the campaign');
    const resetBefore=await campaign.evaluate(()=>['insight-campaign-v3','insight-attempts-r3','insight-campaign-r3'].map(key=>localStorage.getItem(key)));
    await campaign.locator('#newGameBtn').click();
    await campaign.locator('#confirmCancel').click();
    assert.deepEqual(await campaign.evaluate(()=>['insight-campaign-v3','insight-attempts-r3','insight-campaign-r3'].map(key=>localStorage.getItem(key))),resetBefore,'Cancelling New Game preserves progress');
    await campaign.evaluate(()=>{
      localStorage.setItem('insight-editor-drafts-v1','keep my drafts');
      localStorage.setItem('insight-editor-attempts-v2','keep my playtests');
    });
    const preferencesBefore=await campaign.evaluate(()=>['insight-theme-v1','insight-volume-v1'].map(key=>localStorage.getItem(key)));
    await campaign.locator('#newGameBtn').click();await campaign.locator('#confirmAccept').click();
    assert.match(await campaign.locator('#levelNo').textContent(),/001/);
    await movesIs(campaign,0);
    assert.deepEqual(await campaign.evaluate(()=>JSON.parse(localStorage.getItem('insight-campaign-r3')).done),{});
    assert.equal(await campaign.evaluate(()=>Object.keys(JSON.parse(localStorage.getItem('insight-attempts-r3')).entries).length),1,'New Game removes old attempts');
    assert.equal(await campaign.evaluate(()=>localStorage.getItem('insight-editor-drafts-v1')),'keep my drafts');
    assert.equal(await campaign.evaluate(()=>localStorage.getItem('insight-editor-attempts-v2')),'keep my playtests');
    assert.deepEqual(await campaign.evaluate(()=>['insight-theme-v1','insight-volume-v1'].map(key=>localStorage.getItem(key))),preferencesBefore);
    await campaign.reload();await campaign.waitForFunction(()=>document.documentElement.dataset.ready==='true');
    await campaign.locator('#menuLevelsBtn').click();assert.equal(await campaign.locator('.level-card:not(:disabled)').count(),1,'New Game persists');
    // Missing access is rebuilt from solved levels; revision 2 star records are ignored and left untouched.
    await campaign.evaluate(()=>{
      localStorage.removeItem('insight-campaign-v3');
      localStorage.setItem('insight-campaign-r3',JSON.stringify({done:{10:true}}));
      localStorage.setItem('insight-campaign-r2-classic',JSON.stringify({done:{50:3}}));
    });
    await campaign.reload();await campaign.waitForFunction(()=>document.documentElement.dataset.ready==='true');
    assert.equal(await campaign.evaluate(()=>JSON.parse(localStorage.getItem('insight-campaign-v3')).unlocked),11);
    assert.deepEqual(await campaign.evaluate(()=>JSON.parse(localStorage.getItem('insight-campaign-r2-classic')).done),{50:3});
    await campaign.close();
    // Keyboard solve, focus trap/return, progress, undo, and preference persistence.
    const resultsForShape=CORE_LEVELS;
    const first=await state();
    await move(0,1,2);
    await page.locator('#winOverlay').waitFor({state:'visible'});
    assert.equal(await page.locator('#winTitle').textContent(),'Beautifully solved.');
    assert.equal(await page.locator('#winStars,#winMeta').count(),0,'No stars or move count on the win card');
    await page.keyboard.press('Shift+Tab');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'winNextBtn');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'replayBtn');
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(()=>document.activeElement.dataset.c),'1');
    await page.locator('#undoBtn').click();
    assert.equal(await state(),first);
    await movesIs(page,0);
    assert.equal(await page.locator('#moves,#par,#starsTop').count(),0,'No move counter, par or stars while playing');
    // Real pointer dragging and cancellation.
    const a=await tile(0,0).boundingBox(), b=await tile(0,1).boundingBox();
    await page.mouse.move(a.x+a.width/2,a.y+a.height/2);
    await page.mouse.down();
    await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:5});
    await page.locator('#board').dispatchEvent('pointercancel',{pointerId:1});
    await page.mouse.up();
    assert.equal(await state(),first);
    await page.mouse.move(a.x+a.width/2,a.y+a.height/2);
    await page.mouse.down();
    await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:5});
    await page.mouse.up();
    await page.locator('#winOverlay').waitFor({state:'visible'});
    await page.keyboard.press('Escape');
    await page.locator('#undoBtn').click();
    // Mouse taps share selection/movement with the keyboard; tiny jitter is still a tap.
    await page.mouse.move(a.x+a.width/2,a.y+a.height/2);
    await page.mouse.down();
    await page.mouse.move(a.x+a.width/2+3,a.y+a.height/2+2);
    await page.mouse.up();
    assert.equal(await tile(0,0).getAttribute('aria-pressed'),'true');
    await tile(0,1).click();
    await page.locator('#winOverlay').waitFor({state:'visible'});
    await page.keyboard.press('Escape');
    await page.locator('#undoBtn').click();
    // A white tile can receive a tap swap although it cannot initiate one.
    const passengerFixture=(()=>{for(let i=0;i<CORE_LEVELS.length;i++){const l=CORE_LEVELS[i],state=PuzzleRules.initialState(l);for(let r=0;r<state.board.length;r++)for(let c=0;c<state.board[r].length;c++)for(const to of PuzzleRules.legalMoves(state.board,r,c))if(state.board[to[0]][to[1]]==='W')return {i,from:[r,c],to}}})();
    await choose(passengerFixture.i);await tile(...passengerFixture.from).click();await tile(...passengerFixture.to).click();await movesIs(page,1);assert.equal(await tile(...passengerFixture.from).getAttribute('data-type'),'W');
    await choose(0);
    // Restart and level switch while a move is still animating.
    await page.emulateMedia({reducedMotion:'no-preference'});
    await move(0,1,2);
    await page.keyboard.press('r');
    await page.waitForTimeout(400);
    assert.equal(await state(),first);
    assert.equal(await page.locator('#winOverlay').isVisible(),false);
    await move(0,1,2);
    await choose(25);
    await page.waitForTimeout(400);
    await movesIs(page,0);
    assert.equal(await page.locator('#winOverlay').isVisible(),false);
    assert.equal(await page.locator('.cell').count(),resultsForShape[25].start.length*resultsForShape[25].start[0].length);
    // Switch after the board commits but before the win dialog timer fires.
    await choose(0);
    await move(0,1,2);
    await movesIs(page,1);
    await choose(1);
    await page.waitForTimeout(400);
    assert.equal(await page.locator('#winOverlay').isVisible(),false);
    await page.emulateMedia({reducedMotion:'reduce'});
    // Play every verified solution through the actual keyboard UI.
    const results=JSON.parse(fs.readFileSync(rootPath('artifacts','level-checks.json'),'utf8'));
    // An isolated returning player migrates a v1 save, keeps both modes, and recovers a restart.
    const ux=await browser.newPage({viewport:{width:1280,height:720},reducedMotion:'reduce'});
    ux.on('pageerror',e=>errors.push(e.message));
    await ux.goto(page.url());await ux.waitForFunction(()=>document.documentElement.dataset.ready==='true');
    await ux.evaluate(({level,route})=>{
      localStorage.clear();
      localStorage.setItem('insight-dev-mode-v1','on');
      localStorage.setItem('insight-sound-v1','off');
      localStorage.setItem('insight-volume-v1','.5');
      localStorage.setItem('insight-voice-v1','off');
      const w=level.start[0].length;localStorage.setItem('insight-session-r3',JSON.stringify({revision:2,level:1,path:[route[0].map(n=>[Math.floor(n/w),n%w])]}));
    },{level:CORE_LEVELS[1],route:LEVEL_SOLUTIONS[1]});
    await ux.reload();await ux.waitForFunction(()=>document.documentElement.dataset.ready==='true');
    await play(ux);
    await movesIs(ux,1);
    assert.equal(await ux.locator('#ambienceSlider').inputValue(),'50','Old volume initializes ambience');
    assert.equal(await ux.locator('#voiceToggle').isChecked(),false);
    const classicAttempt=await snapshot(ux);
    assert.equal(classicAttempt.moves,1,'Legacy single-session save restores its route');
    await choose(1,ux); await choose(1,ux);
    assert.deepEqual(await snapshot(ux),classicAttempt,'Switching levels preserves an attempt');
    await ux.locator('#restartBtn').click();
    assert.match(await ux.locator('#undoBtn').textContent(),/Undo restart/);
    await ux.reload();await ux.waitForFunction(()=>document.documentElement.dataset.ready==='true'); await play(ux);
    await ux.locator('#undoBtn').click();
    assert.deepEqual(await snapshot(ux),classicAttempt,'Undo restart survives reload');
    assert.equal(await ux.evaluate(()=>document.activeElement.dataset.r),String(Math.floor(results[1].path[0][1]/results[1].width)),'Undo restores board focus');
    await ux.locator('#restartBtn').click(); await move(...results[1].path[0],results[1].width,ux);
    await movesIs(ux,1);
    assert(!/restart/.test(await ux.locator('#undoBtn').textContent()),'Next move clears restart recovery');
    await ux.locator('#undoBtn').click();
    await movesIs(ux,0);
    await choose(0,ux);
    const untouched=await snapshot(ux);
    const uxTile=(r,c)=>ux.locator(`.tile[data-r="${r}"][data-c="${c}"]`);
    await uxTile(0,0).click(); await uxTile(1,0).click();
    assert.equal(await uxTile(0,0).getAttribute('aria-pressed'),'true','Invalid tap keeps selection');
    assert.match(await ux.locator('#announcement').textContent(),/not allowed/);
    assert.deepEqual(await snapshot(ux),untouched,'Invalid moves spend nothing');
    await ux.locator('.board-shell').click({position:{x:40,y:40}});
    assert.equal(await uxTile(0,0).getAttribute('aria-pressed'),'false','Background tap cancels selection');
    await choose(1,ux); await ux.locator('#restartBtn').click();
    await ux.emulateMedia({reducedMotion:'no-preference'});
    await move(...results[1].path[0],results[1].width,ux);
    await movesIs(ux,1);
    assert.equal(await ux.locator('.tile.arrived').count(),1,'Only the newly correct tile glows');
    assert.equal(await ux.locator('.tile.arrived').evaluate(el=>getComputedStyle(el).animationName),'tileArrival');
    await ux.screenshot({path:screenshotPath('game-arrival.png')});
    await ux.locator('#undoBtn').click();
    assert.equal(await ux.locator('.tile.arrived').count(),0);
    await choose(0,ux);
    const dragFrom=await uxTile(0,0).boundingBox(),dragTo=await uxTile(0,1).boundingBox();
    await ux.mouse.move(dragFrom.x+dragFrom.width/2,dragFrom.y+dragFrom.height/2);
    await ux.mouse.down();
    await ux.mouse.move(dragTo.x+dragTo.width/2,dragTo.y+dragTo.height/2,{steps:5});
    await ux.mouse.up();
    assert(await uxTile(0,0).evaluate(el=>el.getAnimations().some(animation=>animation.effect.getKeyframes()[0].transform?.includes('scale(1.045)'))),'Drag settles from the release position');
    await ux.waitForFunction(()=>document.querySelector('#board').classList.contains('solved'));
    assert.equal(await uxTile(0,0).evaluate(el=>getComputedStyle(el).animationName),'solvedBloom');
    await ux.keyboard.press('u'); await ux.waitForTimeout(950);
    assert.equal(await ux.locator('#winOverlay').isVisible(),false,'Undo cancels celebration');
    await ux.emulateMedia({reducedMotion:'reduce'}); await move(0,1,2,ux);
    await ux.locator('#winOverlay').waitFor({state:'visible'});
    assert.equal(await uxTile(0,0).evaluate(el=>getComputedStyle(el).animationName),'none','Reduced motion disables the win ripple');
    await ux.evaluate(()=>window.InsightAudio.playTone('win'));
    assert.equal(await ux.evaluate(()=>window.InsightAudio.voiceSound.paused),true,'Spoken celebration stays off');
    await ux.evaluate(()=>{
      Object.defineProperty(document,'hidden',{configurable:true,value:true});
      document.dispatchEvent(new Event('visibilitychange'));
    });
    assert.equal(await ux.evaluate(()=>[window.InsightAudio.ambientSound,window.InsightAudio.voiceSound,...Object.values(window.InsightAudio.soundEffects)].every(sound=>sound.paused)),true,'Hidden page pauses every audio layer');
    await ux.evaluate(()=>{delete document.hidden;window.InsightAudio.stopMusic();});
    await ux.close();
    const playthroughs=process.env.QUICK_CHECK ? results.filter(level=>[1,26,100,106].includes(level.level)) : results;
    for(const level of playthroughs) {
      await choose(level.level-1);
      await page.locator('#restartBtn').click();
      for(const [i,[from,to]] of level.path.entries()) {
        await move(from,to,level.width);
        await movesIs(page,i+1);
      }
      await page.locator('#winOverlay').waitFor({state:'visible'});
      await page.keyboard.press('Escape');
      if(level.level%25===0) console.log(`Browser solved levels 1–${level.level}.`);
    }
    await page.reload();await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');
    const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('insight-campaign-r3')).done);
    assert.equal(Object.keys(saved).length,playthroughs.length);
    await play(page);
    for(const viewport of [{width:320,height:568},{width:375,height:667},{width:768,height:600},{width:1280,height:720},{width:844,height:390}]) {
      await page.setViewportSize(viewport);
      for(const index of [99,105]) {
      await choose(index);
      const fits=await page.evaluate(()=>{
        const height=innerHeight, width=innerWidth;
        const selectors=['.topbar','.level-meta','#target','.board-shell','.controls','.tile'];
        return selectors.every(selector=>[...document.querySelectorAll(selector)].every(el=>{
          const rect=el.getBoundingClientRect();
          return rect.top>=-1 && rect.bottom<=height+1 && rect.left>=-1 && rect.right<=width+1;
        })) && document.documentElement.scrollHeight<=height+1;
      });
      assert(fits,`One-screen gameplay at ${viewport.width}×${viewport.height}`);
      }
      await choose(99);
      await page.locator('#levelsBtn').click();
      assert.equal(await page.locator('.level-card').count(),25);
      const dialogFits=await page.locator('#levelsOverlay .modal').evaluate(el=>{
        const rect=el.getBoundingClientRect();
        return rect.top>=0 && rect.bottom<=innerHeight && el.scrollHeight<=el.clientHeight+1;
      });
      assert(dialogFits,'Level selector fits without scrolling');
      await page.keyboard.press('Escape');
      await home(page);
      assert(await page.locator('#menuOverlay .menu-card').evaluate(el=>el.scrollHeight<=el.clientHeight+1),'Home menu fits without scrolling');
      await page.keyboard.press('Escape');
    }
    assert.equal(await page.locator('#helpBtn, #helpOverlay, .move-dot').count(),0);
    await choose(25);
    await page.setViewportSize({width:320,height:800});
    await page.locator('#board').scrollIntoViewIfNeeded();
    const bounds=await page.locator('.tile').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return [r.left,r.right]}));
    assert(bounds.every(([left,right])=>left>=0&&right<=320),'Tiles fit narrow viewport');
    assert.match(await page.locator('meta[name="viewport"]').getAttribute('content'),/initial-scale=1/);
    assert(!/user-scalable|maximum-scale/.test(await page.locator('meta[name="viewport"]').getAttribute('content')));
    await page.screenshot({path:screenshotPath('game-mobile.png'),fullPage:true});
    await page.setViewportSize({width:1280,height:960});
    await choose(99);
    await page.screenshot({path:screenshotPath('game-desktop.png'),fullPage:true});
    // The moving tile's colour lights the scene.
    await choose(0);
    await move(0,1,2);
    await page.locator('#winOverlay').waitFor({state:'visible'});
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(()=>document.body.style.getPropertyValue('--light-color')),'#88cedd');
    await page.locator('#undoBtn').click();
    // Resume preserves the actual route, light color and undo history.
    await choose(25);
    const resumeStart=await state();
    const resumeLevel=results[25];
    await move(...resumeLevel.path[0],resumeLevel.width);
    await movesIs(page,1);
    const resumeBoard=await state();
    const resumeColor=await page.evaluate(()=>document.body.style.getPropertyValue('--light-color'));
    await home(page);
    await play(page);
    assert.equal(await state(),resumeBoard,'Continue keeps the current board');
    await page.reload();await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');
    assert.match(await page.locator('#playBtn').textContent(),/Resume/);
    await play(page);
    assert.equal(await state(),resumeBoard);
    assert.equal(await page.evaluate(()=>document.body.style.getPropertyValue('--light-color')),resumeColor);
    assert.equal(await page.locator('#soundBtn').getAttribute('aria-label'),'Enable sound','Mute survives reload');
    await page.locator('#undoBtn').click();
    assert.equal(await state(),resumeStart);
    await movesIs(page,0);
    // Malformed saved routes cannot enter the live game state.
    for (const change of [{revision:1},{path:[[[99,0],[0,0]]]},{path:[[[0,0],null]]}]) {
      await page.evaluate(change=>{
        const saved=JSON.parse(localStorage.getItem('insight-session-r3'));
        localStorage.setItem('insight-session-r3',JSON.stringify({...saved,...change}));
        const attempts=JSON.parse(localStorage.getItem('insight-attempts-r3'));
        attempts.entries[saved.level]={...saved,...change};
        localStorage.setItem('insight-attempts-r3',JSON.stringify(attempts));
      },change);
      await page.reload();await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');
      await play(page);
      await movesIs(page,0);
      assert.equal(await page.locator('#undoBtn').isDisabled(),true);
    }
    const touch=await browser.newPage({viewport:{width:375,height:667},hasTouch:true,reducedMotion:'reduce'});
    await touch.goto(page.url());await touch.waitForFunction(()=>document.documentElement.dataset.ready==='true');
    await touch.locator('#playBtn').tap();
    await touch.locator('.tile[data-r="0"][data-c="0"]').tap();
    await touch.locator('.tile[data-r="0"][data-c="1"]').tap();
    await touch.locator('#winOverlay').waitFor({state:'visible'});
    await movesIs(touch,1);
    await touch.close();
    assert.equal(await page.evaluate(()=>[window.InsightAudio.ambientSound,window.InsightAudio.voiceSound,...Object.values(window.InsightAudio.soundEffects)].every(sound=>sound.readyState===4&&sound.duration>0&&!sound.error)),true,'All native audio assets loaded');
    const audioInfo=await page.evaluate(async assets=>{
      const context=new AudioContext();
      const decoded=[];
      for(const [name,base64] of assets) {
        const bytes=Uint8Array.from(atob(base64),x=>x.charCodeAt(0)).buffer;
        if(new TextDecoder().decode(bytes.slice(0,4))!=='RIFF')throw Error(name+': missing WAV header, '+bytes.byteLength+' bytes');
        let buffer;
        try {buffer=await context.decodeAudioData(bytes);}
        catch(error){throw Error(name+': '+error.message);}
        const data=buffer.getChannelData(0);
        let peak=0;
        for(const sample of data)peak=Math.max(peak,Math.abs(sample));
        decoded.push({name,duration:buffer.duration,peak});
      }
      await context.close();
      return decoded;
    },['ambient','select','move','deny','win','voice'].map(name=>[name,fs.readFileSync(rootPath('public','sounds',`${name}.wav`)).toString('base64')]));
    assert(audioInfo.every(sound=>sound.duration>0&&sound.peak>.005&&sound.peak<1));
    if(await page.locator('#soundBtn').getAttribute('aria-label')==='Enable sound') await page.locator('#soundBtn').click();
    await page.evaluate(()=>{window.InsightAudio.stopNotes();window.InsightAudio.playTone('move','P');});
    assert.equal(await page.evaluate(()=>window.InsightAudio.ambientSound.paused),false);
    assert.deepEqual(await page.evaluate(()=>[...window.InsightAudio.ringingNotes].map(note=>note.frequency.value)),[440,880],'Purple has its own harmonic voice');
    assert(Math.abs(await page.evaluate(()=>window.InsightAudio.noteGain.gain.value)-.8)<.000001);
    await page.locator('#soundBtn').click();
    await page.waitForFunction(()=>[window.InsightAudio.ambientSound,window.InsightAudio.voiceSound,...Object.values(window.InsightAudio.soundEffects)].every(sound=>sound.paused));
    assert.equal(await page.evaluate(()=>[window.InsightAudio.ambientSound,window.InsightAudio.voiceSound,...Object.values(window.InsightAudio.soundEffects)].every(sound=>sound.paused)),true);
    assert.equal(await page.evaluate(()=>window.InsightAudio.ringingNotes.size),0,'Mute stops ringing notes');
    await home(page);
    await settingClick(page,'themeBtn');
    await page.keyboard.press('Escape');
    await choose(105);
    assert.equal(await page.locator('.ambient-lights span').first().evaluate(el=>getComputedStyle(el).animationName),'none','Reduced-motion lights stay still');
    await page.setViewportSize({width:320,height:568});
    await page.waitForFunction(()=>[...document.querySelectorAll('.tile')].every(el=>el.offsetWidth>=44 && el.getBoundingClientRect().width>=43.99));
    assert(await page.locator('.tile').evaluateAll(els=>els.every(el=>el.getBoundingClientRect().width>=44)),'Five-row mobile tiles retain a 44px touch target');
    await page.screenshot({path:screenshotPath('game-mobile.png'),fullPage:true});
    await page.setViewportSize({width:1280,height:720});
    await page.screenshot({path:screenshotPath('game-desktop.png'),fullPage:true});
    await home(page);
    await page.screenshot({path:screenshotPath('game-menu.png'),fullPage:true});
    await page.keyboard.press('Escape');
    assert.match(await page.locator('#nextBtn').textContent(),/Replay final/);
    // Storage writes may fail without preventing play, undo, or opening win dialogs.
    await page.evaluate(()=>{
      localStorage.setItem('insight-campaign-r3',JSON.stringify({done:{}}));
    });
    await page.reload();await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');
    await play(page);
    await page.locator('#soundBtn').click();
    await page.evaluate(()=>{ Storage.prototype.setItem=()=>{throw new DOMException('Blocked','SecurityError')}; });
    await choose(0);
    await move(0,1,2);
    await page.locator('#winOverlay').waitFor({state:'visible'});
    assert.match(await page.locator('#toast').textContent(),/storage unavailable/);
    assert.deepEqual(errors,[]);
    console.log(`Browser checks passed: ${playthroughs.length} playthroughs, sounds, lights, drag, undo, storage, focus and layouts.`);
  } finally {
    await browser?.close();
    await new Promise(resolve=>server.close(resolve));
  }
})().catch(error=>{console.error(error);process.exitCode=1});
