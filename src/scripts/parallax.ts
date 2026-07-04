// Detail-panel controller: opens the world panel for a clicked piece, converts vertical
// wheel to horizontal scroll, and drives layered horizontal parallax via [data-depth].
// Lifecycle-safe: closes/cleans up on View-Transition navigation.
import { prefersReduced } from './motion';
import { stopLenis, startLenis } from './lenis';

let active: HTMLElement | null = null;
let viewport: HTMLElement | null = null;

function applyParallax(): void {
  if (!viewport || prefersReduced()) return;
  const x = viewport.scrollLeft;
  viewport.querySelectorAll<HTMLElement>('[data-depth]').forEach((layer) => {
    const depth = parseFloat(layer.dataset.depth ?? '1');
    layer.style.transform = `translateX(${x * (1 - depth)}px)`;
  });
}

function onWheel(event: WheelEvent): void {
  if (!viewport) return;
  if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
    viewport.scrollLeft += event.deltaY;
    event.preventDefault();
  }
}

function openPanel(id: string): void {
  const panel = document.querySelector<HTMLElement>(`[data-panel="${id}"]`);
  if (!panel) return;
  closePanel(true); // ensure only one open

  panel.hidden = false;
  requestAnimationFrame(() => panel.classList.add('is-open'));
  document.documentElement.style.overflow = 'hidden';
  stopLenis();

  active = panel;
  viewport = panel.querySelector<HTMLElement>('[data-parallax]');
  viewport?.addEventListener('scroll', applyParallax, { passive: true });
  viewport?.addEventListener('wheel', onWheel, { passive: false });
  viewport?.focus();
}

function closePanel(immediate = false): void {
  if (!active) return;
  const panel = active;
  viewport?.removeEventListener('scroll', applyParallax);
  viewport?.removeEventListener('wheel', onWheel);
  panel.classList.remove('is-open');
  if (immediate) panel.hidden = true;
  else window.setTimeout(() => (panel.hidden = true), 450);

  document.documentElement.style.overflow = '';
  startLenis();
  active = null;
  viewport = null;
}

function onClick(event: MouseEvent): void {
  const target = event.target as HTMLElement;
  const opener = target.closest<HTMLElement>('[data-open]');
  if (opener) {
    openPanel(opener.dataset.open!);
    return;
  }
  if (target.closest('[data-close]')) closePanel();
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') closePanel();
}

function onBeforeSwap(): void {
  closePanel(true);
}

document.addEventListener('click', onClick);
document.addEventListener('keydown', onKeydown);
// Don't leave a panel open (or scroll locked) across SPA navigation.
document.addEventListener('astro:before-swap', onBeforeSwap);

// Dev only: restore scroll + drop listeners before this module is hot-replaced.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    closePanel(true);
    document.removeEventListener('click', onClick);
    document.removeEventListener('keydown', onKeydown);
    document.removeEventListener('astro:before-swap', onBeforeSwap);
  });
}
