// Lossless Ogg Opus volume change: sets the "output gain" in the OpusHead packet (Q7.8 dB) and fixes the Ogg page checksum. Players apply it when decoding
// (Android's Opus decoder does). Usage as a module: setOutputGain(buffer, dB) -> Buffer; as a script: node tools/opusgain.mjs in.ogg out.ogg dB
import { readFileSync, writeFileSync } from 'node:fs';

const TABLE = (() => { const t = new Uint32Array(256); for (let i = 0; i < 256; i++) { let r = i << 24; for (let j = 0; j < 8; j++) r = (r & 0x80000000 ? (r << 1) ^ 0x04c11db7 : r << 1) >>> 0; t[i] = r >>> 0; } return t; })();
/** The Ogg page checksum: CRC-32 with polynomial 0x04c11db7, no reflection, zero start, over the page with its checksum field zeroed. */
function oggCrc(page) { let crc = 0; for (const byte of page) crc = ((crc << 8) ^ TABLE[((crc >>> 24) ^ byte) & 255]) >>> 0; return crc >>> 0; }

export function setOutputGain(buffer, dB) {
  const out = Buffer.from(buffer);
  if (out.subarray(0, 4).toString() !== 'OggS') throw new Error('not an Ogg file');
  const segments = out[26], size = out.subarray(27, 27 + segments).reduce((a, b) => a + b, 0), pageLength = 27 + segments + size;
  const head = out.indexOf('OpusHead');
  if (head < 0 || head > pageLength) throw new Error('first page has no OpusHead');
  out.writeInt16LE(Math.round(dB * 256), head + 16);
  out.writeUInt32LE(0, 22);
  out.writeUInt32LE(oggCrc(out.subarray(0, pageLength)), 22);
  return out;
}

if (process.argv[1]?.endsWith('opusgain.mjs') && process.argv.length >= 5) writeFileSync(process.argv[3], setOutputGain(readFileSync(process.argv[2]), Number(process.argv[4])));
