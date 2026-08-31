# DECOROSA — Architecture

Scenographic portfolio site: a collage-wordmark landing, a "ladder into a hole" entry
that opens a 3D spiral showcase whose three panels are doorways into the three sections
of the site — **I AM** (horizontal bio timeline), **MY** (a finite lateral run of
artifacts, each opening a bespoke horizontal-parallax "world" page, closed by two cards
that leave the section) and **DARK SIDE OF THE MOOD** (a text page scrolling over a
fixed disco backdrop, its copy folded into an accordion). Static site, bilingual IT/EN.

> Animations have their own document: **[ANIMATIONS.md](./ANIMATIONS.md)**.

## Stack

| Piece | Role |
|---|---|
| [Astro 5](https://astro.build) | Static site generator; `<ClientRouter />` gives SPA-style View Transitions between pages |
| [GSAP](https://gsap.com) + ScrollTrigger | Scroll-driven showcase spiral, entry transition timeline |
| [Lenis](https://lenis.darkroom.engineering) | Smooth (inertial) scrolling, wired into GSAP's ticker |
| CSS 3D transforms | The spiral itself — no WebGL |
| sharp (dev only) | `npm run slice-logo` bootstrap tool |

## Directory map

```
src/
  pages/                  Route files — thin wrappers that only pick the locale
    index.astro           /            (IT landing)
    showcase.astro        /showcase
    contatti.astro        /contatti
    bio.astro             /bio                  ("I AM")
    dark-side.astro       /dark-side            ("DARK SIDE OF THE MOOD")
    opere/index.astro     /opere                ("MY" — the artifact run)
    opere/[id].astro      /opere/<id>           (one artifact detail page each)
    mosaico.astro         /mosaico              (tile grid the "MY" run ends on)
    en/                   EN twins: /en, /en/showcase, /en/contact, /en/bio,
                          /en/dark-side, /en/works, /en/works/<id>, /en/mosaic
  components/
    pages/                Shared per-page components (all real page markup/CSS lives here)
      LandingPage.astro   ShowcasePage.astro
      ContactsPage.astro  Editorial two-column spread, split by a hairline: address
                          column (title, italic standfirst, Email + Instagram rows whose
                          rule sweeps in on hover) and the mail form — underline-only
                          fields with floating labels and a pill submit (see Contact form)
      BioPage.astro       WorksPage.astro      ArtifactPage.astro
      DarkSidePage.astro  Title + a two-row italic standfirst (rows stepped right of
                          each other) over a fixed backdrop layer, then a native
                          <details name> accordion: Commissioni, Collaborazioni and
                          Prodotti disponibili — the last one a list of every artifact
                          as icon + title (hover spreads the row's wash from its centre
                          outwards), linking to the same detail pages the "MY"
                          cards open. A centred pill link to Contacts closes the column
      TilesPage.astro     (untitled placeholder grid: tiles 0.7 tile-widths apart
                          inside a broad page margin, three per row on desktop —
                          real tile content still to be defined)
    Ladder.astro          The vector ladder SVG (shared by landing + showcase)
    LadderEntry.astro     Landing "Entra nel mood": ladder + hole + rim composition
    Logo.astro            Wordmark rebuilt from per-glyph PNGs (starburst = labelled Contacts link)
    Slogan.astro          Uppercase Futura caption, coloured one hue per row (green,
                          orange, purple, yellow, then the whole items row red), justified to
                          just inside the wordmark's width (--logo-w * 0.96); the lead is
                          split into four rows, each scaled (cqw) to fill that width.
                          Sizes come from a fixed per-row character budget, not from the
                          words a row holds, and the rows are broken to fit those budgets
                          — so the block is the same height (and never wraps) in every
                          locale
    LangToggle.astro      Fixed IT/EN pill (top right, light/dark tone)
    BackLink.astro        Fixed "back" pill (light/dark tone), used by every section
    showcase/
      Scene.astro         The 3D scene: scroll driver, sky, layer sandwich, fallback list
      Ladder3D.astro      The ladder as the spiral's central axis
      PanelCard.astro     One panel on the spiral (billboard transform + big side title).
                          `form: 'card'` frames the photo in the card box; `form: 'object'`
                          is a cut-out on transparency, floating with no frame or shadow
    works/
      ArtifactCard.astro  One card of the "MY" run (links to its detail page)
      EndCard.astro       The two cards that close the run: the tiles page, and back
                          up to the showcase. Same plate as an ArtifactCard; the plate
                          is filled by the `media` prop (the showcase card's photo,
                          which also gets an inner vignette) or by slotted markup
      DuneScene.astro     The tiles card's artwork: flat SVG dune + falling cherry
    worlds/               One component per artifact aesthetic (Disco / Jungle / Desert);
                          pure scenery, the artifact page slots its hero + caption in
  scripts/                Client-side TS (see ANIMATIONS.md)
    lenis.ts  motion.ts  showcase.ts  transition.ts
    logo.ts               Hands the starburst label from its peek animation to CSS hover
    hscroll.ts            Shared sideways-scroll plumbing
    bio.ts  works.ts  artifact.ts    One controller per horizontal section
    contacts.ts           Contacts form submit (relay POST, or mailto: fallback)
  data/
    panels.ts             The three showcase panels (title + spiral pose + target section)
    artifacts.ts          SINGLE SOURCE OF TRUTH for the artist's artifacts
    bio.ts                The "I AM" timeline events
    routes.ts             IT↔EN route map (language toggle + hreflang)
    i18n/                 UI copy: it.ts (defines the Dict type), en.ts, index.ts (t())
    logo-layout.json      Glyph positions manifest (generated by scripts/slice-logo.mjs)
  styles/
    tokens.css            Design tokens: palette, type scale, spacing, shared backgrounds
    global.css            Reset, base type, .world panel structure, .sky-cover, reduced motion
  layouts/
    BaseLayout.astro      <head> (SEO/hreflang/OG/fonts), first-paint gate, LangToggle (`tone` prop), loads transition.ts
public/
  assets/logo/            Per-glyph PNGs (slicer bootstrap; replace with hand exports)
  assets/sky.jpg          The shared sky (hole, showcase backdrop, transition covers)
  assets/showcase/        The three panel artworks (webp; `my`/`dark-side` have alpha)
  assets/works/           Artwork for the "MY" run's end cards (webp)
scripts/slice-logo.mjs    One-off glyph slicer (see below); splits the starburst in two
scripts/build-image-assets.py
                          One-off: derives the site's webps from the raw shots in the
                          sibling `Decorosa Data/` folder (cut-outs + crops)
```

## i18n

- IT is the default locale (no URL prefix); EN lives under `/en/*` with localized slugs
  (`/contatti` ↔ `/en/contact`). Configured in `astro.config.mjs`.
- Each route file is a 5-line wrapper: `<LandingPage lang="it" />` etc. All markup and
  styles are in `src/components/pages/*` — edit those, never the twins in `src/pages/`.
- UI copy lives in `src/data/i18n/`; `it.ts` defines the `Dict` type both locales must
  satisfy, `t(locale)` returns the dictionary (falls back to IT).
- Per-artifact and per-bio-event copy lives inside each entry (`i18n: { it, en }`) in
  `artifacts.ts` / `bio.ts`. Panel titles are brand-fixed and locale-independent.
- `routes.ts` maps IT↔EN paths; used by `LangToggle` (swap language, keep the page) and
  by `BaseLayout` for `hreflang` alternate tags. **Add every new route pair there.**
- `routes.ts` also exports `withBase()` — the site deploys under a subpath
  (`base: '/Decorosa'` on GitHub Pages), so **every internal href/asset path must go
  through `withBase()`**; `normalize()` strips the base before route-pair matching.

## Content model

**`src/data/panels.ts`** — the three showcase panels. Exactly three, by design: their
`spiral` poses (`angleDeg` 120° apart, `dropY`) are coupled with the `turns` constant in
`showcase.ts` so each panel faces front exactly at viewport centre (ANIMATIONS.md
§ Spiral). Each entry carries its brand-fixed `title` (identical in both locales), the
`href` of the section it opens, per locale, and its artwork: `image` (path + intrinsic
size) plus `form` — `card` for a photo cropped into the card box, `object` for a cut-out
that floats frameless at its own `width`.

**`src/data/artifacts.ts`** — one entry per artwork: `id` (slug, also the asset folder
name under `public/assets/artifacts/<id>/`), `world` (which `worlds/*` component renders
its detail scenery), an optional `sold` flag (sold pieces keep their page but drop out of
`availableArtifacts`, the list the dark-side page shows) and IT/EN `i18n`
title/subtitle/body. `artifactPath(id, lang)` is the
canonical URL builder — `routes.ts` derives its IT↔EN pairs from it. Adding an artifact =
append an entry + drop assets + (only for a new aesthetic) create a `worlds/*` component
and register it in the `worlds` map in `ArtifactPage.astro`.

**`src/data/bio.ts`** — the "I AM" timeline: `year`, a placeholder `tint`, IT/EN
title/description. One ruler tick + year + photo per entry.

The showcase panels carry real artwork; artifact and bio artwork is still a placeholder
gradient/tint (tokens `--world-*-bg`) — wire real images in `ArtifactCard.astro` and
`BioPage.astro` when they land.

**Raw artwork** lives outside the repo, in the sibling `Decorosa Data/` folder (originals,
unprocessed). Only the derived files are committed under `public/assets/`.
`scripts/build-image-assets.py` (run by hand; needs Pillow + SciPy) regenerates them from
it: a flood-fill cut-out for the tiger chest, an ink-density alpha for the DSOTM shape,
and hand-framed crops for the two photos ("I AM", and the works page's back-to-showcase
card) — each cropped to its card's aspect so CSS never has to squeeze a whole frame into
a small plate. Its numbers are tuned to *these* photos — re-tune, don't re-run blindly,
when the client sends replacements.

## Styling

- `tokens.css` — brand palette (from the wordmark), fluid type scale (`--step-*`),
  `--font-futura` (the big section/panel titles and the landing slogan; Jost is the loaded
  stand-in for real Futura), `--logo-w` (the wordmark's width, shared by `Logo.astro` and
  `Slogan.astro` so the caption justifies to the logo's lateral boundaries — also capped
  against `100svh` via `--landing-chrome` so the whole landing scene keeps fitting the
  viewport as the page is zoomed; its viewport share rises from 60vw towards ~92vw as the
  viewport narrows, so phone margins shrink in proportion), the landing scene's own
  `--landing-gap` (wordmark+slogan to ladder), `--landing-drop` (how far below the
  viewport's centre the scene sits, so the Contacts label peeking above the wordmark
  clears the top edge) and `--landing-pad-x` (its side padding — tracks `--space-m` when
  there is room, thins out faster below ~900px),
  `--font-emoji` for the placeholder artwork (Noto Color Emoji is loaded as a
  webfont by `BaseLayout` and listed *first*: the installed system emoji faces are
  versioned with the OS, so recent glyphs — mirror ball, beaver, potted plant — render
  as tofu on Windows 10), the shared `--disco-bg` backdrop,
  spacing (`--space-*`), the shared `--sky-bg` (its `--sky-url` image is injected on
  `<html>` by `BaseLayout` so it respects the deploy base) and per-world gradients, motion tokens,
  and the showcase-3D scene tokens (perspective, stage offset/tilt/scale, ladder
  incline/size) — shared by `Scene.astro`, `Ladder3D.astro`, `LadderEntry.astro` *and*
  the entry-transition replica in `transition.ts`.
- `global.css` — reset + base typography, `.world` (shared 300vw horizontal-parallax
  skeleton, themed by each world component), `.sky-cover` (transition overlay), the
  global `prefers-reduced-motion` kill-switch.
- Everything else is scoped inside its `.astro` component.

## Logo pipeline

`npm run slice-logo` scans `public/assets/logo-original.png` for vertical white gaps,
crops one PNG per glyph into `public/assets/logo/`, and writes `logo-layout.json`
(positions in % of the original image). `Logo.astro` rebuilds the wordmark from that
manifest with absolutely-positioned glyphs so each one can be animated/linked
independently. The starburst-TM glyph is the Contacts link; because a lone glyph reads
as decoration, it is labelled and slowly spins (see ANIMATIONS.md).

The starburst is the one glyph the slicer does not emit as a plain crop: because it spins,
an opaque white background would sweep over its neighbours and the TM would turn with it.
`sliceStarburst()` writes it as two transparent layers — `starburst.png` (the black star,
its TM counters filled in) and `starburst-tm.png` (the white TM alone) — which
`Logo.astro` stacks, rotating only the first.

It is also cropped to its own **connected component** rather than to its column band: the
band cuts the outermost spike off, which both blunts the star and leaves the severed tip
baked into `r.png` as a speck that sits still while the star turns. For the same reason
every other crop is scrubbed of any starburst pixels that fall inside its rectangle.

The slicer is still a **bootstrap**: the intended flow is to replace the PNGs with
hand-exported transparent versions (same filenames). Re-running it is safe — it rebuilds
every glyph, starburst layers included, from `logo-original.png`.

## Contact form

`ContactsPage.astro` renders a name / email / message form; `src/scripts/contacts.ts`
handles the submit. The site is static, so delivery goes one of two ways:

- **`PUBLIC_CONTACT_ENDPOINT` set at build time** — the script POSTs
  `{ name, email, message }` as JSON to that URL and reports success/failure inline.
  Any mail relay taking a JSON POST works (Formspree, Web3Forms, Basin). Set it in
  `.env` locally and as a repository variable/secret in the deploy workflow.
- **unset (current default)** — submitting opens a bare `mailto:` link to
  `dict.contacts.email` in the visitor's mail client, with no subject or body; they
  write the message there themselves, so the typed fields are not carried over.

An off-screen `_gotcha` honeypot field is dropped silently when filled. All form copy
and status messages live in `i18n` under `contacts.form`; the recipient address is
`contacts.email` in the same dictionaries.

## Build & deploy

```bash
npm run dev / build / preview
```

Pushes to `main` deploy via GitHub Actions (`.github/workflows/deploy-website.yaml`,
withastro/action → GitHub Pages). The site is fully static; Cloudflare Pages/Netlify
work identically (build `npm run build`, publish `dist/`). Before launch: update `site`
in `astro.config.mjs`, drop/adjust `base` (currently `/Decorosa` for GitHub Pages), and
update the URL in `public/robots.txt`.

---
*Keep this file and ANIMATIONS.md up to date with every significant change.*
