import React from 'react';
import {Dialog} from './react-ui.jsx';

export default function FeedbackUI({dialogs,feedback}) {
  const {confirmation,notice}=feedback;
  return <>
    <Dialog dialogs={dialogs} id="confirmationOverlay" className="confirmation-overlay" role="alertdialog" aria-modal="true" aria-labelledby="confirmationTitle" aria-describedby="confirmationMessage">
      <div className="modal confirmation-card">{confirmation && <>
        <div className={'confirmation-mark'+(confirmation.danger?' destructive':'')} aria-hidden="true">{confirmation.danger?'!':'?'}</div>
        <h2 id="confirmationTitle">{confirmation.title}</h2><p id="confirmationMessage">{confirmation.message}</p>
        <div className="confirmation-actions"><button className="control-btn" id="confirmCancel" onClick={()=>feedback.finish(false)}>Cancel</button>
          <button className={'control-btn '+(confirmation.danger?'danger-btn':'primary')} id="confirmAccept" onClick={()=>feedback.finish(true)}>{confirmation.accept}</button></div>
      </>}</div>
    </Dialog>
    <div className="notice-region" id="toast" role="status" aria-live="polite" aria-atomic="true">{notice && <div className={'system-notice notice-'+notice.tone}>
      <span className="notice-mark" aria-hidden="true">{notice.tone==='success'?'✓':notice.tone==='error'||notice.tone==='warning'?'!':'i'}</span>
      <div>{notice.title && <strong>{notice.title}</strong>}<p>{notice.message}</p></div>
    </div>}</div>
  </>;
}
