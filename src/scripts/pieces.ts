// The live pieces (ArtifactPiece.astro, TigerPiece.astro) and the moves CSS can't make on
// its own:
//  * `.is-live` — the one switch every "hover" move in their CSS reads. With a pointer it
//    follows hover on the piece itself (in the run the tiger overflows its card, so the
//    artwork is what the pointer aims at) and focus on its card; on touch, where there is
//    no hover, it cycles on and off by itself while the piece is on screen, so one-shots
//    replay and held poses open and fold, like the dune's cherry;
//  * eyes [data-eye] turn towards the pointer, as far as their `data-travel` allows;
//  * the table's veins [data-draw] are wiped out, then drawn back in, along their time
//    map, once per turn;
//  * the water [data-trip] fades into a ripple that runs through every hue, held while live.
// Lifecycle-safe for View-Transition navigation.
import { prefersReduced } from './motion';

const ERASE_MS = 1200;
const DRAW_MS = 2400;
/** touch cycle: live long enough for the longest one-shot (the veins), then a rest */
const LIVE_MS = ERASE_MS + DRAW_MS;
const REST_MS = 2500;

let cleanup: Array<() => void> = [];

function listen(el: EventTarget, type: string, fn: EventListener): void {
  el.addEventListener(type, fn);
  cleanup.push(() => el.removeEventListener(type, fn));
}

/** drives `.is-live` on the piece and tells `moves` each time it flips */
function drive(piece: Element, moves: Array<(on: boolean) => void>): void {
  const set = (on: boolean): void => {
    if (piece.classList.contains('is-live') === on) return;
    piece.classList.toggle('is-live', on);
    for (const move of moves) move(on);
  };
  if (matchMedia('(hover: hover)').matches) {
    listen(piece, 'pointerenter', () => set(true));
    listen(piece, 'pointerleave', () => set(false));
    const card = piece.closest('a');
    if (card) {
      listen(card, 'focus', () => set(true));
      listen(card, 'blur', () => set(false));
    }
    return;
  }
  if (prefersReduced()) return;
  let timer = 0;
  const turn = (on: boolean): void => {
    set(on);
    timer = window.setTimeout(turn, on ? LIVE_MS : REST_MS, !on);
  };
  const seen = new IntersectionObserver(([entry]) => {
    clearTimeout(timer);
    if (entry.isIntersecting) turn(true);
    else set(false);
  });
  seen.observe(piece);
  cleanup.push(() => {
    seen.disconnect();
    clearTimeout(timer);
  });
}

function eyes(): void {
  const all = Array.from(document.querySelectorAll<SVGGElement>('.piece [data-eye]'));
  if (!all.length || !matchMedia('(hover: hover)').matches) return;
  let x = 0;
  let y = 0;
  let frame = 0;
  const look = (): void => {
    frame = 0;
    for (const eye of all) {
      const ctm = (eye.parentNode as SVGGraphicsElement).getScreenCTM();
      if (!ctm) continue;
      const [cx, cy] = eye.dataset.eye!.split(' ').map(Number);
      const [tx, ty] = eye.dataset.travel!.split(' ').map(Number);
      const at = new DOMPoint(cx, cy).matrixTransform(ctm);
      const dx = x - at.x;
      const dy = y - at.y;
      const d = Math.hypot(dx, dy) || 1;
      // full turn once the pointer is a little way off; less when it is right on the eye
      const k = Math.min(1, d / 120) / d;
      eye.style.translate = `${dx * k * tx}px ${dy * k * ty}px`;
    }
  };
  listen(window, 'pointermove', (e) => {
    ({ clientX: x, clientY: y } = e as PointerEvent);
    frame ||= requestAnimationFrame(look);
  });
  cleanup.push(() => cancelAnimationFrame(frame));
}

function draw(transfer: SVGFEComponentTransferElement): (on: boolean) => void {
  const edge = Number(transfer.dataset.draw);
  const funcs = Array.from(transfer.children);
  const set = (slope: number, intercept: number) =>
    funcs.forEach((f) => {
      f.setAttribute('slope', String(slope));
      f.setAttribute('intercept', String(intercept));
    });
  let start = 0;
  let frame = 0;
  const step = (now: number): void => {
    const t = now - start;
    const erasing = t < ERASE_MS;
    const p = erasing ? t / ERASE_MS : Math.min(1, (t - ERASE_MS) / DRAW_MS);
    const eased = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
    // runs past 1 by one edge width, so the last vein is fully gone / drawn at the end
    const front = eased * (1 + 1 / edge);
    // the same front, same way: first what is behind it is hidden, then what is behind it shows
    if (erasing) set(edge, 1 - edge * front);
    else set(-edge, edge * front);
    frame = erasing || p < 1 ? requestAnimationFrame(step) : 0;
  };
  cleanup.push(() => cancelAnimationFrame(frame));
  return (on) => {
    if (!on || frame) return;
    start = performance.now();
    frame = requestAnimationFrame(step);
  };
}

/** while live; faded in and out over FADE_MS */
function trip(piece: Element, filter: SVGFilterElement): (on: boolean) => void {
  const FADE_MS = 500;
  const group = piece.querySelector<SVGGElement>('.m-trip')!;
  const noise = filter.querySelector('feTurbulence')!;
  const hue = filter.querySelector('feColorMatrix[type="hueRotate"]')!;
  let on = false;
  let k = 0;
  let last = 0;
  let frame = 0;
  const step = (now: number): void => {
    const dt = last ? now - last : 16;
    last = now;
    k = Math.min(1, Math.max(0, k + (on ? dt : -dt) / FADE_MS));
    group.style.opacity = String(k);
    // the noise drifts by breathing its two frequencies out of step; the hue turns once in 3s
    noise.setAttribute('baseFrequency', `${0.012 + 0.005 * Math.sin(now / 900)} ${0.04 + 0.015 * Math.sin(now / 1300)}`);
    hue.setAttribute('values', String((now * 0.12) % 360));
    if (on || k > 0) frame = requestAnimationFrame(step);
    else frame = last = 0;
  };
  cleanup.push(() => cancelAnimationFrame(frame));
  return (v) => {
    on = v;
    frame ||= requestAnimationFrame(step);
  };
}

function init(): void {
  const still = prefersReduced();
  if (!still) eyes();
  for (const piece of document.querySelectorAll('svg.piece, .tiger')) {
    const moves: Array<(on: boolean) => void> = [];
    const transfer = piece.querySelector<SVGFEComponentTransferElement>('[data-draw]');
    const water = piece.querySelector<SVGFilterElement>('[data-trip]');
    if (!still && transfer) moves.push(draw(transfer));
    if (!still && water) moves.push(trip(piece, water));
    drive(piece, moves);
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
