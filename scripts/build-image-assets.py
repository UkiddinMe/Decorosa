"""One-off: turn the raw shots in the sibling `Decorosa Data/` folder into web assets."""
import os
import cv2
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

DATA = 'D:/MyStuff/Websites/Decorosa Data'
SRC = os.path.join(DATA, 'Pagina principale Scala')
PUB = 'D:/MyStuff/Websites/Decorosa/public/assets'


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


# I AM — the figure sits small in the middle of a very tall frame, so squeezing the whole
# shot into the card threw away most of its resolution. Crop to her bust at the card's own
# 220:280 first, then downscale: same file size, nearly all of it now spent on her.
iam = Image.open(os.path.join(SRC, 'TM.jpeg')).convert('RGB')
CARD_AR = 220 / 280
centre, height = (1600, 1950), 1700  # hand-framed on this shot: bust centred
half_w, half_h = round(height * CARD_AR / 2), height // 2
box = (centre[0] - half_w, centre[1] - half_h, centre[0] + half_w, centre[1] + half_h)
save(resize(iam.crop(box), 880), 'showcase/iam', quality=88)

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

# WORKS — the "back to the showcase" end-card. Its plate is 2:3 and the shot is taller
# than that, so trim the ceiling beam and keep the hatch, her, and the ladder's foot on
# the floor. No downscale: 853px already covers the card's largest render.
#
# The shot is a white room that never reaches white — its 99th percentile sits at 217/255
# — so it reads grey on the page. A gamma lift opens the midtones back up (a linear
# stretch would clip the lit hatch, which is already at 255 in places) without touching
# either end, so the dark jacket and boots keep their weight.
deco = Image.open(os.path.join(DATA, 'MY', 'DecoScala.jpeg')).convert('RGB')
plate_h = round(deco.width * 3 / 2)
deco = deco.crop((0, 160, deco.width, 160 + plate_h))
lifted = np.power(np.asarray(deco).astype(np.float32) / 255.0, 0.82) * 255
save(Image.fromarray(lifted.astype(np.uint8), 'RGB'), 'works/back-to-showcase', quality=90)


# DARK SIDE OF THE MOOD — the mirrorball and the cat that stand in the page's corners.
# Both are flat two-tone drawings: one pink on one navy, nothing else in the file. So the
# cut-out is an exact unmix rather than a segmentation — project each pixel onto the
# navy→pink axis and that scalar *is* the coverage, which keeps the anti-aliased edges
# and, just as importantly, leaves the navy inside the ball (its mirror tiles, the cat's
# body) transparent, so the page's own gradient shows through the drawing as it does in
# the artwork.
DSOTM = os.path.join(DATA, 'DSOTM')
NAVY, PINK = np.array([35, 45, 95], np.float32), np.array([203, 46, 112], np.float32)


def unmix(name, width):
    rgb = np.asarray(Image.open(os.path.join(DSOTM, name + '.png')).convert('RGB')).astype(np.float32)
    axis = PINK - NAVY
    a = np.clip(((rgb - NAVY) @ axis) / (axis @ axis), 0, 1)
    flat = np.broadcast_to(PINK.astype(np.uint8), a.shape + (3,))
    return resize(trim(Image.fromarray(np.dstack([flat, (a * 255).astype(np.uint8)]), 'RGBA')), width)


# Twice the largest size each is rendered at (see DarkSidePage.astro), no more: flat art,
# so lossless keeps the lines crisp at a fraction of a photo's weight.
save(unmix('strobo 1', 960), 'dark-side/ball', lossless=True)
save(unmix('animaletto 1', 660), 'dark-side/animal', lossless=True)

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
