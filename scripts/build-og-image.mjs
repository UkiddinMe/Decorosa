// DECOROSA social preview image builder.
// Composes the landing page's starburst-TM badge, centred on white, into the 1200x630
// card that WhatsApp / Facebook / X / iMessage show when the site is linked.
//
// Source of truth is the same pair of transparent layers the Logo component uses —
// starburst.png (black star) with starburst-tm.png (white TM) laid over it — so the card
// never drifts from the mark on the page. Re-run after replacing either layer.
//
// Usage: npm run build-og

import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const LOGO_DIR = join(ROOT, 'public/assets/logo');
const OUT = join(ROOT, 'public/assets/og-image.png');

// 1.91:1 — the ratio every major unfurler crops to for a large preview.
const W = 1200;
const H = 630;
// Badge height as a share of the card, leaving generous white around it.
const STAR_H = Math.round(H * 0.6);

const star = sharp(join(LOGO_DIR, 'starburst.png'));
const { width: sw, height: sh } = await star.metadata();
const starW = Math.round((sw / sh) * STAR_H);

// The two layers are the same crop, so they scale identically and stay registered.
const resize = (file) =>
  sharp(join(LOGO_DIR, file)).resize(starW, STAR_H, { fit: 'fill' }).png().toBuffer();
const [starLayer, tmLayer] = await Promise.all([resize('starburst.png'), resize('starburst-tm.png')]);

const left = Math.round((W - starW) / 2);
const top = Math.round((H - STAR_H) / 2);

await sharp({ create: { width: W, height: H, channels: 3, background: '#ffffff' } })
  .composite([
    { input: starLayer, left, top },
    { input: tmLayer, left, top },
  ])
  .png({ compressionLevel: 9 })
  .toFile(OUT);

console.log(`wrote ${OUT} (${W}x${H}, badge ${starW}x${STAR_H})`);
