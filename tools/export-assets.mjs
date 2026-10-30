// Copies game data and sounds from the web project (read-only) into the Android app.
// Usage: node tools/export-assets.mjs [path-to-web-project]   (default: ../project-insight)
import {mkdirSync,writeFileSync,copyFileSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const web=resolve(process.argv[2] || join(root,'..','project-insight'));
const load=file=>import(pathToFileURL(join(web,file)).href);

const campaign=await load('src/data/campaign.js');
if(campaign.CAMPAIGN_SOLUTIONS.length!==campaign.CAMPAIGN_LEVELS.length)throw new Error(`Expected ${campaign.CAMPAIGN_LEVELS.length} solutions, found ${campaign.CAMPAIGN_SOLUTIONS.length}`);
// The Android campaign is exactly 200 levels; later web levels are not shipped.
const CAMPAIGN_SIZE=200;
const CAMPAIGN_LEVELS=campaign.CAMPAIGN_LEVELS.slice(0,CAMPAIGN_SIZE),solutions=campaign.CAMPAIGN_SOLUTIONS.slice(0,CAMPAIGN_SIZE);

const levels=CAMPAIGN_LEVELS.map(({name,start,target,world,par})=>({name,start,target,world,par}));
mkdirSync(join(root,'app/src/main/assets'),{recursive:true});
writeFileSync(join(root,'app/src/main/assets/levels.json'),JSON.stringify(levels)+'\n');
// Unit tests replay these optimal routes through the Kotlin rules.
mkdirSync(join(root,'app/src/test/resources'),{recursive:true});
writeFileSync(join(root,'app/src/test/resources/solutions.json'),JSON.stringify(solutions)+'\n');

const raw=join(root,'app/src/main/res/raw');
mkdirSync(raw,{recursive:true});
// Only the forest ambience comes from the web game. Interface cues are the uisfx "zen" pack (CC0), kept in res/raw (MP3) and res/raw-v29 (Ogg Opus); zen_drop and minimal_checkout come from tools/build-cues.mjs.
copyFileSync(join(web,'public/sounds/ambient.wav'),join(raw,'sfx_ambient.wav'));
console.log(`Exported ${levels.length} levels, ${solutions.length} solutions, sounds from ${web}`);
