// DECOROSA logo slicer (BOOTSTRAP ONLY).
// Detects the 8 glyphs in the collage wordmark by scanning for vertical white gaps,
// then writes one tightly-cropped PNG per glyph into public/assets/logo/.
//
// This is a first cut so the site has usable per-letter assets immediately. Replace the
// outputs with hand-exported transparent PNGs later (same filenames) — no code changes.
//
// Usage: npm run slice-logo

import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SRC = join(ROOT, 'public/assets/logo-original.png');
const OUT_DIR = join(ROOT, 'public/assets/logo');

// Glyph order in the wordmark D-E-C-O-R-O-S-A. The 6th (second O) is the starburst-TM.
const KEYS = ['d', 'e', 'c', 'o1', 'r', 'starburst', 's', 'a'];

// A pixel counts as "ink" if any channel is clearly below white.
const INK = 240;
// Min ink pixels in a column for it to count as content (filters stray noise).
const MIN_COL_INK = 3;

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const img = sharp(SRC);
  const meta = await img.metadata();
  const { width, height } = meta;
  const { data, info } = await img
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const ch = info.channels; // 4 (RGBA)

  const isInk = (x, y) => {
    const i = (y * width + x) * ch;
    const a = data[i + 3];
    if (a < 16) return false; // transparent
    return data[i] < INK || data[i + 1] < INK || data[i + 2] < INK;
  };

  // Per-column ink count (used both for the content flag and valley-splitting).
  const colInk = new Array(width).fill(0);
  for (let x = 0; x < width; x++) {
    let count = 0;
    for (let y = 0; y < height; y++) {
      if (isInk(x, y)) count++;
    }
    colInk[x] = count;
  }
  const colHasInk = colInk.map((c) => c >= MIN_COL_INK);

  // Group contiguous content columns into segments (gaps of >= 1 empty column split).
  let segments = [];
  let start = -1;
  for (let x = 0; x < width; x++) {
    if (colHasInk[x] && start === -1) start = x;
    if (!colHasInk[x] && start !== -1) {
      segments.push([start, x - 1]);
      start = -1;
    }
  }
  if (start !== -1) segments.push([start, width - 1]);

  // Drop tiny specks (< 0.8% of width) that aren't real glyphs.
  const minSeg = Math.max(4, Math.round(width * 0.008));
  segments = segments.filter(([a, b]) => b - a + 1 >= minSeg);

  // Touching glyphs (e.g. the starburst's points grazing the R) merge into one
  // over-wide segment. Split any segment wider than 1.5x the median at its thinnest
  // interior column (the valley between the two glyphs), repeating until none remain.
  const widthOf = ([a, b]) => b - a + 1;
  const median = (arr) => {
    const s = [...arr].sort((m, n) => m - n);
    return s[Math.floor(s.length / 2)] || 0;
  };
  const splitWideSegments = (segs) => {
    const med = median(segs.map(widthOf));
    const out = [];
    for (const seg of segs) {
      const [a, b] = seg;
      if (widthOf(seg) <= med * 1.5) {
        out.push(seg);
        continue;
      }
      // Search the central 60% for the minimum-ink column.
      const lo = a + Math.round(widthOf(seg) * 0.2);
      const hi = b - Math.round(widthOf(seg) * 0.2);
      let cut = lo,
        min = Infinity;
      for (let x = lo; x <= hi; x++) {
        if (colInk[x] < min) {
          min = colInk[x];
          cut = x;
        }
      }
      out.push([a, cut - 1], [cut, b]);
    }
    return out;
  };

  let glyphs = segments;
  for (let pass = 0; pass < 3 && glyphs.length < KEYS.length; pass++) {
    glyphs = splitWideSegments(glyphs);
  }

  console.log(`Image ${width}x${height} -> ${glyphs.length} glyph segment(s) detected.`);
  if (glyphs.length !== KEYS.length) {
    console.warn(
      `⚠ Expected ${KEYS.length} glyphs but found ${glyphs.length}. ` +
        `Outputs will use index order; adjust thresholds or hand-export if mismatched.`,
    );
  }

  // Letters of the wordmark, for screen-reader alt text per glyph.
  const LETTERS = { d: 'D', e: 'E', c: 'C', o1: 'O', r: 'R', starburst: 'O', s: 'S', a: 'A' };
  const manifest = { width, height, glyphs: [] };

  for (let g = 0; g < glyphs.length; g++) {
    const [x0, x1] = glyphs[g];
    // Tight vertical bounds within this column range.
    let top = height,
      bottom = 0;
    for (let x = x0; x <= x1; x++) {
      for (let y = 0; y < height; y++) {
        if (isInk(x, y)) {
          if (y < top) top = y;
          if (y > bottom) bottom = y;
        }
      }
    }
    if (top > bottom) continue;

    const key = KEYS[g] ?? `glyph${g}`;
    const left = x0;
    const w = x1 - x0 + 1;
    const h = bottom - top + 1;
    await sharp(SRC)
      .extract({ left, top, width: w, height: h })
      .png()
      .toFile(join(OUT_DIR, `${key}.png`));
    manifest.glyphs.push({
      key,
      letter: LETTERS[key] ?? '',
      src: `/assets/logo/${key}.png`,
      x: left,
      y: top,
      w,
      h,
    });
    console.log(`  ${key}.png  ${w}x${h}  @ x:${left} y:${top}`);
  }

  // Layout manifest consumed by Logo.astro to reconstruct the wordmark faithfully
  // while keeping every glyph an independent, positionable, animatable element.
  await writeFile(
    join(ROOT, 'src/data/logo-layout.json'),
    JSON.stringify(manifest, null, 2) + '\n',
  );

  console.log('Wrote src/data/logo-layout.json');
  console.log('Done. Review public/assets/logo/ — replace with transparent exports later.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
