import React, {useEffect,useRef,useState} from 'react';

export default function AchievementAnnouncer({queue,onDismiss}) {
  const [visible,setVisible]=useState(!document.hidden),dismiss=useRef(onDismiss);dismiss.current=onDismiss;
  const current=queue[0];
  useEffect(()=>{
    const visibility=()=>setVisible(!document.hidden);
    document.addEventListener('visibilitychange',visibility);
    return ()=>{
      document.removeEventListener('visibilitychange',visibility);
    };
  },[]);
  useEffect(()=>{
    if(!current || !visible)return;
    const timer=setTimeout(()=>dismiss.current(),5000);
    return ()=>clearTimeout(timer);
  },[current,visible]);
  return <div className="achievement-announcer" role="status" aria-live="polite" aria-atomic="true">
    {visible && current && <div className="achievement-notice" key={current.id} data-achievement={current.id}>
      <span className="achievement-notice-mark" aria-hidden="true">{current.mark}</span>
      <div className="achievement-notice-copy"><span className="achievement-notice-label">Achievement unlocked</span>
        <strong>{current.name}</strong><span className="achievement-notice-detail">{current.reward ? current.reward+' unlocked' : 'Added to your collection'}</span></div>
      <span className="achievement-notice-spark" aria-hidden="true">✦</span>
    </div>}
  </div>;
}
