# DECOROSA — How the animations work

Map of the moving parts, in the order a visitor meets them.

| System | Files |
|---|---|
| Smooth scrolling | `src/scripts/lenis.ts` |
| The ladder drawing | `src/components/Ladder.astro` |
| Landing wordmark (starburst → Contacts) | `src/components/Logo.astro`, `src/scripts/logo.ts` |
| Landing entry composition | `src/components/LadderEntry.astro` |
| Entry transition (landing → showcase) | `src/scripts/transition.ts`, `.sky-cover` in `global.css` |
| Showcase spiral | `src/scripts/showcase.ts`, `showcase/Scene.astro`, `PanelCard.astro`, `Ladder3D.astro` |
| Sideways sections (bio / works / artifact) | `src/scripts/hscroll.ts` + `bio.ts`, `works.ts`, `artifact.ts` |
| Artifact-page parallax | `src/scripts/artifact.ts`, `worlds/*`, `.world` in `global.css` |

**Reduced motion:** everything below is skipped when `prefers-reduced-motion` is on
(`motion.ts → prefersReduced()`), and the showcase swaps to a plain list via CSS.

## First-paint gate — `BaseLayout.astro` + `global.css`

On hard loads, an inline `<head>` script adds `.is-loading` to `<html>` before anything
paints (`html.is-loading body { opacity: 0 }`), and removes it once `window.load`,
`document.fonts.ready` and the sky texture (`/assets/sky.jpg` — keep in sync with
`--sky-bg`) have all resolved, capped at 2.5s. The page then appears all at once via a
fast (0.15s) body opacity fade — no staggered glyph pop-in, no sky reflow. SPA swaps
are untouched (the script is head-inline, so it doesn't re-run).

## Smooth scrolling — `lenis.ts`

Lenis intercepts the wheel and eases the real scroll position toward it (lerp 0.1).
It is driven by GSAP's ticker and pings `ScrollTrigger.update` on every scroll, so the
spiral animation stays in sync. `initLenis`/`destroyLenis` are idempotent because View
Transitions re-run page scripts; `stopLenis`/`startLenis` pause it while a detail panel
is open. The HMR `dispose` hook exists because two live Lenis instances fight over the
wheel and scrolling freezes in dev.

## The ladder drawing — `Ladder.astro`

One SVG used on both the landing and the showcase — that sameness is what sells the
entry transition. It fakes 3D at build time: each rail is three quads (front, top,
side) extruded up-and-right; rungs are round-capped rects. Depth comes purely from
paint order: left rail → rungs → right rail, so rung ends sit visibly *on* the left
rail but tuck *behind* the right one. `rungs` sets the length (landing/showcase use 95);
the viewBox is computed so the SVG scales to any size.

## Landing wordmark — `Logo.astro`

The starburst-TM is the only clickable glyph, so it advertises itself two ways: a **slow
idle spin** (20s linear) catches the eye, and the **`nav.contacts` label** centred above
it, in the ladder label's type treatment, names the destination.

The label is invisible at rest. It **peeks once** when the page appears
(`starburst-label-peek`, 2.8s): 0.6em below its place at opacity 0, it slides up and
fades to the resting 0.5, holds ~1s, then sinks back down and out over ~1.2s. The peek is
suppressed while `html.is-loading` is set, so it starts when the first-paint gate lifts
rather than playing to a hidden page. **Hover/focus** brings it back — 0.45s up to full
opacity, against a slower 1.1s fall on the way out (the two halves live on the `:hover`
and base `transition` respectively) — freezes the spin (`animation-play-state: paused`)
and pops the star to `rotate(-18deg) scale(1.1)`, a counter-turn against the direction it
was spinning.

The peek lives on an `.is-peeking` class, and `logo.ts` strips that class the moment the
animation ends **or** the pointer/focus arrives — a one-way handoff from animation to
transitions. That is what lets a hover *during* the peek take the label over mid-flight;
expressing it in CSS alone does not work, because a running animation outranks the
transition, and cancelling it from inside the `:hover` rule would restart it on the way
out. The handoff also has to freeze the peek's current `opacity`/`translate` inline,
flush, then release them: Chrome does not interpolate out of a *cancelled* animation, so
without that pin the label snaps to the hover pose instead of rising into it.

One last detail: the label's `padding-bottom` bridges the gap down to the star, so a
pointer travelling from glyph to label never leaves the link.

The glyph is **two transparent layers on one crop**: `starburst.png` is the star
silhouette with its TM counters filled in, `starburst-tm.png` the white TM alone, laid
over it and left out of the rotation — so the badge spins while its lettering stays
upright. Only the star's `<img>` and its `.starburst__spin` wrapper move; the `<a>` and
the label must stay untransformed, or the label would ride along.

Under reduced motion the spin and the pop are dropped and the label sits at 0.75 opacity,
carrying the affordance alone.

## Landing entry composition — `LadderEntry.astro`

Three stacked layers recreate the brand image "ladder into a hole":

1. `[data-hole]` (z1) — the sky ellipse. Its background uses `background-attachment:
   fixed`, so the ellipse is a *window* onto a viewport-sized sky — the exact framing
   the showcase uses. That's why the hole can "grow" seamlessly later.
2. `[data-ladder-clip]` (z2) → `[data-entry-ladder]` → incline wrapper → the SVG.
   The ladder has 95 rungs but only the top shows; `clip-path: inset(...)` hides the
   long tail hanging below the stage. Outer element = position/size only (the
   transition overlays its flight clone on *it*); inner element = the fixed 13°
   incline. Hover nudges the incline up slightly.
3. `[data-rim]` (z3) — a page-coloured overlay whose CSS `mask` keeps it opaque only
   *below the hole's centre line and outside the ellipse*: the crescent of "ground" in
   front of the hole. It occludes the ladder's lower length exactly along the curve.
   Mask geometry mirrors the hole's (centre 50%/78.75%, radii 46%/17.25%).

## Entry transition — `transition.ts`

Clicking the entry runs a GSAP timeline instead of a normal navigation:

1. **Build the flight.** `buildFlight()` appends a live replica of the showcase
   transform chain (`.scene → .stage → .ladder-group → .ladder3d`) with a clone of the
   landing SVG inside, sized to the box's drawn-content area (the real SVG letterboxes
   in `.ladder3d`). The stage tilt starts at 0deg (flat), so the clone is overlaid
   exactly on the landing ladder with a 2D translate + uniform scale on the wrapper.
   The replica scene is sized to the showcase's scrolling viewport (classic-scrollbar
   probe). All shared values (perspective, stage offset/tilt/scale, incline, ladder
   size) come from the scene tokens in `tokens.css`, so they can't drift from
   `Scene.astro`; ⚠ only the *structure* of the replica chain must still mirror it.
2. **Grow the hole.** A fixed, viewport-sized sky cover (`.sky-cover`) is added and
   clipped to an ellipse exactly over the existing hole, then the clip radii grow by
   `coverScale()` (the factor at which the ellipse contains all four viewport corners).
   Only the clip window grows — the sky image never scales — so the end state matches
   the showcase backdrop pixel-for-pixel. In step, the rim scales out by the same
   factor with the same ease (clip edge and rim opening are the same ellipse
   throughout) and the ladder's clip opens to release the hidden tail.
3. **Lift the ladder.** At t=0.75s the landing ladder is hidden and the (identical,
   overlaid) flight clone takes over; wrapper → identity and stage tilt → `--stage-tilt`
   tween together (0.85s, power3.inOut), so the flight ends pixel-identical to the real
   perspective-rendered showcase ladder. (A 2D FLIP can't do this: the perspective
   foreshortening is non-affine over the ladder's length, so bbox matching leaves a
   visible size/offset snap.)
4. **Hand off.** Two sessionStorage flags are set, then `navigate(href)` swaps pages.
   The swap itself is pixel-continuous: the flight ends on the real ladder's pose, and
   every sky paint (hole, cover, showcase backdrop) shares one viewport-anchored
   framing — `--sky-bg` in `tokens.css` uses an explicit, scrollbar-independent
   `background-size` instead of element-based `cover`, so the scrollbar appearing on
   the showcase can't reframe the image. On arrival, `playReveal()` (flag
   `decorosa:entering`) only fades in the fixed chrome (back link, language toggle) —
   covering the just-landed ladder would read as a blink — and `showcase.ts →
   playIntro()` (flag `decorosa:enter-intro`) plays the spiral entrance.

## Showcase spiral — `Scene.astro` + `showcase.ts`

**Scroll driver.** The scene is `position: sticky` inside a tall section
(`(panels+1) × 130svh`). A single ScrollTrigger scrubs progress 0→1 across it; all
motion derives from that one number, written to CSS custom properties:

- `--spin` = `progress × 360° × turns` on the two card groups; `−spin` on the ladder
  (counter-rotation makes the spiral feel mechanical, like a rotisserie).
- `--descend` = `−progress × travel` on the stage (camera descends past the lowest
  card, `travel = max(dropY)`).
- `--sky-shift` = slight sky drift for parallax.

**The turns constant.** With cards every 120° and `turns = 4/3`, each card completes
`(4/3×360 − 120×i)°`... in practice: every card arrives *facing front exactly when its
dropY passes viewport centre*. Change card count/angles/drops and `turns` must be
retuned together (see the note in `panels.ts`).

**The side titles** (`PanelCard.astro` + `sortNear` inside `onSpin`). Each panel carries
its big Futura title to its right. A panel's apparent size comes from perspective alone —
`scale(z) = P / (P − z)` with `z = radius·cos(worldAngle)` — so "the closer half of its
size range" is a fixed z threshold: the z at which `scale` reaches the midpoint of
`[scale(−r), scale(+r)]` (`nearThresholdZ` in `showcase.ts`). Crossing it toggles
`.is-near`, and CSS fades/slides the title in. Because the title lives inside the card's
3D box and is sized in px, perspective grows it with the panel as it approaches.

**Card placement & billboarding** (`PanelCard.astro`). Each card's transform is
`rotateY(angle) translateZ(radius) translateY(drop) rotateY(−(spin+angle))`: the first
three place it on the spiral (inside the spinning group), the final counter-rotation
cancels the *total* world rotation so the card always faces the viewer.

**The occlusion sandwich** (`Scene.astro`). Three sibling `.scene` layers — cards
behind / ladder / cards in front — each with its **own** `perspective`, i.e. its own
flattened 3D context. Planes in separate contexts can never slice through each other
(which real shared-context 3D would do, ugly). `sortLayers()` in `showcase.ts` moves
each card DOM node between the back/front groups whenever its orbit z-sign changes
(`cos(spin + angle) ≥ 0` → front), so cards still *read* as orbiting around the ladder.
The `.scene` layers are `pointer-events: none`; clicks land on each card's `.card__hit`
button.

**The ladder's thickness** (`Ladder3D.astro`). A single spinning plane would vanish
edge-on, so the ladder is three planes, each rendering one `part` of the shared SVG
(full viewBox each, so at rest they stack back into the exact flat drawing —
pixel-identical to the flight clone). The rung plane spins with the group (rungs
foreshorten naturally); each rail is counter-rotated (`rotateY(−spin)`, pivoted via
`transform-origin` on the centre of its drawn strip) so it always faces the viewer:
the rails still converge as the ladder turns (their pivot lines orbit the axis) and
with perspective distance, but keep their drawn width. Centre pivots keep the rung
junctions covered in every phase (the strip extends equally both sides of the pivot)
and make the rails converge exactly onto each other edge-on. There, a seamless flat
silhouette of each rail (`rail-*-flat` parts) fades in over the isometric faces
(opacity `sin⁴(--spin)`, 0 at rest) so the side reads as one solid white face instead
of a striped double edge. Tiny ±0.5px `translateZ` biases reproduce the flat paint
order (rungs over left rail, right rail over rungs) without coplanar z-fighting.
`--ladder3d-w` is derived from the height so the box matches the viewBox ratio
exactly — the rail pivot origins are plain viewBox percentages.

**Rendering gotchas encoded here:** an `<svg>` directly inside `preserve-3d` fails to
rasterize in Chrome — hence the flat wrapper div in `Ladder3D.astro`; and
`overflow: hidden` + `perspective` on the same node breaks 3D in Safari — hence
`.scene-clip` (clip) separate from `.scene` (perspective).

**Entrance intro** (`playIntro`). When arriving via the entry transition, the card
groups start one "scroll slot" back (−240° spin, +700px `--rise`) and ease to rest
over 2.4s — the first panel enters exactly like panels do on scroll. The ladder is left
alone; it just landed via the flight. Two guards keep it clean: an inline pre-paint
script in `Scene.astro` (re-run on SPA swaps via `data-astro-rerun`) parks the spirals
in the start pose *before first paint*, so the first card never flashes at rest; and
scroll is locked for the duration (`stopLenis` + the ScrollTrigger update ignored via
an `introPlaying` flag), with any leaked scroll (scrollbar/keyboard) reset to 0 on
completion before control is handed back.

## Sideways sections — `hscroll.ts`

The three horizontal sections are plain overflow-x containers, not panels: `hscroll.ts`
holds the parts they share and each page's controller supplies the rest. All three are
lifecycle-safe (listeners collected in a `cleanup` array, dropped on `astro:before-swap`)
and Lenis is not involved — these pages don't scroll vertically at all.

- `wheelToHorizontal` — vertical wheel becomes `scrollLeft`; trackpad `deltaX` passes
  straight through to the browser.
- `onScrollFrame` — scroll + resize coalesced to one callback per animation frame.
- `writeCentreProximity` — writes `--near` (1 at the viewport's horizontal centre, 0 half
  a viewport away) so CSS decides what "closer" looks like. All rects are measured before
  any style is written, and unchanged values are skipped, so a still section costs nothing.
- `applyDepthParallax` — every `[data-depth]` layer gets
  `translateX(scrollLeft × (1 − depth))`: depth 1 moves with the content (reads as fixed
  to the world), depth ≈ 0 stays with the viewport.

**Bio timeline** (`bio.ts`, `BioPage.astro`). A ruler of spray-can strokes, one group per
event with the event's own (taller, tinted) stroke dead centre of its slot; the track's
lead-out is `50vw − (last slot)/2` so the scroll ends with the last event dead centre,
while the lead-in is half of the same figure (`25vw − (first slot)/4`) — the page opens
with the first event left of centre so the following events peek in from the right and
signal the scroll direction. A seeded RNG in the frontmatter lays every event out — slot width (years sit at
uneven distances, tick count follows so density stays even), near-square photo size and
aspect ratio, and the per-tick jitter (height, tilt, opacity) — so the irregularity is
identical on server and client and stable across builds. The spray look is one SVG filter
(`#spray`) applied to each ruler group: a slow displacement bends the strokes off-straight,
a blur is the overspray, a fast displacement the paint dust, and an alpha ramp gives back
the body the blur cost. `--near` swells each photo
as it crosses the middle; hover/focus adds `--hover`, which swells it a little further and
fades in the description over it.

**Works carousel** (`works.ts`, `WorksPage.astro`). One set of cards is rendered; the
script clones it to five and parks `scrollLeft` inside the middle copy, teleporting back
by whole sets whenever it leaves that band — the strip is identical every `period` px
(the set's own width, trailing gap included), so the jump is invisible. The initial
`scrollLeft` is offset so a card sits dead centre on open (then shifted by whole sets to
land inside the middle copy). `--near` swells
the card crossing the centre; since a teleport hands every card its neighbour's proximity
in one step, the viewport wears `.is-jumping` for that frame so the swell snaps instead of
easing (otherwise the whole row visibly re-animates each lap). On click the clicked card's media is stamped with
`view-transition-name: artifact-hero`; naming it only at click time keeps the identical
loop clones from colliding over the name, and the artifact page's hero carries the same
name in CSS, so Astro's View Transition morphs the card into the page.

**Artifact pages** (`artifact.ts`, `ArtifactPage.astro`, `worlds/*`). The world is a 300vw
track scrolled sideways with `wheelToHorizontal` + `applyDepthParallax`. `.world` has
`overflow: hidden` so translated layers can't extend the scroll range past 300vw (would
expose the black page background). The world components are pure scenery; the page slots
its hero + caption into them.

---
*Keep this file and ARCHITECTURE.md up to date with every significant change.*
