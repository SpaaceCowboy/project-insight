import {useEffect,useRef,useState} from 'react';
import {initAudio} from './sound.js';
import {readPreference} from './game-state.js';

export default function useAudio(soundOn,onStorageError) {
  const engine=useRef(null),warning=useRef(onStorageError);warning.current=onStorageError;
  const [preferences,setPreferences]=useState(()=>{
    const effects=readPreference('insight-volume-v1'),ambience=readPreference('insight-ambience-volume-v1');
    const volume=value=>Math.max(0,Math.min(1,+value));
    const master=effects!==null && Number.isFinite(+effects)?volume(effects):.8;
    return {effects:master,ambience:ambience!==null && Number.isFinite(+ambience)?volume(ambience):master,voice:readPreference('insight-voice-v1')!=='off'};
  });
  useEffect(()=>{
    const audio=initAudio();engine.current=audio;window.InsightAudio=audio;
    return ()=>{audio.dispose();engine.current=null;if(window.InsightAudio===audio)delete window.InsightAudio};
  },[]);
  useEffect(()=>{
    engine.current?.setVolume(preferences.effects);engine.current?.setAmbienceVolume(preferences.ambience);engine.current?.setVoiceEnabled(preferences.voice);
  },[preferences]);
  useEffect(()=>{if(!soundOn)engine.current?.stopMusic()},[soundOn]);
  function change(kind,value){
    setPreferences(previous=>({...previous,[kind]:value}));
    try{localStorage.setItem({effects:'insight-volume-v1',ambience:'insight-ambience-volume-v1',voice:'insight-voice-v1'}[kind],kind==='voice'?(value?'on':'off'):String(value))}catch{warning.current()}
  }
  return {preferences,change,play:(kind,type,force=false)=>{if(soundOn || force)engine.current?.playTone(kind,type)}};
}
