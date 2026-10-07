const {rootPath,screenshotPath}=require('./check-paths.cjs');
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const {home,play,settings,dismissMenus,movesIs}=require('./check-ui-helpers.cjs');

(async()=>{
  const server=require('./check-server.cjs').createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  try {
    browser=await chromium.launch({executablePath:process.env.CHROME_PATH||`${process.env.ProgramFiles}/Google/Chrome/Application/chrome.exe`,headless:true});
    const page=await browser.newPage({viewport:{width:1280,height:720},reducedMotion:'reduce'}),errors=[],dialogs=[];
    page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>{dialogs.push(dialog.type());dialog.dismiss()});
    const base='http://127.0.0.1:'+server.address().port;
    await page.goto(base+'/Puzzle.html');await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');
    assert(await page.locator('#menuOverlay').isVisible());
    assert.equal(await page.locator('#menuOverlay #volumeSlider,#menuOverlay #devModeBtn').count(),0,'Home has campaign choices, separate from settings');
    assert.equal(await page.locator('#pauseOverlay #newGameBtn').count(),0);
    const data=()=>page.evaluate(()=>Object.fromEntries(Object.keys(localStorage).map(key=>[key,localStorage.getItem(key)])));
    const before=await data();
    await page.locator('#newGameBtn').click();
    assert.equal(await page.locator('#confirmationOverlay').getAttribute('role'),'alertdialog');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'confirmCancel','Destructive confirmation starts on Cancel');
    assert.equal(await page.locator('#menuOverlay').evaluate(el=>el.inert),true);
    await page.keyboard.press('Shift+Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'confirmAccept');
    await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'confirmCancel');
    await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.activeElement.id),'newGameBtn');
    assert.deepEqual(await data(),before,'Escape leaves progress unchanged');
    await page.locator('#newGameBtn').click();await page.locator('#confirmationOverlay').click({position:{x:2,y:2}});
    assert.deepEqual(await data(),before,'Backdrop cancellation leaves progress unchanged');
    await settings(page);await page.locator('#settingsTab-play').focus();await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('#settingsTab-sound').getAttribute('aria-selected'),'true');
    await page.keyboard.press('End');assert.equal(await page.locator('#settingsTab-appearance').getAttribute('aria-selected'),'true');
    await page.locator('#appearanceBtn').click();
    await page.waitForFunction(()=>document.getElementById('achievementTab-appearance').getAttribute('aria-selected')==='true');
    assert.equal(await page.locator('#achievementTab-appearance').getAttribute('aria-selected'),'true','Appearance opens directly from settings');
    await page.keyboard.press('Escape');assert(await page.locator('#settingsOverlay').isVisible());
    assert.equal(await page.evaluate(()=>document.activeElement.id),'appearanceBtn');
    await page.keyboard.press('Escape');assert(await page.locator('#menuOverlay').isVisible());
    assert.equal(await page.evaluate(()=>document.activeElement.id),'homeSettingsBtn');
    await play(page);await page.locator('#menuBtn').click();assert(await page.locator('#pauseOverlay').isVisible());
    assert.equal(await page.evaluate(()=>document.activeElement.id),'resumeBtn');
    await page.locator('#pauseSettingsBtn').click();await page.keyboard.press('Escape');
    assert(await page.locator('#pauseOverlay').isVisible());assert.equal(await page.evaluate(()=>document.activeElement.id),'pauseSettingsBtn');
    await page.locator('#resumeBtn').click();await page.keyboard.press('Escape');assert(await page.locator('#pauseOverlay').isVisible(),'Escape pauses gameplay');
    await page.locator('#homeBtn').click();
    for(const viewport of [{width:320,height:568},{width:375,height:667},{width:768,height:600},{width:1280,height:720},{width:844,height:390}]) {
      await page.setViewportSize(viewport);await home(page);
      async function fits(selector) {
        const overflow=await page.locator(selector).evaluate(el=>{
          const r=el.getBoundingClientRect();return {fits:r.top>=0 && r.bottom<=innerHeight && r.left>=0 && r.right<=innerWidth && el.scrollHeight<=el.clientHeight+1,height:el.clientHeight,content:el.scrollHeight};
        });
        assert(overflow.fits,selector+' fits '+viewport.width+'×'+viewport.height+' '+JSON.stringify(overflow));
      }
      await fits('#menuOverlay .menu-card');await page.screenshot({path:screenshotPath(`home-${viewport.width}.png`)});
      await page.locator('#newGameBtn').click();await fits('.confirmation-card');await page.screenshot({path:screenshotPath(`confirmation-${viewport.width}.png`)});await page.locator('#confirmCancel').click();
      for(const tab of ['play','sound','appearance']) {await settings(page,tab);await fits('.settings-card');await page.screenshot({path:screenshotPath(`settings-${tab}-${viewport.width}.png`)})}
      await page.locator('#closeSettings').click();await play(page);await page.locator('#menuBtn').click();await fits('.pause-card');await page.screenshot({path:screenshotPath(`pause-${viewport.width}.png`)});
    }
    await page.setViewportSize({width:375,height:667});await settings(page,'play');
    await page.locator('#devModeBtn').click();assert(await page.locator('#settingsOverlay').isVisible(),'Developer toggle keeps settings open');
    await page.locator('#devModeBtn').click();
    assert.equal(await page.locator('#modeBtn,#limitsBtn,#resetProgress').count(),0,'Stars and Tile Limits controls are gone');
    await home(page);await page.locator('#newGameBtn').click();await page.locator('#confirmAccept').click();
    assert.equal(await page.locator('.overlay.open').count(),0,'Accepting New Game enters gameplay');
    await movesIs(page,0);
    // Editor confirmations use the same keyboard and cancellation behavior.
    await page.goto(base+'/Editor.html');await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');
    await page.locator('#puzzlesTab').click();const editorBefore=await page.evaluate(()=>localStorage.getItem('insight-editor-drafts-v1'));
    await page.locator('#deleteDraft').click();assert.equal(await page.evaluate(()=>document.activeElement.id),'confirmCancel');
    assert.equal(await page.locator('.editor-app').evaluate(el=>el.inert),true);
    await page.keyboard.press('r');await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'deleteDraft');
    assert.equal(await page.evaluate(()=>localStorage.getItem('insight-editor-drafts-v1')),editorBefore);
    await page.locator('#boardWidth').selectOption('2');await page.locator('#confirmCancel').click();assert.equal(await page.locator('#boardWidth').inputValue(),'3','Cancelled crop restores the size control');
    await page.locator('#clearBoard').click();await page.locator('#confirmCancel').click();
    assert.equal(await page.evaluate(()=>localStorage.getItem('insight-editor-drafts-v1')),editorBefore);
    await page.locator('#filesTab').click();await page.locator('#importText').fill('invalid JSON');await page.locator('#importPaste').click();
    assert(await page.locator('.system-notice.notice-error').isVisible());
    assert.equal(await page.locator('#toast').evaluate(el=>getComputedStyle(el).pointerEvents),'none');
    const blocked=await browser.newPage({reducedMotion:'reduce'});blocked.on('pageerror',error=>errors.push(error.message));
    await blocked.goto(base+'/Puzzle.html');await blocked.waitForFunction(()=>document.documentElement.dataset.ready==='true');
    await blocked.evaluate(()=>{Storage.prototype.setItem=()=>{throw new DOMException('Blocked','SecurityError')}});
    await settings(blocked,'sound');
    await blocked.locator('#volumeSlider').evaluate(el=>{el.value=50;el.dispatchEvent(new Event('input',{bubbles:true}))});
    assert(await blocked.locator('.system-notice.notice-warning').isVisible(),'Sound preferences also report blocked storage');
    await home(blocked);await blocked.locator('#newGameBtn').click();await blocked.locator('#confirmAccept').click();
    await blocked.locator('.system-notice.notice-success').waitFor();
    await blocked.locator('.system-notice.notice-warning').waitFor({timeout:8000});
    assert.match(await blocked.locator('#toast').textContent(),/storage unavailable/,'Persistent warnings return after transient notices');
    await blocked.close();
    assert.deepEqual(dialogs,[],'No browser confirmation or alert is used');assert.deepEqual(errors,[]);
    console.log('Menu checks passed: separate home/pause/settings, nested navigation, confirmations, focus, notifications, storage and five viewport sizes.');
  } finally {await browser?.close();await new Promise(resolve=>server.close(resolve))}
})().catch(error=>{console.error(error);process.exitCode=1});
