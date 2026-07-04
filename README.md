# DECOROSA

Scenographic portfolio for the artist Decorosa — a collage-wordmark landing, a
"ladder into a hole" entry that opens a 3D spiral showcase, and per-piece bespoke
"worlds" reached through horizontal-parallax detail panels. Built with Astro + GSAP
(ScrollTrigger) + Lenis, CSS 3D transforms, bilingual IT/EN.

## Develop

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # static output -> dist/
npm run preview    # preview the production build
```

## Logo slicing

The wordmark is sliced into per-letter PNGs so each glyph (incl. the starburst-TM
Contacts link) is independently positioned/animated.

```bash
npm run slice-logo   # reads public/assets/logo-original.png -> public/assets/logo/*
```

Outputs are a bootstrap; replace them with hand-exported transparent PNGs (same
filenames) and re-run is not needed. The layout manifest is `src/data/logo-layout.json`.

## Content

Pieces live in `src/data/pieces.ts` (id, world, spiral position, cover, IT/EN text).
Each `world` maps to a component in `src/components/worlds/`. Adding a new bespoke
piece = add an entry + assets in `public/assets/pieces/<id>/` + (if a new aesthetic)
a new world component. UI copy is in `src/data/i18n/`.

## Deploy (Cloudflare Pages)

Static site, no adapter needed.

- **Build command:** `npm run build`
- **Output directory:** `dist`
- **Node version:** 20+

Steps: connect the repo in Cloudflare Pages → set the build command/output above →
deploy. `public/_headers` sets long-lived caching for `/assets/*`. Update `site` in
`astro.config.mjs` and the URL in `public/robots.txt` to the final domain before launch.

Netlify works identically (same build command / publish dir).
