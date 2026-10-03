const fs = require('node:fs');
const assert = require('node:assert/strict');
const rate = 22050;
fs.mkdirSync('sounds', {recursive:true});

function write(name, duration, sample) {
  const frames = Math.round(duration*rate);
  const wav = Buffer.alloc(44+frames*2);
  wav.write('RIFF'); wav.writeUInt32LE(wav.length-8,4); wav.write('WAVEfmt ',8);
  wav.writeUInt32LE(16,16); wav.writeUInt16LE(1,20); wav.writeUInt16LE(1,22);
  wav.writeUInt32LE(rate,24); wav.writeUInt32LE(rate*2,28);
  wav.writeUInt16LE(2,32); wav.writeUInt16LE(16,34);
  wav.write('data',36); wav.writeUInt32LE(frames*2,40);
  const samples=Float64Array.from({length:frames},(_,i)=>sample(i/rate));
  let peak=0;
  for(const value of samples) {
    assert(Number.isFinite(value), `${name}: finite audio`);
    peak=Math.max(peak,Math.abs(value));
  }
  assert(peak>.005, `${name}: audible signal`);
  const gain=(name==='ambient' ? .4 : .45)/peak;
  for (let i=0;i<frames;i++) {
    const value=samples[i]*gain;
    assert(Number.isFinite(value) && Math.abs(value)<1, `${name}: unclipped audio`);
    wav.writeInt16LE(Math.round(value*32767),44+i*2);
  }
  fs.writeFileSync(`sounds/${name}.wav`,wav);
  console.log(`${name}: ${duration}s, peak ${(peak*gain).toFixed(3)}`);
}
function bell(t, freq, decay) {
  if(t<0) return 0;
  const attack=1-Math.exp(-t*180);
  return attack*Math.exp(-t/decay)*(Math.sin(2*Math.PI*freq*t)+.18*Math.sin(2*Math.PI*freq*2*t));
}
write('select', .22, t=>.09*bell(t,523.25,.035));
write('move', .36, t=>.16*bell(t,392,.065)+.045*bell(t-.035,587.33,.08));
write('deny', .25, t=>.075*bell(t,196,.045));
write('win', 1.6, t=>[523.25,659.25,783.99].reduce((n,f,i)=>n+.1*bell(t-i*.12,f,.2),0));
const duration=32;
const chords=[[146.83,220,293.66,349.23,440],[116.54,233.08,293.66,349.23,523.25],[174.61,261.63,349.23,440,523.25],[130.81,196,293.66,392,523.25]];
// Integer cycles and periodic swells make the ambient file loop without a seam.
write('ambient', duration, t=>chords.reduce((sum,notes,index)=>{
  const weight=(1+Math.cos(2*Math.PI*t/duration-index*Math.PI/2))/2;
  return sum+weight*notes.reduce((n,f,i)=>n+.012/(1+i*.35)*Math.sin(2*Math.PI*Math.round(f*duration)*t/duration),0);
},0)+.003*bell((t+duration-7)%duration,Math.round(880*duration)/duration,.65)+.002*bell((t+duration-19)%duration,Math.round(1174.66*duration)/duration,.8));
