async function dismissMenus(page) {
  for(let i=0;i<6 && await page.locator('.overlay.open').count();i++)await page.keyboard.press('Escape');
}
async function play(page) {
  if(await page.locator('#settingsOverlay').isVisible())await page.locator('#closeSettings').click();
  if(await page.locator('#pauseOverlay').isVisible())await page.locator('#resumeBtn').click();
  else await dismissMenus(page);
}
// The move counter is no longer shown; the saved playtest attempt holds the move path.
function movesIs(page,count,key='insight-editor-session-v2') {
  return page.waitForFunction(([count,key])=>(JSON.parse(localStorage.getItem(key))?.path.length ?? 0)===count,[count,key]);
}
module.exports={dismissMenus,play,movesIs};
