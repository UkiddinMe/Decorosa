// Hole-widening entry transition between the landing and the showcase.
//
// Clicking [data-entry] reveals a viewport-sized `cover` sky through a growing elliptical clip
// that starts exactly over the existing hole — so the sky never scales (no stretch) and ends
// framed identically to the showcase background. In step, the front rim [data-rim] opens (its
// elliptical mask scales out) and the clip [data-ladder-clip] opens fully. The ladder is then
// lifted by a "flight" replica of the showcase 3D chain: a clone starts flat, exactly over the
// landing ladder, and animates to the showcase resting pose — so it ENDS pixel-identical to
// the real perspective-rendered ladder and the page swap is seamless (the sky too: all sky
// paints share one viewport-anchored framing, see --sky-bg in tokens.css). On arrival only
// the showcase chrome fades in. Falls back to plain navigation when motion is reduced.
import { navigate } from 'astro:transitions/client';
import gsap from 'gsap';
import { prefersReduced } from './motion';

const REVEAL_KEY = 'decorosa:entering';
const INTRO_KEY = 'decorosa:enter-intro';

/** Append a viewport-sized sky cover (styles in global.css → .sky-cover). */
function makeSkyCover(): HTMLElement {
  const cover = document.createElement('div');
  cover.className = 'sky-cover';
  const sky = document.createElement('div');
  sky.className = 'sky-cover__sky';
  cover.appendChild(sky);
  document.body.appendChild(cover);
  return cover;
}

/** Uniform scale factor that grows the hole ellipse until it contains every viewport corner. */
function coverScale(rect: DOMRect): number {
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const dx = Math.max(cx, innerWidth - cx) / (rect.width / 2);
  const dy = Math.max(cy, innerHeight - cy) / (rect.height / 2);
  // A point is inside the scaled ellipse iff hypot(dx, dy) <= scale (in ellipse units).
  return Math.hypot(dx, dy) * 1.05;
}

// The ladder "flight": a live replica of the showcase transform chain (Scene.astro:
// .scene → .stage → .ladder-group → .ladder3d) carrying a clone of the landing ladder SVG.
// The stage tilt starts at 0deg (flat) so the clone can be overlaid exactly on the landing
// ladder with a plain 2D translate + uniform scale on the wrapper; both then animate to rest
// (tilt to --stage-tilt, wrapper to identity), so the flight ends pixel-identical to the real
// perspective-rendered showcase ladder. A 2D FLIP of the flat ladder cannot achieve this:
// perspective foreshortening is non-affine over the ladder's length, so matching bounding
// boxes still leaves a visible size/offset difference at the swap. All shared values come
// from tokens.css custom properties; only the *structure* of the chain must track Scene.astro.
function buildFlight(svg: SVGElement): { flight: HTMLElement; stage: HTMLElement; clone: SVGElement } {
  // The showcase always scrolls (tall driver), so its .scene is one classic scrollbar
  // narrower than a non-scrolling landing viewport — size the replica scene to match
  // its end-state width (with overlay scrollbars the probe measures 0).
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;overflow:scroll;width:60px;height:60px;visibility:hidden;';
  document.body.appendChild(probe);
  const scrollbar = probe.offsetWidth - probe.clientWidth;
  probe.remove();

  const flight = document.createElement('div');
  // z-index 101: above the sky cover (100), below the rim (102) like the original ladder.
  flight.style.cssText = 'position:fixed;inset:0;visibility:hidden;pointer-events:none;z-index:101;';
  const scene = document.createElement('div');
  scene.style.cssText = `position:absolute;top:0;left:0;width:${innerWidth - scrollbar}px;height:100svh;perspective:var(--scene-perspective);`;
  const stage = document.createElement('div');
  stage.style.cssText =
    'position:absolute;top:50%;left:var(--stage-left);transform-style:preserve-3d;transform:scale(var(--scene-scale)) rotateX(var(--flight-tilt));';
  stage.style.setProperty('--flight-tilt', '0deg');
  const group = document.createElement('div');
  group.style.cssText =
    'position:absolute;top:0;left:0;transform-style:preserve-3d;transform:rotateZ(var(--ladder-incline));';
  const l3d = document.createElement('div');
  l3d.style.cssText =
    'position:absolute;top:0;left:0;width:var(--ladder3d-w);height:var(--ladder3d-h);transform:translate(-50%, -50%);';
  const clone = svg.cloneNode(true) as SVGElement;
  l3d.appendChild(clone);
  group.appendChild(l3d);
  stage.appendChild(group);
  scene.appendChild(stage);
  flight.appendChild(scene);
  document.body.appendChild(flight);

  // Size the clone to the box's drawn-content area. The real showcase SVG letterboxes inside
  // .ladder3d (width/height 100% + `xMidYMid meet`; the box ratio need not equal the viewBox
  // ratio), so a clone filling the box would render the ladder narrower than the box itself.
  // This draws identically to the real one while keeping the clone's rect measurable.
  const boxW = parseFloat(getComputedStyle(l3d).width);
  const boxH = parseFloat(getComputedStyle(l3d).height);
  const vb = (svg as SVGSVGElement).viewBox.baseVal;
  const fit = Math.min(boxW / vb.width, boxH / vb.height);
  clone.style.cssText = `position:absolute;left:50%;top:50%;width:${vb.width * fit}px;height:${vb.height * fit}px;transform:translate(-50%, -50%);display:block;`;
  return { flight, stage, clone };
}

async function onEntryClick(event: MouseEvent) {
  const link = event.currentTarget as HTMLAnchorElement;
  const href = link.getAttribute('href');
  if (!href || prefersReduced()) return; // let the normal navigation happen

  const hole = link.querySelector<HTMLElement>('[data-hole]');
  if (!hole) return;
  const clip = link.querySelector<HTMLElement>('[data-ladder-clip]');
  const rim = link.querySelector<HTMLElement>('[data-rim]');
  const ladder = link.querySelector<HTMLElement>('[data-entry-ladder]');
  const ladderSvg = ladder?.querySelector('svg');

  event.preventDefault();
  const rect = hole.getBoundingClientRect();

  // Build the flight chain and overlay its (flat, tilt 0) clone exactly on the landing
  // ladder: both are the same artwork at the same incline, so bbox centres + one uniform
  // scale on the wrapper align them pixel-for-pixel.
  let flight: { flight: HTMLElement; stage: HTMLElement; clone: SVGElement } | null = null;
  if (ladder && ladderSvg) {
    flight = buildFlight(ladderSvg);
    const first = ladderSvg.getBoundingClientRect();
    const flat = flight.clone.getBoundingClientRect();
    const c0x = flat.left + flat.width / 2;
    const c0y = flat.top + flat.height / 2;
    gsap.set(flight.flight, {
      x: first.left + first.width / 2 - c0x,
      y: first.top + first.height / 2 - c0y,
      scale: first.width / flat.width,
      transformOrigin: `${c0x}px ${c0y}px`,
    });
  }

  // Elliptical clip window over the existing hole, grown until it clears every corner.
  // Both radii scale by the SAME factor the rim scales by, with the same ease — the clip edge
  // and the rim's masked opening are the same ellipse throughout, so only one oval is visible.
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const rx0 = rect.width / 2;
  const ry0 = rect.height / 2;
  const scaleEnd = coverScale(rect);

  // Viewport-sized sky cover (same framing as the showcase), revealed by the clip below.
  const cover = makeSkyCover();

  const setClip = (rx: number, ry: number) =>
    cover.style.setProperty('clip-path', `ellipse(${rx}px ${ry}px at ${cx}px ${cy}px)`);
  setClip(rx0, ry0);

  if (clip) gsap.set(clip, { zIndex: 101 });
  if (rim) gsap.set(rim, { zIndex: 102, willChange: 'transform' });
  sessionStorage.setItem(REVEAL_KEY, '1');
  sessionStorage.setItem(INTRO_KEY, '1'); // tells the showcase to play its entrance

  const grow = { v: 0 };
  const open = { v: 0 };
  const tl = gsap
    .timeline({ defaults: { duration: 0.9, ease: 'power2.inOut' } })
    .to(
      grow,
      {
        v: 1,
        onUpdate: () => {
          const k = 1 + (scaleEnd - 1) * grow.v;
          setClip(rx0 * k, ry0 * k);
        },
      },
      0
    )
    .to(rim, { scale: scaleEnd }, 0)
    // Open the ladder clip on every side, in step with the sky, so the lifting ladder stays
    // revealed (and never ends abruptly at the old stage edge).
    .to(
      open,
      {
        v: 1,
        onUpdate: () => {
          const e = -60 - 540 * open.v;
          // Bottom starts at the resting 2% inset (see LadderEntry.astro) and opens downward.
          clip?.style.setProperty('clip-path', `inset(${e}% ${e}% ${2 - 602 * open.v}% ${e}%)`);
        },
      },
      0
    );
  // The lift starts only once the sky has (almost) fully taken over (by then the clip and
  // rim are fully open): the flight clone takes over from the (identical, overlaid) landing
  // ladder and rises into the showcase resting pose — wrapper to identity, tilt to its token.
  if (flight) {
    const tilt = getComputedStyle(document.documentElement).getPropertyValue('--stage-tilt').trim();
    tl.set(ladder!, { visibility: 'hidden' }, 0.75)
      .set(flight.flight, { visibility: 'visible' }, 0.75)
      .to(flight.flight, { x: 0, y: 0, scale: 1, duration: 0.85, ease: 'power3.inOut' }, 0.75)
      .to(flight.stage, { '--flight-tilt': tilt, duration: 0.85, ease: 'power3.inOut' }, 0.75);
  }
  await tl;
  navigate(href);
}

/** On arriving at the showcase: the sky and the ladder are pixel-continuous across the
 * swap (shared --sky-bg framing + the flight's end pose), so nothing may be covered —
 * a cover over the just-landed ladder reads as a blink. Only the fixed chrome (back
 * link, language toggle), absent on the landing, eases in. */
function playReveal() {
  if (!sessionStorage.getItem(REVEAL_KEY)) return;
  sessionStorage.removeItem(REVEAL_KEY);
  if (prefersReduced()) return;

  const chrome = document.querySelectorAll('.showcase-back, .lang-toggle');
  if (chrome.length)
    gsap.from(chrome, { opacity: 0, duration: 0.45, ease: 'power1.out', clearProps: 'opacity' });
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
