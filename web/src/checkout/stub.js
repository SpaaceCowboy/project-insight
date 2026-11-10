// Stand-in until a real payment provider is chosen. It never takes money.
// In development it plays out the flow so the sheet can be exercised: an email starting with
// "fail" is declined, anything else is "paid". In a production build it reports itself closed.
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

export const stub = {
  id: 'stub',
  /** True only for adapters that really charge. */
  live: false,
  /** True when the flow is a rehearsal and the sheet must say so. */
  simulated: import.meta.env.DEV,
  async startCheckout({email}) {
    if (!import.meta.env.DEV) return {status: 'unavailable'};
    await wait(900);
    if (/^fail/i.test(email)) return {status: 'failed', message: 'The test payment was declined.'};
    return {status: 'paid', email};
  },
  async getStatus() {
    return {owned: false};
  },
};
