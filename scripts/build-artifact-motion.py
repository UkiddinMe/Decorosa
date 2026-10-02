"""The moving parts of the "MY" run's pieces (ArtifactPiece.astro, ANIMATIONS.md).

Works on the published cut-outs (public/assets/artifacts/<id>.webp, made by
build-image-assets.py), so every layer lives in its artifact's own pixel grid: the page
draws each piece as an SVG whose viewBox *is* that grid, and lays these layers back
exactly where they were cut from. Two kinds of layer:
  * parts — a piece of the artwork that will move (a head, a hat, a tail, an iris);
  * patches — what shows where a part used to be once it has moved: wall behind a head,
    board behind a tail, eye-white behind an iris. Painted flat from a sampled colour;
    they are only ever seen as the thin slivers a part uncovers in motion.
Geometry (x, y, w, h in the cut-out's pixels) goes to src/data/artifact-motion.json.
Every box, pivot and colour below is hand-measured on these particular cut-outs.
"""
import json
import os
import cv2
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage
from skimage.graph import MCP_Geometric
from skimage.morphology import convex_hull_image

ROOT = 'D:/MyStuff/Websites/Decorosa'
ART = os.path.join(ROOT, 'public/assets/artifacts')
OUT = os.path.join(ART, 'motion')
GEOMETRY = {}


def load(slug):
    return np.asarray(Image.open(os.path.join(ART, slug + '.webp')).convert('RGBA')).astype(np.float32)


def soft(mask, r=0.7):
    """Hard mask -> anti-aliased alpha in [0, 1]."""
    img = Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r))
    return np.asarray(img).astype(np.float32) / 255.0


def box_mask(shape, x0, y0, x1, y1):
    m = np.zeros(shape[:2], bool)
    m[y0:y1, x0:x1] = True
    return m


def disk(shape, cx, cy, r):
    yy, xx = np.mgrid[:shape[0], :shape[1]]
    return (xx - cx) ** 2 + (yy - cy) ** 2 <= r * r


def ellipse(shape, cx, cy, rx, ry):
    yy, xx = np.mgrid[:shape[0], :shape[1]]
    return ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 <= 1


def poly(shape, *points):
    m = np.zeros(shape[:2], np.uint8)
    cv2.fillPoly(m, [np.int32(points)], 1)
    return m.astype(bool)


def biggest(mask):
    lab, n = ndimage.label(mask)
    if not n:
        return mask
    return lab == np.argmax(np.bincount(lab.ravel())[1:]) + 1


def median(img, mask):
    return np.median(img[..., :3][mask], 0)


def layer(slug, name, rgb, alpha, lossless=False):
    """Save rgb (HxWx3, or one colour) under alpha, trimmed to what is visible."""
    h, w = alpha.shape
    rgb = np.broadcast_to(np.asarray(rgb, np.float32), (h, w, 3))
    img = Image.fromarray(np.dstack([rgb, alpha * 255]).clip(0, 255).astype(np.uint8), 'RGBA')
    x0, y0, x1, y1 = img.getchannel('A').point(lambda p: 255 if p > 4 else 0).getbbox()
    os.makedirs(OUT, exist_ok=True)
    rel = f'{slug}-{name}'
    img.crop((x0, y0, x1, y1)).save(os.path.join(OUT, rel + '.webp'), 'WEBP', method=6,
                                    **({'lossless': True} if lossless else {'quality': 90}))
    GEOMETRY.setdefault(slug, {})[name] = [x0, y0, x1 - x0, y1 - y0]
    print(f'  {rel:36s} {x1 - x0}x{y1 - y0}')


def part(slug, name, a, mask, r=0.7):
    layer(slug, name, a[..., :3], soft(mask, r) * a[..., 3] / 255)


def patch(slug, name, a, mask, colour):
    layer(slug, name, colour, soft(mask, 0.7) * a[..., 3] / 255)


def eye(slug, name, a, box, iris, white_min=165):
    """An eye that can look around: the iris as a disk, a socket patch (the eye's white,
    iris painted out) under it, and a frame on top — the box minus the eye's white — so
    the iris slides *behind* the lids instead of over the face."""
    cx, cy, r = iris
    rgb = a[..., :3]
    inbox = box_mask(a.shape, *box)
    bright = (rgb.min(2) > white_min) & (rgb.max(2) - rgb.min(2) < 70) & inbox
    iris_px = disk(a.shape, cx, cy, r + 1)
    white = ndimage.binary_fill_holes(ndimage.binary_closing(bright | iris_px, np.ones((3, 3))))
    white = biggest(white & inbox)
    patch(slug, f'{name}-socket', a, white, median(a, bright & ~disk(a.shape, cx, cy, r + 3)))
    part(slug, f'{name}-iris', a, iris_px & white, 0.5)
    part(slug, f'{name}-frame', a, inbox & ~ndimage.binary_erosion(white), 0.4)


# ---------------------------------------------------------------------------------------
# ATTACCHINI — three guinea fowls pecking, and the bowler hat on the cornice hopping.
print('attacchini')
a = load('attacchini')
rows, cols = np.ogrid[:a.shape[0], :a.shape[1]]
wall = median(a, box_mask(a.shape, 200, 275, 380, 340))
not_wall = np.abs(a[..., :3] - wall).max(2) > 26
# (box, the row the neck is cut on). Below the cut the body stays put. The patch stops
# 10px short of the cut, so the wedge a rotating neck opens there shows the original
# neck rather than wall.
HEADS = [((145, 340, 202, 449), 449), ((238, 345, 320, 419), 419), ((388, 249, 484, 338), 338)]
for i, (bx, cut) in enumerate(HEADS):
    m = not_wall & box_mask(a.shape, *bx)
    m = biggest(ndimage.binary_opening(m, np.ones((2, 2))))
    m = ndimage.binary_fill_holes(ndimage.binary_closing(m, np.ones((5, 5)))) & box_mask(a.shape, *bx)
    part('attacchini', f'head-{i}', a, m)
    hole = ndimage.binary_dilation(m, iterations=1) & (rows < cut - 10) & box_mask(a.shape, *bx)
    # the wall is not evenly lit: each patch takes the tone of the wall right around its head
    around = ndimage.binary_dilation(m, iterations=8) & ~ndimage.binary_dilation(m, iterations=2) & ~not_wall
    patch('attacchini', f'head-{i}-hole', a, hole, median(a, around))

# The hat: the one near-black blob in the corner, down to where it sits on the cornice —
# the cornice's top face, in the hat's shadow, is just as dark, so the blob is cut on the
# cornice's top edge (the brim's left tip, which hangs past the cornice's end, is kept).
# There is nothing behind the hat but air, so the page cuts its shape out of the base
# (the `hat-cut` path) instead of patching it.
# The cornice hides the front of the brim, which the hop would show as a flat cut. The
# brim's outline is an ellipse: fitted to the two tips that do show (the hat's contour
# from where the crown meets the brim down, off the cut), its front half is painted in,
# grown out of the hat's own blacks. The page draws the hat *under* the base, so at rest
# that half is hidden again — and the cut is wide enough on the air side to take the
# cut-out's soft edge with it, which would otherwise ghost the hat's outline over it.
CORNICE_TOP, CORNICE_LEFT, BRIM_TOP = 71, 27, 49
hat = biggest((a[..., :3].max(2) < 80) & box_mask(a.shape, 0, 0, 180, 96) & (a[..., 3] > 128))
hat = ndimage.binary_fill_holes(hat) & ~((rows >= CORNICE_TOP) & (cols >= CORNICE_LEFT))
hat = biggest(hat)
on_cut = (rows >= CORNICE_TOP - 2) & (cols >= CORNICE_LEFT - 1)
(outline,), _ = cv2.findContours(hat.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
brim = cv2.fitEllipse(np.float32([p[0] for p in outline
                                  if p[0][1] >= BRIM_TOP and not on_cut[p[0][1], p[0][0]]]))
front = cv2.ellipse(np.zeros(a.shape[:2], np.uint8), brim, 1, -1).astype(bool) & on_cut
# (the hat's own rows along the cut are the cornice's shadow line: repainted with the
# front, and dropped where they run past the brim's tip)
whole = ndimage.binary_dilation((hat & ~on_cut) | front, iterations=1)
paint = ndimage.binary_dilation(front, iterations=2)
black = np.where((hat & ~paint)[..., None], a[..., :3], median(a, hat)).astype(np.uint8)
black = cv2.inpaint(black, paint.astype(np.uint8) * 255, 4, cv2.INPAINT_TELEA)
layer('attacchini', 'hat', black, soft(whole) * np.maximum(a[..., 3] / 255, paint))
cornice = (rows >= CORNICE_TOP) & (cols >= CORNICE_LEFT)
cut = ndimage.binary_dilation(hat, iterations=2) | ndimage.binary_dilation(hat, iterations=5) & ~cornice
cs, _ = cv2.findContours(cut.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
# The cornice's top edge lies in the hat's shadow, as dark as the hat, and goes with the
# cut: it is laid back as a patch (under the hat), each row in the tone and opacity it has
# just right of the hat, so the edge runs level once the hat is in the air.
EDGE = slice(CORNICE_TOP - 2, CORNICE_TOP + 2)
edge = np.zeros_like(a)
edge[EDGE, CORNICE_LEFT:177] = np.median(a[EDGE, 180:205], 1)[:, None]
layer('attacchini', 'cornice', edge[..., :3], edge[..., 3] / 255)
GEOMETRY['attacchini']['hat-cut'] = ' '.join(
    'M' + ' L'.join(f'{p[0][0]} {p[0][1]}' for p in c) + ' Z' for c in cs)

# ---------------------------------------------------------------------------------------
# SI STA COME D'INVERNO — the leaf on the table top draws itself, vein by vein.
# The top is flat green with black ink on it: the ink is lifted into its own layer (colour
# = ink, alpha = how far each pixel sits from the green towards the ink), the green under
# it is inpainted into a clean top, and a time map says when each ink pixel is reached —
# its distance *along the veins* from the leaf's base, where they gather at the top's left tip.
print('si-sta-come-d-inverno')
slug = 'si-sta-come-d-inverno'
a = load(slug)
rows, cols = np.ogrid[:a.shape[0], :a.shape[1]]
rgb = a[..., :3]
green = (rgb[..., 1] > rgb[..., 0] + 4) & (rgb[..., 1] > rgb[..., 2] + 4) & (rgb.max(2) > 120)
# the top is a convex shape, so its hull closes the notches the veins cut into its edge
# (padded: the top runs up to the image's border, where a closing would eat into it)
PAD = 8
top = convex_hull_image(biggest(ndimage.binary_closing(np.pad(green, PAD), np.ones((15, 15)))))
top = top[PAD:-PAD, PAD:-PAD]
# The near side of the top ends on the dark rim. The far sides end in air, and the hull
# falls short of them where ink covers a corner: there the top is whatever the cut-out
# still has past the hull (and a hair more, to stay solid under the soft edge).
opaque = a[..., 3] > 0
dark = rgb.max(2) < 150
rim = biggest(dark & opaque & ~top)
top = biggest(ndimage.binary_dilation(top, iterations=12) & opaque & ~rim)
top = ndimage.binary_dilation(top, iterations=2) & ~rim
# the rim's own shaded edge is not ink: a dark patch counts only if it reaches off it
edge = ndimage.binary_dilation(rim, iterations=2)
lab, _ = ndimage.label(dark & top & opaque)
ink = (lab > 0) & np.isin(lab, np.unique(lab[~edge]))
# lifted with it: its anti-aliased rim, and the faintest strokes (anything under the bare
# green, which never drops below 177) — these arrive with the ink nearest to them
faint = (rgb.max(2) < 172) & top & opaque & ~edge
ink_grown = ndimage.binary_dilation(ink | faint, iterations=2) & top
# inpainted from the green alone: whatever is off the top (the rim, the air) first takes
# its nearest green, or a vein that runs into the rim would be filled back in dark
_, (gy, gx) = ndimage.distance_transform_edt(~(top & ~ink_grown & (a[..., 3] > 250)), return_indices=True)
clean = cv2.inpaint(rgb[gy, gx].astype(np.uint8), ink_grown.astype(np.uint8) * 255, 5, cv2.INPAINT_TELEA)
clean = clean.astype(np.float32)
INK = median(a, ink & (rgb.max(2) < 70))
d = clean - INK
cover = np.clip(((clean - rgb) * d).sum(2) / np.maximum((d * d).sum(2), 1), 0, 1) * ink_grown * (a[..., 3] / 255)
layer(slug, 'clean', clean, soft(top, 0.6) * (a[..., 3] / 255))
layer(slug, 'ink', INK, cover)
# travel cost: cheap along ink, dear across bare green (so a stroke the brush broke still
# gets reached, a little late), impassable off the top
cost = np.where(ink, 1.0, 12.0)
cost[~top] = np.inf
seeds = [tuple(p) for p in np.argwhere(ink & (cols < 30))]
dist, _ = MCP_Geometric(cost).find_costs(seeds)
dist[~np.isfinite(dist)] = 0
far = np.percentile(dist[ink], 99)
# every pixel takes the time of its nearest ink pixel, so the anti-aliased rim of a
# stroke arrives with the stroke
_, (iy, ix) = ndimage.distance_transform_edt(~ink, return_indices=True)
t = np.clip(dist[iy, ix] / far, 0, 1)
layer(slug, 'time', np.dstack([t * 255] * 3), top.astype(np.float32), lossless=True)

# ---------------------------------------------------------------------------------------
# GIUNGLA DEI COLORI PRIMARI — three boards that fan apart; on them the panther's eyes
# follow the pointer, the blue tiger's jaw snaps, the red tiger blinks, the leopard's
# tail swishes. The boards themselves are plain crops of the cut-out (rows 0-396,
# 396-794, 794-end, where they touch) — the page clips them, no files needed.
print('giungla-dei-colori')
slug = 'giungla-dei-colori'
a = load(slug)
rows, cols = np.ogrid[:a.shape[0], :a.shape[1]]
eye(slug, 'panther-l', a, (536, 110, 582, 142), (560, 126, 7.5))
eye(slug, 'panther-r', a, (646, 94, 707, 128), (676, 111, 8))

# The jaw: one layer of fur blue in the shape of the open mouth, with a dark lip line
# across its middle — scaled 0 -> 1 about that line it shuts the mouth.
rgb = a[..., :3]
mbox = box_mask(a.shape, 294, 482, 330, 524)
blue = (rgb[..., 2] > rgb[..., 0] + 60) & mbox
mouth = mbox & ~blue & ~(rgb.max(2) < 60)
mouth = ndimage.binary_dilation(ndimage.binary_fill_holes(biggest(mouth)), iterations=2)
ys = np.nonzero(mouth.any(1))[0]
lip = (ys.min() + ys.max()) // 2
fur = median(a, ndimage.binary_dilation(mouth, iterations=6) & blue)
lips = np.broadcast_to(fur, a.shape[:2] + (3,)).copy()
lips[lip - 1:lip + 2] = (20, 20, 40)
layer(slug, 'jaw', lips, soft(mouth, 0.6))
GEOMETRY[slug]['jaw-line'] = int(lip)

# The red tiger's lids: fur-red ellipses a little bigger than each eye, dark lash line
# along the bottom; they drop from the top to blink.
red = (rgb[..., 0] > 150) & (rgb[..., 1] < 70)
for name, (cx, cy) in (('lid-l', (643.5, 614)), ('lid-r', (689.5, 617))):
    m = ellipse(a.shape, cx, cy, 11, 7)
    col = np.broadcast_to(median(a, ellipse(a.shape, cx, cy, 20, 13) & ~m & red), a.shape[:2] + (3,)).copy()
    col[ellipse(a.shape, cx, cy + 1.5, 11, 6) ^ ellipse(a.shape, cx, cy - 0.5, 11, 6)] = (40, 10, 15)
    layer(slug, name, col, soft(m, 0.5))

# The leopard's tail, in two bones: the long run along the board's foot (A, pivoting
# where it leaves x = 383) and the raised tip (B, pivoting at its bend). Each overlaps the
# next by a band, so the wedges rotation opens at the joints are covered by tail.
yellow = (rgb[..., 0] > 150) & (rgb[..., 1] > 120) & (rgb[..., 2] < 120) & (rgb[..., 0] - rgb[..., 2] > 80)
# the spots are dark brown, not black: warm enough to tell from the board, so the ones
# biting into the tail's outline stay part of it
spots = (rgb[..., 0] - rgb[..., 2] > 18) & (rgb[..., 0] > 35)
tail = (yellow | spots) & box_mask(a.shape, 360, 940, 600, 1200)
tail = ndimage.binary_fill_holes(biggest(ndimage.binary_closing(tail, np.ones((7, 7)))))
tail = ndimage.binary_dilation(tail, iterations=1) & box_mask(a.shape, 360, 940, 600, 1200)
tip = tail & (rows < 1100) & (cols > 490)
run = tail & (cols >= 380) & ~(tip & (rows < 1085))
board = median(a, box_mask(a.shape, 250, 1040, 450, 1100) & (rgb.max(2) < 60))
part(slug, 'tail-a', a, run)
part(slug, 'tail-b', a, tip)
patch(slug, 'tail-hole', a, ndimage.binary_dilation(tail, iterations=2) & (cols >= 392), board)

# ---------------------------------------------------------------------------------------
# DRAGO — the finials' eyes follow the pointer; the roses behind the glass pulse like
# embers (a glow layer: the roses alone, brightened and blurred, faded in and out).
print('drago')
slug = 'drago'
a = load(slug)
rows, cols = np.ogrid[:a.shape[0], :a.shape[1]]
eye(slug, 'eye-l', a, (196, 30, 254, 90), (228, 56, 11))
eye(slug, 'eye-r', a, (758, 30, 816, 88), (789, 56, 10.5))
rgb = a[..., :3]
# The roses are painted barely above the black, under a glass full of reflections. What
# tells a petal apart is red over the mean of green and blue: the glass is blue-black and
# its reflections grey, both around -16, the petals above -8. Bright neutral things (shelf
# edges, dust) pass too, and down in the dark the measure is all compression noise — so
# each rose gets a loose hand-measured hull, and the faint one low in the middle, lost in
# that noise, goes by plain red instead. The glow's strength is how far up that ramp a
# pixel sits; its colour is an ember orange, modulated by the rose's own red so the
# petals keep their drawing.
smooth = cv2.GaussianBlur(np.ascontiguousarray(rgb), (0, 0), 1.2)
red = smooth[..., 0]
pink = red - smooth[..., 1:].mean(2)
ROSES = [  # (hull, measure, its level off the rose, on a petal)
    (box_mask(a.shape, 335, 250, 522, 326), pink, -13.5, -8),      # top, cut by the frame
    (ellipse(a.shape, 477, 430, 102, 94), pink, -13.5, -8),        # centre
    (ellipse(a.shape, 397, 595, 66, 80), pink, -13.5, -8),         # left
    (box_mask(a.shape, 300, 635, 326, 748), pink, -13.5, -8),      # left edge, a sliver
    (poly(a.shape, (672, 250), (628, 283), (630, 370), (640, 405), (655, 435), (672, 442),
          (695, 430), (708, 395), (708, 250)), pink, -13.5, -8),    # top right
    (ellipse(a.shape, 685, 690, 40, 52) & (cols < 708), pink, -13.5, -8),  # bottom right
    (ellipse(a.shape, 530, 716, 56, 34) & (rows < 746), red, 6, 18),  # low in the middle
]
strength = np.zeros(a.shape[:2], np.float32)
for hull, measure, off, on in ROSES:
    strength = np.maximum(strength, soft(hull, 4) * np.clip((measure - off) / (on - off), 0, 1))
ember = np.float32([235, 90, 40]) * np.clip(rgb[..., :1] / 30, 0.45, 1)
layer(slug, 'roses', ember, soft(strength, 3))

# ---------------------------------------------------------------------------------------
# METTO IL BECCO — the right toucan pokes its beak forward: head and beak as one part,
# rotating about the neck. Cream wall behind; the door's keyhole plates stay on top.
print('metto-il-becco')
slug = 'metto-il-becco'
a = load(slug)
rows, cols = np.ogrid[:a.shape[0], :a.shape[1]]
rgb = a[..., :3]
loose = np.zeros(a.shape[:2], np.uint8)
cv2.fillPoly(loose, [np.int32([(318, 1030), (318, 985), (368, 902), (470, 887), (505, 882),
                               (548, 896), (562, 960), (560, 1000), (340, 1030)])], 1)
loose = loose.astype(bool)
sat = rgb.max(2) - rgb.min(2)
yellowish = (sat > 70) & (rgb[..., 0] > 150)
dark = ndimage.binary_opening(rgb.max(2) < 90, np.ones((5, 5)))
throat = np.zeros(a.shape[:2], np.uint8)
cv2.fillPoly(throat, [np.int32([(478, 928), (500, 912), (525, 925), (556, 1000), (478, 1000)])], 1)
head = (yellowish | dark) & loose | throat.astype(bool)
head = biggest(ndimage.binary_fill_holes(ndimage.binary_closing(head, np.ones((5, 5))))) & loose
head &= rows < 1000
cream = median(a, loose & ~head & (rgb.min(2) > 170))
# the two rhombi, by their corners (top, right, bottom, left): the one on the beak is half
# in shadow, as dark and as warm as the beak around it — no threshold finds it whole
wall_plate = poly(a.shape, (328, 937), (338, 958), (328, 986), (320, 960))
beak_plate = poly(a.shape, (372, 936), (380, 956), (372, 980), (363, 957))
plates = wall_plate | beak_plate
# The beak leaves its plate behind: on the moving part the plate is painted out. It sits
# on the yellow, its top-left edge against the black tip — which ends on x = 372 and on
# the mouth line. So: yellow grown in from the beak's own, the tip's corner drawn back
# over it. (Of the wall's plate the head only has the tip's edge under it: black.)
hole = ndimage.binary_dilation(beak_plate, iterations=3)
_, (gy, gx) = ndimage.distance_transform_edt(~(yellowish & ~hole), return_indices=True)
beak = cv2.inpaint(rgb[gy, gx].astype(np.uint8), hole.astype(np.uint8) * 255, 4, cv2.INPAINT_TELEA)
black = median(a, dark & head)
beak[poly(a.shape, (340, 920), (372, 920), (372, 949), (356, 962), (340, 976))] = black
beak = np.where(hole[..., None], cv2.GaussianBlur(np.where(hole[..., None], beak, rgb), (0, 0), 0.7), rgb)
beak[ndimage.binary_dilation(wall_plate, iterations=3)] = black
layer(slug, 'head', beak, soft(head) * a[..., 3] / 255)
patch(slug, 'head-hole', a, ndimage.binary_dilation(head, iterations=1) & (rows < 988), cream)
part(slug, 'plates', a, plates, 0.5)

with open(os.path.join(ROOT, 'src/data/artifact-motion.json'), 'w') as f:
    json.dump(GEOMETRY, f, indent=1)
print('geometry -> src/data/artifact-motion.json')
