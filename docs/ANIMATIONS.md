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
| Works end-card dune (falling cherry) | `src/components/works/DuneScene.astro` |
| Artifact-page parallax | `src/scripts/artifact.ts`, `worlds/*`, `.world` in `global.css` |
| Contacts micro-motion (floating labels, sweeping rules) | `src/components/pages/ContactsPage.astro` |

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
is open; `jumpTo` moves page and Lenis together for scroll restoration. The HMR
`dispose` hook exists because two live Lenis instances fight over the wheel and
scrolling freezes in dev.

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
(`starburst-label-peek`, 4.4s after a 0.6s delay): 0.6em below its place at opacity 0, it
slides up and fades to full opacity (the same as hover) over ~2.2s on a symmetric `cubic-bezier(0.42, 0, 0.58, 1)`
(deliberately not `--ease-out` — that expo curve front-loads the rise, so its tail crawls
and reads as extra hold), holds ~0.5s, then sinks back down and out over ~1.7s. The peek is suppressed while `html.is-loading` is set, so its delay starts
when the first-paint gate lifts rather than playing to a hidden page. **Hover/focus** brings it back — 0.45s up to full
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
   the showcase uses. That's why the hole can "grow" seamlessly later. It must therefore
   carry **no transform** (it is centred with `left: 4%`, not `translate: -50% 0`): a
   transform re-anchors a fixed background to the element's own box, which showed a
   blown-up crop of the image centre and made the sky jump the instant the transition's
   viewport-framed cover took over.
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

**The tiger's mouth** (`PanelCard.astro` + `mouthOpen` in `showcase.ts`). The "MY" artwork is
the chest with its mouth shut; over one column of it (`panel.mouth.box`, in % of the artwork's
own box) sit two strips, both plain rectangles: `open`, cut from a second photo of the piece
with its drawer pulled out, and `shut`, cut from the artwork itself. `--mouth-open` drives
both as **one moving seam**: the open strip scales vertically about its *top* edge (the jaw
line), the shut strip about its *bottom* edge at `--mouth-squeeze` times the rate, so the two edges
always meet, and the shut strip is gone by the time the open one is ~63% out. That rate is
measured to the open strip's **seam row** (`mouth.open.seam`), not to its full height: below
that row only the drawer pull hangs free, and chasing the file's bottom edge instead parts
the strips around that overhang. So the whole drawer is present from the first frame,
squashed flat against the jaw line, and unfolds downward while pushing the closed face out
of sight — not a curtain lifting off a still picture. The strips are rectangles *because* they
are scaled: a shaped cut-out would deform against paint that is not moving, while straight
sides stay straight. The open strip is the taller file, so at full stretch it hangs past the
bottom of the card box, as the real drawer does. The drive is
`cos(worldAngle)` — the same number that sets the panel's apparent size — smoothstepped from
shut at `cos 0.1` to open at `0.85`: the piece comes at you growing *and* opening, and shuts
again on the way out. At ≤ 1100px (phones either way up) the window narrows to `0.6 → 0.93`,
since a side-on panel is still off-screen there — both moves happen in view. The same three layers are packaged as `TigerPiece.astro` and reused
twice off the spiral: as the first card of the works run and as the hero of the page that
card opens (artifacts flagged `tiger` in `artifacts.ts`; artwork and strip geometry shared
from `tigerArt`/`mouthVars` in `panels.ts`). Only the drive differs — there is no orbit
there, so **hover** flips `--mouth-open` 0 → 1 and each strip's `scale` transitions across
it, eased to match the smoothstep. Hover also shakes the piece: `tiger-shake`, three swings
that die away over 0.42s about a pivot high in the box, one shot per hover rather than an
idle loop. The angles are small (±1.8° at most) because the piece is wide — a couple of
degrees already throws its far corners a long way. In the run it is 160% of its card box
and hangs a little below its centre, about as low as it can go: wide enough to read,
narrow enough to keep its corners clear of the run's clipped top edge while it swings, and
low enough that the fully hung drawer reaches just past the bottom of the box — what is
left between there and the title is all the room it has, since the title row is shared
alignment and cannot move. The whole artwork (all three layers) also tilts,
`--glide` — a function of the orbit, not of the clock, so it only turns while the page is scrolling. It is spread
over the panel's *whole journey* rather than repeating every turn: the world angle is
unwrapped (`spin` climbs past 360°), every panel makes its one frontal pass at worldDeg 360°
(the angle/turns coupling in `panels.ts`), and the swing runs ±240° — half a full spin —
either side of it. So the piece leans one way the entire time it is coming up, turns **once**,
60° past facing us, and swings back for the rest; each leg is smoothstepped, so that single
reversal eases rather than snaps. A swing that repeated every orbit instead would reverse two
or three times while the panel is on screen, which reads as ticking. Amplitude ±4.5°. That is
why the layers sit in their own `.card__art` box: the card's own transform is the spiral
billboard.

**Card placement & billboarding** (`PanelCard.astro`). Each card's transform is
`rotateY(angle) translateZ(radius) translateY(drop) rotateY(−(spin+angle))`: the first
three place it on the spiral (inside the spinning group), the final counter-rotation
cancels the *total* world rotation so the card always faces the viewer. A `form: 'object'`
panel (a cut-out with no frame) overrides `--card-w/--card-h` inline from its artwork's
proportions, so the same billboard transform drives a box of any shape.

**The occlusion sandwich** (`Scene.astro`). Three sibling `.scene` layers — cards
behind / ladder / cards in front — each with its **own** `perspective`, i.e. its own
flattened 3D context. Planes in separate contexts can never slice through each other
(which real shared-context 3D would do, ugly). `sortLayers()` in `showcase.ts` moves
each card DOM node between the back/front groups as it orbits, so cards still *read* as
going around the ladder. The cut-off (`isFrontOfLadder`, `panels.ts`) is **not** the
`z = 0` crossing but `cos(spin + angle) ≥ radius / perspective`: under perspective a
card's apparent x is `P·r·sin t / (P − r·cos t)`, which turns around ~17° later than
z = 0 does. Swapping at z = 0 pops a card in front of the ladder while it is still
visibly travelling outward — it reads as cutting straight through the ladder. Swapping
at the turning point, a card stays behind for its whole outward swing and returns to the
front only once it is genuinely on its way back.
The `.scene` layers are `pointer-events: none`; clicks land on each card's own `<a>`
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

**Scroll memory.** Leaving the showcase stores `window.scrollY` in `sessionStorage`
(`decorosa:showcase-scroll`, written on `astro:before-swap` and `pagehide`, only while
the showcase is the live page). Coming back — link, back button or reload — the scene
fades in while gliding down to that height, so the spiral turns back into place.
`showcase-return.ts` (global, since the page script may not be loaded yet) sets the start
pose on `astro:after-swap`: `html.is-returning` hides `[data-driver]` and the page is
scrolled (instantly — `html` is `scroll-behavior: smooth`) half a viewport above the
stored height. It has to be then, inside the view transition's update: by
`astro:page-load` the new page is already captured and on screen. `restoreScroll()` then
syncs Lenis to that pose (`jumpTo`, before the ScrollTrigger is created, so the first
spin/panel sort match), and a frame later drops the class (0.9 s opacity fade,
`global.css`) and `glideTo`s the stored height (Lenis, input locked, ease-out, 1.3 s). Arriving from the landing is the exception: the intro replays,
so the stored offset is dropped and the page starts at the top.

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
as it crosses the middle. The photo is always on show; its label (title + description) is
a dark tab tucked behind it (`z-index: -2` in the card's stacking context, under the
comic's plates) that slides out of its right edge, bottom-aligned, a tint stripe on the
shared edge; under 40rem it rises above the card instead. `--hover` drives it (plus a
little extra swell): set by `:hover` only under `(hover: hover)` — a tap would stick it
on — and by `:focus-visible`. On touch (`hover: none`) `markCentreEvent` in `bio.ts` puts
`data-active` on the event nearest the centre (within 35% of the viewport width, a 24px
handover margin so a scroll stopping between two events never flickers), which sets
`--hover` too; it runs even under reduced motion, since the label is content. The label
is `pointer-events: none` and its slot is lifted (`z-index`) while it shows. A
multi-page event (the comic) shows as a pile: two tinted plates behind the top page,
fanned a little further apart on hover. A card with media is a button that opens that
event's `<dialog>` as a panel over nearly the whole viewport (96vw × 94svh): close row,
artwork row, caption. A card whose media is a video has no still to show, so it keeps its
tint under a play mark. The panel's layout hangs off `.bio-zoom[open]`, never the dialog
itself — a plain `display: grid` there outranks the UA's `dialog:not([open])` rule and
leaves every panel sitting open on the page. The artwork row is a flex row taking every pixel left over — each
page whole and as tall as the panel allows, the set scrolling sideways (`justify-content:
safe center`, so centring never pushes the first page out of reach) with the shared
`wheelToHorizontal` on it. The dialogs sit outside the timeline's scroller, so its own
wheel handler never fires under an open one; `bio.ts` opens them by delegation and closes
on the close button, on Escape, or on a click that lands outside the dialog's own box (the
backdrop reports the dialog itself as its target).

**Works run** (`works.ts`, `WorksPage.astro`). A finite strip: the artifact cards, then
the two `EndCard`s that leave the section (tiles page, back to the showcase). The track
carries half a viewport of padding at each end, so the first and the last card can each
be brought to the centre — no JS start offset, `scrollLeft: 0` already opens on the first
card dead centre. `--near` swells the card crossing the centre — every title sits in a
fixed two-line box (a long label overflows it instead of growing the card), so all the
cards keep the same height and stay aligned as they scale. On click the clicked
card's media is stamped with `view-transition-name: artifact-hero`; the artifact page's
hero carries the same name in CSS, so Astro's View Transition morphs the card into the
page. Coming back (back pill or browser back) from a card's page — a detail page, or the
tiles page — the run opens centred on that card instead: `came-from.ts` records the path
each SPA swap leaves, and `works.ts` matches it against the `href` of the cards marked
`data-return` (every artifact card, and the tiles `EndCard` via `returnHere`; not the
back-to-showcase card, so arriving from the showcase still starts at the first card). The tiles `EndCard`'s plate is the "Dessert" painting with its cherry and the
cherry's cast shadow lifted off (`assets/works/dessert*.webp`); `works/DuneScene.astro`
lays both back over it in an SVG whose viewBox is the plate's pixel grid, so they sit
exactly where they were cut from. One 7.5s CSS loop — gravity fall from above the plate's
top edge, squash-and-jiggle on contact with two small hops (`transform-origin` at the
image's bottom edge, the point that touches the sand), a few seconds at rest, a fade out
in place, then it waits offstage before falling again. While the cherry falls, its shadow
wipes in from the dune's foot to the peak — an SVG `<mask>` whose rect is three shadow
heights tall (dark top third, a soft band, then lit) slides up 1.1 shadow heights,
landing with the cherry; the dark third keeps the soft band clear of the shadow at rest,
so nothing shows before the wipe — its tip draws back a little on each hop, and it fades
out alongside the cherry.

**Artifact pages** (`artifact.ts`, `ArtifactPage.astro`, `worlds/*`). The world is a 300vw
track scrolled sideways with `wheelToHorizontal` + `applyDepthParallax`. `.world` has
`overflow: hidden` so translated layers can't extend the scroll range past 300vw (would
expose the black page background). The world components are pure scenery; the page slots
its hero + caption into them.

## Dark-side accordion — `DarkSidePage.astro`

No script: three `<details>` sharing one `name`, which is what makes them mutually
exclusive. The glide is CSS only — `::details-content` animates `block-size` from `0` to
`auto` (unlocked by `interpolate-size: allow-keywords` on the wrapper) with
`content-visibility` in `transition-behavior: allow-discrete`. Browsers without
`::details-content` simply snap open, which is the correct fallback. The summary marker is
a hairline cross whose vertical stroke collapses (`background-size` → `0`) as the panel
opens.

The backdrop (gradient + mirrorball + animal) is a `position: fixed` layer, so it holds
still while the column scrolls over it.

Rows of the "Prodotti disponibili" list don't fade their wash in, they *open it from the
middle*: a `::before` with feathered gradient ends goes `scale: 0 1` → `1 1` about its own
centre over 2.5s — far slower than the usual hover, because the spread is the whole
gesture. Text and icon are untouched; the row still nudges 0.3rem right.

## Contacts micro-motion — `ContactsPage.astro`

No script either. The fields carry `placeholder=" "`, so `:placeholder-shown` (plus
`:focus`) tells CSS whether the floating label sits on the baseline or has ridden up into
its uppercase micro-label position. Focus is drawn by a red rule scaled from `0 1` to
`1 1` (`transform-origin: left`) over the field's resting hairline — which is why the
inputs turn the global focus outline off. The Email / Instagram values underline
themselves the same way, animating a `background-size` from `0` to `100%`, and the submit
pill grows its arrow out of zero width so its box never changes size (same trick as the
dark-side call to action).

---
*Keep this file and ARCHITECTURE.md up to date with every significant change.*
