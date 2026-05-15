"""
Normalize product photos so the eyewear is framed consistently in every image.

Each source photo has the frame sitting at a different spot / size on a light
marble background. This detects the frame (the darker subject vs the light
background), then crops a SQUARE centred on the product, sized so the product
width is a consistent fraction of the cell. Where the square runs past the
original photo edge it is reflect-padded (marble texture mirrors, ~seamless) —
so there is never a flat-colour border, never a gap, and every product lines up.

Originals are backed up to:
  D:/Eye Noon - Website Archive/images-original-backup/

Usage:
  python scripts/normalize_product_images.py <dir1> [<dir2> ...]
"""
import sys
import os
import numpy as np
from PIL import Image

OUT_SIZE = 1000          # final square px
WIDTH_FRAC = 0.88        # product width as a fraction of the cell width
HEIGHT_CAP = 0.92        # ensure product height never exceeds this fraction
DARK_DELTA = 55          # a pixel is "product" if this much darker than the background
ROWCOL_MIN_FRAC = 0.02   # a row/col counts as product if >=2% of it is product pixels


def normalize(path):
    img = Image.open(path).convert("RGB")
    arr = np.asarray(img)
    rgb = arr.astype(np.int16)
    g = np.asarray(img.convert("L"), dtype=np.int16)
    h, w = g.shape

    # Sample the marble background from the four corner patches.
    cs = max(8, min(h, w) // 12)
    g_corners = np.concatenate([
        g[:cs, :cs].ravel(), g[:cs, -cs:].ravel(),
        g[-cs:, :cs].ravel(), g[-cs:, -cs:].ravel(),
    ])
    bg = int(np.median(g_corners))
    rgb_corners = np.concatenate([
        rgb[:cs, :cs].reshape(-1, 3), rgb[:cs, -cs:].reshape(-1, 3),
        rgb[-cs:, :cs].reshape(-1, 3), rgb[-cs:, -cs:].reshape(-1, 3),
    ])
    bg_rgb = np.median(rgb_corners, axis=0)

    # Product mask — three signals so light metal frames & coloured lenses are
    # caught too, not just dark acetate:
    #   (a) much darker than the background
    #   (b) colour notably different from the background (gold, blue lenses, ...)
    #   (c) crisp edges (frame outlines; soft marble veins don't trigger)
    dark = g < (bg - DARK_DELTA)
    colored = np.abs(rgb - bg_rgb).sum(axis=2) > 70
    gx = np.abs(np.diff(g, axis=1, prepend=g[:, :1]))
    gy = np.abs(np.diff(g, axis=0, prepend=g[:1, :]))
    edges = (gx + gy) > 45
    mask = dark | colored | edges
    rows = np.where(mask.sum(axis=1) > (w * ROWCOL_MIN_FRAC))[0]
    cols = np.where(mask.sum(axis=0) > (h * ROWCOL_MIN_FRAC))[0]

    if len(rows) and len(cols):
        top, bot, left, right = rows[0], rows[-1], cols[0], cols[-1]
        pw, ph = right - left, bot - top
        if pw < w * 0.15 or ph < h * 0.08:   # detection looks bogus -> use whole image
            top, bot, left, right, pw, ph = 0, h - 1, 0, w - 1, w - 1, h - 1
    else:
        top, bot, left, right, pw, ph = 0, h - 1, 0, w - 1, w - 1, h - 1

    cx, cy = (left + right) // 2, (top + bot) // 2
    side = max(int(round(pw / WIDTH_FRAC)), int(round(ph / HEIGHT_CAP)))

    # Square window centred on the product; reflect-pad where it exceeds the photo.
    x0, y0 = cx - side // 2, cy - side // 2
    padl, padt = max(0, -x0), max(0, -y0)
    padr, padb = max(0, x0 + side - w), max(0, y0 + side - h)
    if padl or padt or padr or padb:
        # np.pad 'reflect' needs pad < dim; clamp to 'edge' fallback if a pad is huge.
        mode = "reflect" if max(padl, padr) < w and max(padt, padb) < h else "edge"
        arr = np.pad(arr, ((padt, padb), (padl, padr), (0, 0)), mode=mode)
        x0, y0 = x0 + padl, y0 + padt

    crop = arr[y0:y0 + side, x0:x0 + side]
    out = Image.fromarray(crop).resize((OUT_SIZE, OUT_SIZE), Image.LANCZOS)
    out.save(path, quality=88)
    return pw, ph, side


def main(dirs):
    total = 0
    for d in dirs:
        for name in sorted(os.listdir(d)):
            if not name.lower().endswith((".jpg", ".jpeg", ".png")):
                continue
            p = os.path.join(d, name)
            try:
                pw, ph, side = normalize(p)
                total += 1
                print(f"  {p}  product {pw}x{ph} -> {side}px square")
            except Exception as e:
                print(f"  !! {p}: {e}")
    print(f"Done: {total} images normalized.")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    main(sys.argv[1:])
