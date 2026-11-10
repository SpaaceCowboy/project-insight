import {CHECKOUT_PROVIDER} from '../config.js';
import {stub} from './stub.js';

// To add a real provider, write an adapter with the stub's shape and register it here:
//   live: boolean, simulated: boolean,
//   startCheckout({email}) -> {status: 'paid' | 'failed' | 'cancelled' | 'unavailable', message?}
//   getStatus({email}) -> {owned: boolean}
// The adapter must only report 'paid' once the server has confirmed the payment.
const PROVIDERS = {stub};

export const checkout = PROVIDERS[CHECKOUT_PROVIDER] ?? stub;
