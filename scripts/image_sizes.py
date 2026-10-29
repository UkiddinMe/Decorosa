"""Smaller copies of the site's pictures, so the browser never shrinks a big file itself
(its quick resample breaks fine lines — the Llorona's roll-top slats — into dashes):
each picture also as `<name>-<level>.webp`, for the pages' srcset and the SVG pieces
(src/scripts/sized.ts). `level` is the long side the *group's first* picture is brought
down to, and every picture of a group (an artwork and the parts that move on it) is
scaled by that same factor, so they always stay in step. Levels at or over the first
picture's long side are skipped, so pictures under 500px get none.

Made from the published files (alpha and lossless kept). The build-*.py scripts run it
when done; on its own: `python scripts/image_sizes.py`. SIZES must match
src/data/images.ts.
"""
import glob
import os
import re

from PIL import Image

PUB = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'assets'))
SIZES = (500, 800, 1200)
SIZED = re.compile(r'-(?:' + '|'.join(map(str, SIZES)) + r')\.webp$')
# in a story's folder, not photos: the tiled walls and floor, the stripes background and
# the videos' posters
STORY_SKIP = {'wall', 'floor', 'stripes', 'teaser', 'demo', 'rolltop', 'rolltop-front'}


def rel(pattern: str) -> list[str]:
    paths = glob.glob(os.path.join(PUB, pattern))
    return sorted(os.path.relpath(p, PUB).replace(os.sep, '/') for p in paths if not SIZED.search(p))


def groups() -> list[list[str]]:
    """Every sized picture, in groups; the first of each sets the scale."""
    out = [[cut, *rel(f'artifacts/motion/{cut[10:-5]}-*.webp')] for cut in rel('artifacts/*.webp')]
    out.append(['showcase/my.webp', 'showcase/my-mouth.webp', 'showcase/my-mouth-shut.webp'])
    out.append(['works/dessert.webp', 'works/dessert-shadow.webp', 'works/dessert-cherry.webp'])
    singles = rel('showcase/iam.webp') + rel('works/back-to-showcase.webp') + rel('dark-side/*-dim.webp')
    singles += rel('bio/*.webp')
    singles += [p for p in rel('stories/*/*.webp') if os.path.basename(p)[:-5] not in STORY_SKIP]
    return out + [[p] for p in singles]


def lossless(path: str) -> bool:
    with open(path, 'rb') as f:
        head = f.read(40)
    # simple lossless, or extended with its image chunk straight after the header
    return head[12:16] == b'VP8L' or (head[12:16] == b'VP8X' and head[30:34] == b'VP8L')


def build() -> None:
    for old in glob.glob(os.path.join(PUB, '**', '*.webp'), recursive=True):
        if SIZED.search(old):
            os.remove(old)
    for group in groups():
        ref = max(Image.open(os.path.join(PUB, group[0])).size)
        for path in group:
            src = os.path.join(PUB, path)
            img = Image.open(src)
            img = img.convert('RGBA' if 'A' in img.getbands() else 'RGB')
            keep = {'lossless': True} if lossless(src) else {'quality': 82}
            for level in (s for s in SIZES if s < ref):
                f = level / ref
                size = (max(1, round(img.width * f)), max(1, round(img.height * f)))
                img.resize(size, Image.LANCZOS).save(src[:-5] + f'-{level}.webp', method=6, **keep)
        print(f'{group[0]} (+{len(group) - 1}): {[s for s in SIZES if s < ref]}')


if __name__ == '__main__':
    build()
