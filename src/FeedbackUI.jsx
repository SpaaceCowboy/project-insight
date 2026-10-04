import React from 'react';
import {View} from './views.jsx';

export default function FeedbackUI() {
  return <>
    <div className="overlay confirmation-overlay" id="confirmationOverlay" role="alertdialog" aria-modal="true" aria-labelledby="confirmationTitle" aria-describedby="confirmationMessage" inert={true}>
      <div className="modal confirmation-card"><View name="confirmation" /></div>
    </div>
    <div className="notice-region" id="toast" role="status" aria-live="polite" aria-atomic="true"><View name="notice" /></div>
  </>;
}
