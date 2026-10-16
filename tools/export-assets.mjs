// Copies game data and sounds from the web project (read-only) into the Android app.
// Usage: node tools/export-assets.mjs [path-to-web-project]   (default: ../project-insight)
import {mkdirSync,writeFileSync,copyFileSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const web=resolve(process.argv[2] || join(root,'..','project-insight'));
const load=file=>import(pathToFileURL(join(web,file)).href);

const {CAMPAIGN_LEVELS,CAMPAIGN_SOLUTIONS:solutions}=await load('src/data/campaign.js');
if(solutions.length!==CAMPAIGN_LEVELS.length)throw new Error(`Expected ${CAMPAIGN_LEVELS.length} solutions, found ${solutions.length}`);

const levels=CAMPAIGN_LEVELS.map(({name,start,target,world,par})=>({name,start,target,world,par}));
mkdirSync(join(root,'app/src/main/assets'),{recursive:true});
writeFileSync(join(root,'app/src/main/assets/levels.json'),JSON.stringify(levels)+'\n');
// Unit tests replay these optimal routes through the Kotlin rules.
mkdirSync(join(root,'app/src/test/resources'),{recursive:true});
writeFileSync(join(root,'app/src/test/resources/solutions.json'),JSON.stringify(solutions)+'\n');

const raw=join(root,'app/src/main/res/raw');
mkdirSync(raw,{recursive:true});
for(const name of ['ambient','deny','move','select','voice','win'])copyFileSync(join(web,'public/sounds',name+'.wav'),join(raw,'sfx_'+name+'.wav'));

// Tile notes: the web game synthesises these with WebAudio (src/sound.js); render the same envelope to WAV.
const NOTES={r:261.63,b:293.66,g:329.63,y:392,p:440,w:523.25},RATE=44100;
function note(frequency,peak,decay) {
  const length=Math.round(RATE*.7),data=Buffer.alloc(44+length*2);
  for(let i=0;i<length;i++) {
    const t=i/RATE;
    const envelope=t<.012?t/.012:Math.max(0,Math.pow(.0001/1,(t-.012)/(decay-.012)));
    const value=Math.sin(2*Math.PI*frequency*t)+.12*Math.sin(4*Math.PI*frequency*t);
    data.writeInt16LE(Math.round(Math.max(-1,Math.min(1,value*peak*envelope))*32767),44+i*2);
  }
  data.write('RIFF',0);data.writeUInt32LE(36+length*2,4);data.write('WAVE',8);data.write('fmt ',12);
  data.writeUInt32LE(16,16);data.writeUInt16LE(1,20);data.writeUInt16LE(1,22);data.writeUInt32LE(RATE,24);
  data.writeUInt32LE(RATE*2,28);data.writeUInt16LE(2,32);data.writeUInt16LE(16,34);data.write('data',36);data.writeUInt32LE(length*2,40);
  return data;
}
for(const [type,frequency] of Object.entries(NOTES)) {
  writeFileSync(join(raw,`note_select_${type}.wav`),note(frequency,.035,.18));
  writeFileSync(join(raw,`note_move_${type}.wav`),note(frequency,.12,.65));
}
console.log(`Exported ${levels.length} levels, ${solutions.length} solutions, sounds from ${web}`);
