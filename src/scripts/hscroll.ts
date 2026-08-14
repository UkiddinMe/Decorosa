// Shared plumbing for the three horizontally-developing sections (bio timeline, works
// carousel, artifact detail pages). Each of them is one element that scrolls sideways;
// what differs is only what they do with the scroll position.

/** Vertical wheel input drives the horizontal scroll (trackpad deltaX passes through). */
export function wheelToHorizontal(el: HTMLElement): () => void {
  const onWheel = (event: WheelEvent): void => {
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    el.scrollLeft += event.deltaY;
    event.preventDefault();
  };
  el.addEventListener('wheel', onWheel, { passive: false });
  return () => el.removeEventListener('wheel', onWheel);
}

/** Run `fn` on scroll and resize, coalesced to one call per animation frame. */
export function onScrollFrame(el: HTMLElement, fn: () => void): () => void {
  let queued = false;
  const schedule = (): void => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      fn();
    });
  };
  el.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  fn();
  return () => {
    el.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', schedule);
  };
}

/**
 * How close an element is to the horizontal centre of the viewport, 1 at dead centre
 * falling to 0 one half-viewport away. Written to `--near` so the CSS decides what
 * "closer" looks like (swell, opacity, …).
 *
 * All measuring happens before any writing — interleaving the two would force a reflow
 * per item — and unchanged values are skipped, so a still carousel costs nothing.
 */
export function writeCentreProximity(items: HTMLElement[]): void {
  const centre = window.innerWidth / 2;
  const values = items.map((item) => {
    const box = item.getBoundingClientRect();
    const distance = Math.abs(box.left + box.width / 2 - centre);
    return Math.max(0, 1 - distance / centre).toFixed(2);
  });
  items.forEach((item, i) => {
    if (item.dataset.near === values[i]) return;
    item.dataset.near = values[i];
    item.style.setProperty('--near', values[i]);
  });
}

/**
 * Layered parallax: every `[data-depth]` layer is translated by `scrollLeft × (1 − depth)`.
 * Depth 1 moves with the content (reads as fixed to the world), depth ≈ 0 stays put
 * relative to the viewport.
 */
export function applyDepthParallax(el: HTMLElement): void {
  const x = el.scrollLeft;
  el.querySelectorAll<HTMLElement>('[data-depth]').forEach((layer) => {
    const depth = parseFloat(layer.dataset.depth ?? '1');
    layer.style.transform = `translateX(${x * (1 - depth)}px)`;
  });
}
