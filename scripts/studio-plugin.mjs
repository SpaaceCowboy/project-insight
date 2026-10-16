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
async function addLevel(input) {
  // Never trust client-supplied par/proof: validate strictly, then solve here.
  const spec=PuzzleRules.validate(input),solved=PuzzleSolver.solve(spec,{maxStates:350000,timeout:8000});
  PuzzleSolver.verify(spec,solved);
  const studio=await readList(LEVELS_FILE,'STUDIO_LEVELS'),routes=await readList(SOLUTIONS_FILE,'LEVEL_SOLUTIONS');
  if(studio.length!==routes.length)throw Object.assign(new Error('levels-3.js and level-solutions-3.js are out of sync. Run check-levels --game 3 --update.'),{status:500});
  const key=boardKey(spec),all=[...CORE_LEVELS,...GAME2_LEVELS,...studio],existing=all.findIndex(level=>boardKey(level)===key);
  if(existing>=0)throw Object.assign(new Error('Already in the game as level '+(existing+1)+'.'),{status:409});
  studio.push({name:spec.name,start:spec.start,target:spec.target,revision:1,par:solved.distance});routes.push(solved.path);
  await writeAtomic(LEVELS_FILE,'// Studio levels, appended to the campaign by the editor\'s Add to game button (scripts/studio-plugin.mjs).\nexport const STUDIO_LEVELS = '+JSON.stringify(studio,null,2)+';\n');
  await writeAtomic(SOLUTIONS_FILE,'// Generated optimal routes.\nexport const LEVEL_SOLUTIONS = '+JSON.stringify(routes)+';\n');
  const level=all.length+1;
  return {level,world:Math.floor((level-1)/WORLD_SIZE)+1,par:solved.distance,android:await exportAndroid()};
}

export default function studioPlugin() {
  let queue=Promise.resolve(); // ponytail: one write at a time; fine for a single developer
  return {
    name:'insight-studio',apply:'serve',
    config:()=>({server:{watch:{ignored:['**/src/data/levels-3.js','**/src/data/level-solutions-3.js']}}}),
    configureServer(server) {
      server.middlewares.use('/__studio/add-level',(req,res)=>{
        const send=(status,payload)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(payload))};
        const host=req.headers.host || '';
        if(req.method!=='POST')return send(405,{error:'POST only.'});
        // Blocks other websites (and DNS rebinding) from writing to the project through localhost.
        if(!LOOPBACK.test(host) || req.headers.origin!=='http://'+host)return send(403,{error:'Forbidden origin.'});
        if(!String(req.headers['content-type'] || '').startsWith('application/json'))return send(415,{error:'Body must be JSON.'});
        queue=queue.then(async()=>{
          try{send(200,await addLevel(await body(req)))}
          catch(error){console.error('[studio] add-level:',error.message);send(error.status || 422,{error:error.message})}
        });
      });
    }
  };
}
