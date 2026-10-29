// Every picture ships smaller copies beside it (scripts/image_sizes.py), so the browser
// never shrinks a big file itself — its quick resample breaks fine lines into dashes,
// and a phone needn't download a desktop's pixels. `<img>`s get them as a srcset, with a
// `sizes` worked out from where each is drawn (landscape and portrait); pictures drawn in
// an SVG (the pieces, the dune) are pointed at one copy for the whole SVG by
// src/scripts/sized.ts.
import { withBase } from './routes';

/** the long sides a group's first picture is brought down to — as in image_sizes.py */
export const SIZES = [500, 800, 1200];

/** `src`'s copy at `level` */
export const sizedSrc = (src: string, level: number): string => src.replace(/\.webp$/, `-${level}.webp`);

/** the levels a group whose first picture's long side is `ref` has */
export const levels = (ref: number): number[] => SIZES.filter((level) => level < ref);

/**
 * `src`, `srcset`, `width` and `height` for an `<img>` of a w×h picture (unprefixed
 * path); `ref` is the long side of its group's first picture, when it belongs to one.
 */
export const sized = (src: string, w: number, h: number, ref = Math.max(w, h)) => ({
  src: withBase(src),
  srcset: [
    ...levels(ref).map((level) => `${withBase(sizedSrc(src, level))} ${Math.round((w * level) / ref)}w`),
    `${withBase(src)} ${w}w`,
  ].join(', '),
  width: w,
  height: h,
});

/**
 * A picture's proportions pinned to its full file's, for one sized by `height: auto` that
 * other parts are laid over (the tiger's mouth): a copy's rounded pixels can't shift them.
 */
export const ratio = ({ w, h }: { w: number; h: number }): string => `aspect-ratio: ${w} / ${h}`;

/** a `sizes` as [media condition ('' for the last), drawn width] pairs, so it can be scaled */
export type Sizes = [string, string][];

/** the `sizes` attribute, every width ×f (a part drawn at that fraction of its artwork) */
export const sizesAttr = (sizes: Sizes, f = 1): string =>
  sizes.map(([media, width]) => `${media} ${f === 1 ? width : `calc(${width} * ${+f.toFixed(4)})`}`.trim()).join(', ');

/**
 * A CSS background's `image-set()` of `src`'s copies (a w×h picture, alone in its group),
 * for a box drawn about `drawn` CSS px wide: backgrounds can only be picked by pixel
 * density, so each density gets the smallest copy that covers it.
 */
export const sizedImageSet = (src: string, w: number, h: number, drawn: number): string => {
  const ref = Math.max(w, h);
  const pick = (need: number) => {
    const level = levels(ref).find((l) => (w * l) / ref >= need);
    return withBase(level ? sizedSrc(src, level) : src);
  };
  return `image-set(${[1, 2, 3].map((x) => `url("${pick(drawn * x)}") ${x}x`).join(', ')})`;
};

/** an SVG `<image>`'s href — the smallest copy, until sized.ts picks — and its full file */
export const sizedHref = (src: string, ref: number) => {
  const [first] = levels(ref);
  return { href: withBase(first ? sizedSrc(src, first) : src), 'data-src': withBase(src) };
};
