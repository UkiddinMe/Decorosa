// Smooth scroll (Lenis) wired into GSAP's ticker and ScrollTrigger.
// init/destroy are idempotent so View-Transition navigations don't leak instances.
import Lenis from 'lenis';
import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import { prefersReduced } from './motion';

let lenis: Lenis | null = null;
let rafFn: ((time: number) => void) | null = null;

export function initLenis(): void {
  if (lenis || prefersReduced()) return;
  lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  rafFn = (time: number) => lenis?.raf(time * 1000);
  gsap.ticker.add(rafFn);
  gsap.ticker.lagSmoothing(0);
}

export function destroyLenis(): void {
  if (rafFn) {
    gsap.ticker.remove(rafFn);
    rafFn = null;
  }
  lenis?.destroy();
  lenis = null;
}

/** Pause/resume smooth scroll (e.g. while a detail panel is open). */
export function stopLenis(): void {
  lenis?.stop();
}
export function startLenis(): void {
  lenis?.start();
}

// Dev only: on HMR, tear down the live instance before this module is replaced.
// Otherwise the old Lenis keeps its wheel listener + ticker callback while a fresh
// one is created, and the two fight over the wheel — scrolling appears to freeze.
if (import.meta.hot) {
  import.meta.hot.dispose(destroyLenis);
}
