// "MY": a finite lateral run of artifact cards that swell as they cross the
// middle of the screen, ending on two cards that leave the section. Cards hand their
// media over to the detail page on click, and a visitor coming back from a card's page
// lands in front of that card. Lifecycle-safe for View-Transition navigation.
import { prefersReduced } from './motion';
import { cameFrom } from './came-from';
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

  // Back from a detail page (or the tiles page): centre the card that led there. Only
  // cards marked `data-return` — the back-to-showcase card leads *up*, and arriving from
  // the showcase should start the run at its beginning.
  const from = cameFrom();
  const back = Array.from(viewport.querySelectorAll<HTMLAnchorElement>('[data-return]')).find(
    (card) => new URL(card.href).pathname.replace(/\/$/, '') === from,
  );
  if (back) {
    const box = back.getBoundingClientRect();
    const view = viewport.getBoundingClientRect();
    viewport.scrollLeft += box.left + box.width / 2 - (view.left + view.width / 2);
  }

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
