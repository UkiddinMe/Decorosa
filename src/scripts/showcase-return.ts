// Coming back to the showcase: it reopens a little above where the visitor left, hidden,
// then fades in while gliding down to that spot (showcase.ts). The starting pose must be
// set on astro:after-swap — inside the view transition's update, before the new page is
// captured — or the page first shows at the stored spot and only then moves. showcase.ts
// is a page script and may not be loaded yet at that point, so this is global (BaseLayout).
import { prefersReduced } from './motion';

const INTRO_KEY = 'decorosa:enter-intro';
/** Last scroll offset on the showcase, written by showcase.ts as the visitor leaves. */
export const SCROLL_KEY = 'decorosa:showcase-scroll';
const LEAD = 0.5; // × viewport height above the stored spot

/** Where the return glide starts and lands, or null for a plain arrival. Arriving from the
 *  landing never returns: the intro replays at the top, so the stored offset is stale. */
export function returnPose(): { from: number; to: number } | null {
  if (prefersReduced() || sessionStorage.getItem(INTRO_KEY)) return null;
  const to = Number(sessionStorage.getItem(SCROLL_KEY) ?? 0);
  return to > 0 ? { from: Math.max(0, to - window.innerHeight * LEAD), to } : null;
}

document.addEventListener('astro:after-swap', () => {
  const pose = document.querySelector('[data-driver]') && returnPose();
  if (!pose) return;
  document.documentElement.classList.add('is-returning');
  window.scrollTo({ top: pose.from, behavior: 'instant' }); // html is scroll-behavior: smooth
});
