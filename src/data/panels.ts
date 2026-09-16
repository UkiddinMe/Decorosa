// DECOROSA — the three panels of the showcase spiral. They are not products: each one
// is a doorway into a section of the site. Exactly three, by design — the spiral geometry
// (angles 120deg apart) and the `turns` constant in showcase.ts are tuned for three.

/**
 * The tiger chest's mouth, as two strips cut from one column of the artwork (`box`
 * places that column in % of the artwork's own box): `open`, taken from a second shot
 * of the piece with its drawer pulled out, and `shut`, taken from the artwork itself.
 * As the mouth opens, `open` stretches down from the jaw line and `shut` is squeezed
 * against its own floor, so one pushes the other out of the way; `open` is the taller
 * file and ends up hanging past the bottom of the box, as the real open drawer does.
 * `open.seam` is the row the two meet on — the drawer's last solid row, above the pull
 * that hangs free below it, so the strips stay flush instead of parting around that
 * overhang. Both are cut by `scripts/build-image-assets.py`, which prints these numbers.
 */
export interface Mouth {
  box: { left: number; top: number; width: number };
  open: { src: string; w: number; h: number; seam: number };
  shut: { src: string; w: number; h: number };
}

/**
 * The tiger chest artwork and its mouth cut, shared by the two places it appears: the
 * "MY" panel of the showcase spiral (which opens the mouth as the panel turns to face
 * the viewer) and the first card of the works run (which opens it on hover).
 */
export const tigerArt = {
  image: { src: "/assets/showcase/my.webp", w: 1500, h: 1018 },
  mouth: {
    box: { left: 38.53, top: 52.06, width: 24.93 },
    open: { src: "/assets/showcase/my-mouth.webp", w: 374, h: 667, seam: 593 },
    shut: { src: "/assets/showcase/my-mouth-shut.webp", w: 374, h: 375 },
  } satisfies Mouth,
};

/** The CSS custom properties that place and drive a mouth overlay (see ANIMATIONS.md). */
export function mouthVars(mouth: Mouth): string {
  return (
    `--mouth-left:${mouth.box.left}%;--mouth-top:${mouth.box.top}%;` +
    `--mouth-w:${mouth.box.width}%;--mouth-squeeze:${mouth.open.seam / mouth.shut.h};`
  );
}

export interface Panel {
  /** slug — only used as a DOM hook */
  id: string;
  /** big title shown beside the panel; brand-fixed, identical in both locales */
  title: string;
  /** position in the 3D spiral */
  spiral: { angleDeg: number; radius: number; dropY: number };
  /** section this panel opens, per locale (root-relative, before withBase()) */
  href: Record<"it" | "en", string>;
  /**
   * How the artwork rides the spiral: `card` fills the fixed card box (a photo,
   * cropped); `object` is a cut-out on transparency that floats with no frame —
   * sized by `width`, its height following the file's own proportions.
   */
  form: "card" | "object";
  /** artwork in public/assets/showcase (before withBase()) */
  image: { src: string; w: number; h: number };
  /** mouth overlay that opens as the panel turns to face the viewer (tiger chest) */
  mouth?: Mouth;
  /** scene-space width of an `object` panel (cards use --card-w) */
  width?: number;
}

/** Mirrors `--scene-perspective` (tokens.css) for the server-rendered first paint. */
export const SCENE_PERSPECTIVE = 1200;

/**
 * Which side of the ladder a panel belongs on, from the cosine of its world angle
 * (spin + its own angle) — see the occlusion sandwich in ANIMATIONS.md.
 *
 * Deliberately not `cos >= 0`, the z = 0 crossing. Under perspective a panel's *apparent*
 * horizontal position is `P·r·sin t / (P − r·cos t)`, which turns around at `cos t = r/P`
 * — about 17° past z = 0 at our radius. Swapping at z = 0 therefore moves a panel in front
 * of the ladder while it is still visibly travelling outward, and it reads as cutting
 * through the ladder rather than orbiting it. Swapping at the turning point instead, a
 * panel stays behind for the whole of its outward swing and returns to the front only
 * once it is genuinely on its way back.
 */
export function isFrontOfLadder(
  cosWorldAngle: number,
  radius: number,
  perspective: number = SCENE_PERSPECTIVE,
): boolean {
  return cosWorldAngle >= radius / perspective;
}

export const panels: Panel[] = [
  {
    id: "bio",
    title: "I AM",
    // NOTE: angle/dropY/turns are coupled so each panel faces front exactly at
    // viewport centre — see showcase.ts (turns) for the relationship.
    spiral: { angleDeg: 0, radius: 360, dropY: 0 },
    href: { it: "/bio", en: "/en/bio" },
    form: "card",
    image: { src: "/assets/showcase/iam.webp", w: 880, h: 1120 },
  },
  {
    id: "works",
    title: "MY",
    spiral: { angleDeg: 120, radius: 360, dropY: 700 },
    href: { it: "/opere", en: "/en/works" },
    form: "object",
    image: tigerArt.image,
    mouth: tigerArt.mouth,
    width: 340,
  },
  {
    id: "dark-side",
    title: "DARK SIDE OF THE MOOD",
    spiral: { angleDeg: 240, radius: 360, dropY: 1400 },
    href: { it: "/dark-side", en: "/en/dark-side" },
    form: "object",
    image: { src: "/assets/showcase/dark-side.webp", w: 482, h: 428 },
    width: 300,
  },
];
