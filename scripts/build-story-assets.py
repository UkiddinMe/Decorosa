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
"""
import os
import shutil
import subprocess
import tempfile

import cv2
import numpy as np
from PIL import Image, ImageOps
from scipy import ndimage

DATA = 'D:/MyStuff/Websites/Decorosa Data'
PUB = 'D:/MyStuff/Websites/Decorosa/public/assets/stories'

TIGRE_SRC = os.path.join(DATA, 'MY', '1. Tigre', 'tigre contro tigre UNA TIGRE CHE PORTA GIOIE')
TIGRE_OUT = os.path.join(PUB, 'tigre')

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


def save_webp(img: Image.Image, name: str, long_side: int = 1800, quality: int = 80) -> None:
    img = img.copy()
    img.thumbnail((long_side, long_side), Image.LANCZOS)
    img.save(os.path.join(TIGRE_OUT, name + '.webp'), quality=quality, method=6)
    print(f'{name}.webp {img.size[0]}x{img.size[1]}')


def photos() -> None:
    for raw, name in TIGRE_PHOTOS.items():
        img = ImageOps.exif_transpose(Image.open(os.path.join(TIGRE_SRC, raw))).convert('RGB')
        save_webp(img, name)


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
    art_w, art_h = Image.open('D:/MyStuff/Websites/Decorosa/public/assets/showcase/my.webp').size
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
        os.path.join(TIGRE_OUT, 'teaser.webp'), quality=80)


def demo() -> None:
    encode(['-i', os.path.join(TIGRE_SRC, 'IMG_2520.MOV')], 'demo', 720, crf=30)
    cap = cv2.VideoCapture(os.path.join(TIGRE_SRC, 'IMG_2520.MOV'))
    ok, frame = cap.read()
    poster = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
    poster.thumbnail((720, 1280))
    poster.save(os.path.join(TIGRE_OUT, 'demo.webp'), quality=78)


def encode(inputs: list, name: str, width: int, fps: int | None = None, crf: int = 26) -> None:
    """H.264 baseline-friendly mp4: muted, yuv420p, moov atom up front so it starts
    streaming at once."""
    args = [ffmpeg(), '-y', '-loglevel', 'error', *inputs, '-an',
            '-vf', f'scale={width}:-2:flags=lanczos', '-c:v', 'libx264', '-preset', 'slow',
            '-crf', str(crf), '-pix_fmt', 'yuv420p', '-movflags', '+faststart']
    if fps:
        args += ['-r', str(fps)]
    out = os.path.join(TIGRE_OUT, name + '.mp4')
    subprocess.run([*args, out], check=True)
    print(f'{name}.mp4 {os.path.getsize(out) // 1024} KB')


if __name__ == '__main__':
    shutil.rmtree(TIGRE_OUT, ignore_errors=True)
    os.makedirs(TIGRE_OUT)
    photos()
    scene()
    teaser()
    demo()
