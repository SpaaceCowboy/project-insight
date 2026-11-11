import {useEffect, useRef, useState} from 'react';
import {checkout} from '../checkout/provider.js';
import {SUPPORT_EMAIL, WORLDS_PRICE} from '../config.js';
import {WORLDS_INCLUDES} from './Modes.jsx';
import {Icon} from '../ui.jsx';

const open = checkout.live || checkout.simulated;

export default function CheckoutSheet({shown, onClose}) {
  const dialog = useRef(null);
  const [email, setEmail] = useState('');
  const [phase, setPhase] = useState('offer'); // offer | paying | paid | failed
  const [message, setMessage] = useState('');

  useEffect(() => {
    const node = dialog.current;
    if (shown && !node.open) { setPhase('offer'); setMessage(''); node.showModal(); }
    if (!shown && node.open) node.close();
  }, [shown]);

  async function pay(event) {
    event.preventDefault();
    setPhase('paying'); setMessage('');
    try {
      const result = await checkout.startCheckout({email: email.trim()});
      if (result.status === 'paid') setPhase('paid');
      else if (result.status === 'cancelled') setPhase('offer');
      else { setPhase('failed'); setMessage(result.message || 'The payment did not go through. You have not been charged.'); }
    } catch {
      setPhase('failed'); setMessage('Something went wrong before the payment started. You have not been charged.');
    }
  }

  return <dialog ref={dialog} className="sheet" aria-labelledby="sheet-title" onClose={onClose}
    onClick={event => { if (event.target === dialog.current) onClose(); }}>
    <div className="sheet-head">
      <h2 id="sheet-title">{phase === 'paid' ? 'Worlds is yours' : 'Unlock Worlds'}</h2>
      <button type="button" className="key icon" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
    </div>

    {phase === 'paid' ? <>
      <p>Sign in to Midori on your phone with <strong>{email.trim()}</strong> and Worlds will be open.</p>
      {checkout.simulated && <p className="notice">This was a test run. No payment was taken and nothing was unlocked.</p>}
      <button type="button" className="key primary" onClick={onClose}>Done</button>
    </> : <>
      <p>A one-time purchase to play community puzzles and publish your own boards. Journey stays free.</p>
      {WORLDS_PRICE ? <span className="price">{WORLDS_PRICE}</span> : <p className="notice">Price announced soon.</p>}
      <ul>{WORLDS_INCLUDES.map(text => <li key={text}><Icon name="check" /><span>{text}</span></li>)}</ul>

      {!open && <>
        <p className="notice">Checkout opens soon. Nothing can be bought on this page yet, and you will not be charged.</p>
        {SUPPORT_EMAIL && <a className="key primary" href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Tell me when Worlds opens')}`}>Email me when it opens</a>}
      </>}

      {open && <form onSubmit={pay}>
        {checkout.simulated && <p className="notice">Test mode: this build only rehearses the purchase. No money moves.</p>}
        {phase === 'failed' && <p className="notice bad" role="alert">{message}</p>}
        <label>Your Midori account email
          <input type="email" required autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" disabled={phase === 'paying'} />
        </label>
        <button type="submit" className="key primary" disabled={phase === 'paying'}>
          {phase === 'paying' ? 'Opening payment…' : phase === 'failed' ? 'Try again' : WORLDS_PRICE ? `Pay ${WORLDS_PRICE}` : 'Continue to payment'}
        </button>
      </form>}
      <p className="sheet-fine">One payment. No subscription. Tied to your account, not your device.</p>
    </>}
  </dialog>;
}
