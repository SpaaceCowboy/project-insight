import React, {useEffect,useState} from 'react';

export default function AchievementAnnouncer() {
  const [queue,setQueue]=useState([]),[visible,setVisible]=useState(!document.hidden);
  const current=queue[0];
  useEffect(()=>{
    const earned=event=>setQueue(items=>[...items,...event.detail]);
    const visibility=()=>setVisible(!document.hidden);
    window.addEventListener('insight-achievements-earned',earned);
    document.addEventListener('visibilitychange',visibility);
    return ()=>{
      window.removeEventListener('insight-achievements-earned',earned);
      document.removeEventListener('visibilitychange',visibility);
    };
  },[]);
  useEffect(()=>{
    if(!current || !visible)return;
    const timer=setTimeout(()=>setQueue(items=>items.slice(1)),5000);
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
