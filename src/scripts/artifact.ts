// Artifact detail page: the world develops to the right — vertical wheel becomes
// horizontal scroll and every [data-depth] layer drifts at its own rate.
// Lifecycle-safe for View-Transition navigation.
import { prefersReduced } from './motion';
import { wheelToHorizontal, onScrollFrame, applyDepthParallax } from './hscroll';

let cleanup: Array<() => void> = [];

function init(): void {
  const viewport = document.querySelector<HTMLElement>('[data-artifact]');
  if (!viewport) return;

  cleanup.push(wheelToHorizontal(viewport));
  if (!prefersReduced()) {
    cleanup.push(onScrollFrame(viewport, () => applyDepthParallax(viewport)));
  }
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
