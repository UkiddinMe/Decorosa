// Landing wordmark: hands the starburst's contacts label from its one-off "peek" animation
// (CSS `starburst-label-peek`) back to the CSS transitions that drive hover, as soon as the
// peek is over OR the pointer/focus arrives — whichever comes first.
//
// Why it can't be pure CSS: a running animation outranks the transition, so hovering during
// the peek would do nothing; and dropping the animation from within the `:hover` rule would
// make it *restart* on the way out. Removing the class instead is a one-way handoff — the
// transition then picks the label up from wherever the peek had it.
// Lifecycle-safe for View-Transition navigation.

let cleanup: Array<() => void> = [];

function init(): void {
  const label = document.querySelector<HTMLElement>('[data-starburst-label]');
  if (!label || !label.classList.contains('is-peeking')) return;
  const link = label.closest('a');

  const handOff = (event: Event): void => {
    // The label's own animation is the peek (the star's spin lives on another element and
    // never ends anyway); anything bubbling from below is not ours.
    if (event.type === 'animationend' && event.target !== label) return;

    // Freeze the pose the peek is holding into inline styles BEFORE dropping it. Chrome
    // does not interpolate out of a cancelled animation — remove the class on its own and
    // the label snaps to the hover pose instead of rising into it. Pinning the current
    // values, flushing, then releasing them makes that pose the transition's start.
    const { opacity, translate } = getComputedStyle(label);
    label.style.opacity = opacity;
    label.style.translate = translate;
    label.classList.remove('is-peeking');
    void label.offsetWidth;
    label.style.opacity = '';
    label.style.translate = '';

    teardown();
  };

  const on = (target: EventTarget, type: string): void => {
    target.addEventListener(type, handOff);
    cleanup.push(() => target.removeEventListener(type, handOff));
  };

  on(label, 'animationend');
  if (link) {
    on(link, 'pointerenter');
    on(link, 'focusin');
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
