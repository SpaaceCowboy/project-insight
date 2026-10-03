const fs = require('node:fs');
const http = require('node:http');
const assert = require('node:assert/strict');
const {chromium} = require(process.env.PLAYWRIGHT_PATH || 'playwright');

(async () => {
  const server = http.createServer((req,res) => {
    const file=new URL(req.url,'http://localhost').pathname.slice(1) || 'Puzzle.html';
    if (!['Puzzle.html','game.js','levels.js','styles.css','sound.js','puzzle-rules.js','tile-art.js','puzzle-solver.js',...['ambient','select','move','deny','win','voice'].map(name=>`sounds/${name}.wav`)].includes(file)) { res.writeHead(404); res.end(); return; }
    res.setHeader('Cache-Control','no-store');
    res.setHeader('Content-Type', file.endsWith('.wav') ? 'audio/wav' : file.endsWith('.png') ? 'image/png' : file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html');
    const content=fs.readFileSync(file);
    res.setHeader('Content-Length',content.length);
    res.end(content);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  try {
    browser = await chromium.launch({executablePath:process.env.CHROME_PATH || `${process.env.ProgramFiles}/Google/Chrome/Application/chrome.exe`,headless:true});
    const page = await browser.newPage({viewport:{width:1280,height:960},reducedMotion:'reduce'});
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/Puzzle.html`);
    assert.equal(await page.locator('#menuOverlay').isVisible(),true);
    await page.locator('#limitsBtn').click();
    await page.locator('#menuBtn').click();
    await page.locator('#modeBtn').click();
    await page.locator('#themeBtn').click();
    await page.locator('#volumeSlider').focus();
    await page.keyboard.press('End');
    assert.equal(await page.locator('#volumeValue').textContent(),'100%');
    assert.equal(await page.locator('#ambienceSlider').inputValue(),'80');
    assert.equal(await page.evaluate(()=>ambienceVolume),.8,'Effects do not change ambience');
    await page.keyboard.press('Home');
    await page.waitForFunction(()=>[voiceSound,...Object.values(soundEffects)].every(sound=>sound.volume===0));
    assert.equal(await page.evaluate(()=>ambienceVolume),.8);
    await page.locator('#volumeSlider').evaluate(el=>{el.value=80;el.dispatchEvent(new Event('input',{bubbles:true}));});
    await page.locator('#ambienceSlider').focus();
    await page.keyboard.press('End');
    await page.waitForFunction(()=>ambientSound.volume===.7);
    await page.keyboard.press('Home');
    await page.waitForFunction(()=>ambientSound.volume===0);
    assert.equal(await page.evaluate(()=>masterVolume),.8,'Ambience does not change effects');
    await page.locator('#ambienceSlider').evaluate(el=>{el.value=80;el.dispatchEvent(new Event('input',{bubbles:true}));});
    await page.locator('#voiceToggle').uncheck();
    await page.locator('#voiceToggle').focus();
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'playBtn','Volume is included in menu focus trap');
    await page.reload();
    assert.equal(await page.locator('#volumeSlider').inputValue(),'80');
    assert.equal(await page.locator('#ambienceSlider').inputValue(),'80');
    assert.equal(await page.locator('#voiceToggle').isChecked(),false);
    assert.equal(await page.locator('body.light-mode').count(),1);
    assert.equal(await page.locator('body.zen-mode').count(),0);
    await page.locator('#playBtn').click();
    await page.locator('#soundBtn').click();
    const tile=(r,c)=>page.locator(`.tile[data-r="${r}"][data-c="${c}"]`);
    const state=(target=page)=>target.locator('.tile').evaluateAll(els=>els.map(el=>el.dataset.type).join(''));
    const snapshot=(target=page)=>target.evaluate(()=>({moves:document.querySelector('#moves').textContent,
      color:document.body.style.getPropertyValue('--light-color'),
      tiles:[...document.querySelectorAll('.tile')].map(el=>[el.dataset.type,el.querySelector('.tile-allowance')?.textContent||null])}));
    async function move(a,b,width,target=page) {
      await target.locator(`.tile[data-r="${Math.floor(a/width)}"][data-c="${a%width}"]`).focus();
      await target.keyboard.press('Enter');
      await target.locator(`.tile[data-r="${Math.floor(b/width)}"][data-c="${b%width}"]`).focus();
      await target.keyboard.press('Enter');
    }
    async function choose(index,target=page) {
      await target.locator('#levelsBtn').click();
      await target.locator('#worldTab'+(Math.floor(index/25)+1)).click();
      await target.locator('.level-card').nth(index%25).click();
    }
    // Keyboard solve, focus trap/return, progress, undo, and preference persistence.
    const first=await state();
    await move(0,1,2);
    await page.locator('#winOverlay').waitFor({state:'visible'});
    assert.equal(await page.locator('#winStars').textContent(),'★★★');
    await page.keyboard.press('Shift+Tab');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'winNextBtn');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'replayBtn');
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(()=>document.activeElement.dataset.c),'1');
    await page.locator('#undoBtn').click();
    assert.equal(await state(),first);
    assert.equal(await page.locator('#moves').textContent(),'0');
    assert.equal(await page.locator('#starsTop').textContent(),'★★★');
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
    await choose(19);
    await tile(1,2).click();
    await tile(0,2).click();
    await page.waitForFunction(()=>document.querySelector('#moves').textContent==='1');
    assert.equal(await tile(1,2).getAttribute('data-type'),'W');
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
    assert.equal(await page.locator('#moves').textContent(),'0');
    assert.equal(await page.locator('#winOverlay').isVisible(),false);
    assert.equal(await page.locator('.cell').count(),9);
    // Switch after the board commits but before the win dialog timer fires.
    await choose(0);
    await move(0,1,2);
    await page.waitForFunction(()=>document.querySelector('#moves').textContent==='1');
    await choose(1);
    await page.waitForTimeout(400);
    assert.equal(await page.locator('#winOverlay').isVisible(),false);
    await page.emulateMedia({reducedMotion:'reduce'});
    // Play every verified solution through the actual keyboard UI.
    const results=JSON.parse(fs.readFileSync('level-checks.json','utf8'));
    // An isolated returning player migrates a v1 save, keeps both modes, and recovers a restart.
    const ux=await browser.newPage({viewport:{width:1280,height:720},reducedMotion:'reduce'});
    ux.on('pageerror',e=>errors.push(e.message));
    await ux.goto(page.url());
    await ux.evaluate(()=>{
      localStorage.clear();
      localStorage.setItem('insight-tile-limits-v1','off');
      localStorage.setItem('insight-sound-v1','off');
      localStorage.setItem('insight-volume-v1','.5');
      localStorage.setItem('insight-voice-v1','off');
      localStorage.setItem('insight-session-v1',JSON.stringify({level:25,limits:false,allowances:null,path:[[[1,0],[0,0]]]}));
    });
    await ux.reload();
    await ux.locator('#playBtn').click();
    assert.equal(await ux.locator('#moves').textContent(),'1','Legacy route restored');
    assert.equal(await ux.locator('#ambienceSlider').inputValue(),'50','Old volume initializes ambience');
    assert.equal(await ux.locator('#voiceToggle').isChecked(),false);
    const classicAttempt=await snapshot(ux);
    await choose(1,ux); await choose(25,ux);
    assert.deepEqual(await snapshot(ux),classicAttempt,'Switching levels preserves an attempt');
    await ux.locator('#menuBtn').click(); await ux.locator('#limitsBtn').click();
    assert.equal(await ux.locator('#moves').textContent(),'0');
    await move(3,0,3,ux);
    await ux.waitForFunction(()=>document.querySelector('#moves').textContent==='1');
    const limitedAttempt=await snapshot(ux);
    await ux.locator('#menuBtn').click(); await ux.locator('#limitsBtn').click();
    assert.deepEqual(await snapshot(ux),classicAttempt,'Classic attempt survives mode switching');
    await ux.locator('#menuBtn').click(); await ux.locator('#limitsBtn').click();
    assert.deepEqual(await snapshot(ux),limitedAttempt,'Limited budgets survive mode switching');
    await ux.locator('#restartBtn').click();
    assert.match(await ux.locator('#undoBtn').textContent(),/Undo restart/);
    await ux.reload(); await ux.locator('#playBtn').click();
    await ux.locator('#undoBtn').click();
    assert.deepEqual(await snapshot(ux),limitedAttempt,'Undo restart survives reload');
    assert.equal(await ux.evaluate(()=>document.activeElement.dataset.r),'0','Undo restores board focus');
    await ux.locator('#restartBtn').click(); await move(3,0,3,ux);
    await ux.waitForFunction(()=>document.querySelector('#moves').textContent==='1');
    assert(!/restart/.test(await ux.locator('#undoBtn').textContent()),'Next move clears restart recovery');
    await ux.locator('#undoBtn').click();
    assert.equal(await ux.locator('#moves').textContent(),'0');
    await choose(0,ux);
    const untouched=await snapshot(ux);
    const uxTile=(r,c)=>ux.locator(`.tile[data-r="${r}"][data-c="${c}"]`);
    await uxTile(0,0).click(); await uxTile(1,0).click();
    assert.equal(await uxTile(0,0).getAttribute('aria-pressed'),'true','Invalid tap keeps selection');
    assert.match(await ux.locator('#announcement').textContent(),/not allowed/);
    assert.deepEqual(await snapshot(ux),untouched,'Invalid moves spend nothing');
    await ux.locator('.board-shell').click({position:{x:40,y:40}});
    assert.equal(await uxTile(0,0).getAttribute('aria-pressed'),'false','Background tap cancels selection');
    await choose(25,ux); await ux.locator('#restartBtn').click();
    await ux.emulateMedia({reducedMotion:'no-preference'});
    await move(3,0,3,ux);
    await ux.waitForFunction(()=>document.querySelector('#moves').textContent==='1');
    assert.equal(await ux.locator('.tile.arrived').count(),1,'Only the newly correct tile glows');
    assert.equal(await uxTile(0,0).evaluate(el=>getComputedStyle(el).animationName),'tileArrival');
    await ux.screenshot({path:'game-arrival.png'});
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
    await ux.evaluate(()=>playTone('win'));
    assert.equal(await ux.evaluate(()=>voiceSound.paused),true,'Spoken celebration stays off');
    await ux.evaluate(()=>{
      Object.defineProperty(document,'hidden',{configurable:true,value:true});
      document.dispatchEvent(new Event('visibilitychange'));
    });
    assert.equal(await ux.evaluate(()=>[ambientSound,voiceSound,...Object.values(soundEffects)].every(sound=>sound.paused)),true,'Hidden page pauses every audio layer');
    await ux.evaluate(()=>{delete document.hidden;stopMusic();});
    await ux.close();
    const playthroughs=process.env.QUICK_CHECK ? results.filter(level=>[1,26,100,106].includes(level.level)) : results;
    for(const level of playthroughs) {
      await choose(level.level-1);
      await page.locator('#restartBtn').click();
      for(const [i,[from,to]] of level.path.entries()) {
        await move(from,to,level.width);
        await page.waitForFunction(n=>document.querySelector('#moves').textContent===String(n),i+1);
      }
      await page.locator('#winOverlay').waitFor({state:'visible'});
      assert.equal(await page.locator('#winStars').textContent(),'★★★',`Level ${level.level}`);
      await page.keyboard.press('Escape');
      if(level.level%25===0) console.log(`Browser solved levels 1–${level.level}.`);
    }
    await page.reload();
    const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('insight-100-fixed-v4')).done);
    assert.equal(Object.keys(saved).length,playthroughs.length);
    await page.locator('#playBtn').click();
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
      await page.locator('#menuBtn').click();
      assert(await page.locator('.menu-card').evaluate(el=>el.scrollHeight<=el.clientHeight+1),'Menu and volume control fit without scrolling');
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
    await page.screenshot({path:'game-mobile.png',fullPage:true});
    await page.setViewportSize({width:1280,height:960});
    await choose(99);
    await page.screenshot({path:'game-desktop.png',fullPage:true});
    // Limited-mode stars remain separate; counters follow tiles and undo restores them.
    await page.locator('#menuBtn').click();
    await page.locator('#limitsBtn').click();
    assert.equal(await page.locator('.tile-allowance').count(),await page.locator('.tile:not(.white)').count());
    for (const level of playthroughs) {
      await choose(level.level-1);
      await page.locator('#restartBtn').click();
      const initial=await page.locator('.tile').evaluateAll(els=>els.map(el=>[el.dataset.type,el.querySelector('.tile-allowance')?.textContent]));
      assert(initial.every(([type,count])=>type==='W'||(+count>=3&&+count<=6)));
      for(const [i,[from,to]] of level.path.entries()) {
        await move(from,to,level.width);
        await page.waitForFunction(n=>document.querySelector('#moves').textContent===String(n),i+1);
      }
      await page.locator('#winOverlay').waitFor({state:'visible'});
      await page.keyboard.press('Escape');
      await page.locator('#restartBtn').click();
      assert.deepEqual(await page.locator('.tile').evaluateAll(els=>els.map(el=>[el.dataset.type,el.querySelector('.tile-allowance')?.textContent])),initial);
      if(level.level%25===0)console.log(`Limited mode solved levels 1–${level.level}.`);
    }
    await choose(0);
    const before=await tile(0,0).locator('.tile-allowance').textContent();
    const passenger=await tile(0,1).locator('.tile-allowance').textContent();
    await move(0,1,2);
    await page.locator('#winOverlay').waitFor({state:'visible'});
    await page.keyboard.press('Escape');
    assert.equal(await tile(0,1).locator('.tile-allowance').textContent(),String(+before-1));
    assert.equal(await tile(0,0).locator('.tile-allowance').textContent(),passenger);
    assert.equal(await page.evaluate(()=>document.body.style.getPropertyValue('--light-color')),'#88cedd');
    await page.locator('#undoBtn').click();
    assert.equal(await tile(0,0).locator('.tile-allowance').textContent(),before);
    // Resume preserves the actual route, tile budgets, light color and undo history.
    await choose(25);
    const resumeStart=await state();
    const resumeBudget=await page.locator('.tile-allowance').allTextContents();
    const resumeLevel=results[25];
    await move(...resumeLevel.path[0],resumeLevel.width);
    await page.waitForFunction(()=>document.querySelector('#moves').textContent==='1');
    const resumeBoard=await state();
    const resumeRemaining=await page.locator('.tile-allowance').allTextContents();
    const resumeColor=await page.evaluate(()=>document.body.style.getPropertyValue('--light-color'));
    await page.locator('#menuBtn').click();
    await page.locator('#playBtn').click();
    assert.equal(await state(),resumeBoard,'Continue keeps the current board');
    await page.reload();
    assert.match(await page.locator('#playBtn').textContent(),/Resume/);
    await page.locator('#playBtn').click();
    assert.equal(await state(),resumeBoard);
    assert.deepEqual(await page.locator('.tile-allowance').allTextContents(),resumeRemaining);
    assert.equal(await page.evaluate(()=>document.body.style.getPropertyValue('--light-color')),resumeColor);
    assert.equal(await page.locator('#soundBtn').getAttribute('aria-label'),'Enable sound','Mute survives reload');
    await page.locator('#undoBtn').click();
    assert.equal(await state(),resumeStart);
    assert.deepEqual(await page.locator('.tile-allowance').allTextContents(),resumeBudget);
    assert.equal(await page.locator('#moves').textContent(),'0');
    // Malformed saved routes and budgets cannot enter the live game state.
    for (const change of [{path:[[[99,0],[0,0]]]},{allowances:[[999]]},{path:[[[0,0],null]]}]) {
      await page.evaluate(change=>{
        const saved=JSON.parse(localStorage.getItem('insight-session-v1'));
        localStorage.setItem('insight-session-v1',JSON.stringify({...saved,...change}));
        const attempts=JSON.parse(localStorage.getItem('insight-attempts-v1'));
        const key=(saved.limits ? 'limited:' : 'classic:')+saved.level;
        attempts.entries[key]={...saved,...change};
        localStorage.setItem('insight-attempts-v1',JSON.stringify(attempts));
      },change);
      await page.reload();
      await page.locator('#playBtn').click();
      assert.equal(await page.locator('#moves').textContent(),'0');
      assert.equal(await page.locator('#undoBtn').isDisabled(),true);
    }
    const touch=await browser.newPage({viewport:{width:375,height:667},hasTouch:true,reducedMotion:'reduce'});
    await touch.goto(page.url());
    await touch.locator('#playBtn').tap();
    await touch.locator('.tile[data-r="0"][data-c="0"]').tap();
    await touch.locator('.tile[data-r="0"][data-c="1"]').tap();
    await touch.locator('#winOverlay').waitFor({state:'visible'});
    assert.equal(await touch.locator('#moves').textContent(),'1','Touch tap completes a swap');
    await touch.close();
    // Spending all allowances cannot soft-lock recovery controls.
    await page.evaluate(()=>{ Math.random=()=>0; });
    await choose(1);
    await choose(2);
    const directions = require('./puzzle-rules.js').moves;
    for(let i=0;i<40;i++) {
      if(await page.locator('#emptyOverlay').isVisible())break;
      const options=await page.locator('.tile').evaluateAll(els=>els.map(el=>({r:+el.dataset.r,c:+el.dataset.c,t:el.dataset.type,left:+el.querySelector('.tile-allowance')?.textContent})));
      let pair;
      for(const from of options) {
        if(from.left<=0||from.t==='W')continue;
        for(const [dr,dc] of directions[from.t]) {
          const to=options.find(el=>el.r===from.r+dr&&el.c===from.c+dc);
          if(!to)continue;
          const colors=options.map(el=>el.t);
          [colors[from.r*3+from.c],colors[to.r*3+to.c]]=[colors[to.r*3+to.c],colors[from.r*3+from.c]];
          if(colors.join('')!=='RBRBRB'){pair=[from,to];break;}
        }
        if(pair)break;
      }
      if(!pair)break;
      const [from,to]=pair;
      const count=+(await page.locator('#moves').textContent());
      await move(from.r*3+from.c,to.r*3+to.c,3);
      await page.waitForFunction(n=>document.querySelector('#moves').textContent===String(n),count+1);
    }
    await page.locator('#emptyOverlay').waitFor({state:'visible'});
    const emptyCount=+(await page.locator('#moves').textContent());
    const exhausted=await snapshot();
    await page.locator('#emptyLevelsBtn').click();
    await page.locator('.level-card').first().click();
    await choose(2);
    assert.equal(await page.locator('#emptyOverlay').isVisible(),true,'Returning restores exhaustion');
    assert.deepEqual(await snapshot(),exhausted);
    await page.reload(); await page.locator('#playBtn').click();
    assert.equal(await page.locator('#emptyOverlay').isVisible(),true,'Reload offers recovery');
    await page.locator('#emptyRestartBtn').click();
    await page.locator('#undoBtn').click();
    assert.deepEqual(await snapshot(),exhausted,'Undo restart restores an exhausted attempt');
    assert.equal(await page.locator('#emptyOverlay').isVisible(),true);
    await page.locator('#emptyUndoBtn').click();
    assert.equal(+(await page.locator('#moves').textContent()),emptyCount-1);
    assert.equal(await page.locator('#emptyOverlay').isVisible(),false);
    assert.equal(await page.evaluate(()=>[ambientSound,voiceSound,...Object.values(soundEffects)].every(sound=>sound.readyState===4&&sound.duration>0&&!sound.error)),true,'All native audio assets loaded');
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
    },['ambient','select','move','deny','win','voice'].map(name=>[name,fs.readFileSync(`sounds/${name}.wav`).toString('base64')]));
    assert(audioInfo.every(sound=>sound.duration>0&&sound.peak>.005&&sound.peak<1));
    if(await page.locator('#soundBtn').getAttribute('aria-label')==='Enable sound') await page.locator('#soundBtn').click();
    await page.evaluate(()=>{stopNotes();playTone('move','P');});
    assert.equal(await page.evaluate(()=>ambientSound.paused),false);
    assert.deepEqual(await page.evaluate(()=>[...ringingNotes].map(note=>note.frequency.value)),[440,880],'Purple has its own harmonic voice');
    assert(Math.abs(await page.evaluate(()=>noteGain.gain.value)-.8)<.000001);
    await page.locator('#soundBtn').click();
    await page.waitForFunction(()=>[ambientSound,voiceSound,...Object.values(soundEffects)].every(sound=>sound.paused));
    assert.equal(await page.evaluate(()=>[ambientSound,voiceSound,...Object.values(soundEffects)].every(sound=>sound.paused)),true);
    assert.equal(await page.evaluate(()=>ringingNotes.size),0,'Mute stops ringing notes');
    await page.locator('#menuBtn').click();
    await page.locator('#themeBtn').click();
    await page.keyboard.press('Escape');
    await choose(105);
    assert.equal(await page.locator('.ambient-lights span').first().evaluate(el=>getComputedStyle(el).animationName),'none','Reduced-motion lights stay still');
    await page.setViewportSize({width:320,height:568});
    await page.waitForFunction(()=>[...document.querySelectorAll('.tile')].every(el=>el.getBoundingClientRect().width>=44));
    assert(await page.locator('.tile').evaluateAll(els=>els.every(el=>el.getBoundingClientRect().width>=44)),'Five-row mobile tiles retain a 44px touch target');
    assert(await page.locator('.tile-allowance').evaluateAll(els=>els.every(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight;})),'Limited map fits narrow screen');
    await page.screenshot({path:'game-mobile.png',fullPage:true});
    await page.setViewportSize({width:1280,height:720});
    await page.screenshot({path:'game-desktop.png',fullPage:true});
    await page.locator('#menuBtn').click();
    await page.screenshot({path:'game-menu.png',fullPage:true});
    await page.keyboard.press('Escape');
    assert.match(await page.locator('#nextBtn').textContent(),/Replay final/);
    // Back to classic mode for the blocked-storage regression.
    if(await page.locator('#emptyOverlay').isVisible())await page.keyboard.press('Escape');
    await page.locator('#menuBtn').click();
    await page.locator('#limitsBtn').click();
    // Storage writes may fail without preventing play, undo, or opening win dialogs.
    await page.evaluate(()=>{
      localStorage.setItem('insight-100-fixed-v4',JSON.stringify({done:{}}));
    });
    await page.reload();
    await page.locator('#playBtn').click();
    await page.locator('#soundBtn').click();
    await page.evaluate(()=>{ Storage.prototype.setItem=()=>{throw new DOMException('Blocked','SecurityError')}; });
    await choose(0);
    await move(0,1,2);
    await page.locator('#winOverlay').waitFor({state:'visible'});
    assert.match(await page.locator('#toast').textContent(),/storage unavailable/);
    assert.deepEqual(errors,[]);
    console.log(`Browser checks passed: ${playthroughs.length} classic and ${playthroughs.length} limited playthroughs, sounds, budgets, lights, drag, undo, storage, focus and layouts.`);
  } finally {
    await browser?.close();
    await new Promise(resolve=>server.close(resolve));
  }
})().catch(error=>{console.error(error);process.exitCode=1});
