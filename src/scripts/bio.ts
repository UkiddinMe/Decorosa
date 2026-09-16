// "I AM" timeline: sideways scrolling plus the centre-proximity swell on each photo
// (the CSS reads `--near`). Lifecycle-safe for View-Transition navigation.
import { prefersReduced } from './motion';
import { wheelToHorizontal, onScrollFrame, writeCentreProximity } from './hscroll';

let cleanup: Array<() => void> = [];

function init(): void {
  cleanup.push(lightbox());

  const viewport = document.querySelector<HTMLElement>('[data-bio]');
  if (!viewport || prefersReduced()) return;

  const events = Array.from(document.querySelectorAll<HTMLElement>('[data-bio-event]'));
  cleanup.push(wheelToHorizontal(viewport));
  cleanup.push(onScrollFrame(viewport, () => writeCentreProximity(events)));
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
