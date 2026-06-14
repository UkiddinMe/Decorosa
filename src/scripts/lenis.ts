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
