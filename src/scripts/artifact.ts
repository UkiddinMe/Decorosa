// Artifact detail page: the page develops to the right — vertical wheel becomes
// horizontal scroll — or, on portrait screens (`PORTRAIT`), plainly downwards; every
// measure below follows that axis, and turning the device re-inits on the other one. Worlds drift their [data-depth] layers; stories (stories/*) read
// `--near` ([data-wake], 1 at the middle of the screen) and `--pan` ([data-pan], -1..1 as
// the slice crosses the screen), play their [data-play] videos while on screen, aim
// their [data-lens] at the pointer, and carry their [data-lamp] after it. Every page ends on NextWork: scrolling on past the
// end fills its bar and goes there. Lifecycle-safe for View-Transition navigation.
import { navigate } from 'astro:transitions/client';
import { prefersReduced } from './motion';
import {
  PORTRAIT,
  type Axis,
  wheelToHorizontal,
  onScrollFrame,
  applyDepthParallax,
  writeCentreProximity,
} from './hscroll';

const HERO = 'artifact-hero';
/** wheel delta (px) it takes past the end to fill NextWork's bar */
const PULL_PX = 1400;
/** ignore the wheel for this long after reaching the end, so the momentum that got
    there doesn't count as a pull */
const PULL_ARM_MS = 450;

let cleanup: Array<() => void> = [];

function listen(el: EventTarget, type: string, fn: EventListener, opts?: AddEventListenerOptions): void {
  el.addEventListener(type, fn, opts);
  cleanup.push(() => el.removeEventListener(type, fn, opts));
}

/** `--pan`: where each slice sits across the screen — 1 entering (right / bottom), 0 dead
    centre, -1 leaving (left / top). Measure all, then write all. */
function writePan(items: HTMLElement[], axis: Axis): void {
  const half = (axis === 'x' ? window.innerWidth : window.innerHeight) / 2;
  const values = items.map((item) => {
    const box = item.getBoundingClientRect();
    const [start, size] = axis === 'x' ? [box.left, box.width] : [box.top, box.height];
    const p = (start + size / 2 - half) / (half + size / 2);
    return Math.max(-1, Math.min(1, p)).toFixed(3);
  });
  items.forEach((item, i) => item.style.setProperty('--pan', values[i]));
}

/** Videos play only while on screen; under reduced motion they wait for the visitor. */
function playWhenSeen(viewport: HTMLElement): void {
  const videos = Array.from(viewport.querySelectorAll<HTMLVideoElement>('video[data-play]'));
  if (prefersReduced()) {
    for (const video of videos) video.controls = true;
    return;
  }
  const seen = new IntersectionObserver(
    (entries) => {
      for (const { target, isIntersecting } of entries) {
        const video = target as HTMLVideoElement;
        if (isIntersecting) video.play().catch(() => {});
        else video.pause();
      }
    },
    { threshold: 0.25 },
  );
  for (const video of videos) {
    // The ClientRouter builds the next page in a DOMParser document, where the video's
    // source selection fails (NETWORK_NO_SOURCE) and isn't retried once it is swapped in.
    if (video.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) video.load();
    seen.observe(video);
  }
  cleanup.push(() => seen.disconnect());
}

/** The lens follows the pointer while it is over the picture; otherwise CSS drifts it.
 *  Left behind, it rests a beat, fades out, and fades back in on its drift. */
const LENS_REST = 400;
const LENS_FADE = 1200; // = the .lens fade transition

function lenses(viewport: HTMLElement): void {
  if (!matchMedia('(hover: hover)').matches) return;
  for (const lens of viewport.querySelectorAll<HTMLElement>('[data-lens]')) {
    let timer: number | undefined;
    cleanup.push(() => clearTimeout(timer));
    listen(lens, 'pointermove', (event) => {
      const { clientX, clientY } = event as PointerEvent;
      const box = lens.getBoundingClientRect();
      clearTimeout(timer);
      lens.classList.remove('is-faded');
      lens.classList.add('is-aimed');
      lens.style.setProperty('--lx', `${((clientX - box.left) / box.width) * 100}%`);
      lens.style.setProperty('--ly', `${((clientY - box.top) / box.height) * 100}%`);
    });
    listen(lens, 'pointerleave', () => {
      timer = window.setTimeout(() => {
        lens.classList.add('is-faded');
        timer = window.setTimeout(() => lens.classList.remove('is-aimed', 'is-faded'), LENS_FADE);
      }, LENS_REST);
    });
  }
}

/** The lantern trails the pointer (eased, so it swings after it like a carried light);
 *  until the pointer first moves, CSS sways it on its own. */
const LAMP_EASE = 0.09;

function lamps(viewport: HTMLElement): void {
  const lamp = viewport.querySelector<HTMLElement>('[data-lamp]');
  if (!lamp || !matchMedia('(hover: hover)').matches || prefersReduced()) return;
  let x = 0;
  let y = 0;
  let toX = 0;
  let toY = 0;
  let frame = 0;
  const step = (): void => {
    x += (toX - x) * LAMP_EASE;
    y += (toY - y) * LAMP_EASE;
    lamp.style.setProperty('--lx', `${x.toFixed(1)}px`);
    lamp.style.setProperty('--ly', `${y.toFixed(1)}px`);
    frame = Math.abs(toX - x) + Math.abs(toY - y) > 0.5 ? requestAnimationFrame(step) : 0;
  };
  listen(window, 'pointermove', (event) => {
    ({ clientX: toX, clientY: toY } = event as PointerEvent);
    if (!lamp.classList.contains('is-aimed')) {
      // pick up from wherever the sway has carried it
      const at = getComputedStyle(lamp);
      x = parseFloat(at.getPropertyValue('--lx'));
      y = parseFloat(at.getPropertyValue('--ly'));
      lamp.classList.add('is-aimed');
    }
    if (!frame) frame = requestAnimationFrame(step);
  });
  cleanup.push(() => cancelAnimationFrame(frame));
}

/** Off to the next artifact: its cut-out takes the hero's name, so it morphs into it. */
function handOff(link: HTMLAnchorElement): void {
  const own = document.querySelector<HTMLElement>('[data-page-hero]');
  if (own) own.style.viewTransitionName = 'none';
  const media = link.querySelector<HTMLElement>('[data-next-media]');
  if (media) media.style.viewTransitionName = HERO;
}

function nextWork(viewport: HTMLElement, axis: Axis): void {
  const link = viewport.querySelector<HTMLAnchorElement>('[data-next]');
  if (!link) return;
  listen(link, 'click', () => handOff(link));

  let pull = 0;
  let endSince = 0;
  let lastWheel = 0;
  let frame = 0;
  const show = (): void => link.style.setProperty('--pull', pull.toFixed(3));
  // let go and the bar drains back
  const drain = (): void => {
    if (performance.now() - lastWheel > 200) pull = Math.max(0, pull - 0.025);
    show();
    frame = pull > 0 ? requestAnimationFrame(drain) : 0;
  };
  listen(
    viewport,
    'wheel',
    (event) => {
      const { deltaX, deltaY } = event as WheelEvent;
      const atEnd =
        axis === 'x'
          ? viewport.scrollLeft >= viewport.scrollWidth - viewport.clientWidth - 2
          : viewport.scrollTop >= viewport.scrollHeight - viewport.clientHeight - 2;
      if (!atEnd) {
        endSince = 0;
        return;
      }
      const now = performance.now();
      if (!endSince) endSince = now;
      const delta = Math.abs(deltaY) > Math.abs(deltaX) ? deltaY : deltaX;
      if (now - endSince < PULL_ARM_MS || delta <= 0) return;
      lastWheel = now;
      pull = Math.min(1, pull + delta / PULL_PX);
      show();
      if (pull >= 1) {
        handOff(link);
        navigate(link.href);
        return;
      }
      if (!frame) frame = requestAnimationFrame(drain);
    },
    { passive: true },
  );
  cleanup.push(() => cancelAnimationFrame(frame));
}

function init(): void {
  const viewport = document.querySelector<HTMLElement>('[data-artifact]');
  if (!viewport) return;

  const portrait = matchMedia(PORTRAIT);
  const axis: Axis = portrait.matches ? 'y' : 'x';
  listen(portrait, 'change', () => {
    teardown();
    init();
  });
  if (axis === 'x') cleanup.push(wheelToHorizontal(viewport));
  const bar = document.querySelector<HTMLElement>('[data-progress]');
  const wakes = Array.from(viewport.querySelectorAll<HTMLElement>('[data-wake]'));
  const pans = Array.from(viewport.querySelectorAll<HTMLElement>('[data-pan]'));
  const still = prefersReduced();
  cleanup.push(
    onScrollFrame(viewport, () => {
      const [at, max] =
        axis === 'x'
          ? [viewport.scrollLeft, viewport.scrollWidth - viewport.clientWidth]
          : [viewport.scrollTop, viewport.scrollHeight - viewport.clientHeight];
      bar?.style.setProperty('--progress', max > 0 ? (at / max).toFixed(4) : '1');
      if (still) return;
      applyDepthParallax(viewport, axis);
      writeCentreProximity(wakes, axis);
      writePan(pans, axis);
    }),
  );
  playWhenSeen(viewport);
  lenses(viewport);
  lamps(viewport);
  nextWork(viewport, axis);
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
