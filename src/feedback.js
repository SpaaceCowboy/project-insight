import {renderView} from './view-store.js';

export function createFeedback({open,close}) {
  let pending=null,timer=null,disposed=false,stickyNotice=null;
  renderView('notice',{message:''});
  function cancel() {const resolve=pending;pending=null;resolve?.(false)}
  function finish(answer) {const resolve=pending;pending=null;close();resolve?.(answer)}
  return {
    confirm({title,message,accept='Continue',danger=false}) {
      if(disposed || pending)return Promise.resolve(false);
      return new Promise(resolve=>{
        pending=resolve;
        renderView('confirmation',{title,message,accept,danger,onCancel:()=>finish(false),onAccept:()=>finish(true)});
        open();
      });
    },
    notify(message,{tone='info',title='',duration=6000}={}) {
      if(disposed)return;
      const notice={message,tone,title};
      if(!duration)stickyNotice=notice;
      clearTimeout(timer);renderView('notice',notice);
      if(duration)timer=setTimeout(()=>renderView('notice',stickyNotice || {message:''}),duration);
    },
    cancel,
    dispose(){disposed=true;cancel();clearTimeout(timer)}
  };
}
