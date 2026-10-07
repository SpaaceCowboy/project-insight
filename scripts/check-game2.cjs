// Game 2: New Game 2 switches in place, isolated storage, unlock progression, no achievement credit, one-screen layout.
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const {screenshotPath}=require('./check-paths.cjs');
const {play,dismissMenus}=require('./check-ui-helpers.cjs');
const {GAME2_LEVELS}=require('../src/data/levels-2.js');
const {LEVEL_SOLUTIONS}=require('../src/data/level-solutions-2.js');

(async()=>{
  assert.equal(GAME2_LEVELS.length,100);assert.equal(LEVEL_SOLUTIONS.length,100);
  const server=require('./check-server.cjs').createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  try {
    browser=await chromium.launch({executablePath:process.env.CHROME_PATH||`${process.env.ProgramFiles}/Google/Chrome/Application/chrome.exe`,headless:true});
    const errors=[],base='http://127.0.0.1:'+server.address().port;
    const page=await browser.newPage({viewport:{width:375,height:667},reducedMotion:'reduce'});
    page.on('pageerror',error=>errors.push(error.message));page.on('dialog',()=>assert.fail('No browser dialogs'));
    const ready=()=>page.waitForFunction(()=>document.documentElement.dataset.ready==='true');
    const data=()=>page.evaluate(()=>Object.fromEntries(Object.keys(localStorage).map(key=>[key,localStorage.getItem(key)])));
    await page.goto(base+'/Puzzle.html');await ready();
    await page.evaluate(()=>{localStorage.setItem('insight-campaign-r2-classic',JSON.stringify({done:{1:3,2:2}}));localStorage.setItem('insight-campaign-v2',JSON.stringify({unlocked:3}));localStorage.setItem('insight-tile-limits-v1','off')});
    await page.reload();await ready();
    const game1=Object.fromEntries(Object.entries(await data()).filter(([key])=>/^insight-(campaign|attempts|session|achievements)/.test(key)));

    assert.match(await page.locator('#menuProgress').textContent(),/^Game 1 · Level 3 \/ 106$/);
    await page.locator('#newGame2Btn').click();
    assert.equal(await page.evaluate(()=>document.activeElement.id),'confirmCancel');
    await page.keyboard.press('Escape');assert.match(await page.locator('#menuProgress').textContent(),/^Game 1 /,'Cancelling keeps Game 1');
    await page.locator('#newGame2Btn').click();await page.locator('#confirmAccept').click();
    assert.equal(page.url(),base+'/Puzzle.html','Game 2 starts in place');
    await dismissMenus(page);await page.locator('#menuBtn').click();await page.locator('#homeBtn').click();
    assert.match(await page.locator('#menuProgress').textContent(),/^Game 2 · Level 1 \/ 100$/);
    await page.locator('#menuLevelsBtn').click();
    assert.equal(await page.locator('.level-card:not(:disabled)').count(),1,'Game 2 starts with one level unlocked');
    assert.equal(await page.locator('.level-card').count(),20,'Twenty levels per world');
    await dismissMenus(page);await play(page);
    assert.match(await page.locator('#levelNo').textContent(),/^STRAIGHT LINES · LEVEL 001$/);
    await page.screenshot({path:screenshotPath('game2-mobile.png')});

    const achievementsBefore=(await data())['insight-achievements-v1'],width=GAME2_LEVELS[0].start[0].length;
    for(const [a,b] of LEVEL_SOLUTIONS[0])for(const n of [a,b]){await page.locator(`.tile[data-r="${Math.floor(n/width)}"][data-c="${n%width}"]`).focus();await page.keyboard.press('Enter')}
    await page.locator('#winOverlay').waitFor({state:'visible'});
    const after=await data();
    assert.deepEqual(JSON.parse(after['insight-game2-classic']).done,{1:3});
    assert.equal(JSON.parse(after['insight-game2-campaign']).unlocked,2,'Winning unlocks the next Game 2 level');
    for(const [key,value] of Object.entries(game1))assert.equal(after[key],value,'Game 2 leaves '+key+' untouched');
    assert.equal(after['insight-achievements-v1'],achievementsBefore,'Game 2 wins earn no achievement credit');

    for(const size of [[320,568],[844,390],[1280,720]]){
      await page.setViewportSize({width:size[0],height:size[1]});
      assert(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1 && document.documentElement.scrollWidth<=innerWidth+1),'One screen at '+size.join('×'));
    }
    await page.reload();await ready();
    assert.match(await page.locator('#menuProgress').textContent(),/^Game 2 · Level 2 \/ 100$/,'Reload keeps the active game');
    await page.locator('#newGameBtn').click();await page.locator('#confirmAccept').click();
    await dismissMenus(page);await page.locator('#menuBtn').click();await page.locator('#homeBtn').click();
    assert.match(await page.locator('#menuProgress').textContent(),/^Game 1 · Level 1 \/ 106$/,'New Game 1 restarts Game 1');
    const final=await data();
    assert.deepEqual(JSON.parse(final['insight-game2-classic']).done,{1:3},'New Game 1 keeps Game 2 progress');
    assert.equal(final['insight-active-game-v1'],'1');
    assert.deepEqual(errors,[]);
    console.log('Game 2 checks passed.');
  } finally {await browser?.close();server.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
