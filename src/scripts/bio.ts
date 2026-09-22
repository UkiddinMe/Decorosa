// "I AM" timeline: sideways scrolling, the centre-proximity swell on each photo (the CSS
// reads `--near`) and, on touch screens, the event at the centre showing its label.
// Lifecycle-safe for View-Transition navigation.
import { prefersReduced } from './motion';
import { wheelToHorizontal, onScrollFrame, writeCentreProximity } from './hscroll';

let cleanup: Array<() => void> = [];

function init(): void {
  cleanup.push(lightbox());

  const viewport = document.querySelector<HTMLElement>('[data-bio]');
  if (!viewport) return;
  const events = Array.from(document.querySelectorAll<HTMLElement>('[data-bio-event]'));

  // the label is content, not motion: it follows the centre even with reduced motion
  if (matchMedia('(hover: none)').matches) {
    cleanup.push(onScrollFrame(viewport, () => markCentreEvent(events)));
  }
  if (prefersReduced()) return;
  cleanup.push(wheelToHorizontal(viewport));
  cleanup.push(onScrollFrame(viewport, () => writeCentreProximity(events)));
}

/**
 * Touch has no hover, so the label shows on the event nearest the viewport's centre
 * (`data-active`), and leaves it as that event scrolls on. A newcomer has to be clearly
 * closer before it takes over, so a scroll that stops between two events never flickers.
 */
const HANDOVER = 24; // px
const REACH = 0.35; // of the viewport width: farther than this from the centre, no label
function markCentreEvent(events: HTMLElement[]): void {
  const centre = window.innerWidth / 2;
  const distances = events.map((event) => {
    const box = event.getBoundingClientRect();
    return Math.abs(box.left + box.width / 2 - centre);
  });
  const current = events.findIndex((event) => event.hasAttribute('data-active'));
  let best = distances.indexOf(Math.min(...distances));
  if (current >= 0 && distances[current] - distances[best] < HANDOVER) best = current;
  if (distances[best] > window.innerWidth * REACH) best = -1;
  if (best === current) return;
  events[current]?.removeAttribute('data-active');
  events[best]?.setAttribute('data-active', '');
}

/** An event with artwork opens its own <dialog>: the card is far too small to read in. */
function lightbox(): () => void {
  // the panel's pages run sideways like the timeline, so the wheel has to drive them too
  const wheels = Array.from(document.querySelectorAll<HTMLElement>('[data-bio-pages]')).map(
    wheelToHorizontal
  );

  const onClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const opener = target.closest<HTMLElement>('[data-bio-open]');
    if (opener) {
      document
        .querySelector<HTMLDialogElement>(`[data-bio-zoom="${opener.dataset.bioOpen}"]`)
        ?.showModal();
      return;
    }
    const dialog = target.closest<HTMLDialogElement>('dialog[data-bio-zoom]');
    if (!dialog) return;
    // a click on the backdrop reports the dialog itself as its target, so tell the two
    // apart by where it landed: outside the dialog's own box = backdrop = close
    const box = dialog.getBoundingClientRect();
    const outside =
      e.clientX < box.left || e.clientX > box.right || e.clientY < box.top || e.clientY > box.bottom;
    if (outside || target.closest('[data-bio-close]')) dialog.close();
  };

  document.addEventListener('click', onClick);
  return () => {
    document.removeEventListener('click', onClick);
    for (const off of wheels) off();
    document.querySelectorAll<HTMLDialogElement>('dialog[data-bio-zoom]').forEach((d) => d.close());
  };
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
