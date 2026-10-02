// The moves of the "MY" pieces that CSS can't make on its own (ArtifactPiece.astro):
//  * eyes [data-eye] turn towards the pointer, as far as their `data-travel` allows;
//  * the table's veins [data-draw] are wiped out, then drawn back in, along their time
//    map, once per hover.
// Lifecycle-safe for View-Transition navigation.
import { prefersReduced } from './motion';

const ERASE_MS = 1200;
const DRAW_MS = 2400;

let cleanup: Array<() => void> = [];

function listen(el: EventTarget, type: string, fn: EventListener): void {
  el.addEventListener(type, fn);
  cleanup.push(() => el.removeEventListener(type, fn));
}

/** hover on the piece itself, or keyboard focus on the card it sits in */
function onEnter(piece: SVGSVGElement, fn: () => void): void {
  listen(piece, 'pointerenter', fn);
  const card = piece.closest('a');
  if (card) listen(card, 'focus', fn);
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

function draw(piece: SVGSVGElement, transfer: SVGFEComponentTransferElement): void {
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
  onEnter(piece, () => {
    if (frame) return;
    start = performance.now();
    frame = requestAnimationFrame(step);
  });
  cleanup.push(() => cancelAnimationFrame(frame));
}

function init(): void {
  if (prefersReduced()) return;
  eyes();
  for (const piece of document.querySelectorAll<SVGSVGElement>('svg.piece')) {
    const transfer = piece.querySelector<SVGFEComponentTransferElement>('[data-draw]');
    if (transfer) draw(piece, transfer);
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
