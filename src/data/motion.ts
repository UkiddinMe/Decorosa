// DECOROSA — how each piece of the "MY" run comes alive (ArtifactPiece.astro,
// ANIMATIONS.md). A piece is drawn as an SVG in its cut-out's own pixel grid, as a tree of:
//   base   the cut-out itself (minus `cut`, a path from the geometry, where a part lifts
//          off into empty air)
//   crop   the cut-out clipped to a box — a board, a drawer — so it can move on its own
//   layer  a file from scripts/build-artifact-motion.py: a part, or the patch behind one
//   move   a group that plays an animation (a class in ArtifactPiece) about `origin`,
//          with `vars` as its CSS custom properties
//   eye    a group that turns towards the pointer, up to `travel` px each way
//   draw   the veins of the table top, wiped out then drawn in along their time map on hover
// Every number is in the cut-out's pixels. Layer geometry: artifact-motion.json.
import geometry from './artifact-motion.json';

export type Box = [x: number, y: number, w: number, h: number];
export type MotionNode =
  | { base: true; cut?: string }
  | { crop: Box }
  | { layer: string }
  | { move: string; origin: [number, number]; vars?: Record<string, string>; children: MotionNode[] }
  | { eye: [number, number]; travel: [number, number]; children: MotionNode[] }
  | { draw: { ink: string; time: string } };

type Geometry = Record<string, Record<string, number[] | string | number>>;
const geo: Geometry = geometry;

export const layerBox = (id: string, name: string): Box => geo[id][name] as unknown as Box;
export const cutPath = (id: string, name: string): string => geo[id][name] as string;
const jawLine = geo['giungla-dei-colori']['jaw-line'] as number;

const layer = (name: string): MotionNode => ({ layer: name });
/** a move whose only child is the layer of the same name */
const moving = (anim: string, name: string, origin: [number, number], vars?: Record<string, string>) =>
  ({ move: anim, origin, vars, children: [layer(name)] }) as MotionNode;
/** socket under, iris turning, frame (the lids) over it */
const eye = (name: string, at: [number, number], travel: [number, number]): MotionNode[] => [
  layer(`${name}-socket`),
  { eye: at, travel, children: [layer(`${name}-iris`)] },
  layer(`${name}-frame`),
];

/** the drawers of the Llorona, in the order they pull out: top row, pigeonholes, bottom */
const DRAWERS: Box[] = [
  [175, 45, 230, 50],
  [420, 42, 230, 53],
  [665, 42, 232, 53],
  [181, 193, 203, 67],
  [184, 274, 203, 69],
  [683, 190, 207, 65],
  [683, 269, 205, 67],
  [121, 405, 196, 136],
  [373, 404, 317, 87],
  [749, 402, 197, 139],
];
const centre = ([x, y, w, h]: Box): [number, number] => [x + w / 2, y + h / 2];

export const motion: Record<string, MotionNode[]> = {
  // three guinea fowls peck, one after the other; the hat on the cornice hops — from
  // under the base, so the cornice hides the front of its brim until it is in the air
  attacchini: [
    layer('cornice'),
    moving('hop', 'hat', [85, 86]),
    { base: true, cut: 'hat-cut' },
    layer('head-0-hole'),
    layer('head-1-hole'),
    layer('head-2-hole'),
    moving('peck', 'head-0', [173, 449], { '--tilt': '9deg', '--d': '0s' }),
    moving('peck', 'head-1', [272, 419], { '--tilt': '16deg', '--d': '0.14s' }),
    moving('peck', 'head-2', [448, 338], { '--tilt': '-18deg', '--d': '0.28s' }),
  ],

  // the leaf on the table top wipes out, then draws itself back in, both left to right
  'si-sta-come-d-inverno': [{ base: true }, layer('clean'), { draw: { ink: 'ink', time: 'time' } }],

  // three boards fan apart; panther eyes follow, blue tiger snaps; looping in the
  // run: red tiger blinks, leopard's tail swishes (in two bones: the tip rides on the run)
  'giungla-dei-colori': [
    {
      move: 'fan',
      origin: [421, 198],
      vars: { '--x': '-10px', '--y': '-34px', '--r': '-4.5deg' },
      children: [
        { crop: [0, 0, 842, 396] },
        ...eye('panther-l', [560, 126], [6, 2]),
        ...eye('panther-r', [676, 111], [7, 3]),
      ],
    },
    {
      move: 'fan',
      origin: [421, 595],
      vars: { '--x': '16px', '--y': '0px', '--r': '2.5deg' },
      children: [
        { crop: [0, 396, 842, 398] },
        { move: 'snap', origin: [312, jawLine], children: [layer('jaw')] },
        moving('blink', 'lid-l', [643, 607]),
        moving('blink', 'lid-r', [689, 610]),
      ],
    },
    {
      move: 'fan',
      origin: [421, 997],
      vars: { '--x': '-8px', '--y': '34px', '--r': '-3deg' },
      children: [
        { crop: [0, 794, 842, 406] },
        layer('tail-hole'),
        {
          move: 'swish-run',
          origin: [383, 1152],
          children: [layer('tail-a'), moving('swish-tip', 'tail-b', [548, 1098])],
        },
      ],
    },
  ],

  // the finials' eyes follow the pointer; the roses behind the glass smoulder
  drago: [
    { base: true },
    moving('ember', 'roses', [510, 570]),
    ...eye('eye-l', [228, 56], [9, 9]),
    ...eye('eye-r', [789, 56], [9, 9]),
  ],

  // the drawers pull out one by one
  llorona: [
    { base: true },
    ...DRAWERS.map(
      (box, i): MotionNode => ({
        move: 'pull',
        origin: centre(box),
        vars: { '--d': `${i * 0.05}s` },
        children: [{ crop: box }],
      }),
    ),
  ],

  // the right toucan pokes its beak forward, twice; the door's keyhole plates stay put
  'metto-il-becco': [
    { base: true },
    layer('head-hole'),
    moving('poke', 'head', [525, 1000]),
    layer('plates'),
  ],
};
