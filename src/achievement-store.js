import {CORE_LEVELS} from './data.js';
import {createAchievements} from './achievements.mjs';

let storageUnavailable=false;
const storage={
  getItem:key=>localStorage.getItem(key),
  setItem:(key,value)=>localStorage.setItem(key,value)
};
export const achievements=createAchievements({levels:CORE_LEVELS,storage,progressKeys:['insight-campaign-r3'],onStorageError:()=>{
  storageUnavailable=true;
  window.dispatchEvent(new Event('insight-storage-warning'));
}});
export function hasAchievementStorageWarning() {return storageUnavailable}
