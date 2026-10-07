const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_PATH || 'playwright');
const {screenshotPath}=require('./check-paths.cjs');
const {play}=require('./check-ui-helpers.cjs');
const baseline=process.env.PERFORMANCE_BASELINE_ROOT;

(async()=>{
  const server=require(baseline?path.join(baseline,'scripts/check-server.cjs'):'./check-server.cjs').createServer();
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  try {
    browser=await chromium.launch({executablePath:process.env.CHROME_PATH || `${process.env.ProgramFiles}/Google/Chrome/Application/chrome.exe`,headless:true});
    const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,reducedMotion:'no-preference'});
    const page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.addInitScript(()=>{
      if(!sessionStorage.getItem('performance-seeded')){
        localStorage.setItem('insight-sound-v1','off');localStorage.setItem('insight-tile-limits-v1','off');localStorage.setItem('insight-dev-mode-v1','on');
        localStorage.setItem('insight-session-r2',JSON.stringify({revision:2,level:1,limits:false,allowances:null,path:[]}));
        sessionStorage.setItem('performance-seeded','true');
      }
      window.performanceChecks={rects:0,writes:[]};
      const rect=Element.prototype.getBoundingClientRect,set=Storage.prototype.setItem;
      Element.prototype.getBoundingClientRect=function(){if(this.closest('#board'))window.performanceChecks.rects++;return rect.call(this)};
      Storage.prototype.setItem=function(key,value){window.performanceChecks.writes.push(key);return set.call(this,key,value)};
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/Puzzle.html`);
    await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');await play(page);
    const tile=(r,c)=>page.locator(`.tile[data-r="${r}"][data-c="${c}"]`),source=tile(0,1),target=tile(1,1);
    const canvasSize=()=>page.locator('#fx').evaluate(node=>[node.width,node.height]);
    const idleCanvas=await canvasSize();
    await page.screenshot({path:screenshotPath(`performance-${baseline?'before':'after'}-idle.png`)});
    await page.evaluate(()=>window.initialTiles=[...document.querySelectorAll('#board .tile')]);
    const a=await source.boundingBox(),b=await target.boundingBox();
    await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();
    await page.evaluate(()=>{window.performanceChecks.rects=0;window.performanceChecks.writes=[]});
    await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:30});
    const dragRects=await page.evaluate(()=>window.performanceChecks.rects);
    await page.mouse.up();await page.waitForFunction(()=>document.getElementById('moves').textContent==='1');
    await page.waitForFunction(()=>JSON.parse(localStorage.getItem('insight-session-r2')).path.length===1);
    const retainedTiles=await page.evaluate(()=>window.initialTiles.every((node,i)=>document.querySelectorAll('#board .tile')[i]===node));
    const moveWrites=await page.evaluate(()=>window.performanceChecks.writes.filter(key=>/^insight-(attempts-r2|session-r2|campaign)/.test(key)));
    const swapCanvas=await canvasSize();
    const trail=await page.locator('.screen-stroke span').last().evaluate(node=>({duration:getComputedStyle(node).animationDuration,filter:getComputedStyle(node).filter}));
    await page.screenshot({path:screenshotPath(`performance-${baseline?'before':'after'}-swap.png`)});
    console.log(JSON.stringify({variant:baseline?'before':'after',dragRects,retainedTiles,moveWrites,idleCanvas,swapCanvas,trail}));
    if(baseline)return;
    assert.equal(dragRects,0,'Dragging must not read layout after pointerdown');
    assert(retainedTiles,'Swaps retain every board tile node');
    assert.deepEqual(moveWrites,['insight-attempts-r2','insight-session-r2'],'Non-winning moves write only changed attempts');
    assert.deepEqual(idleCanvas,[1,1]);assert.deepEqual(swapCanvas,[1,1],'Ordinary swaps do not run fullscreen particles');
    assert.equal(trail.filter,'none');assert(parseFloat(trail.duration)<=2,'Trails finish within two seconds');
    assert.equal(await page.evaluate(()=>document.activeElement.dataset.r+':'+document.activeElement.dataset.c),'1:1');
    await page.reload();await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');await play(page);
    assert.equal(await page.locator('#moves').textContent(),'1','Completed move survives immediate reload');
    await page.locator('#undoBtn').click();
    await page.waitForFunction(()=>document.getElementById('moves').textContent==='0');

    // A queued frame cannot move a tile after Escape, resize, menu entry, or hidden-tab cancellation.
    async function cancelGesture(kind){
      const box=await source.boundingBox();
      await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
      await page.evaluate(({x,y,kind})=>{
        const board=document.getElementById('board');
        board.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,cancelable:true,pointerId:1,clientX:x+30,clientY:y+30}));
        if(kind==='escape')document.dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,key:'Escape'}));
        if(kind==='resize')window.dispatchEvent(new Event('resize'));
        if(kind==='menu')document.getElementById('menuBtn').click();
        if(kind==='hidden'){
          Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));
          delete document.hidden;
        }
      },{x:box.x+box.width/2,y:box.y+box.height/2,kind});
      await page.mouse.up();
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      assert.equal(await source.evaluate(node=>node.style.transform),'',kind+' clears pending drag transform');
      assert.equal(await page.locator('#moves').textContent(),'0',kind+' preserves the attempt');
      await play(page);
    }
    for(const kind of ['escape','resize','menu','hidden'])await cancelGesture(kind);

    // Rapid reversible swaps cannot accumulate more than three pairs of trails.
    for(let i=0;i<6;i++){
      const from=tile(i%2?1:0,1),to=tile(i%2?0:1,1);
      await from.focus();await page.keyboard.press('Enter');await to.focus();await page.keyboard.press('Enter');
      await page.waitForFunction(count=>document.getElementById('moves').textContent===String(count),i+1);
      assert(await page.locator('.color-stroke').count()<=6,'Rapid moves cap overlapping trail layers');
    }
    await page.keyboard.press('r');

    // A partial storage failure stays visible and is retried when the page is hidden.
    await page.evaluate(()=>{
      window.recoverableSet=Storage.prototype.setItem;
      Storage.prototype.setItem=function(key,value){if(key==='insight-attempts-r2')throw new DOMException('Blocked','SecurityError');return window.recoverableSet.call(this,key,value)};
    });
    await source.focus();await page.keyboard.press('Enter');await target.focus();await page.keyboard.press('Enter');
    await page.waitForFunction(()=>document.getElementById('moves').textContent==='1');
    await page.locator('.system-notice.notice-warning').waitFor();
    await page.evaluate(()=>{Storage.prototype.setItem=window.recoverableSet;window.dispatchEvent(new Event('pagehide'))});
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('insight-attempts-r2')).entries['classic:1'].path.length),1,'Lifecycle flush retries failed writes');
    await page.keyboard.press('r');

    // Drop before the next frame still uses the release coordinates.
    const from=await source.boundingBox(),to=await target.boundingBox();
    await page.mouse.move(from.x+from.width/2,from.y+from.height/2);await page.mouse.down();
    await page.evaluate(({x,y})=>{
      const board=document.getElementById('board');
      for(const type of ['pointermove','pointerup'])board.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerId:1,clientX:x,clientY:y}));
    },{x:to.x+to.width/2,y:to.y+to.height/2});
    await page.mouse.up();await page.waitForFunction(()=>document.getElementById('moves').textContent==='1');
    await tile(0,1).focus();await page.keyboard.press('Enter');await tile(0,0).focus();await page.keyboard.press('Enter');
    await page.locator('#winOverlay').waitFor({state:'visible'});
    assert.deepEqual(await canvasSize(),[585,1266],'Win particles cap DPR at 1.5 on a DPR 3 display');
    await page.waitForFunction(()=>document.getElementById('fx').width===1);
    await page.waitForFunction(()=>document.querySelectorAll('.color-stroke').length===0);
    assert.deepEqual(errors,[]);
    console.log('Performance checks passed: cached drag geometry, stable tiles, selective saves, release/cancellation, bounded trails and particle buffers.');
  }finally{await browser?.close();await new Promise(resolve=>server.close(resolve))}
})().catch(error=>{console.error(error);process.exitCode=1});
