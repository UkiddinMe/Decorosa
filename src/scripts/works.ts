// "MY": a finite lateral run of artifact cards that swell as they cross the
// middle of the screen, ending on two cards that leave the section. Cards hand their
// media over to the detail page on click. Lifecycle-safe for View-Transition navigation.
import { prefersReduced } from './motion';
import { wheelToHorizontal, onScrollFrame, writeCentreProximity } from './hscroll';

/** the media element carries this name into the detail page's hero (see ArtifactPage) */
const HERO = 'artifact-hero';

let cleanup: Array<() => void> = [];

function init(): void {
  const viewport = document.querySelector<HTMLElement>('[data-works]');
  if (!viewport) return;

  // The clicked card is the one that morphs into the detail page's hero.
  const onClick = (event: MouseEvent): void => {
    const card = (event.target as HTMLElement).closest<HTMLElement>('[data-artifact]');
    const hero = card?.querySelector<HTMLElement>('[data-hero]');
    if (hero) hero.style.viewTransitionName = HERO;
  };
  viewport.addEventListener('click', onClick);
  cleanup.push(() => viewport.removeEventListener('click', onClick));

  cleanup.push(wheelToHorizontal(viewport));

  // Reduced motion keeps the plain, natively-scrollable row (the swell is off in CSS).
  if (prefersReduced()) return;

  const cards = Array.from(viewport.querySelectorAll<HTMLElement>('[data-card]'));
  cleanup.push(onScrollFrame(viewport, () => writeCentreProximity(cards)));
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
