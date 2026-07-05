// Hole-widening entry transition between the landing and the showcase.
//
// Clicking [data-entry] reveals a viewport-sized `cover` sky through a growing elliptical clip
// that starts exactly over the existing hole — so the sky never scales (no stretch) and ends
// framed identically to the showcase background. In step, the front rim [data-rim] opens (its
// elliptical mask scales out), the clip [data-ladder-clip] opens fully, and the ladder itself
// is FLIPped — translated up and scaled down — onto the exact spot where the showcase ladder
// rests (measured off-screen via a replica of the showcase transform chain), so the page swap
// is seamless. On arrival, a matching sky cover fades out to hide the swap. Falls back to plain
// navigation when motion is reduced.
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

// On-screen rect of the showcase ladder at rest. Built by mirroring the showcase transform
// chain (Scene.astro: .scene → .stage → .ladder-group → .ladder3d) off-screen and measuring a
// clone of the (geometrically identical) landing ladder SVG — so the browser does the
// perspective math and the target is exact. All shared values come from tokens.css custom
// properties (they resolve on these inline styles too, media queries included); only the
// *structure* of the chain must track Scene.astro.
function measureShowcaseLadder(svg: SVGElement): DOMRect {
  const scene = document.createElement('div');
  scene.style.cssText =
    'position:fixed;inset:0;perspective:var(--scene-perspective);visibility:hidden;pointer-events:none;z-index:-1;';
  const stage = document.createElement('div');
  stage.style.cssText =
    'position:absolute;top:50%;left:var(--stage-left);transform-style:preserve-3d;transform:scale(var(--scene-scale)) rotateX(var(--stage-tilt));';
  const group = document.createElement('div');
  group.style.cssText =
    'position:absolute;top:0;left:0;transform-style:preserve-3d;transform:rotateZ(var(--ladder-incline));';
  const l3d = document.createElement('div');
  l3d.style.cssText =
    'position:absolute;top:0;left:0;width:var(--ladder3d-w);height:var(--ladder3d-h);transform:translate(-50%, -50%);';
  const clone = svg.cloneNode(true) as SVGElement;
  clone.style.cssText = 'width:100%;height:100%;display:block;';
  l3d.appendChild(clone);
  group.appendChild(l3d);
  stage.appendChild(group);
  scene.appendChild(stage);
  document.body.appendChild(scene);
  const rect = clone.getBoundingClientRect();
  scene.remove();
  return rect;
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

  // FLIP target: where the showcase ladder will rest, vs. where ours sits now. Aligning the
  // bbox centres + width matches it exactly (same SVG geometry, same incline).
  let flip: { x: number; y: number; scale: number; origin: string } | null = null;
  if (ladder && ladderSvg) {
    const first = ladderSvg.getBoundingClientRect();
    const last = measureShowcaseLadder(ladderSvg);
    const box = ladder.getBoundingClientRect();
    const fcx = first.left + first.width / 2;
    const fcy = first.top + first.height / 2;
    flip = {
      x: last.left + last.width / 2 - fcx,
      y: last.top + last.height / 2 - fcy,
      scale: last.width / first.width,
      origin: `${fcx - box.left}px ${fcy - box.top}px`,
    };
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
  if (ladder) gsap.set(ladder, { willChange: 'transform' });
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
  // The lift starts only once the sky has (almost) fully taken over, so the hole-grow reads
  // first and the ladder then rises to meet its showcase resting spot.
  if (flip)
    tl.to(
      ladder,
      { x: flip.x, y: flip.y, scale: flip.scale, transformOrigin: flip.origin, duration: 0.85, ease: 'power3.inOut' },
      0.75
    );
  await tl;
  navigate(href);
}

/** On arriving at the showcase, fade a covering sky away to hide the page swap. */
function playReveal() {
  if (!sessionStorage.getItem(REVEAL_KEY)) return;
  sessionStorage.removeItem(REVEAL_KEY);
  if (prefersReduced()) return;

  const cover = makeSkyCover();
  gsap.to(cover, { opacity: 0, duration: 0.45, ease: 'power1.out', onComplete: () => cover.remove() });
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
