// "MY" carousel: an endless lateral loop of artifact cards that swell as they cross the
// middle of the screen, and hand their card over to the detail page on click.
// Lifecycle-safe for View-Transition navigation.
import { prefersReduced } from './motion';
import { wheelToHorizontal, onScrollFrame, writeCentreProximity } from './hscroll';

// The rendered set is cloned to this many copies; scrollLeft is then kept inside the
// middle copy's span, so there is always ≥ 2 sets of runway on the side being scrolled
// toward (holds for any viewport up to twice a set's width).
const COPIES = 5;
/** the media element carries this name into the detail page's hero (see ArtifactPage) */
const HERO = 'artifact-hero';

let cleanup: Array<() => void> = [];

function cloneSets(track: HTMLElement, set: HTMLElement): void {
  for (let i = 1; i < COPIES; i++) {
    const clone = set.cloneNode(true) as HTMLElement;
    clone.dataset.clone = '';
    clone.setAttribute('aria-hidden', 'true');
    clone.querySelectorAll('a').forEach((a) => (a.tabIndex = -1));
    track.appendChild(clone);
  }
}

function init(): void {
  const viewport = document.querySelector<HTMLElement>('[data-works]');
  const track = document.querySelector<HTMLElement>('[data-works-track]');
  const set = document.querySelector<HTMLElement>('[data-works-set]');
  if (!viewport || !track || !set) return;

  // The clicked card is the one that morphs into the detail page's hero. Naming it only
  // at click time keeps the loop clones (identical markup) from colliding over the name.
  const onClick = (event: MouseEvent): void => {
    const card = (event.target as HTMLElement).closest<HTMLElement>('[data-artifact]');
    const hero = card?.querySelector<HTMLElement>('[data-hero]');
    if (hero) hero.style.viewTransitionName = HERO;
  };
  viewport.addEventListener('click', onClick);
  cleanup.push(() => viewport.removeEventListener('click', onClick));

  // Reduced motion keeps a plain, finite, natively-scrollable row.
  if (prefersReduced()) return;

  cloneSets(track, set);
  cleanup.push(() => track.querySelectorAll('[data-clone]').forEach((n) => n.remove()));

  const cards = Array.from(viewport.querySelectorAll<HTMLElement>('[data-artifact]'));
  const period = (): number => set.offsetWidth;
  viewport.scrollLeft = period() * 2;

  // A teleport moves the whole strip by one set, so every card inherits the proximity of
  // its neighbour a set away — a discontinuity the CSS would otherwise ease into over
  // 0.3s, reading as the carousel re-entering. Rewrite the swell with transitions off.
  const teleport = (to: number): void => {
    viewport.classList.add('is-jumping');
    viewport.scrollLeft = to;
    writeCentreProximity(cards);
    void viewport.offsetWidth; // flush the untransitioned scales before re-enabling
    viewport.classList.remove('is-jumping');
  };

  cleanup.push(wheelToHorizontal(viewport));
  cleanup.push(
    onScrollFrame(viewport, () => {
      // Teleport back by whole sets whenever we leave the middle copy — the strip is
      // identical every `period` px, so the jump is invisible. Only ever jump to a
      // position that really exists, so a clamped write can't bounce us frame after frame.
      const p = period();
      const max = viewport.scrollWidth - viewport.clientWidth;
      const x = viewport.scrollLeft;
      if (x >= p * 3 && x - p >= 0) teleport(x - p);
      else if (x < p * 2 && x + p <= max) teleport(x + p);
      else writeCentreProximity(cards);
    }),
  );
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
