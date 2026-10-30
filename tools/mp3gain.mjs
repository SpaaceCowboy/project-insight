// Lossless MP3 volume change: adds [steps] to every granule's global_gain (each step is 2^(1/4) = +1.5 dB). Same bitstream size, no re-encoding.
// Only for the uisfx cues (MPEG-1 Layer III, no CRC). Usage as a module: shiftGain(buffer, steps) -> Buffer; as a script: node tools/mp3gain.mjs in.mp3 out.mp3 steps
import { readFileSync, writeFileSync } from 'node:fs';

const BITRATES = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
const RATES = [44100, 48000, 32000];

/** The global_gain of every granule/channel in the file, in order. With [steps] they are changed in the returned copy. */
export function gains(buffer, steps = 0) {
  const out = Buffer.from(buffer); const found = [];
  let at = out.subarray(0, 3).toString() === 'ID3' ? 10 + ((out[6] & 127) << 21 | (out[7] & 127) << 14 | (out[8] & 127) << 7 | (out[9] & 127)) : 0;
  while (at + 4 <= out.length) {
    if (out[at] !== 0xff || (out[at + 1] & 0xfe) !== 0xfa) { at++; continue; }        // MPEG-1 Layer III sync (bit 0 = protection: 1 = no CRC)
    if (!(out[at + 1] & 1)) throw new Error('frame with CRC: not supported');
    const bitrate = BITRATES[out[at + 2] >> 4] * 1000, rate = RATES[(out[at + 2] >> 2) & 3], pad = (out[at + 2] >> 1) & 1;
    const mono = (out[at + 3] >> 6) === 3, channels = mono ? 1 : 2;
    const length = Math.floor(144 * bitrate / rate) + pad;
    const side = at + 4, perGranule = 59 * channels, fixed = mono ? 18 : 20;           // bits before the first granule: main_data_begin, private bits, scfsi
    for (let gr = 0; gr < 2; gr++) for (let ch = 0; ch < channels; ch++) {
      const bit = fixed + (gr * channels + ch) * 59 + 21;                              // part2_3_length (12) + big_values (9) come first
      let value = 0;
      for (let i = 0; i < 8; i++) value = value << 1 | (out[side + ((bit + i) >> 3)] >> (7 - ((bit + i) & 7)) & 1);
      found.push(value);
      if (steps) {
        const next = Math.max(0, Math.min(255, value + steps));
        for (let i = 0; i < 8; i++) {
          const mask = 1 << (7 - ((bit + i) & 7)), byte = side + ((bit + i) >> 3);
          out[byte] = (next >> (7 - i) & 1) ? out[byte] | mask : out[byte] & ~mask;
        }
      }
    }
    at += length;
  }
  return steps ? out : found;
}
export const shiftGain = (buffer, steps) => gains(buffer, steps);

if (process.argv[1]?.endsWith('mp3gain.mjs') && process.argv.length >= 5) writeFileSync(process.argv[3], shiftGain(readFileSync(process.argv[2]), Number(process.argv[4])));
