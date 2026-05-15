"""One-off cleanup:
  - Remove specific models from the sunglasses catalog
      Akila: Jet, Cosmos, Solace, Torrey
      Cutler & Gross: 9386 Square Polarised, 9782 Aviator (non-polarised), 9386 Square
      L.G.R: Reunion Explorer, Asmara Explorer, Axum Explorer, Zanzibar Explorer
  - Replace Akila Echo image with its P1 variant (current P2 is a close-up detail)
  - Delete the now-orphaned image files in images/sunglasses/<brand>/
"""

from __future__ import annotations

import json
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
IMG = ROOT / "images"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"

REMOVE = {
    "akila": {"Jet", "Cosmos", "Solace", "Torrey"},
    "cutler-gross": {
        "9386 Square Polarised Sunglasses",
        "9782 Aviator Sunglasses",
        "9386 Square Sunglasses",
    },
    "lgr": {
        "Reunion Explorer | Netflix THE SANDMAN",
        "Asmara Explorer | Mission: Impossible",
        "Axum Explorer | Lions of Ethiopia",
        "Zanzibar Explorer",
    },
}


def fetch_bytes(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    return urllib.request.urlopen(req, timeout=30).read()


def find_echo_p1() -> str | None:
    data = json.loads(fetch_bytes("https://akila.la/products.json?limit=250"))
    for p in data.get("products", []):
        if p.get("title") != "Echo":
            continue
        for im in p.get("images", []):
            src = im.get("src", "")
            if "-P1." in src or "-P1_" in src:
                return src
    return None


def main() -> int:
    cat_path = DATA / "sunglasses-catalog.json"
    catalog = json.loads(cat_path.read_text(encoding="utf-8"))

    removed_files: list[Path] = []
    for brand in catalog["brands"]:
        bid = brand["id"]
        if bid not in REMOVE:
            continue
        names = REMOVE[bid]
        kept = []
        for f in brand["frames"]:
            if f["model"] in names:
                p = ROOT / f["image"]
                if p.is_file():
                    removed_files.append(p)
                # also queue .orig backup
                orig = p.with_name(p.stem + ".orig" + p.suffix)
                if orig.is_file():
                    removed_files.append(orig)
            else:
                kept.append(f)
        before = len(brand["frames"])
        brand["frames"] = kept
        print(f"  {bid}: {before} -> {len(kept)} (removed {before - len(kept)})")

    # Fix Echo image (Akila)
    p1_url = find_echo_p1()
    if not p1_url:
        print("WARN: Akila Echo P1 not found; skipping Echo image fix")
    else:
        for brand in catalog["brands"]:
            if brand["id"] != "akila":
                continue
            for f in brand["frames"]:
                if f["model"] != "Echo":
                    continue
                dest = ROOT / f["image"]
                print(f"  fetching Echo P1: {p1_url}")
                dest.write_bytes(fetch_bytes(p1_url))
                print(f"  wrote {dest}")
                # invalidate .orig backup if it's stale (keep, but note)
                break

    # Delete orphan files
    for p in removed_files:
        try:
            p.unlink()
            print(f"  deleted {p}")
        except FileNotFoundError:
            pass

    cat_path.write_text(json.dumps(catalog, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\nWrote {cat_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
