"""Re-frame glasses photos so each image matches the 9852 / Linda Farrow
framing: glasses width ~84% of frame width, vertically and horizontally
centered, with reflected-edge padding filling any exposed marble area.

Originals are copied alongside as ``<name>.orig.<ext>`` on the first run, and
subsequent runs always read from the backup so the script is idempotent.
"""

from __future__ import annotations

import shutil
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / "images"
TARGET_BRANDS = ("akila", "cutler-gross", "yuichi-toyama")
SECTIONS = ("sunglasses", "optical")
DARK_THRESHOLD = 80
TARGET_GW_RATIO = 0.84
MAX_SCALE = 1.35
MIN_SCALE = 0.85
EXTS = {".jpg", ".jpeg", ".png", ".webp"}


def detect_glasses_bbox(im: Image.Image) -> tuple[int, int, int, int] | None:
    arr = np.array(im.convert("L"))
    h, w = arr.shape
    mask = arr < DARK_THRESHOLD
    rows = np.where(mask.any(axis=1))[0]
    cols = np.where(mask.any(axis=0))[0]
    if len(rows) < 10 or len(cols) < 10:
        return None
    top, bot = int(rows[0]), int(rows[-1])
    left, right = int(cols[0]), int(cols[-1])
    if (bot - top) < h * 0.10 or (bot - top) > h * 0.85:
        return None
    if (right - left) < w * 0.30:
        return None
    return left, top, right, bot


def reframe(im: Image.Image) -> Image.Image | None:
    bbox = detect_glasses_bbox(im)
    if bbox is None:
        return None
    w, h = im.size
    left, top, right, bot = bbox
    gw = right - left
    cx, cy = (left + right) / 2, (top + bot) / 2

    scale = (TARGET_GW_RATIO * w) / gw
    scale = max(MIN_SCALE, min(MAX_SCALE, scale))

    sw, sh = int(round(w * scale)), int(round(h * scale))
    scaled = im.resize((sw, sh), Image.LANCZOS)
    scx, scy = cx * scale, cy * scale

    pad = max(w, h)
    arr = np.array(scaled)
    if arr.ndim == 2:
        padded = np.pad(arr, ((pad, pad), (pad, pad)), mode="reflect")
    else:
        padded = np.pad(arr, ((pad, pad), (pad, pad), (0, 0)), mode="reflect")
    cx_p, cy_p = scx + pad, scy + pad
    x0 = int(round(cx_p - w / 2))
    y0 = int(round(cy_p - h / 2))
    cropped = padded[y0:y0 + h, x0:x0 + w]
    return Image.fromarray(cropped)


def backup_path(p: Path) -> Path:
    return p.with_name(p.stem + ".orig" + p.suffix)


def process_one(p: Path) -> str:
    orig = backup_path(p)
    if not orig.exists():
        shutil.copy2(p, orig)
    with Image.open(orig) as im:
        im.load()
        fmt = (im.format or p.suffix.lstrip(".")).upper()
        result = reframe(im)
    if result is None:
        shutil.copy2(orig, p)
        return "skip"
    save_kwargs: dict[str, object] = {}
    if fmt in {"JPG", "JPEG"}:
        save_kwargs = {"quality": 92, "subsampling": 1, "optimize": True}
        fmt = "JPEG"
    result.save(p, format=fmt, **save_kwargs)
    return "ok"


def main() -> int:
    counts = {"ok": 0, "skip": 0, "miss": 0, "err": 0}
    for section in SECTIONS:
        for brand in TARGET_BRANDS:
            folder = ROOT / section / brand
            if not folder.is_dir():
                counts["miss"] += 1
                print(f"[miss] {folder}")
                continue
            for entry in sorted(folder.iterdir()):
                if entry.suffix.lower() not in EXTS:
                    continue
                if entry.stem.endswith(".orig"):
                    continue
                try:
                    status = process_one(entry)
                except Exception as exc:
                    print(f"[err]  {entry.relative_to(ROOT)}: {exc}")
                    counts["err"] += 1
                    continue
                counts[status] += 1
    print(f"Done: {counts}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
