const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_PATH || 'playwright');
const {rootPath}=require('./check-paths.cjs');
const {play,home,dismissMenus,movesIs}=require('./check-ui-helpers.cjs');

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
        window.screenCommits=0;
        window.mountScreen=screen=>root.render(screen ? React.createElement(React.StrictMode,null,React.createElement(React.Profiler,{id:screen,onRender:()=>window.screenCommits++},React.createElement(screen==='editor'?EditorApp:GameApp))) : null);
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
    await move([0,0],[0,1]);await movesIs(page,1);
    await mount('game');await play(page);
    await move();await movesIs(page,1);
    await mount('game');await play(page);
    await page.keyboard.press('r');
    await movesIs(page,0);
    await page.keyboard.press('u');
    await movesIs(page,1);
    await page.keyboard.press('r');
    // Coordinates within the same destination move only the tile, without React commits.
    const dragSource=page.locator('.tile[data-r="0"][data-c="1"]'),dragTarget=page.locator('.tile[data-r="1"][data-c="1"]');
    const sourceBox=await dragSource.boundingBox(),targetBox=await dragTarget.boundingBox();
    await page.mouse.move(sourceBox.x+sourceBox.width/2,sourceBox.y+sourceBox.height/2);await page.mouse.down();
    await page.mouse.move(targetBox.x+targetBox.width/2,targetBox.y+targetBox.height/2);
    await page.waitForFunction(()=>document.querySelector('.tile.dragging'));
    const commits=await page.evaluate(async({x,y})=>{
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      window.screenCommits=0;
      for(let i=0;i<30;i++)document.getElementById('board').dispatchEvent(new PointerEvent('pointermove',{bubbles:true,cancelable:true,pointerId:1,clientX:x+i/10,clientY:y}));
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      return window.screenCommits;
    },{x:targetBox.x+targetBox.width/2,y:targetBox.y+targetBox.height/2});
    assert.equal(commits,0,'Steady dragging must not rerender the game or its hidden menus');
    await page.keyboard.press('Escape');await page.mouse.up();
    assert.equal(await dragSource.evaluate(el=>el.style.transform),'','Cancel removes the imperative drag transform');
    // A preference changed during the animation must survive its completion.
    await move();await page.locator('#soundBtn').click();
    await movesIs(page,1);
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
    await movesIs(page,0);
    // Unmount must also cancel a drag frame that has not run yet.
    const remountBox=await dragSource.boundingBox();
    await page.mouse.move(remountBox.x+remountBox.width/2,remountBox.y+remountBox.height/2);await page.mouse.down();
    await page.evaluate(()=>{
      window.oldTile=document.querySelector('.tile[data-r="0"][data-c="1"]');
      document.getElementById('board').dispatchEvent(new PointerEvent('pointermove',{bubbles:true,cancelable:true,pointerId:1,clientX:200,clientY:400}));
      window.mountScreen(null);
    });
    await page.waitForFunction(()=>!document.documentElement.dataset.ready);await page.mouse.up();
    assert.equal(await page.evaluate(()=>window.oldTile.style.transform),'','Unmount cancels pending drag work');
    await page.evaluate(()=>window.mountScreen('game'));await ready();await play(page);
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
