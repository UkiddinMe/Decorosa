// Showcase spiral: scroll progress drives opposite-direction rotation of the spiral and
// the ladder, plus a vertical descent of the stage. Cards orbit the ladder across three
// stacked perspective layers (cards behind / ladder / cards in front): each layer is its
// own 3D context so planes can never slice through each other, and sortLayers() keeps
// every card on the side of the sandwich matching its current orbit position. Reduced
// motion skips all of this (a static fallback list is shown via CSS). Lifecycle-safe for
// View-Transition navigation.
import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import { prefersReduced } from './motion';
import { initLenis, destroyLenis, stopLenis, startLenis } from './lenis';

gsap.registerPlugin(ScrollTrigger);

const INTRO_KEY = 'decorosa:enter-intro';
let trigger: ScrollTrigger | null = null;
// While the entrance intro tweens the spiral, scroll must not drive it too (the two
// writers fight over --spin): lenis is stopped and the ScrollTrigger update is ignored.
let introPlaying = false;

// When arriving from the landing (the ladder has just risen to its resting spot), the first
// piece enters exactly like pieces do on scroll: the spiral starts one scroll slot back
// (240deg of spin, 700px lower — see the angle/drop coupling in pieces.ts) and decelerates
// to its resting point. The ladder is left alone: it just landed via the entry transition.
// (Scene.astro pre-paints the same start pose inline so the resting spot never flashes.)
function playIntro(spirals: HTMLElement[], sortLayers: (spin: number) => void): void {
  if (!sessionStorage.getItem(INTRO_KEY)) return;
  sessionStorage.removeItem(INTRO_KEY);
  introPlaying = true;
  stopLenis();
  gsap.set(spirals, { '--spin': '-240deg', '--rise': '700px' });
  gsap.to(spirals, {
    '--spin': '0deg',
    '--rise': '0px',
    duration: 2.4,
    ease: 'power2.out',
    delay: 0.5,
    onUpdate: () => sortLayers(parseFloat(String(gsap.getProperty(spirals[0], '--spin')))),
    onComplete: () => {
      // Discard any scroll that slipped through (scrollbar drag, keyboard) while locked,
      // so the resting pose and the scroll position agree before handing control back.
      window.scrollTo(0, 0);
      introPlaying = false;
      startLenis();
    },
  });
}

function init(): void {
  const driver = document.querySelector<HTMLElement>('[data-driver]');
  const scene = document.querySelector<HTMLElement>('[data-scene]');
  const ladder = document.querySelector<HTMLElement>('[data-ladder]');
  const sky = document.querySelector<HTMLElement>('[data-sky]');
  const spirals = Array.from(document.querySelectorAll<HTMLElement>('[data-spiral]'));
  const cards = Array.from(document.querySelectorAll<HTMLElement>('[data-piece]'));
  if (!driver || !scene || !ladder || spirals.length !== 2 || prefersReduced()) return;

  initLenis();

  const [backSpiral, frontSpiral] = spirals;

  // A card is in front of the ladder when its orbit z is positive, i.e. when the cosine
  // of its current world angle (spin + own angle) is; move it to the matching layer so
  // the ladder occludes it — or not — correctly.
  const sortLayers = (spin: number): void => {
    for (const card of cards) {
      const worldAngle = spin + Number(card.dataset.angle ?? 0);
      const layer = Math.cos((worldAngle * Math.PI) / 180) >= 0 ? frontSpiral : backSpiral;
      if (card.parentElement !== layer) layer.appendChild(card);
    }
  };

  // Spiral rotations across the whole scroll. With evenly spaced angles (120deg) and
  // drops, 4/3 turns makes every card face front exactly as it passes viewport center,
  // so each piece reaches its frontal point at the same height.
  const turns = 4 / 3;
  const travel = Number(driver.dataset.travel ?? 0);

  trigger = ScrollTrigger.create({
    trigger: driver,
    start: 'top top',
    end: 'bottom bottom',
    scrub: true,
    onUpdate: (self) => {
      if (introPlaying) return;
      const spin = self.progress * 360 * turns;
      for (const spiral of spirals) spiral.style.setProperty('--spin', `${spin}deg`);
      ladder.style.setProperty('--spin', `${-spin}deg`);
      sortLayers(spin);
      scene.style.setProperty('--descend', `${-self.progress * travel}px`);
      // Gentle parallax: the sky drifts a little in the scroll direction. Kept in svh so
      // the max shift (8svh) always stays inside the sky's 12% overscan (Scene.astro) —
      // a px value can outrun the overscan on short viewports and expose the page behind.
      sky?.style.setProperty('--sky-shift', `${self.progress * 8}svh`);
    },
  });

  sortLayers(trigger.progress * 360 * turns);
  playIntro(spirals, sortLayers);
}

function teardown(): void {
  trigger?.kill();
  trigger = null;
  introPlaying = false;
  destroyLenis();
}

document.addEventListener('astro:page-load', init);
document.addEventListener('astro:before-swap', teardown);

// Dev only: drop the ScrollTrigger + listeners before this module is hot-replaced,
// so reloads don't stack duplicate triggers.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    teardown();
    document.removeEventListener('astro:page-load', init);
    document.removeEventListener('astro:before-swap', teardown);
  });
}
