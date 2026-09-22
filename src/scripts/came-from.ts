// Remembers the page each SPA navigation leaves, so the page it lands on can tell where
// the visitor came from (works.ts: back in front of the card they left through). Plain
// module state, not storage: a hard load starts with no history, as it should.
let from: string | null = null;

document.addEventListener('astro:before-swap', (event) => {
  from = event.from.pathname;
});

/** Path of the page the last SPA navigation left, without a trailing slash. */
export const cameFrom = (): string | null => from && from.replace(/\/$/, '');
