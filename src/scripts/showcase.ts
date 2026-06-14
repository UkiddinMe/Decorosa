// Showcase spiral: scroll progress drives opposite-direction rotation of the spiral and
// the ladder, plus a vertical descent of the stage. Reduced motion skips all of this (a
// static fallback list is shown via CSS). Lifecycle-safe for View-Transition navigation.
import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import { prefersReduced } from './motion';
import { initLenis, destroyLenis } from './lenis';

gsap.registerPlugin(ScrollTrigger);

let trigger: ScrollTrigger | null = null;

function init(): void {
  const driver = document.querySelector<HTMLElement>('[data-driver]');
  const scene = document.querySelector<HTMLElement>('[data-scene]');
  const spiral = document.querySelector<HTMLElement>('[data-spiral]');
  const ladder = document.querySelector<HTMLElement>('[data-ladder]');
  if (!driver || !scene || !spiral || !ladder || prefersReduced()) return;

  initLenis();

  const turns = 1; // full spiral rotations across the whole scroll
  const travel = Number(driver.dataset.travel ?? 0);

  trigger = ScrollTrigger.create({
    trigger: driver,
    start: 'top top',
    end: 'bottom bottom',
    scrub: true,
    onUpdate: (self) => {
      const spin = self.progress * 360 * turns;
      spiral.style.setProperty('--spin', `${spin}deg`);
      ladder.style.setProperty('--spin', `${-spin}deg`);
      scene.style.setProperty('--descend', `${-self.progress * travel}px`);
    },
  });
}

function teardown(): void {
  trigger?.kill();
  trigger = null;
  destroyLenis();
}

document.addEventListener('astro:page-load', init);
document.addEventListener('astro:before-swap', teardown);
