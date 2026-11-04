"""The rose reflection painted out of the Drago's glass: shared by the cut-out
(build-image-assets.py) and the painted photo of the page's wipe (build-story-assets.py)."""
import cv2
import numpy as np
from PIL import Image


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
