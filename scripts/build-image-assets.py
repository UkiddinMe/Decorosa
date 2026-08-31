"""One-off: turn the raw shots in the sibling `Decorosa Data/` folder into web assets."""
import os
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
my = resize(cutout('TigreAperta', 42, (185, 150, 128)), 1500)
save(drop_cast_shadow(my, base_y=1012, drawer=(575, 931), drawer_y=1138, v_max=85),
     'showcase/my', quality=88)

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
