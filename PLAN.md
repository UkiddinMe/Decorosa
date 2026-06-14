# DECOROSA — Artist Portfolio Site: Build Plan

> Context document for the Claude Code on the web (Ultraplan) session. It captures every
> decision agreed in the originating conversation so the remote session can refine and
> implement without re-deriving context.

## Context

The client is building a **scenographic portfolio/showcase** for an artist ("Decorosa")
who paints furniture and objects in an artistic way. The site is greenfield — the repo
contains only three empty placeholder files (`index.html`, `style.css`, `script.js`), so
we start from scratch.

The experience is the product. The agreed concept:

- **Landing:** the "DECOROSA" wordmark (hand-cut collage letters, each a different color,
  on white) + an Italian slogan. The **starburst-TM "O" is a clickable hotspot →
  Contacts** (see Logo asset below).
- A **ladder descending into a hole** with "Entra nel mood". Clicking it **widens the
  hole to fill the viewport** (a "going down" transition) into the showcase.
- **Showcase:** pieces arranged in a **spiral around a diagonally-inclined ladder**.
  On scroll, the ladder and the pieces **rotate in opposite directions** about a
  vertical axis.
- Each piece opens a **side detail panel** navigated by **horizontal parallax scroll**,
  each styled as a distinct bespoke **"world"** (e.g. disco hall — *The dark side of
  the mood*; domestic jungle; desert — *DESSERT*).

**Slogan (Italian):** "Un progetto artistico che vuole dare nuova vita a qualcosa che non
sapevi potesse essere 'bello' — Un mobile | Un tessuto | Un oggetto | Un ambiente".

**Key content decision (already settled with the client):** every piece has its own
bespoke world, so there is **no CMS and no self-service editing**. When the artist
wants a new piece, she supplies the media assets + the intended aesthetic, and the
developer hand-codes a new world. This makes each world a code artifact, not data.

**Decisions confirmed with the client:**
1. Centerpiece rendered with **CSS 3D transforms + GSAP** (flat image-cards in 3D
   space; no WebGL / no 3D modeling — honors the "no 3D art" constraint and keeps
   mobile parity feasible).
2. Built on **Astro** (component-per-world, built-in image optimization, strong SEO,
   zero-JS-by-default with the showcase as a hydrated island).
3. **Bilingual IT / EN** with a language toggle.
4. Mobile must stay **as close as possible to the desktop experience**, adapted to
   device/width (not a stripped-down fallback).

## Logo asset (received)

- Logo received as a textured raster PNG (`~/Downloads/LOGO copia.png` — must be added to
  the repo, e.g. `public/assets/`): "DECOROSA" in a hand-cut **collage style**, each
  letter a distinct color/shape: D = sage-green triangle, E = orange, C = purple,
  **first O = round golden yellow**, R = red, **second O = black starburst containing
  "TM"**, S = black (paper texture), A = grey arch (paper texture), on a white background.
- **Two O's exist.** The clickable contacts hotspot is the **black starburst-TM (second
  O)** — confirmed by client. The round yellow O is NOT the link (left free to play the
  "hole" motif of the ladder/hole entry).
- **Asset approach:** the paper texture is part of the identity, so do NOT flat-vectorize
  the whole wordmark. Instead **slice the PNG into one transparent PNG per letter**,
  positioned in HTML, so the **starburst-TM** can be an isolated, clickable, animatable
  element (e.g. spin/pulse on hover, link to contacts). Recreate only as a fallback.
- **Palette tokens (from logo):** sage green, orange, lavender/purple, golden yellow,
  red, black, warm grey, white. Doubles as the world color language (jungle↔green,
  desert/DESSERT↔yellow/orange).

## Recommended Approach

### Tech stack
- **Astro** — pages, layouts, per-world components, image optimization, static output.
- **GSAP + ScrollTrigger** — scroll-driven rotation, hole-widening transition,
  horizontal parallax in detail panels.
- **Lenis** — smooth/inertial scrolling to support the "scenographic" feel.
- **CSS 3D transforms** (`perspective`, `transform-style: preserve-3d`,
  `translateZ/rotateY`) — the spiral ladder + image-cards in 3D space.
- **Astro i18n** (built-in routing) — `/it` and `/en` route trees, copy in per-locale
  data files.
- **Hosting:** Cloudflare Pages or Netlify (both free, static, auto-deploy from Git).
  Default recommendation: **Cloudflare Pages**.

### Project structure (target)
```
src/
  pages/
    [lang]/index.astro          # landing (logo, slogan, ladder/hole entry)
    [lang]/showcase.astro        # the spiral showcase
    [lang]/contatti.astro        # contacts (target of the starburst-TM hotspot)
  layouts/
    BaseLayout.astro             # html shell, fonts, meta/SEO, lang switch
  components/
    Logo.astro                   # sliced per-letter wordmark; isolated, clickable starburst-TM
    Slogan.astro
    LadderEntry.astro            # ladder + hole + "Entra nel mood" + transition trigger
    showcase/
      Spiral.astro               # the 3D scene container (CSS 3D, perspective root)
      Ladder3D.astro             # inclined, vertical-axis-rotating ladder
      PieceCard.astro            # a single piece's image-card slot in the spiral
    worlds/
      DiscoWorld.astro           # "The dark side of the mood"
      JungleWorld.astro          # domestic jungle
      DesertWorld.astro          # "DESSERT"
      <NewWorld>.astro           # one component per future piece
  scripts/
    showcase.ts                  # GSAP/ScrollTrigger setup for spiral rotation
    transition.ts                # hole-widening enter animation
    parallax.ts                  # horizontal parallax for detail panels
    lenis.ts                     # smooth scroll init + reduced-motion guard
  data/
    pieces.ts                    # ordered list: id, world component, assets, i18n text
    i18n/it.ts, i18n/en.ts       # UI strings (nav, slogan, contacts)
  styles/
    global.css, tokens.css       # palette derived from logo, type scale
public/
  assets/...                     # logo letters + per-piece optimized media, fonts
```

### Showcase architecture (the hard part)
- A single **perspective root** wraps the scene; the ladder and the spiral of
  `PieceCard`s are children with `preserve-3d`.
- Pieces are positioned around a vertical axis at increasing depth/height using
  `rotateY(i * step) translateZ(radius) translateY(i * drop)` — producing the spiral.
- **ScrollTrigger** maps scroll progress → `rotateY` on the ladder (one direction) and
  on the spiral group (opposite direction). The ladder also carries a fixed diagonal
  incline (`rotateZ`/`rotateX`).
- Clicking a piece triggers a GSAP timeline that brings its **detail panel** in from
  the side; the panel scrolls **horizontally with parallax layers** (each world
  composes its own layered scene — disco ball + sad animal, tropical plants, dune +
  *DESSERT* sweet, etc.).
- **Entry transition:** `LadderEntry` click runs a GSAP timeline that scales/clips the
  hole to full viewport, then reveals the showcase (route or in-page state change).

### i18n
- Use Astro's i18n routing with `it` as default and `en` secondary; all visible copy
  pulled from `data/i18n/*` and per-piece text fields in `data/pieces.ts`. A toggle in
  `BaseLayout` swaps locale while preserving the current route.

### Mobile parity strategy (not a fallback)
- Keep the 3D spiral on mobile but **tune the perspective, radius, and card scale** by
  breakpoint so it remains legible on narrow widths; reduce simultaneous on-screen
  cards if needed for performance.
- Detail-panel horizontal parallax adapts to touch (swipe) input.
- Respect **`prefers-reduced-motion`**: replace continuous rotation/parallax with
  simple fades and a vertical layout for users who request it (accessibility, not the
  default mobile experience).
- Performance budget: lazy-load world assets, use Astro image optimization, cap
  animated DOM nodes, `will-change`/GPU-friendly transforms only.

## Build phases (suggested order)
1. **Scaffold** Astro project, base layout, i18n routing, hosting wiring, color tokens.
2. **Landing**: sliced logo with clickable starburst-TM → contacts, slogan, ladder/hole
   entry (static first, then the hole-widening transition).
3. **Showcase shell**: CSS 3D perspective root + spiral math with placeholder cards +
   ScrollTrigger opposite-rotation; validate on desktop and mobile.
4. **Detail panels + horizontal parallax** mechanism (generic), then build the three
   seed worlds (Disco, Jungle, Desert).
5. **Polish**: Lenis smooth scroll, reduced-motion paths, responsive tuning, SEO/meta,
   performance pass.
6. **Deploy** to Cloudflare Pages; set up auto-deploy.

## Verification
- `npm run dev` — manually walk the flow: landing → click starburst-TM reaches contacts;
  click ladder/hole → transition into showcase.
- In the showcase, confirm scroll drives **opposite-direction rotation** of ladder vs
  pieces, and the spiral reads correctly with the diagonal incline.
- Click a piece → detail panel enters; horizontal parallax scrolls smoothly; each
  seed world renders its distinct aesthetic.
- Toggle **IT/EN** on each page; confirm copy swaps and route is preserved.
- Test at desktop, tablet, and phone widths (responsive devtools + a real phone);
  confirm parity and acceptable performance (Lighthouse).
- Toggle OS "reduce motion"; confirm the animation-free path works.
- `npm run build` + preview the static output before deploy.
