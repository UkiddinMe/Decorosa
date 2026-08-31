// Showcase spiral: scroll progress drives opposite-direction rotation of the spiral and
// the ladder, plus a vertical descent of the stage. The three panels orbit the ladder
// across three stacked perspective layers (behind / ladder / in front): each layer is its
// own 3D context so planes can never slice through each other, and sortLayers() keeps
// every panel on the side of the sandwich matching its current orbit position.
// sortNear() reveals each panel's big title while it is in the closer half of its
// apparent-size range. Reduced motion skips all of this (a static fallback list is shown
// via CSS). Lifecycle-safe for View-Transition navigation.
import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import { isFrontOfLadder } from '../data/panels';
import { prefersReduced } from './motion';
import { initLenis, destroyLenis, stopLenis, startLenis, jumpTo } from './lenis';

gsap.registerPlugin(ScrollTrigger);

const INTRO_KEY = 'decorosa:enter-intro';
// Last scroll offset on this page, so coming back (link, back button, reload) resumes at
// the same height instead of at the top of the spiral.
const SCROLL_KEY = 'decorosa:showcase-scroll';
let trigger: ScrollTrigger | null = null;
// While the entrance intro tweens the spiral, scroll must not drive it too (the two
// writers fight over --spin): lenis is stopped and the ScrollTrigger update is ignored.
let introPlaying = false;

// A panel's apparent size is set by perspective alone: scale(z) = P / (P − z), with
// z = radius·cos(worldAngle) sweeping [−radius, +radius]. "Closer half of its size range"
// is therefore the z at which scale reaches the midpoint of [scale(−r), scale(+r)].
function nearThresholdZ(perspective: number, radius: number): number {
  const mid = (perspective / (perspective + radius) + perspective / (perspective - radius)) / 2;
  return perspective - perspective / mid;
}

// When arriving from the landing (the ladder has just risen to its resting spot), the first
// panel enters exactly like panels do on scroll: the spiral starts one scroll slot back
// (240deg of spin, 700px lower — see the angle/drop coupling in panels.ts) and decelerates
// to its resting point. The ladder is left alone: it just landed via the entry transition.
// (Scene.astro pre-paints the same start pose inline so the resting spot never flashes.)
function playIntro(spirals: HTMLElement[], onSpin: (spin: number) => void): void {
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
    onUpdate: () => onSpin(parseFloat(String(gsap.getProperty(spirals[0], '--spin')))),
    onComplete: () => {
      // Discard any scroll that slipped through (scrollbar drag, keyboard) while locked,
      // so the resting pose and the scroll position agree before handing control back.
      window.scrollTo(0, 0);
      introPlaying = false;
      startLenis();
    },
  });
}

// `trigger` doubles as "the showcase is the live page": these document listeners survive
// SPA swaps, so without it another page's scroll offset would be stored here.
function saveScroll(): void {
  if (trigger) sessionStorage.setItem(SCROLL_KEY, String(window.scrollY));
}

// Restore before the ScrollTrigger is created so its first progress (and the initial panel
// sort) already match the resumed height. Arriving from the landing always starts at the
// top: the intro replays there, so any stored offset is stale.
function restoreScroll(): void {
  if (sessionStorage.getItem(INTRO_KEY)) {
    sessionStorage.removeItem(SCROLL_KEY);
    return;
  }
  const saved = Number(sessionStorage.getItem(SCROLL_KEY) ?? 0);
  if (saved > 0) jumpTo(saved);
}

function init(): void {
  const driver = document.querySelector<HTMLElement>('[data-driver]');
  const scene = document.querySelector<HTMLElement>('[data-scene]');
  const ladder = document.querySelector<HTMLElement>('[data-ladder]');
  const sky = document.querySelector<HTMLElement>('[data-sky]');
  const spirals = Array.from(document.querySelectorAll<HTMLElement>('[data-spiral]'));
  const cards = Array.from(document.querySelectorAll<HTMLElement>('[data-panel]'));
  if (!driver || !scene || !ladder || spirals.length !== 2 || prefersReduced()) return;

  initLenis();
  restoreScroll();
  window.addEventListener('pagehide', saveScroll);

  const [backSpiral, frontSpiral] = spirals;
  const perspective =
    parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--scene-perspective')) ||
    1200;

  // Per orbit tick: (a) move each panel to the card layer that puts it on the right side
  // of the ladder — the cut-off is the apparent-motion turning point, not z = 0, see
  // isFrontOfLadder; (b) show its title once its z crosses the "closer half of the size
  // range" mark.
  const onSpin = (spin: number): void => {
    for (const card of cards) {
      const worldAngle = ((spin + Number(card.dataset.angle ?? 0)) * Math.PI) / 180;
      const cos = Math.cos(worldAngle);
      const radius = Number(card.dataset.radius ?? 0);
      const layer = isFrontOfLadder(cos, radius, perspective) ? frontSpiral : backSpiral;
      if (card.parentElement !== layer) layer.appendChild(card);
      card.classList.toggle('is-near', radius * cos >= nearThresholdZ(perspective, radius));
    }
  };

  // Spiral rotations across the whole scroll. With evenly spaced angles (120deg) and
  // drops, 4/3 turns makes every panel face front exactly as it passes viewport center,
  // so each one reaches its frontal point at the same height.
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
      onSpin(spin);
      scene.style.setProperty('--descend', `${-self.progress * travel}px`);
      // Gentle parallax: the sky drifts a little in the scroll direction. Kept in svh so
      // the max shift (8svh) always stays inside the sky's 12% overscan (Scene.astro) —
      // a px value can outrun the overscan on short viewports and expose the page behind.
      sky?.style.setProperty('--sky-shift', `${self.progress * 8}svh`);
    },
  });

  onSpin(trigger.progress * 360 * turns);
  playIntro(spirals, onSpin);
}

function teardown(): void {
  saveScroll();
  window.removeEventListener('pagehide', saveScroll);
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
