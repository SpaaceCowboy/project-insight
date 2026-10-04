async function dismissMenus(page) {
  for(let i=0;i<6 && await page.locator('.overlay.open').count();i++)await page.keyboard.press('Escape');
}
async function home(page) {
  if(await page.locator('#menuOverlay').isVisible())return;
  await dismissMenus(page);await page.locator('#menuBtn').click();await page.locator('#homeBtn').click();
}
async function play(page) {
  if(await page.locator('#settingsOverlay').isVisible())await page.locator('#closeSettings').click();
  if(await page.locator('#menuOverlay').isVisible())await page.locator('#playBtn').click();
  else if(await page.locator('#pauseOverlay').isVisible())await page.locator('#resumeBtn').click();
  else await dismissMenus(page);
}
async function settings(page,tab='play') {
  if(!await page.locator('#settingsOverlay').isVisible()) {
    if(await page.locator('#menuOverlay').isVisible())await page.locator('#homeSettingsBtn').click();
    else {
      if(!await page.locator('#pauseOverlay').isVisible()){await dismissMenus(page);await page.locator('#menuBtn').click()}
      await page.locator('#pauseSettingsBtn').click();
    }
  }
  await page.locator('#settingsTab-'+tab).click();
}
async function settingClick(page,id) {
  await settings(page,id==='themeBtn'?'appearance':'play');await page.locator('#'+id).click();
  if(id==='limitsBtn')await dismissMenus(page);
  if(id==='devModeBtn')await home(page);
}
async function collection(page) {
  if(await page.locator('#settingsOverlay').isVisible())await page.locator('#closeSettings').click();
  if(await page.locator('#menuOverlay').isVisible())await page.locator('#achievementsBtn').click();
  else if(await page.locator('#pauseOverlay').isVisible())await page.locator('#pauseAchievementsBtn').click();
  else {await home(page);await page.locator('#achievementsBtn').click()}
}
module.exports={dismissMenus,home,play,settings,settingClick,collection};
