// Dev-server endpoint behind the editor's "Add to game" button: verifies a puzzle, appends it to the
// studio levels (src/data/levels-3.js) and refreshes the Android project's assets.
import {readFile,writeFile,rename} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {resolve} from 'node:path';
import {PuzzleRules} from '../src/puzzle-rules.js';
import {PuzzleSolver} from '../src/puzzle-solver.js';
import {CORE_LEVELS} from '../src/data/levels.js';
import {GAME2_LEVELS} from '../src/data/levels-2.js';

const LEVELS_FILE=resolve('src/data/levels-3.js'),SOLUTIONS_FILE=resolve('src/data/level-solutions-3.js');
const ANDROID_EXPORT=resolve('..','project-insight-android','tools','export-assets.mjs');
const WORLD_SIZE=20,MAX_BODY=256*1024,LOOPBACK=/^(127\.0\.0\.1|localhost)(:\d+)?$/;

const boardKey=level=>{const spec=PuzzleRules.validate(level,false);return JSON.stringify([spec.start,spec.target])};
async function readList(file,name){
  const text=await readFile(file,'utf8'),match=text.match(new RegExp('export const '+name+' = ([\\s\\S]*?);\\s*$'));
  if(!match)throw new Error('Cannot parse '+file);
  return JSON.parse(match[1]);
}
async function writeAtomic(file,text){await writeFile(file+'.tmp',text);await rename(file+'.tmp',file)}
function body(req){
  return new Promise((done,fail)=>{
    let size=0;const chunks=[];
    req.on('data',chunk=>{size+=chunk.length;if(size>MAX_BODY){fail(Object.assign(new Error('Puzzle too large.'),{status:413}));req.destroy()}else chunks.push(chunk)});
    req.on('end',()=>{try{done(JSON.parse(Buffer.concat(chunks).toString('utf8')))}catch{fail(Object.assign(new Error('Body must be JSON.'),{status:400}))}});
    req.on('error',fail);
  });
}
function exportAndroid(){
  return new Promise(done=>execFile(process.execPath,[ANDROID_EXPORT,resolve('.')],{timeout:30000},(error,stdout,stderr)=>done(error?'failed: '+(stderr || error.message).trim().split('\n').pop():'exported')));
}
async function writeStudio(studio,routes) {
  await writeAtomic(LEVELS_FILE,'// Studio levels, appended to the campaign by the editor\'s Add to game button (scripts/studio-plugin.mjs).\nexport const STUDIO_LEVELS = '+JSON.stringify(studio,null,2)+';\n');
  await writeAtomic(SOLUTIONS_FILE,'// Generated optimal routes.\nexport const LEVEL_SOLUTIONS = '+JSON.stringify(routes)+';\n');
}
async function addLevel(input) {
  // Never trust client-supplied par/proof: validate strictly, then solve here.
  const spec=PuzzleRules.validate(input),solved=PuzzleSolver.solve(spec,{maxStates:350000,timeout:8000});
  PuzzleSolver.verify(spec,solved);
  const studio=await readList(LEVELS_FILE,'STUDIO_LEVELS'),routes=await readList(SOLUTIONS_FILE,'LEVEL_SOLUTIONS');
  if(studio.length!==routes.length)throw Object.assign(new Error('levels-3.js and level-solutions-3.js are out of sync. Run check-levels --game 3 --update.'),{status:500});
  const key=boardKey(spec),all=[...CORE_LEVELS,...GAME2_LEVELS,...studio],existing=all.findIndex(level=>boardKey(level)===key);
  if(existing>=0)throw Object.assign(new Error('Already in the game as level '+(existing+1)+'.'),{status:409});
  studio.push({name:spec.name,start:spec.start,target:spec.target,revision:1,par:solved.distance});routes.push(solved.path);
  await writeStudio(studio,routes);
  const level=all.length+1;
  return {level,world:Math.floor((level-1)/WORLD_SIZE)+1,par:solved.distance,android:await exportAndroid()};
}

async function removeLast(level) {
  const studio=await readList(LEVELS_FILE,'STUDIO_LEVELS'),routes=await readList(SOLUTIONS_FILE,'LEVEL_SOLUTIONS');
  if(studio.length!==routes.length)throw Object.assign(new Error('levels-3.js and level-solutions-3.js are out of sync. Run check-levels --game 3 --update.'),{status:500});
  const last=CORE_LEVELS.length+GAME2_LEVELS.length+studio.length;
  if(!studio.length)throw Object.assign(new Error('No studio levels to remove.'),{status:409});
  // Only the newest level can go: removing an earlier one would renumber the rest and break saved progress.
  if(level!==last)throw Object.assign(new Error('Only the newest studio level (level '+last+') can be removed. The list changed; reload the studio.'),{status:409});
  const [removed]=studio.splice(-1);routes.pop();
  await writeStudio(studio,routes);
  return {removed:removed.name,level,android:await exportAndroid()};
}
async function listStudio() {
  const studio=await readList(LEVELS_FILE,'STUDIO_LEVELS'),offset=CORE_LEVELS.length+GAME2_LEVELS.length;
  return {levels:studio.map((item,i)=>({level:offset+i+1,name:item.name}))};
}

export default function studioPlugin() {
  let queue=Promise.resolve(); // ponytail: one write at a time; fine for a single developer
  return {
    name:'insight-studio',apply:'serve',
    config:()=>({server:{watch:{ignored:['**/src/data/levels-3.js','**/src/data/level-solutions-3.js']}}}),
    configureServer(server) {
      server.middlewares.use('/__studio',(req,res)=>{
        const send=(status,payload)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(payload))};
        const host=req.headers.host || '',route=(req.url || '').split('?')[0];
        // Blocks other websites (and DNS rebinding) from reading or writing the project through localhost.
        if(!LOOPBACK.test(host))return send(403,{error:'Forbidden host.'});
        if(req.method==='GET' && route==='/levels')return queue=queue.then(async()=>{try{send(200,await listStudio())}catch(error){send(500,{error:error.message})}});
        if(req.method!=='POST' || !['/add-level','/remove-last'].includes(route))return send(405,{error:'Unsupported request.'});
        if(req.headers.origin!=='http://'+host)return send(403,{error:'Forbidden origin.'});
        if(!String(req.headers['content-type'] || '').startsWith('application/json'))return send(415,{error:'Body must be JSON.'});
        queue=queue.then(async()=>{
          try{
            const input=await body(req);
            send(200,route==='/add-level'?await addLevel(input):await removeLast(input?.level));
          }catch(error){console.error('[studio] '+route+':',error.message);send(error.status || 422,{error:error.message})}
        });
      });
    }
  };
}
