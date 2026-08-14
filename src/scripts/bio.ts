// "I AM" timeline: sideways scrolling plus the centre-proximity swell on each photo
// (the CSS reads `--near`). Lifecycle-safe for View-Transition navigation.
import { prefersReduced } from './motion';
import { wheelToHorizontal, onScrollFrame, writeCentreProximity } from './hscroll';

let cleanup: Array<() => void> = [];

function init(): void {
  const viewport = document.querySelector<HTMLElement>('[data-bio]');
  if (!viewport || prefersReduced()) return;

  const events = Array.from(document.querySelectorAll<HTMLElement>('[data-bio-event]'));
  cleanup.push(wheelToHorizontal(viewport));
  cleanup.push(onScrollFrame(viewport, () => writeCentreProximity(events)));
}

function teardown(): void {
  for (const off of cleanup) off();
  cleanup = [];
}

document.addEventListener('astro:page-load', init);
document.addEventListener('astro:before-swap', teardown);

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    teardown();
    document.removeEventListener('astro:page-load', init);
    document.removeEventListener('astro:before-swap', teardown);
  });
}
