// Hole-widening entry transition between the landing and the showcase.
//
// On clicking [data-entry], a dark overlay clip-circle grows from the hole to cover the
// viewport ("descending"), then we navigate. On arrival, an overlay clip-circle shrinks
// away to reveal the showcase. Coordinates are handed across the navigation via
// sessionStorage. Falls back to a plain navigation when motion is reduced.
import { navigate } from 'astro:transitions/client';
import gsap from 'gsap';
import { prefersReduced } from './motion';

const REVEAL_KEY = 'decorosa:entering';

/** Largest distance from (cx,cy) to a viewport corner — the radius that fully covers. */
function coverRadius(cx: number, cy: number): number {
  return Math.hypot(Math.max(cx, innerWidth - cx), Math.max(cy, innerHeight - cy));
}

function makeOverlay(cxPct: number, cyPct: number, r: number): HTMLElement {
  const el = document.createElement('div');
  el.className = 'descent-overlay';
  el.style.setProperty('--cx', `${cxPct}%`);
  el.style.setProperty('--cy', `${cyPct}%`);
  el.style.setProperty('--r', `${r}px`);
  document.body.appendChild(el);
  return el;
}

function tweenRadius(el: HTMLElement, from: number, to: number, ease: string) {
  const proxy = { r: from };
  return gsap.to(proxy, {
    r: to,
    duration: 0.75,
    ease,
    onUpdate: () => el.style.setProperty('--r', `${proxy.r}px`),
  });
}

async function onEntryClick(event: MouseEvent) {
  const link = event.currentTarget as HTMLAnchorElement;
  const href = link.getAttribute('href');
  if (!href || prefersReduced()) return; // let the normal navigation happen

  event.preventDefault();
  const hole = link.querySelector<HTMLElement>('[data-hole]') ?? link;
  const rect = hole.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const cxPct = (cx / innerWidth) * 100;
  const cyPct = (cy / innerHeight) * 100;

  const overlay = makeOverlay(cxPct, cyPct, 0);
  sessionStorage.setItem(REVEAL_KEY, JSON.stringify({ cx: cxPct, cy: cyPct }));
  await tweenRadius(overlay, 0, coverRadius(cx, cy), 'power2.in');
  navigate(href);
}

/** On arriving at the showcase, shrink the covering circle away to reveal the page. */
function playReveal() {
  const raw = sessionStorage.getItem(REVEAL_KEY);
  if (!raw) return;
  sessionStorage.removeItem(REVEAL_KEY);
  if (prefersReduced()) return;

  const { cx, cy } = JSON.parse(raw) as { cx: number; cy: number };
  const cxpx = (innerWidth * cx) / 100;
  const cypx = (innerHeight * cy) / 100;
  const r = coverRadius(cxpx, cypx);
  const overlay = makeOverlay(cx, cy, r);
  tweenRadius(overlay, r, 0, 'power2.out').then(() => overlay.remove());
}

function bindEntries() {
  document.querySelectorAll<HTMLAnchorElement>('[data-entry]').forEach((link) => {
    if (link.dataset.entryBound) return;
    link.dataset.entryBound = 'true';
    link.addEventListener('click', onEntryClick);
  });
}

// Re-bind and check for an incoming reveal on every (SPA) page load.
document.addEventListener('astro:page-load', () => {
  bindEntries();
  playReveal();
});
