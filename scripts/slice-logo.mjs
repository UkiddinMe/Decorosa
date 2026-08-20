// DECOROSA logo slicer (BOOTSTRAP ONLY).
// Detects the 8 glyphs in the collage wordmark by scanning for vertical white gaps,
// then writes one tightly-cropped PNG per glyph into public/assets/logo/.
//
// This is a first cut so the site has usable per-letter assets immediately. Replace the
// outputs with hand-exported transparent PNGs later (same filenames) — no code changes.
//
// The starburst-TM is the exception: it SPINS on the landing page, so a plain crop will not
// do — opaque white background, TM baked into the bitmap, and its outermost spike sliced off
// into the neighbouring crop. It is cropped to its own connected component and emitted as
// two transparent layers; the neighbour is scrubbed of the spike. See sliceStarburst().
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
// Grey levels (0..1) that map to fully-inked / fully-blank when building the starburst's
// alpha channel. The source is a scan, so its "black" and "white" are neither.
const INK_DARK = 0.25;
const INK_LIGHT = 0.85;
// Min ink pixels in a column for it to count as content (filters stray noise).
const MIN_COL_INK = 3;

// Connected-component labels over the whole wordmark (4-connectivity). Glyph crops are
// rectangles, so a neighbour's ink can land inside one — the starburst's leftmost spike
// reaches into the R's column band, and a plain crop bakes it into r.png as a stray speck
// that stays put while the star spins away. Labels let each crop keep only its own glyph.
function labelInk(isInk, width, height) {
  const labels = new Int32Array(width * height);
  const bounds = new Map(); // label -> { x0, y0, x1, y1, size }
  let next = 0;
  const queue = [];
  for (let y0 = 0; y0 < height; y0++) {
    for (let x0 = 0; x0 < width; x0++) {
      const seed = y0 * width + x0;
      if (labels[seed] || !isInk(x0, y0)) continue;
      const id = ++next;
      const b = { x0, y0, x1: x0, y1: y0, size: 0 };
      bounds.set(id, b);
      labels[seed] = id;
      queue.length = 0;
      queue.push(seed);
      for (let q = 0; q < queue.length; q++) {
        const i = queue[q];
        const x = i % width;
        const y = (i - x) / width;
        b.size++;
        if (x < b.x0) b.x0 = x;
        if (x > b.x1) b.x1 = x;
        if (y < b.y0) b.y0 = y;
        if (y > b.y1) b.y1 = y;
        const neighbours = [];
        if (x > 0) neighbours.push(i - 1);
        if (x < width - 1) neighbours.push(i + 1);
        if (y > 0) neighbours.push(i - width);
        if (y < height - 1) neighbours.push(i + width);
        for (const j of neighbours) {
          if (labels[j]) continue;
          const jx = j % width;
          if (!isInk(jx, (j - jx) / width)) continue;
          labels[j] = id;
          queue.push(j);
        }
      }
    }
  }
  return { labels, bounds };
}

// The starburst-TM, split into the two transparent layers Logo.astro animates:
//   starburst.png     the black star alone, its TM counters FILLED IN, so nothing shows
//                     through the lettering as it turns
//   starburst-tm.png  the white TM alone, on the same crop box, so it can be laid over
//                     the star and left out of the rotation (lettering stays upright)
// A plain crop cannot do this: its white background is opaque (it would sweep over the
// neighbouring glyphs) and its TM would turn with the star.
async function sliceStarburst({ left, top, width: w, height: h }, { labels, starLabel, imageWidth }) {
  const { data } = await sharp(SRC)
    .extract({ left, top, width: w, height: h })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Only the star's own component contributes ink — anything else that happens to fall in
  // the crop (a neighbouring glyph) stays transparent. Grown by 2px so the star's
  // antialiased rim, which sits below the labelling threshold, is not shaved off.
  const nearStar = (x, y) => {
    for (let dy = -2; dy <= 2; dy++) {
      const gy = top + y + dy;
      if (gy < 0) continue;
      for (let dx = -2; dx <= 2; dx++) {
        const gx = left + x + dx;
        if (gx < 0 || gx >= imageWidth) continue;
        if (labels[gy * imageWidth + gx] === starLabel) return true;
      }
    }
    return false;
  };

  const n = w * h;
  const grey = new Float32Array(n);
  const ink = new Float32Array(n); // ink coverage 0..1, doubles as the star's soft edge
  for (let i = 0; i < n; i++) {
    const g = (data[i * 3] + data[i * 3 + 1] + data[i * 3 + 2]) / 3 / 255;
    grey[i] = g;
    const x = i % w;
    ink[i] = nearStar(x, (i - x) / w)
      ? Math.min(1, Math.max(0, (INK_LIGHT - g) / (INK_LIGHT - INK_DARK)))
      : 0;
  }
  const solid = (i) => ink[i] > 0.5;

  // Flood the blank background inwards from the border (4-connectivity). Whatever it can
  // NOT reach is enclosed by the star — i.e. the TM counters.
  const outside = new Uint8Array(n);
  const queue = [];
  for (let x = 0; x < w; x++) {
    for (const i of [x, (h - 1) * w + x]) if (!solid(i) && !outside[i]) (outside[i] = 1), queue.push(i);
  }
  for (let y = 0; y < h; y++) {
    for (const i of [y * w, y * w + w - 1]) if (!solid(i) && !outside[i]) (outside[i] = 1), queue.push(i);
  }
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q];
    const x = i % w;
    const y = (i - x) / w;
    const neighbours = [];
    if (x > 0) neighbours.push(i - 1);
    if (x < w - 1) neighbours.push(i + 1);
    if (y > 0) neighbours.push(i - w);
    if (y < h - 1) neighbours.push(i + w);
    for (const j of neighbours) if (!outside[j] && !solid(j)) (outside[j] = 1), queue.push(j);
  }
  const holes = new Uint8Array(n);
  for (let i = 0; i < n; i++) holes[i] = !outside[i] && !solid(i) ? 1 : 0;

  // Square dilation by `r` px. The star layer needs the counters grown past the TM's
  // antialiased rim (r=2), or a pale halo survives under the white lettering.
  const grow = (mask, r) => {
    const out = new Uint8Array(n);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let hit = 0;
        for (let dy = -r; dy <= r && !hit; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= h) continue;
          for (let dx = -r; dx <= r; dx++) {
            const xx = x + dx;
            if (xx < 0 || xx >= w) continue;
            if (mask[yy * w + xx]) { hit = 1; break; }
          }
        }
        out[y * w + x] = hit;
      }
    }
    return out;
  };
  const starHoles = grow(holes, 2);
  const tmHoles = grow(holes, 1);

  const star = Buffer.alloc(n * 4);
  const tm = Buffer.alloc(n * 4);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    star[o] = star[o + 1] = star[o + 2] = 12; // the wordmark's ink black
    star[o + 3] = Math.round(255 * (starHoles[i] && !outside[i] ? 1 : ink[i]));
    tm[o] = tm[o + 1] = tm[o + 2] = 255;
    const white = Math.min(1, Math.max(0, (grey[i] - INK_DARK) / (INK_LIGHT - INK_DARK)));
    tm[o + 3] = Math.round(255 * (tmHoles[i] ? white : 0));
  }

  const raw = { raw: { width: w, height: h, channels: 4 } };
  await sharp(star, raw).png().toFile(join(OUT_DIR, 'starburst.png'));
  await sharp(tm, raw).png().toFile(join(OUT_DIR, 'starburst-tm.png'));
}

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

  // Label the ink once: the starburst is cropped to its OWN component (a column band cuts
  // its outermost spike off, which is both a clipped star and a speck in the neighbour),
  // and every other crop is scrubbed of any starburst pixels that fall inside it.
  const { labels, bounds } = labelInk(isInk, width, height);
  const starBand = glyphs[KEYS.indexOf('starburst')];
  let starLabel = 0;
  if (starBand) {
    const [bx0, bx1] = starBand;
    let best = 0;
    for (const [id, b] of bounds) {
      const cx = (b.x0 + b.x1) / 2;
      if (cx >= bx0 && cx <= bx1 && b.size > best) {
        best = b.size;
        starLabel = id;
      }
    }
  }

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
    let left = x0;
    let w = x1 - x0 + 1;
    let h = bottom - top + 1;

    if (key === 'starburst' && starLabel) {
      // Its own silhouette, not its column band — plus a 1px margin so the antialiased
      // rim survives. The glyph lands in the same place either way: the manifest carries
      // the box, and Logo.astro positions from that.
      const b = bounds.get(starLabel);
      left = Math.max(0, b.x0 - 1);
      top = Math.max(0, b.y0 - 1);
      w = Math.min(width, b.x1 + 2) - left;
      h = Math.min(height, b.y1 + 2) - top;
      await sliceStarburst({ left, top, width: w, height: h }, { labels, starLabel, imageWidth: width });
    } else {
      const crop = sharp(SRC).extract({ left, top, width: w, height: h });
      const { data: px } = await crop.clone().removeAlpha().raw().toBuffer({ resolveWithObject: true });
      let scrubbed = 0;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (labels[(top + y) * width + left + x] !== starLabel || !starLabel) continue;
          const o = (y * w + x) * 3;
          px[o] = px[o + 1] = px[o + 2] = 255; // paint the intruding spike back to paper
          scrubbed++;
        }
      }
      if (scrubbed) {
        console.log(`  (scrubbed ${scrubbed} starburst px out of ${key}.png)`);
        await sharp(px, { raw: { width: w, height: h, channels: 3 } })
          .png()
          .toFile(join(OUT_DIR, `${key}.png`));
      } else {
        await crop.png().toFile(join(OUT_DIR, `${key}.png`));
      }
    }
    manifest.glyphs.push({
      key,
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
