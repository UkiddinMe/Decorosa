"""One-off: turn the raw shots in the sibling `Decorosa Data/` folder into web assets."""
import os
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageOps
from scipy import ndimage
from rembg import new_session, remove

DATA = 'E:/MyStuff/Websites/Decorosa Data'
SRC = os.path.join(DATA, 'Pagina principale Scala')
PUB = 'E:/MyStuff/Websites/Decorosa/public/assets'


def flood_bg(rgb, sat_max, v_levels):
    """Background = low-saturation bright pixels reachable from the image border.
    Levels are applied loosest-last so a soft shadow gradient is eaten progressively
    without letting the looser threshold leak into the (dark, saturated) object."""
    v = rgb.max(2)
    sat = rgb.max(2) - rgb.min(2)
    border = np.zeros(v.shape, bool)
    border[0, :] = border[-1, :] = border[:, 0] = border[:, -1] = True
    bg = np.zeros(v.shape, bool)
    for vmin in v_levels:
        cand = (sat < sat_max) & (v >= vmin)
        lab, n = ndimage.label(cand)
        seed = ndimage.binary_dilation(bg | border) & cand
        keep = np.unique(lab[seed])
        bg |= np.isin(lab, keep[keep > 0])
    return bg


def keep_object(mask):
    """The subject is the biggest blob; keep it plus any detached part of the piece
    (a drawer pull under its own shadow). Stray patches of lit background touch the
    frame edge, so anything border-touching that is not the subject is dropped."""
    lab, n = ndimage.label(mask)
    sizes = ndimage.sum(mask, lab, range(1, n + 1))
    main = int(np.argmax(sizes)) + 1
    edge = set(lab[0, :]) | set(lab[-1, :]) | set(lab[:, 0]) | set(lab[:, -1])
    keep = [i for i in range(1, n + 1) if i == main or (i not in edge and sizes[i - 1] > 500)]
    return np.isin(lab, keep)


def feathered(rgb, mask, feather=1.2, shrink=1.0):
    """Soften the hard mask edge, then pull it in so no white JPEG fringe survives."""
    a = Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(feather))
    a = np.asarray(a).astype(np.float32) / 255.0
    a = np.clip((a - shrink * 0.5) / (1 - shrink * 0.5), 0, 1)
    return Image.fromarray(np.dstack([rgb.astype(np.uint8), (a * 255).astype(np.uint8)]), 'RGBA')


def trim(img):
    """Crop away fully transparent margins."""
    return img.crop(img.getchannel('A').point(lambda p: 255 if p > 8 else 0).getbbox())


def cutout(name, sat_max, v_levels, **kw):
    rgb = np.asarray(Image.open(os.path.join(SRC, name + '.jpeg')).convert('RGB')).astype(np.int16)
    mask = keep_object(ndimage.binary_fill_holes(~flood_bg(rgb, sat_max, v_levels)))
    return trim(feathered(rgb, mask, **kw))


def drop_cast_shadow(img, base_y, drawer, drawer_y, v_max):
    """Hand-measured for this photo, and only sound because of what is in frame. The
    piece stands on a flat contact line (`base_y`); the one thing that legitimately hangs
    below it is the open drawer, in the column `drawer`. Lower still (`drawer_y` down),
    the drawer front and its pull are near-black while the shadow they cast on the table
    is the same dark warm neutral as the painted green base — no colour, hue or texture
    rule separates those two — so there, keep only what is near-black."""
    a = np.asarray(img).astype(np.float32)
    v = a[..., :3].max(2)
    keep = np.ones(a.shape[:2], np.float32)
    keep[base_y:] = 0
    keep[base_y:, drawer[0]:drawer[1]] = 1
    # the drawer front is solid, so close the pinholes its lighter brush strokes punch
    # in a plain threshold rather than loosening the threshold into the shadow's range
    band = v[drawer_y:, drawer[0]:drawer[1]] < v_max
    band = ndimage.binary_fill_holes(ndimage.binary_closing(band, np.ones((9, 9))))
    keep[drawer_y:, drawer[0]:drawer[1]] = band
    keep = np.asarray(
        Image.fromarray((keep * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))
    ).astype(np.float32) / 255.0
    a[..., 3] *= keep
    a[..., 3] *= keep_object(a[..., 3] > 128)
    return trim(Image.fromarray(a.astype(np.uint8), 'RGBA'))


def drop_right_shadow(img, from_y, margin=4):
    """This piece is photographed on a white sweep with its shadow falling to the right,
    and in shade that shadow is neither bright nor neutral enough for `flood_bg` to reach
    it — it survives as a beige skirt welded to the object. The chest's own right edge,
    though, is painted green all the way down (body, then the plinth that juts back out),
    so from `from_y` down keep nothing right of each row's last green pixel. The median
    filter is there because single rows lose the green to a black outline stroke."""
    a = np.asarray(img).astype(np.float32)
    green = (a[..., 1] - a[..., 0] > 5) & (a[..., 3] > 128)
    idx = np.arange(a.shape[1])
    right = ndimage.median_filter(np.where(green.any(1), (green * idx).max(1), a.shape[1]), 41)
    keep = (idx[None, :] <= right[:, None] + margin).astype(np.float32)
    keep[:from_y] = 1
    keep = np.asarray(
        Image.fromarray((keep * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))
    ).astype(np.float32) / 255.0
    a[..., 3] *= keep
    a[..., 3] *= keep_object(a[..., 3] > 128)
    return trim(Image.fromarray(a.astype(np.uint8), 'RGBA'))


def register(src, dst, skip):
    """Homography that lays cut-out `src` onto cut-out `dst`. The two shots are the same
    piece from a slightly different camera spot, so nothing short of a fitted transform
    makes the paint line up. Matching runs on the opaque pixels only, minus `skip` — the
    band where the two shots are *meant* to differ (the mouth), which would otherwise
    offer the fit a pile of confident wrong matches."""
    def prep(img):
        g = cv2.cvtColor(np.asarray(img)[..., :3], cv2.COLOR_RGB2GRAY)
        m = (np.asarray(img)[..., 3] > 200).astype(np.uint8) * 255
        h, w = m.shape
        m[int(h * skip[1]):, int(w * skip[0]):int(w * skip[2])] = 0
        return g, m

    sift = cv2.SIFT_create(6000)
    ks, ds = sift.detectAndCompute(*prep(src))
    kd, dd = sift.detectAndCompute(*prep(dst))
    pairs = cv2.BFMatcher().knnMatch(ds, dd, k=2)
    good = [m for m, n in pairs if m.distance < 0.75 * n.distance]
    H, inliers = cv2.findHomography(
        np.float32([ks[m.queryIdx].pt for m in good]).reshape(-1, 1, 2),
        np.float32([kd[m.trainIdx].pt for m in good]).reshape(-1, 1, 2),
        cv2.RANSAC, 3.0)
    print(f'register: {int(inliers.sum())}/{len(good)} matches kept')
    return H


def resize(img, width):
    return img.resize((width, round(img.height * width / img.width)), Image.LANCZOS)


def save(img, rel, **kw):
    p = os.path.join(PUB, rel + '.webp')
    os.makedirs(os.path.dirname(p), exist_ok=True)
    img.save(p, 'WEBP', method=6, **kw)
    print(f'{rel}.webp  {img.size[0]}x{img.size[1]}  {os.path.getsize(p) / 1024:.0f} KB')


# Matting model for the cut-outs whose backgrounds are real places (a wall, a room), where
# no colour rule separates the subject: rembg's BiRefNet (`pip install "rembg[cpu]"`,
# ~1 GB model on first run).
matte = new_session('birefnet-general')

# I AM — her whole figure, lifted off the wall and pavement, floating frameless on the
# spiral like the other two panels. Full resolution of the cut (~490px wide): the panel
# renders ~60 CSS px wide, so even close up that is >4x.
iam = Image.open(os.path.join(SRC, 'TM.jpeg')).convert('RGB')
iam_alpha = remove(iam, session=matte, only_mask=True)
save(trim(Image.fromarray(np.dstack([np.asarray(iam), np.asarray(iam_alpha)]), 'RGBA')),
     'showcase/iam', quality=88)

# MY — the tiger chest, lifted off its white sweep (background + cast shadow dropped).
# It comes in two shots, mouth shut and mouth open, and the page animates between them
# (ANIMATIONS.md): the shut chest is the artwork, and the mouth is two strips cut from the
# *same column* of it — the open mouth from the second shot, the shut mouth from the first.
# On the page the open strip stretches down from the jaw line while the shut strip is
# squeezed against its own floor, so the drawer pushes the closed face out of the way.
#
# Both strips are plain rectangles, and deliberately so: the page scales them vertically,
# and a shaped cut-out would deform against paint that isn't moving. Straight sides stay
# straight. Their width is the drawer's, at its widest — the outer edge of its side walls.
shut = resize(drop_right_shadow(cutout('TigreChiusa', 42, (185, 150, 128)), from_y=1150), 1500)
open_ = resize(cutout('TigreAperta', 42, (185, 150, 128)), 1500)
open_ = drop_cast_shadow(open_, base_y=1012, drawer=(575, 931), drawer_y=1138, v_max=85)
save(shut, 'showcase/my', quality=88)

# Hand-measured on these two shots, in the 1500px frame both are resized to: the column the
# drawer occupies, the jaw line it swings from, and the floor of the shut drawers (below
# that the green plinth starts, and the open drawer simply covers it).
MOUTH_X = (578, 952)
JAW_Y = 530
SHUT_FLOOR_Y = 905

H = register(open_, shut, skip=(0.42, 0.40, 0.62))
# The open drawer hangs below the shut chest's silhouette, so the shared canvas is taller
# than the artwork — the open strip is allowed to spill past the card box on the page.
corners = np.float32([[0, 0], [open_.width, 0], [open_.width, open_.height], [0, open_.height]])
canvas_h = int(np.ceil(max(cv2.perspectiveTransform(corners.reshape(-1, 1, 2), H)[:, 0, 1].max(),
                           shut.height)))
warped = Image.fromarray(cv2.warpPerspective(np.asarray(open_), H, (shut.width, canvas_h),
                                             flags=cv2.INTER_LANCZOS4, borderValue=(0, 0, 0, 0)),
                         'RGBA')
mouth_open = warped.crop((MOUTH_X[0], JAW_Y, MOUTH_X[1], canvas_h))
save(mouth_open, 'showcase/my-mouth', quality=88)
save(shut.crop((MOUTH_X[0], JAW_Y, MOUTH_X[1], SHUT_FLOOR_Y)), 'showcase/my-mouth-shut', quality=88)

# The open strip does not end in a straight line: its last rows are the drawer's pull,
# hanging free with transparency either side. So the shut strip below it is pinned to the
# deepest row that is still solid across the strip — the drawer's bottom bar — and the
# pull simply overhangs it. Pinned to the file's true bottom instead, the two strips only
# touch at the pull and a band of untouched artwork shows between them.
# (not a full row: below the chest's silhouette the strip's outermost columns are already
# past the drawer's side walls, so the deepest solid rows are ~97% opaque, not 100%)
solid = (np.asarray(mouth_open)[..., 3] > 200).mean(1) > 0.9
seam = int(np.nonzero(solid)[0].max()) + 1
# Copy into `mouth` in panels.ts: where the column sits on the artwork, and that seam row.
print('  mouth box (% of my.webp): left {:.2f} top {:.2f} width {:.2f} | seam {}'.format(
    100 * MOUTH_X[0] / shut.width, 100 * JAW_Y / shut.height,
    100 * (MOUTH_X[1] - MOUTH_X[0]) / shut.width, seam))

# DARK SIDE — the black shape; alpha comes from the ink itself, so the wavy edges
# keep their anti-aliasing instead of being cut by a threshold.
ink = np.asarray(Image.open(os.path.join(SRC, 'DSOTM.jpeg')).convert('L')).astype(np.float32)
a = np.clip((235 - ink) / 175, 0, 1)
save(trim(Image.fromarray(
    np.dstack([np.zeros(ink.shape + (3,), np.uint8), (a * 255).astype(np.uint8)]), 'RGBA')),
    'showcase/dark-side', lossless=True)

# ...and its hover twitch (PanelCard.astro): a strip of the shape's 8 mirror/rotation
# variants, the original first. Flipped as-is, the off-centre point the sparks converge
# on would jump around the box, so each variant is warped back to put it where the
# original has it: per axis a power curve x -> W·(x/W)^g, which pins both edges and is
# smooth everywhere (no crease), with g picked to send the variant's hub onto HUB.
# Variants that swap axes are first stretched back to the original's box.
twitch = np.asarray(Image.open(os.path.join(PUB, 'showcase/dark-side.webp')).getchannel('A'))
TH, TW = twitch.shape
HUB = (257, 204)  # (x, y) of the convergence point in dark-side.webp


def pow_axis(n, out_c, src_c):
    """Source coordinate for each output pixel along one axis, sending out_c <- src_c."""
    g = np.log(src_c / n) / np.log(out_c / n)
    return (n * (np.arange(n) / n) ** g).astype(np.float32)


def variant(img, k):
    """k-th element of the square's symmetry group (0 = untouched), back in the TW x TH box."""
    v = np.rot90(img, k % 4)
    v = np.fliplr(v) if k >= 4 else v
    return np.asarray(Image.fromarray(np.ascontiguousarray(v)).resize((TW, TH), Image.LANCZOS))


# The hub is tracked by putting a blob on it and sending that through the same transform.
yy, xx = np.mgrid[:TH, :TW]
blob = (255 * np.exp(-((xx - HUB[0]) ** 2 + (yy - HUB[1]) ** 2) / 50)).astype(np.uint8)
frames = []
for k in range(8):
    b = variant(blob, k).astype(np.float32)
    hx, hy = (b * xx).sum() / b.sum(), (b * yy).sum() / b.sum()
    mx, my = np.meshgrid(pow_axis(TW, HUB[0], hx), pow_axis(TH, HUB[1], hy))
    frames.append(cv2.remap(variant(twitch, k), mx, my, cv2.INTER_LINEAR))
strip = np.hstack(frames)
save(Image.fromarray(np.dstack([np.zeros(strip.shape + (3,), np.uint8), strip]), 'RGBA'),
     'showcase/dark-side-twitch', lossless=True)

# WORKS — the "back to the showcase" end-card. Hand-framed on this shot to the owner's
# reference crop: the bookcase on the right and the floor below are left out, which caps
# the width at 776px; the 2:3 plate is centred vertically on the reference's height.
# No upscale: 776px still covers ~1.9x the card's largest render.
#
# The shot is a white room that never reaches white — its 99th percentile sits at 217/255
# — so it reads grey on the page. A gamma lift opens the midtones back up (a linear
# stretch would clip the lit hatch, which is already at 255 in places) without touching
# either end, so the dark jacket and boots keep their weight.
#
# The room is then dissolved into plain white — wall, ceiling, beam, the rail under the
# window and every cast shadow — so the hatch opens in empty space. What stays: the
# hatch (frame, doors and lit inside, minus the shaded head above it) and the ladder as
# hand-measured shapes in this frame, and her figure from the matting model.
deco = Image.open(os.path.join(DATA, 'MY', 'DecoScala.jpeg')).convert('RGB')
DECO_W, DECO_TOP = 776, 42
deco = deco.crop((0, DECO_TOP, DECO_W, DECO_TOP + round(DECO_W * 3 / 2)))
lifted = np.power(np.asarray(deco).astype(np.float32) / 255.0, 0.82)
DH, DW = lifted.shape[:2]


def lrail(y):  # left edge of each ladder rail: they lean right, the near one more
    return 412 + 0.176 * (y - 455)


def rrail(y):
    return 679 + 0.2 * (y - 1160)


def rung(y, t=12):
    """A rung between the rails, its top edge at height `y` where x = 640, tilting down
    to the left."""
    xl, xr = lrail(y) + 15, rrail(y) + 4
    yl, yr = y + 0.18 * (640 - xl), y + 0.18 * (640 - xr)
    return [(xl, yl), (xr, yr), (xr, yr + t), (xl, yl + t)]


# The frame's outline: its top edge is one straight line from the frame's top-left corner,
# parallel to the opening's head (the left door pokes above it); its bottom edge slopes
# down to where the ladder hooks on.
hatch = np.zeros((DH, DW), np.uint8)
cv2.fillPoly(hatch, [np.int32([(274, 85), (326, 98), (390, 28), (397, 30), (398, 116),
                               (687, 190), (736, 132), (744, 135), (748, 405),
                               (690, 440), (480, 456), (290, 433)])], 1)
ladder = np.zeros((DH, DW), np.uint8)
# The two rungs under her feet sit flatter than the lower ones: measured on their own.
for p in ([(lrail(446), 446), (lrail(446) + 22, 446), (lrail(DH) + 22, DH), (lrail(DH), DH)],
          [(rrail(560), 560), (rrail(560) + 14, 560), (rrail(DH) + 14, DH), (rrail(DH), DH)],
          [(520, 999), (647, 979), (647, 994), (520, 1012)], rung(1104),
          [(500, 877), (626, 873), (626, 883), (500, 890)],
          [(480, 759), (600, 757), (600, 770), (480, 773)]):
    # one call per shape: fillPoly given several at once leaves their overlaps empty
    cv2.fillPoly(ladder, [np.int32(p)], 1)
figure = np.asarray(remove(deco, session=matte, only_mask=True)).astype(np.float32) / 255.0
shape = cv2.GaussianBlur((hatch | ladder).astype(np.float32), (0, 0), 1.2)
keep = np.maximum(figure, shape)[..., None]
# white wood on white: a touch of shade keeps the bare rails legible
wood = cv2.GaussianBlur((ladder * (figure < 0.5) * (hatch == 0)).astype(np.float32), (0, 0), 1.5)
fg = lifted * (1 - 0.1 * wood[..., None])
# The white things (doors, frame, rails) shot in a grey room read grey against pure
# white, i.e. pasted on; lifting the near-neutral light tones (not her) makes them high-key.
pale = (np.clip((fg.mean(2) - 0.55) / 0.3, 0, 1) * np.clip(1 - (fg.max(2) - fg.min(2)) / 0.12, 0, 1)
        * (1 - figure))[..., None]
fg = fg + (1 - fg) * 0.6 * pale


def spread(img, w, sigma):
    """`img` smeared outward from where `w` holds, normalised so it keeps its colour."""
    return (cv2.GaussianBlur(img * w, (0, 0), sigma)
            / np.maximum(cv2.GaussianBlur(w, (0, 0), sigma), 1e-4)[..., None])


# So nothing looks pasted on, subject and white are lit by the same light:
#  * the hatch's lamp light spills out — a tight bloom round the opening plus a wide
#    wash that tints the white well beyond it — and falls on the doors, frame, ladder
#    and figure too, strongest near the opening;
#  * the subject is bathed in the room's light: its darks lifted (colour kept), so the
#    jacket and boots stay dark but no longer read as cut from a dimmer shot;
#  * light wraps round every edge (the white bleeds a few px onto the subject) and the
#    subject haloes softly into the white, as if seen through a faint haze.
lit = hatch.astype(bool) & (lifted[..., 0] - lifted[..., 2] > 0.12) & (lifted.mean(2) > 0.7)
warm = np.median(lifted[lit], 0)
litf = lit.astype(np.float32)
near, wide = cv2.GaussianBlur(litf, (0, 0), 35), cv2.GaussianBlur(litf, (0, 0), 160)
glow = (1 - (1 - 0.6 * near / near.max()) * (1 - 0.75 * wide / wide.max()))[..., None]
light = 1 - (1 - warm) * np.minimum(1.1 * glow ** 0.7, 1)   # off-white, warming toward the lamp
light = light * (1 - 0.03 * (1 - glow))                     # the far corners a touch softer than paper white
# bathed in light: the same lift added to all three channels raises the darks without
# washing out their colour, and her colours get back the punch the lift takes off
lum = fg.mean(2, keepdims=True)
fg = fg + (0.1 + 0.12 * glow) * (1 - lum) ** 1.5 * (1 - lit[..., None])
lum = fg.mean(2, keepdims=True)
fg = lum + (fg - lum) * (1 + 0.25 * figure[..., None])
fg = fg * (1 - (1 - warm) * 0.35 * glow * (~lit[..., None]))          # and warmed by the lamp
haze = cv2.GaussianBlur(keep, (0, 0), 6)[..., None]
bg = light * (1 - 0.25 * haze) + spread(fg, keep, 6) * light * 0.25 * haze
wrap = np.clip(cv2.GaussianBlur(1 - keep[..., 0], (0, 0), 2), 0, 1)[..., None] * keep
fg = fg + (spread(bg, 1 - keep, 2) - fg) * 0.35 * wrap
out = fg * keep + bg * (1 - keep)
# the opening itself overexposes: its glow blooms over the frame and doors in front
bloom = cv2.GaussianBlur(litf, (0, 0), 14)[..., None]
out = out + (1 - out) * 0.35 * bloom * (1 - litf[..., None])
save(Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8), 'RGB'),
     'works/back-to-showcase', quality=90)


# DARK SIDE OF THE MOOD — the mirrorball and the cat that stand in the page's corners.
# Both are flat two-tone drawings: one pink on one navy, nothing else in the file. So the
# cut-out is an exact unmix rather than a segmentation — project each pixel onto the
# navy→pink axis and that scalar *is* the coverage, which keeps the anti-aliased edges
# and, just as importantly, leaves the navy inside the ball (its mirror tiles, the cat's
# body) transparent, so the page's own gradient shows through the drawing as it does in
# the artwork.
DSOTM = os.path.join(DATA, 'DSOTM')
NAVY, PINK = np.array([35, 45, 95], np.float32), np.array([203, 46, 112], np.float32)


def unmix(name, width, ink=None):
    """`ink(h, w)` paints the drawing (an RGB float array); by default the artwork's pink."""
    rgb = np.asarray(Image.open(os.path.join(DSOTM, name + '.png')).convert('RGB')).astype(np.float32)
    axis = PINK - NAVY
    a = np.clip(((rgb - NAVY) @ axis) / (axis @ axis), 0, 1)
    paint = ink(*a.shape) if ink else np.broadcast_to(PINK, a.shape + (3,))
    flat = np.clip(paint, 0, 255).astype(np.uint8)
    return resize(trim(Image.fromarray(np.dstack([flat, (a * 255).astype(np.uint8)]), 'RGBA')), width)


# The "dim" variants the restyled page uses: a deeper, more saturated magenta, lit from
# the right like the page's shaft of light — a horizontal ramp from shadow to lit ink.
SHADE, LIT = np.array([96, 10, 52], np.float32), np.array([226, 34, 118], np.float32)


def side_lit(h, w):
    t = (np.linspace(0, 1, w, dtype=np.float32) ** 1.4)[None, :, None]
    return np.broadcast_to(SHADE + (LIT - SHADE) * t, (h, w, 3))


# Twice the largest size each is rendered at (see DarkSidePage.astro), no more: flat art,
# so lossless keeps the lines crisp at a fraction of a photo's weight.
save(unmix('strobo 1', 960), 'dark-side/ball', lossless=True)
save(unmix('animaletto 1', 660), 'dark-side/animal', lossless=True)
save(unmix('strobo 1', 960, side_lit), 'dark-side/ball-dim', lossless=True)
save(unmix('animaletto 1', 660, side_lit), 'dark-side/animal-dim', lossless=True)

# I AM timeline — the photos a few events on /bio carry (see src/data/bio.ts).
TIMELINE = os.path.join(DATA, 'I AM', 'file per timeline')

# The comic (2014): five scanned pages, already trimmed to the paper. They are read
# full-screen in the timeline's lightbox, so they keep their native size — the scan is
# only 679px wide and upscaling would buy nothing.
for page in range(1, 6):
    src = Image.open(os.path.join(TIMELINE, f'{page} fumetto.JPG')).convert('RGB')
    save(src, f'bio/fumetto-{page}', quality=86)

# The workshop sign (2022): a wide piece in a tall shot. The timeline cards are near-square
# and cover-cropped, so frame a square on the sign — hand-measured on this photo, wall
# above and floor below — instead of letting CSS cut the lettering off.
entrata = Image.open(os.path.join(TIMELINE, 'entrata.jpeg')).convert('RGB')
save(resize(entrata.crop((250, 905, 2700, 3355)), 1200), 'bio/entrata', quality=86)


# WORKS — the tiles end-card: the "Dessert" dune, split into the plate and the cherry that
# drops onto it (DuneScene.astro). The painting is flat colour — sky, sand, sand in shade,
# plus the text — so both jobs are exact rather than guessed:
#  * the cherry's cast shadow is a plain multiply over the sand: every shadowed colour is
#    its lit colour × 0.783 per channel. Find the band (the one blob of the two shadowed
#    colours), divide it back out, and the dune is as it would be with no cherry on it.
#  * the cherry is everything in its corner that is not a palette colour. Behind it goes
#    sky, down to the ridge line; its anti-aliased rim is unmixed against that background.
# The plate is 2:3 and the painting square, and in the painting the dune's peak sits high
# and well right of where the card wants it. So the plate is a two-thirds-wide window slid
# right and down — the peak lands just right of the card's centre, the sky grows above it
# and the dune's foot drops off the bottom — and the word, which that would move or cut,
# is pasted back from the unmoved frame at its own margins (plain sky around it both ways).
# The cast shadow is kept as a layer of its own: the page fades it in as the cherry falls.
dessert = np.asarray(Image.open(os.path.join(DATA, 'MY', 'Dessert.JPG')).convert('RGB')).astype(np.float32)
SKY, SAND, BROWN = (136, 162, 161), (221, 165, 106), (137, 102, 74)
SHADE = 0.783


def near(img, c, tol=14):
    return np.abs(img - np.float32(c)).max(2) < tol


# 1. the shadow band: the biggest blob of shaded sand/brown, with its pinholes (the brush
#    strokes crossing it) filled. Inside, divide; on its 1px rim — pixels only partly in
#    shade — snap to whichever lit colour, sand or brown, explains the pixel best.
band = near(dessert, np.float32(SAND) * SHADE) | near(dessert, np.float32(BROWN) * SHADE)
lab, _ = ndimage.label(band)
band = lab == np.argmax(np.bincount(lab.ravel())[1:]) + 1
band = ndimage.binary_fill_holes(ndimage.binary_closing(band, np.ones((5, 5))))
flat = dessert.copy()
flat[band] = np.clip(dessert[band] / SHADE, 0, 255)
rim = ndimage.binary_dilation(band, np.ones((5, 5))) & ~band & ~near(dessert, SKY, 30)
lit = np.float32([SAND, BROWN])
for y, x in zip(*np.nonzero(rim)):
    p = dessert[y, x]
    # p = c · s for a shade factor s in [SHADE, 1]: fit s per candidate, keep the better
    s = np.clip((lit @ p) / (lit * lit).sum(1), SHADE, 1)
    flat[y, x] = lit[np.argmin(((lit * s[:, None] - p) ** 2).sum(1))]

# 2. the cherry: non-palette pixels in its corner of the frame, as one blob, closed and
#    grown by 2px so its whole anti-aliased rim is inside.
BOX = (980, 280, 1320, 760)  # x0, y0, x1, y1 — hand-framed around the cherry and stem
sub = flat[BOX[1]:BOX[3], BOX[0]:BOX[2]].copy()
other = ~(near(sub, SKY, 10) | near(sub, SAND, 10) | near(sub, BROWN, 10))
lab, _ = ndimage.label(ndimage.binary_opening(other, np.ones((3, 3))))
core = ndimage.binary_fill_holes(lab == np.argmax(np.bincount(lab.ravel())[1:]) + 1)
cherry_px = ndimage.binary_dilation(core, np.ones((5, 5)))

# 3. behind it: sky above the ridge, sand/brown below. The ridge under the cherry is what
#    each column shows just below the blob; the sand's top edge is interpolated straight
#    across the columns where the cherry sits on it.
bg = sub.copy()
sky = np.median(sub[near(sub, SKY, 10)], 0)  # the true tone: SKY is only a tolerance centre
h, w = cherry_px.shape
ridge = np.full(w, h, np.int32)
for x in range(w):
    col = np.nonzero(~near(sub[:, x:x + 1], SKY, 30)[:, 0] & ~cherry_px[:, x])[0]
    if col.size:
        ridge[x] = col.min()
touch = np.nonzero(cherry_px[-1] | (ridge < h) & cherry_px[np.clip(ridge - 1, 0, h - 1), np.arange(w)])[0]
if touch.size:
    l, r = max(touch.min() - 1, 0), min(touch.max() + 1, w - 1)
    ridge[l:r + 1] = np.round(np.interp(np.arange(l, r + 1), [l, r], [ridge[l], ridge[r]]))
for x in range(w):
    ys = np.nonzero(cherry_px[:, x])[0]
    if not ys.size:
        continue
    below = sub[min(max(ridge[x], ys.max() + 1), h - 1), x]
    for y in ys:
        bg[y, x] = sky if y < ridge[x] else below
flat[BOX[1]:BOX[3], BOX[0]:BOX[2]] = bg

# the cherry's colour: its core pixels as they are; on the rim, the nearest core colour,
# with alpha = how far the pixel sits from the background towards that colour
_, (iy, ix) = ndimage.distance_transform_edt(~core, return_indices=True)
c = sub[iy, ix]
d = c - bg
alpha = np.clip(((sub - bg) * d).sum(2) / np.maximum((d * d).sum(2), 1), 0, 1)
alpha[core] = 1
alpha[~cherry_px] = 0
cherry = trim(Image.fromarray(np.dstack([c, alpha * 255]).astype(np.uint8), 'RGBA'))
cy0, cx0 = [int(v.min()) for v in np.nonzero(alpha > 8 / 255)]

PLATE_W = round(dessert.shape[0] * 2 / 3)
SHIFT, DROP = 384, 290  # the peak (≈1150, 722) lands at ~56% across, ~49% down
WORD = (0, 0, 1110, 320)  # x0, y0, x1, y1 — the word plus a margin of sky
OUT_W = 1024  # the card renders at most ~410 CSS px wide, so ~2.5x
k = OUT_W / PLATE_W


def window(img, fill):
    """The painting slid SHIFT left and DROP down in a plate-sized frame; `fill` tops it."""
    out = np.empty((img.shape[0], PLATE_W) + img.shape[2:], img.dtype)
    out[:] = fill
    out[DROP:] = img[:img.shape[0] - DROP, SHIFT:SHIFT + PLATE_W]
    return out


wordless = flat.copy()
wordless[WORD[1]:WORD[3], WORD[0]:WORD[2]] = sky
framed = window(wordless, sky)
framed[WORD[1]:WORD[3], WORD[0]:WORD[2]] = flat[WORD[1]:WORD[3], WORD[0]:WORD[2]]
save(resize(Image.fromarray(framed.astype(np.uint8), 'RGB'), OUT_W), 'works/dessert', quality=92)
save(cherry.resize((round(cherry.width * k), round(cherry.height * k)), Image.LANCZOS),
     'works/dessert-cherry', quality=92)

# the shadow as black at the coverage that reproduces the multiply: 1 - shot / clean. Flat
# 1 - SHADE inside the band, fractional on its anti-aliased rim; cropped to its own box.
shade = np.clip(1 - (dessert * flat).sum(2) / np.maximum((flat * flat).sum(2), 1), 0, 1 - SHADE)
shade[~ndimage.binary_dilation(band, np.ones((5, 5)))] = 0
shade = window(shade, 0)
shadow = Image.fromarray(np.dstack([np.zeros(shade.shape + (3,)), shade * 255]).astype(np.uint8), 'RGBA')
sx0, sy0, sx1, sy1 = shadow.getchannel('A').getbbox()
shadow = shadow.crop((sx0, sy0, sx1, sy1))
save(shadow.resize((round(shadow.width * k), round(shadow.height * k)), Image.LANCZOS),
     'works/dessert-shadow', quality=92)

# Copy into DuneScene.astro: the plate's size and where the cherry and shadow sit on it.
print('  plate {}x{} | cherry at x {:.1f} y {:.1f} size {:.1f}x{:.1f}'.format(
    OUT_W, round(dessert.shape[0] * k), (BOX[0] + cx0 - SHIFT) * k, (BOX[1] + cy0 + DROP) * k,
    cherry.width * k, cherry.height * k))
print('  shadow at x {:.1f} y {:.1f} size {:.1f}x{:.1f}'.format(
    sx0 * k, sy0 * k, (sx1 - sx0) * k, (sy1 - sy0) * k))


# WORKS — the "MY" run's cards (artifacts.ts), one shot per folder in `MY/`, numbered in
# run order (1 is the tiger and -1 the dessert, both handled above). The backgrounds are
# real rooms — wall, tiles, stone, a courtyard — so the cut-out is the matting model.
# Each card floats frameless in its 2:3 box, so ~1200px on the long side covers the
# largest render (the detail hero, ~520 CSS px) at 2x.
RUN = [
    ('2. Attacchini', 'attacchini'),
    ('3. Si sta come d_inverno', 'si-sta-come-d-inverno'),
    ('4. Giungla dei colori', 'giungla-dei-colori'),
    ('5. Drago', 'drago'),
    ('6. llorona', 'llorona'),
    ('7. Metto il becco', 'metto-il-becco'),
    ('8. Mangrovie', 'mangrovie'),
]
# Where the model misses part of the piece, a hand-measured polygon on the shot gives it
# back. White on white, it loses the left pillar of the coat rack against the wall: the
# frame is straight, so its body (below the cornice, down to the plinth) is filled in.
# The mangrove embroidery comes back with a hole in the right of its mount: the frame
# is a plain quad, so all of it is.
PATCH = {
    'attacchini': [(289, 157), (440, 157), (440, 1050), (292, 1050), (292, 1035), (297, 1033)],
    'mangrovie': [(165, 482), (1338, 467), (1347, 1577), (168, 1587)],
}


def drago_without_roses(img):
    """The dragon cabinet was shot with roses behind its glass that are not part of the
    piece. They are painted out on the cut-out (hand-measured hulls, in its pixels): the
    low frequencies are inpainted from the glass around them, blurred over the glass alone
    so the white teeth and the frame never bleed in; a fifth of the detail is laid back,
    its red and its dark petal outlines dropped, so the grain doesn't go flat. Through a
    rose, each row of a shelf edge is carried over from its sides instead."""
    a = np.asarray(img).astype(np.float32)
    rgb = a[..., :3]
    H, W = rgb.shape[:2]
    yy, xx = np.mgrid[:H, :W]

    def ell(cx, cy, rx, ry):
        return ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 <= 1

    def box(x0, y0, x1, y1):
        return (xx >= x0) & (xx < x1) & (yy >= y0) & (yy < y1)

    right = np.zeros((H, W), np.uint8)
    cv2.fillPoly(right, [np.int32([(672, 240), (622, 283), (622, 370), (634, 410), (652, 445),
                                   (672, 452), (700, 440), (712, 395), (712, 240)])], 1)
    hull = (box(330, 236, 530, 335) | ell(477, 430, 110, 102) | ell(397, 595, 74, 88)
            | box(300, 630, 332, 755) | ell(685, 690, 48, 60) | ell(530, 716, 64, 42)
            | right.astype(bool))
    dark = cv2.GaussianBlur(rgb, (0, 0), 1).max(2) < 80   # the glass, not teeth or frame
    m = hull & dark & box(300, 236, 709, 958)
    # never inpaint *from* the teeth or the frame's lit inner edge
    src = m | ((~dark | (xx >= 700)) & box(270, 200, 740, 990))
    d = dark.astype(np.float32)[..., None]
    low = cv2.GaussianBlur(rgb * d, (0, 0), 5) / np.maximum(cv2.GaussianBlur(d, (0, 0), 5)[..., None], 1e-3)
    bg = cv2.inpaint(low.clip(0, 255).astype(np.uint8), src.astype(np.uint8), 15, cv2.INPAINT_TELEA)
    hi = rgb - low
    hi[..., 0] = hi[..., 1:].mean(2)
    fill = bg.astype(np.float32) + 0.2 * np.maximum(hi, -2)
    for y0, y1 in ((444, 470), (738, 770)):   # the two shelf edges
        for y in range(y0, y1):
            xs = np.nonzero(~m[y] & dark[y] & box(300, 236, 709, 958)[y])[0]
            for c in range(3):
                fill[y, :, c] = np.interp(np.arange(W), xs, rgb[y, xs, c])
    w = (cv2.GaussianBlur(m.astype(np.float32), (0, 0), 2.5) * dark)[..., None]
    a[..., :3] = rgb * (1 - w) + fill * w
    return Image.fromarray(a.clip(0, 255).astype(np.uint8), 'RGBA')


RETOUCH = {'drago': drago_without_roses}  # run on the published-size cut-out

for folder, slug in RUN:
    d = os.path.join(DATA, 'MY', folder)
    shot = ImageOps.exif_transpose(Image.open(os.path.join(d, os.listdir(d)[0]))).convert('RGB')
    alpha = remove(shot, session=matte, only_mask=True)
    if slug in PATCH:
        ImageDraw.Draw(alpha).polygon(PATCH[slug], fill=255)
    art = trim(Image.fromarray(np.dstack([np.asarray(shot), np.asarray(alpha)]), 'RGBA'))
    k = min(1, 1200 / max(art.size))
    art = art.resize((round(art.width * k), round(art.height * k)), Image.LANCZOS)
    save(RETOUCH.get(slug, lambda img: img)(art), f'artifacts/{slug}', quality=88)
