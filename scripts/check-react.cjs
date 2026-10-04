const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_PATH || 'playwright');
const {rootPath}=require('./check-paths.cjs');
const {play,home,dismissMenus}=require('./check-ui-helpers.cjs');

(async()=>{
  // An isolated development fixture exercises Strict Mode and real unmounts.
  const {createServer}=await import('vite');
  const server=await createServer({root:rootPath(),configFile:rootPath('vite.config.mjs'),server:{host:'127.0.0.1',port:0,strictPort:false},plugins:[{
    name:'react-lifecycle-check',resolveId(id){if(id==='/@react-check-entry')return id},
    load(id){if(id==='/@react-check-entry')return `
        import React from 'react';import {createRoot} from 'react-dom/client';
        import GameApp from '/src/GameApp.jsx';import EditorApp from '/src/EditorApp.jsx';
        import '/src/styles.css';import '/src/editor.css';
        const root=createRoot(document.getElementById('root'));
        window.mountScreen=screen=>root.render(screen ? React.createElement(React.StrictMode,null,React.createElement(screen==='editor'?EditorApp:GameApp)) : null);
        window.mountScreen('game');
      `},
    configureServer(server){server.middlewares.use('/__react-check.html',(_request,response)=>{
      response.setHeader('Content-Type','text/html');
      response.end('<!doctype html><html><head><meta charset="utf-8"><link rel="icon" href="data:,"></head><body><div id="root" inert></div><script type="module" src="/@react-check-entry"></script></body></html>');
    })}
  }]});
  let browser;
  try{
    await server.listen();
    browser=await chromium.launch({executablePath:process.env.CHROME_PATH || `${process.env.ProgramFiles}/Google/Chrome/Application/chrome.exe`,headless:true});
    const page=await browser.newPage({viewport:{width:1280,height:960}}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{if(message.type()==='error')errors.push(message.text())});
    page.on('response',response=>{if(response.status()>=400)errors.push(response.status()+' '+response.url())});
    await page.addInitScript(()=>{
      const NativeWorker=window.Worker;window.activeWorkers=new Set();
      window.Worker=class extends NativeWorker{
        constructor(...args){super(...args);window.activeWorkers.add(this)}
        terminate(){window.activeWorkers.delete(this);super.terminate()}
      };
    });
    await page.goto(server.resolvedUrls.local[0]+'__react-check.html');
    const ready=()=>page.waitForFunction(()=>document.documentElement.dataset.ready==='true');
    const mount=async screen=>{
      await page.evaluate(()=>window.mountScreen(null));
      await page.waitForFunction(()=>!document.documentElement.dataset.ready);
      await page.evaluate(screen=>window.mountScreen(screen),screen);await ready();
    };
    await ready();await play(page);
    const move=async(a=[0,1],b=[1,1])=>{
      await page.locator(`.tile[data-r="${a[0]}"][data-c="${a[1]}"]`).focus();await page.keyboard.press('Enter');
      await page.locator(`.tile[data-r="${b[0]}"][data-c="${b[1]}"]`).focus();await page.keyboard.press('Enter');
    };
    await move([0,0],[0,1]);await page.waitForFunction(()=>document.querySelector('#moves').textContent==='1');
    await mount('game');await play(page);
    await move();await page.waitForFunction(()=>document.querySelector('#moves').textContent==='1');
    await mount('game');await play(page);
    await page.keyboard.press('r');
    assert.equal(await page.locator('#moves').textContent(),'0');
    await page.keyboard.press('u');
    assert.equal(await page.locator('#moves').textContent(),'1','One key event undoes one restart after remount');
    await page.keyboard.press('r');
    // A preference changed during the animation must survive its completion.
    await move();await page.locator('#soundBtn').click();
    await page.waitForFunction(()=>document.querySelector('#moves').textContent==='1');
    assert.equal(await page.locator('#soundBtn').getAttribute('aria-pressed'),'false');
    assert.equal(await page.evaluate(()=>localStorage.getItem('insight-sound-v1')),'off');
    await dismissMenus(page);await page.keyboard.press('r');
    // Unmounting mid-animation cancels the uncommitted swap and its win timer.
    await move();
    await page.evaluate(()=>{window.oldAudio=window.InsightAudio;window.mountScreen(null)});
    await page.waitForFunction(()=>!document.documentElement.dataset.ready);
    assert.equal(await page.evaluate(()=>window.InsightAudio===undefined && window.oldAudio.ringingNotes.size===0 && window.oldAudio.ambientSound.paused),true,'Unmount releases audio');
    await page.waitForTimeout(1100);
    await page.evaluate(()=>window.mountScreen('game'));await ready();await play(page);
    assert.equal(await page.locator('#moves').textContent(),'0','A cancelled animation cannot save a stale move');
    await home(page);await page.locator('#newGameBtn').click();
    await mount('game');
    assert.equal(await page.locator('#confirmationOverlay').isVisible(),false,'An unmounted confirmation cannot remain pending');

    await mount('editor');
    await page.locator('#filesTab').click();
    await page.locator('#importText').fill(JSON.stringify({name:'Worker lifecycle',start:['RGBYP','PYBGR','GBRPY','YRPBG','BGPYR'],target:['PYBGR','RGBYP','YRPBG','BGPYR','GBRPY']}));
    await page.locator('#importPaste').click();
    await page.locator('#validatePuzzle').click();
    assert.equal(await page.evaluate(()=>window.activeWorkers.size),1,'Validation starts one worker in Strict Mode');
    await mount('editor');
    assert.equal(await page.evaluate(()=>window.activeWorkers.size),0,'Unmount terminates validation');
    assert.equal(await page.locator('#validatePuzzle').textContent(),'Validate');
    assert.equal(await page.locator('#playtestPuzzle').isDisabled(),true);
    const cell=page.locator('.edit-cell[data-r="0"][data-c="0"]');
    await cell.focus();await page.keyboard.press('Delete');
    const draft=()=>page.evaluate(()=>{const data=JSON.parse(localStorage.getItem('insight-editor-drafts-v1'));return data.drafts.find(item=>item.id===data.active)});
    assert.equal((await draft()).start[0][0],'.');
    await page.keyboard.press('Control+z');
    assert.equal((await draft()).start[0][0],'R','Undo restores exactly one keyboard edit after remount');
    await page.keyboard.press('Control+y');
    assert.equal((await draft()).start[0][0],'.');
    await mount('editor');
    assert.equal((await draft()).start[0][0],'.','Drafts survive repeated mounts');
    assert.deepEqual(errors,[],'Strict Mode and remounts produce no browser or React errors');
    console.log('React lifecycle checks passed: Strict Mode, repeated mounts, animation cancellation, preference races, audio disposal, confirmations, worker cancellation and saved drafts.');
  }finally{await browser?.close();await server.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
