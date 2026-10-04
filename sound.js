export function initAudio() {
const events=new AbortController();
const listen=(target,type,callback)=>target.addEventListener(type,callback,{signal:events.signal});
// Original forest ambience; the sparse voice cue contains no instructions.
const ambientSound = new Audio('sounds/ambient.wav');
ambientSound.loop = true;
const voiceSound = new Audio('sounds/voice.wav');
const soundEffects = Object.fromEntries(['select','move','deny','win'].map(name => [name,new Audio(`sounds/${name}.wav`)]));
let lastVoiceTime = -Infinity;
let audioEnabled = false;
let masterVolume = .8;
let ambienceVolume=.8, voiceEnabled=true, muted=false, volumeFrame=null, silenceTimer=null;
const TILE_NOTES = {R:261.63,B:293.66,G:329.63,Y:392,P:440,W:523.25};
let noteContext = null, noteGain = null;
const ringingNotes = new Set();
try {
  const saved=localStorage.getItem('insight-volume-v1');
  if(saved!==null && Number.isFinite(+saved)) masterVolume=Math.max(0,Math.min(1,+saved));
  const ambience=localStorage.getItem('insight-ambience-volume-v1');
  ambienceVolume=ambience!==null && Number.isFinite(+ambience) ? Math.max(0,Math.min(1,+ambience)) : masterVolume;
  voiceEnabled=localStorage.getItem('insight-voice-v1')!=='off';
} catch {}
function applyVolumes(immediate=false) {
  cancelAnimationFrame(volumeFrame);
  const targets=[[ambientSound,muted ? 0 : .7*ambienceVolume],[voiceSound,muted || !voiceEnabled ? 0 : .5*masterVolume],
    ...Object.entries(soundEffects).map(([name,sound])=>[sound,muted ? 0 : (name==='deny' ? .6 : .9)*masterVolume])];
  if (noteGain) {
    noteGain.gain.cancelScheduledValues(noteContext.currentTime);
    noteGain.gain.setTargetAtTime(muted ? 0 : masterVolume,noteContext.currentTime,.025);
  }
  if (immediate || document.hidden) { for(const [sound,value] of targets)sound.volume=value; return; }
  const start=performance.now(), from=targets.map(([sound])=>sound.volume);
  function fade(now) {
    const amount=Math.max(0,Math.min(1,(now-start)/120));
    targets.forEach(([sound,value],i)=>{sound.volume=amount===1 ? value : from[i]+(value-from[i])*amount;});
    volumeFrame=amount<1 ? requestAnimationFrame(fade) : null;
  }
  volumeFrame=requestAnimationFrame(fade);
}
function setVolume(value) {
  if (!Number.isFinite(value)) return;
  masterVolume=Math.max(0,Math.min(1,value));
  applyVolumes();
  document.getElementById('volumeSlider').value=Math.round(masterVolume*100);
  document.getElementById('volumeValue').value=Math.round(masterVolume*100)+'%';
}
function setAmbienceVolume(value) {
  if (!Number.isFinite(value)) return;
  ambienceVolume=Math.max(0,Math.min(1,value));
  applyVolumes();
  document.getElementById('ambienceSlider').value=Math.round(ambienceVolume*100);
  document.getElementById('ambienceValue').value=Math.round(ambienceVolume*100)+'%';
}
setVolume(masterVolume); setAmbienceVolume(ambienceVolume); applyVolumes(true);
document.getElementById('voiceToggle').checked=voiceEnabled;
listen(document.getElementById('volumeSlider'),'input',event=>{
  setVolume(+event.target.value/100);
  try {localStorage.setItem('insight-volume-v1',String(masterVolume));} catch {window.dispatchEvent(new Event('insight-storage-warning'))}
});
listen(document.getElementById('ambienceSlider'),'input',event=>{
  setAmbienceVolume(+event.target.value/100);
  try {localStorage.setItem('insight-ambience-volume-v1',String(ambienceVolume));} catch {window.dispatchEvent(new Event('insight-storage-warning'))}
});
listen(document.getElementById('voiceToggle'),'change',event=>{
  voiceEnabled=event.target.checked;
  if (!voiceEnabled) voiceSound.pause();
  applyVolumes();
  try {localStorage.setItem('insight-voice-v1',voiceEnabled ? 'on' : 'off');} catch {window.dispatchEvent(new Event('insight-storage-warning'))}
});

// A pentatonic palette lets every tile share the same gentle harmony.
function playTileNote(kind,type) {
  try {
    if (!noteContext) {
      noteContext = new (window.AudioContext || window.webkitAudioContext)();
      noteGain = noteContext.createGain();
      noteGain.gain.value = masterVolume;
      noteGain.connect(noteContext.destination);
    }
    if (noteContext.state==='closed') return false;
    noteContext.resume().catch(() => {});
    const frequency = TILE_NOTES[type] || TILE_NOTES.B;
    const time = noteContext.currentTime;
    const sequence = kind==='undo' ? [frequency,frequency*.75] : [frequency];
    for (const [i,note] of sequence.entries()) {
      const start = time+i*.09;
      for (const [harmonic,weight] of [[1,1],[2,.12]]) {
        const oscillator = noteContext.createOscillator();
        const envelope = noteContext.createGain();
        oscillator.frequency.value = note*harmonic;
        const peak = (kind==='select' ? .035 : .12)*weight;
        envelope.gain.setValueAtTime(0,start);
        envelope.gain.linearRampToValueAtTime(peak,start+.012);
        envelope.gain.exponentialRampToValueAtTime(.0001,start+(kind==='select' ? .18 : .65));
        oscillator.connect(envelope); envelope.connect(noteGain);
        ringingNotes.add(oscillator);
        oscillator.onended = () => { ringingNotes.delete(oscillator); oscillator.disconnect(); envelope.disconnect(); };
        oscillator.start(start); oscillator.stop(start+.7);
      }
    }
    return true;
  } catch { return false; }
}
function stopNotes() {
  for (const oscillator of ringingNotes) oscillator.stop();
  ringingNotes.clear();
  noteContext?.suspend().catch(() => {});
}
function playTone(kind,type) {
  clearTimeout(silenceTimer);
  if (!audioEnabled || muted) { muted=false; ambientSound.volume=0; applyVolumes(); }
  audioEnabled = true;
  if (document.hidden) return;
  ambientSound.play().catch(() => {});
  if (['select','move','undo'].includes(kind) && playTileNote(kind,type)) return;
  const sound = soundEffects[kind==='undo' ? 'move' : kind];
  if (!sound) return;
  sound.pause();
  sound.currentTime = 0;
  sound.play().catch(() => {});
  if (kind==='win' && voiceEnabled && Date.now()-lastVoiceTime>90000) {
    lastVoiceTime = Date.now();
    voiceSound.currentTime = 0;
    voiceSound.play().catch(() => {});
  }
}
function stopMusic() {
  audioEnabled = false;
  muted=true; applyVolumes();
  clearTimeout(silenceTimer);
  silenceTimer=setTimeout(()=>{
    for (const sound of [ambientSound,voiceSound,...Object.values(soundEffects)]) sound.pause();
    stopNotes();
  },140);
}
listen(document,'visibilitychange', () => {
  if (document.hidden) {
    clearTimeout(silenceTimer); applyVolumes(true);
    for (const sound of [ambientSound,voiceSound,...Object.values(soundEffects)]) sound.pause();
    stopNotes();
  } else if (audioEnabled) {
    ambientSound.volume=0; applyVolumes();
    ambientSound.play().catch(() => {});
  }
});

return {ambientSound,voiceSound,soundEffects,ringingNotes,playTone,stopMusic,stopNotes,
  get masterVolume(){return masterVolume},get ambienceVolume(){return ambienceVolume},get noteGain(){return noteGain},
  dispose(){events.abort();cancelAnimationFrame(volumeFrame);clearTimeout(silenceTimer);
    for(const sound of [ambientSound,voiceSound,...Object.values(soundEffects)])sound.pause();
    stopNotes();noteContext?.close().catch(()=>{});
  }
};
}
