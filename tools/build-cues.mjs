// Adds the two cues that are not from the zen pack's original set, straight from the uisfx package (CC0, https://uisfx.com, npm uisfx@0.4.0):
//   zen/drop      -> res/raw/zen_drop.mp3          + res/raw-v29/zen_drop.ogg          (a tile landing)
//   minimal/checkout -> res/raw/minimal_checkout.mp3 + res/raw-v29/minimal_checkout.ogg (a puzzle solved)
// Both are stored +3 dB (2 MP3 gain steps; Opus output gain) so that Cue's play levels (70 % and 90 % of the other cues) fit under SoundPool's 1.0 ceiling.
//   mkdir /tmp/uisfx && cd /tmp/uisfx && npm pack uisfx@0.4.0 && tar xzf uisfx-0.4.0.tgz   then   node tools/build-cues.mjs /tmp/uisfx/package
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { shiftGain } from './mp3gain.mjs';
import { setOutputGain } from './opusgain.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pack = resolve(process.argv[2] ?? join(root, 'node_modules/uisfx'));
const MP3_STEPS = 2, OPUS_DB = MP3_STEPS * 1.5;   // one global_gain step is 2^(1/4) = 1.5 dB
const cues = [['zen', 'drop', 'zen_drop'], ['minimal', 'checkout', 'minimal_checkout']];
mkdirSync(join(root, 'app/src/main/res/raw'), { recursive: true }); mkdirSync(join(root, 'app/src/main/res/raw-v29'), { recursive: true });
for (const [set, name, file] of cues) {
  writeFileSync(join(root, `app/src/main/res/raw/${file}.mp3`), shiftGain(readFileSync(join(pack, 'sounds', set, `${name}.mp3`)), MP3_STEPS));
  writeFileSync(join(root, `app/src/main/res/raw-v29/${file}.ogg`), setOutputGain(readFileSync(join(pack, 'sounds', set, `${name}.ogg`)), OPUS_DB));
  console.log(`${set}/${name} -> ${file} (+${OPUS_DB} dB)`);
}
