"""One-off: derive the assets of the artifact "story" pages (the slices of a detail page)
from the raw shots in the sibling `Decorosa Data/` folder.

Needs Pillow + NumPy + SciPy + OpenCV, and an ffmpeg with libx264 for the videos — the
`FFMPEG` env var, else `imageio_ffmpeg`'s bundled binary, else `ffmpeg` on PATH.

Tigre (`MY/1. Tigre/...`):
  * the photos, straight to webp (long side capped);
  * the staged scene ("ambientazione"): the ink drawing with the painted chest erased —
    the page sets the live chest (TigerPiece) back on the desk. Prints where it goes;
  * a still from the illustrated teaser (IMG_0015): the orange/black stripes;
  * the teaser itself as a loop, minus its "coming soon" frames, and the phone demo
    (IMG_2520) re-encoded small and muted, each with a poster.

Llorona (`MY/6. llorona/llorona-detail/...`):
  * the photos, straight to webp — the closed roll-top registered onto the open one
    (SIFT + RANSAC homography), so the page can roll the shutter up between them;
  * the stone wall behind the desk, flat-fielded and made seamless both ways: the
    page's own wall; and the terrazzo in front of it, its floor;
  * the roll-top being pulled shut, from the side (IMG_2699) and face-on (IMG_2698),
    muted at 720px, each with a poster.

Drago (`MY/5. Drago/l_anno del drago di legno/...`):
  * the photos, straight to webp, and the brown cabinet as it was (IMG_9829) warped onto
    the painted one, from hand-measured points, for the page's wipe;
  * square crops of the details, for the turntable's plates; the three paint swatches;
  * the walk backwards (IMG_0902/4/6). Prints where each sits in the farthest one's frame;
  * the piece turning (IMG_0535) and the door opening (IMG_0538), muted at 720px.

Run with the story to build: `python scripts/build-story-assets.py tigre|llorona|drago` — then
the smaller copies of every picture are remade (image_sizes.py).
"""
import os
import subprocess
import sys
import tempfile

import cv2
import numpy as np
from PIL import Image, ImageOps
from scipy import ndimage

import image_sizes

DATA = 'E:/MyStuff/Websites/Decorosa Data'
PUB = 'E:/MyStuff/Websites/Decorosa/public/assets/stories'

TIGRE_SRC = os.path.join(DATA, 'MY', '1. Tigre', 'tigre contro tigre UNA TIGRE CHE PORTA GIOIE')

# raw name -> published name
TIGRE_PHOTOS = {
    'IMG_2383.jpeg': 'shut',
    'IMG_2384.jpeg': 'open',
    'IMG_2388.jpeg': 'lid-up',
    'IMG_2389.jpeg': 'inside',
    'IMG_2397.JPG': 'detail-flower',
    'IMG_2398.JPG': 'detail-drawer',
    'IMG_2399.JPG': 'detail-mirror',
    'IMG_2400.JPG': 'detail-contro',
    'IMG_2524.jpeg': 'top',
    'IMG_2552.jpeg': 'back',
    'IMG_2571.jpeg': 'tongue',
}

# The teaser's frames (5 fps): 0-5 stripes, 6-8 "coming soon", then the drawing, the
# face, the title card and the TM star (kept: the teaser plays them all).
TEASER_SKIP = range(6, 9)
TEASER_STRIPES = 0


def ffmpeg() -> str:
    if os.environ.get('FFMPEG'):
        return os.environ['FFMPEG']
    try:
        import imageio_ffmpeg

        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        return 'ffmpeg'


# the story being built: its published folder (set in main)
OUT = ''


def save_webp(img: Image.Image, name: str, long_side: int = 1800, quality: int = 80) -> None:
    img = img.copy()
    img.thumbnail((long_side, long_side), Image.LANCZOS)
    img.save(os.path.join(OUT, name + '.webp'), quality=quality, method=6)
    print(f'{name}.webp {img.size[0]}x{img.size[1]}')


def load(folder: str, raw: str) -> Image.Image:
    return ImageOps.exif_transpose(Image.open(os.path.join(folder, raw))).convert('RGB')


def photos() -> None:
    for raw, name in TIGRE_PHOTOS.items():
        save_webp(load(TIGRE_SRC, raw), name)


def scene() -> None:
    """Erase the chest from the staged drawing: the saturated paint, plus the black mouth
    drawer that hangs under it (not saturated, so boxed by hand), hulled and widened a
    hair, painted paper white. Everything the live chest won't cover is plain paper."""
    rgb = np.asarray(Image.open(os.path.join(TIGRE_SRC, 'ambientazione tigre copia.jpg')).convert('RGB'))
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    paint = (hsv[..., 1] > 60) & (hsv[..., 2] > 40)
    lab, n = ndimage.label(paint)
    chest = lab == (np.argmax(ndimage.sum(paint, lab, range(1, n + 1))) + 1)
    ys, xs = np.where(chest)
    left, right, top = xs.min(), xs.max(), ys.min()
    # the dark green base and the drawer, below where the paint mask stops
    base_bottom, drawer = 966, (690, 830, 1036)
    pts = np.column_stack([xs, ys]).astype(np.int32)
    pts = np.vstack([pts, [[left, base_bottom], [right, base_bottom],
                           [drawer[0], drawer[2]], [drawer[1], drawer[2]]]]).astype(np.int32)
    mask = np.zeros(paint.shape, np.uint8)
    cv2.fillConvexPoly(mask, cv2.convexHull(pts), 255)
    mask = cv2.dilate(mask, np.ones((7, 7), np.uint8))
    out = rgb.copy()
    out[mask > 0] = 255
    save_webp(Image.fromarray(out), 'scene', long_side=1600, quality=82)

    # The live chest: the showcase cut-out, as wide as the painted chest, standing on the
    # same base line. Percentages of the scene, for TigreStory.astro.
    art_w, art_h = Image.open('E:/MyStuff/Websites/Decorosa/public/assets/showcase/my.webp').size
    w = right - left
    h = w * art_h / art_w
    size = rgb.shape[1]
    print(f'live chest: left {100 * left / size:.2f}%  top {100 * (base_bottom - 4 - h) / size:.2f}%'
          f'  width {100 * w / size:.2f}%')


def teaser_frames() -> list:
    cap = cv2.VideoCapture(os.path.join(TIGRE_SRC, 'IMG_0015.mp4'))
    frames = []
    while True:
        ok, frame = cap.read()
        if not ok:
            return frames
        frames.append(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))


def teaser() -> None:
    frames = teaser_frames()
    save_webp(Image.fromarray(frames[TEASER_STRIPES]), 'stripes', long_side=1400)
    keep = [f for i, f in enumerate(frames) if i not in TEASER_SKIP]
    with tempfile.TemporaryDirectory() as tmp:
        for i, f in enumerate(keep):
            Image.fromarray(f).save(os.path.join(tmp, f'{i:03d}.png'))
        encode(['-framerate', '5', '-i', os.path.join(tmp, '%03d.png')], 'teaser', 1184, fps=5)
    Image.fromarray(keep[0]).resize((1184, 822), Image.LANCZOS).save(
        os.path.join(OUT, 'teaser.webp'), quality=80)


def demo() -> None:
    encode(['-i', os.path.join(TIGRE_SRC, 'IMG_2520.MOV')], 'demo', 720, crf=30)
    cap = cv2.VideoCapture(os.path.join(TIGRE_SRC, 'IMG_2520.MOV'))
    ok, frame = cap.read()
    poster = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
    poster.thumbnail((720, 1280))
    poster.save(os.path.join(OUT, 'demo.webp'), quality=78)


LLORONA_SRC = os.path.join(DATA, 'MY', '6. llorona', 'llorona-detail')

LLORONA_PHOTOS = {
    'IMG_3007.jpeg': 'open',
    'IMG_2681.jpeg': 'top',
    'IMG_2680.jpeg': 'stars',
    'IMG_2689.jpeg': 'drawers',
    'IMG_2817.jpeg': 'snake',
    'IMG_2690.jpeg': 'side',
    'IMG_2678.jpeg': 'above',
    'IMG_2848.jpeg': 'room',
    'IMG_2989.jpeg': 'front',
    'IMG_2688.jpeg': 'drawers-open',
    'IMG_2697.jpeg': 'shut-side',
}
# the wall above the desk in IMG_2690 (px of the upright photo), and the tile's size
WALL_SRC, WALL_BOX = 'IMG_2690.jpeg', (0, 0, 3024, 1240)
WALL_H, WALL_BLEND = 900, 160
# the terrazzo floor in IMG_3007, clear of the desk and its shadow (px of the upright
# photo), and the strip's height
FLOOR_SRC, FLOOR_BOX = 'IMG_3007.jpeg', (800, 3100, 3024, 4032)
FLOOR_H, FLOOR_BLEND = 420, 60
# the desk's front in the roll-top pair (left, top, right, bottom as fractions of the
# frame) — below its starry top, which turned with it on another plane
DESK = (0.2, 0.29, 0.84, 0.58)


def llorona_photos() -> None:
    for raw, name in LLORONA_PHOTOS.items():
        save_webp(load(LLORONA_SRC, raw), name)
    # the frieze of beasts was shot sideways: stood upright, cut to the frieze and the
    # stone above it (the gilt rail of the roll-top at the bottom)
    frieze = load(LLORONA_SRC, 'IMG_2683.jpeg').rotate(90, expand=True)
    save_webp(frieze.crop((0, round(frieze.height * 0.38), frieze.width, frieze.height)), 'frieze')
    # The closed roll-top (IMG_3008), warped onto the open one: the desk shifted between
    # the two, so only keypoints on its front (DESK) count — the
    # page wipes from one to the other inside the shutter's box only.
    open_, shut = load(LLORONA_SRC, 'IMG_3007.jpeg'), load(LLORONA_SRC, 'IMG_3008.jpeg')
    a, b = (cv2.cvtColor(np.asarray(im.resize((im.width // 2, im.height // 2))), cv2.COLOR_RGB2GRAY)
            for im in (open_, shut))
    mask = np.zeros(a.shape, np.uint8)
    h, w = a.shape
    mask[round(DESK[1] * h):round(DESK[3] * h), round(DESK[0] * w):round(DESK[2] * w)] = 255
    sift = cv2.SIFT_create(4000)
    ka, da = sift.detectAndCompute(a, mask)
    kb, db = sift.detectAndCompute(b, mask)
    pairs = cv2.BFMatcher().knnMatch(db, da, k=2)
    good = [m for m, n in pairs if m.distance < 0.7 * n.distance]
    src = np.float32([kb[m.queryIdx].pt for m in good]) * 2
    dst = np.float32([ka[m.trainIdx].pt for m in good]) * 2
    hom, _ = cv2.findHomography(src, dst, cv2.RANSAC, 4.0)
    warped = cv2.warpPerspective(np.asarray(shut), hom, open_.size, borderMode=cv2.BORDER_REPLICATE)
    save_webp(Image.fromarray(warped), 'closed')


def llorona_wall() -> None:
    """The page's stone: the wall above the desk, its light flattened (divided by its own
    heavy blur) so no tile is brighter than the next, then made seamless both ways by
    folding each far edge back over the near one."""
    rgb = np.asarray(load(LLORONA_SRC, WALL_SRC).crop(WALL_BOX)).astype(np.float32)
    lum = rgb.mean(axis=2, keepdims=True)
    rgb = rgb / np.maximum(cv2.GaussianBlur(lum, (0, 0), 160)[..., None], 1) * lum.mean()
    img = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8))
    img = np.asarray(img.resize((round(img.width * WALL_H / img.height), WALL_H), Image.LANCZOS)).astype(np.float32)
    for axis in (1, 0):
        img = np.moveaxis(img, axis, 0)
        n = img.shape[0] - WALL_BLEND
        t = np.linspace(0, 1, WALL_BLEND, endpoint=False)[:, None, None]
        out = img[:n].copy()
        out[:WALL_BLEND] = img[:WALL_BLEND] * t + img[n:] * (1 - t)
        img = np.moveaxis(out, 0, axis)
    tile = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))
    tile.save(os.path.join(OUT, 'wall.webp'), quality=72, method=6)
    print(f'wall.webp {tile.size[0]}x{tile.size[1]}')


def llorona_floor() -> None:
    """The page's floor: the terrazzo in front of the desk, its light evened out across
    (not down — the near tiles stay brighter), and made seamless sideways: it repeats at
    the width where the tile grid best meets itself again, the overlap cross-faded."""
    rgb = np.asarray(load(LLORONA_SRC, FLOOR_SRC).crop(FLOOR_BOX)).astype(np.float32)
    lum = cv2.GaussianBlur(rgb.mean(axis=2), (0, 0), 120)
    rgb = rgb / lum[..., None] * lum.mean(axis=1, keepdims=True)[..., None]
    h, w = rgb.shape[:2]
    img = cv2.resize(np.clip(rgb, 0, 255), (round(w * FLOOR_H / h), FLOOR_H), interpolation=cv2.INTER_AREA)
    head = img[:, :FLOOR_BLEND]
    n = min(range(img.shape[1] // 2, img.shape[1] - FLOOR_BLEND),
            key=lambda n: float(np.mean((img[:, n:n + FLOOR_BLEND] - head) ** 2)))
    t = np.linspace(0, 1, FLOOR_BLEND, endpoint=False)[None, :, None]
    out = img[:, :n].copy()
    out[:, :FLOOR_BLEND] = head * t + img[:, n:n + FLOOR_BLEND] * (1 - t)
    tile = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))
    tile.save(os.path.join(OUT, 'floor.webp'), quality=74, method=6)
    print(f'floor.webp {tile.size[0]}x{tile.size[1]}')


# the roll-top being pulled shut, from the side and face-on: raw -> published name
LLORONA_FILMS = {'IMG_2699.MOV': 'rolltop', 'IMG_2698.MOV': 'rolltop-front'}


def llorona_film() -> None:
    for raw, name in LLORONA_FILMS.items():
        raw = os.path.join(LLORONA_SRC, raw)
        encode(['-i', raw], name, 720, crf=30)
        cap = cv2.VideoCapture(raw)
        ok, frame = cap.read()
        poster = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        poster.thumbnail((720, 1280))
        poster.save(os.path.join(OUT, name + '.webp'), quality=78)


DRAGO_SRC = os.path.join(DATA, 'MY', '5. Drago', 'l_anno del drago di legno')

DRAGO_PHOTOS = {
    'drago.jpeg': 'after',
    'IMG_0550 2.jpeg': 'wall-near',
    'IMG_0549 2.jpeg': 'wall-far',
    'IMG_0908.jpeg': 'held',
    'IMG_0909.jpeg': 'peek',
    'Draghetto_OK copia.jpg': 'drawing',
    'moodboard.jpg': 'street',
}
# The same points on the brown cabinet (IMG_9829) and on the painted one (drago.jpeg), as
# fractions of each frame: shelf tips, finials, feet, hinges, handle, crest and door.
DRAGO_OLD = [(.184, .420), (.827, .420), (.149, .900), (.864, .900), (.315, .975), (.705, .975), (.335, .352),
             (.680, .352), (.503, .397), (.316, .425), (.697, .893), (.672, .527), (.681, .768), (.347, .612)]
DRAGO_NEW = [(.115, .178), (.897, .175), (.122, .900), (.890, .895), (.298, .980), (.712, .985), (.288, .066),
             (.717, .066), (.490, .150), (.272, .188), (.725, .890), (.695, .362), (.697, .715), (.320, .490)]
# the turntable's plates: name -> centre and half-side on drago.jpeg (px)
DRAGO_PLATES = {
    'eye': (1935, 290, 215),
    'crest': (1300, 330, 320),
    'fang': (1770, 760, 270),
    'handle': (860, 1480, 270),
    'scales': (620, 2270, 300),
    'teeth': (1050, 2180, 270),
    'foot': (790, 2470, 200),
}
# the paint swatches at the foot of IMG_0575: name -> box (px)
DRAGO_SWATCHES = {'blue': (78, 1225, 300, 1470), 'orange': (487, 1225, 702, 1470), 'yellow': (897, 1225, 1112, 1470)}
# the walk backwards, nearest first: raw -> where to look for the door's orange frame (px)
DRAGO_ZOOM = {
    'IMG_0902.jpeg': (1100, 1200, 2100, 2700),
    'IMG_0904.jpeg': (1250, 1550, 1750, 2200),
    'IMG_0906.jpeg': (1330, 1700, 1620, 2000),
}
# the turning piece, and the door opening: raw -> published name
DRAGO_FILMS = {'IMG_0535.MOV': 'turn', 'IMG_0538.MOV': 'door'}


def drago_photos() -> None:
    for raw, name in DRAGO_PHOTOS.items():
        save_webp(load(DRAGO_SRC, raw), name)
    # The brown cabinet as it was, warped onto the painted one, for the page's wipe.
    old, new = load(DRAGO_SRC, 'IMG_9829.jpeg'), load(DRAGO_SRC, 'drago.jpeg')
    src = np.float32(DRAGO_OLD) * old.size
    dst = np.float32(DRAGO_NEW) * new.size
    hom, _ = cv2.findHomography(src, dst, 0)
    print('old cabinet off by', np.abs(cv2.perspectiveTransform(src[None], hom)[0] - dst).mean().round(1), 'px')
    warped = cv2.warpPerspective(np.asarray(old), hom, new.size, borderMode=cv2.BORDER_REPLICATE)
    save_webp(Image.fromarray(warped), 'before')
    for name, (x, y, r) in DRAGO_PLATES.items():
        save_webp(new.crop((x - r, y - r, x + r, y + r)).resize((640, 640), Image.LANCZOS), f'plate-{name}')
    swatches = load(DRAGO_SRC, 'IMG_0575 2.jpeg')
    for name, box in DRAGO_SWATCHES.items():
        save_webp(swatches.crop(box), f'swatch-{name}')


def drago_zoom() -> None:
    """The walk backwards: three shots (all 3:4), placed in the farthest one's frame so
    the door's frame coincides. Prints the numbers DragoStory.astro's `.zoom` takes."""
    frames = []
    for i, (raw, (x0, y0, x1, y1)) in enumerate(DRAGO_ZOOM.items()):
        img = load(DRAGO_SRC, raw)
        save_webp(img, f'zoom-{i + 1}')
        hsv = cv2.cvtColor(np.asarray(img.crop((x0, y0, x1, y1))), cv2.COLOR_RGB2HSV)
        paint = (hsv[..., 0] < 16) & (hsv[..., 1] > 110) & (hsv[..., 2] > 120)
        lab, n = ndimage.label(paint)
        door = lab == (np.argmax(ndimage.sum(paint, lab, range(1, n + 1))) + 1)
        ys, xs = np.where(door)
        frames.append((img.size, x0 + (xs.min() + xs.max()) / 2, y0 + (ys.min() + ys.max()) / 2, xs.max() - xs.min()))
        print(raw, f'door centre {frames[-1][1]:.0f},{frames[-1][2]:.0f} width {frames[-1][3]}')
    (W, H), cx, cy, width = frames[-1]
    for i, ((w, h), x, y, door) in enumerate(frames):
        s = width / door * w / W
        left, top = (cx - x * width / door) / W, (cy - y * width / door) / H
        print(f'zoom-{i + 1}: left {100 * left:.2f}%  top {100 * top:.2f}%  width {100 * s:.2f}%')
        if i == 0:
            z = 1 / s
            print(f'start scale {z:.3f}, about {100 * z * left / (z - 1):.2f}% {100 * z * top / (z - 1):.2f}%')


def drago_film() -> None:
    for raw, name in DRAGO_FILMS.items():
        raw = os.path.join(DRAGO_SRC, raw)
        encode(['-i', raw], name, 720, crf=30)
        cap = cv2.VideoCapture(raw)
        ok, frame = cap.read()
        poster = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        poster.thumbnail((720, 720))
        poster.save(os.path.join(OUT, name + '.webp'), quality=78)


def encode(inputs: list, name: str, width: int, fps: int | None = None, crf: int = 26) -> None:
    """H.264 baseline-friendly mp4: muted, yuv420p, moov atom up front so it starts
    streaming at once."""
    args = [ffmpeg(), '-y', '-loglevel', 'error', *inputs, '-an',
            '-vf', f'scale={width}:-2:flags=lanczos', '-c:v', 'libx264', '-preset', 'slow',
            '-crf', str(crf), '-pix_fmt', 'yuv420p', '-movflags', '+faststart']
    if fps:
        args += ['-r', str(fps)]
    out = os.path.join(OUT, name + '.mp4')
    subprocess.run([*args, out], check=True)
    print(f'{name}.mp4 {os.path.getsize(out) // 1024} KB')


if __name__ == '__main__':
    story = sys.argv[1] if len(sys.argv) > 1 else ''
    jobs = {
        'tigre': (photos, scene, teaser, demo),
        'llorona': (llorona_photos, llorona_wall, llorona_floor, llorona_film),
        'drago': (drago_photos, drago_zoom, drago_film),
    }
    if story not in jobs:
        sys.exit(f'usage: build-story-assets.py {"|".join(jobs)}')
    OUT = os.path.join(PUB, story)
    # emptied rather than removed: Windows refuses to recreate a folder it is still deleting
    os.makedirs(OUT, exist_ok=True)
    for old in os.listdir(OUT):
        os.remove(os.path.join(OUT, old))
    for job in jobs[story]:
        job()
    image_sizes.build()
