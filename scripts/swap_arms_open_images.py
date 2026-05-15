"""Replace catalog entries for Akila, Cutler & Gross, and Yuichi Toyama with
'arms-open' product photos sourced from each brand's official site.

Output:
  - Downloads new product images into images/{section}/{brand}/
  - Updates data/{sunglasses,optical}-catalog.json in place for those brands

Backs up the original catalog as data/{sunglasses,optical}-catalog.bak.json
before writing. Idempotent: rerun to refresh.
"""

from __future__ import annotations

import io
import json
import re
import shutil
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

# Force UTF-8 stdout so we can print URLs and titles containing non-ASCII chars.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
IMG = ROOT / "images"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
COUNT_PER_BRAND = 20
TIMEOUT = 30


def _ascii_url(url: str) -> str:
    """Percent-encode any non-ASCII characters in the URL path/query."""
    if url.startswith("//"):
        url = "https:" + url
    parts = urllib.parse.urlsplit(url)
    path = urllib.parse.quote(parts.path, safe="/-._~%")
    query = urllib.parse.quote(parts.query, safe="=&-._~%")
    return urllib.parse.urlunsplit((parts.scheme, parts.netloc, path, query, parts.fragment))


def fetch_bytes(url: str) -> bytes:
    req = urllib.request.Request(_ascii_url(url), headers={"User-Agent": UA})
    return urllib.request.urlopen(req, timeout=TIMEOUT).read()


def fetch_text(url: str) -> str:
    return fetch_bytes(url).decode("utf-8", errors="replace")


def sanitize(name: str) -> str:
    s = re.sub(r"[^A-Za-z0-9._-]+", "-", name).strip("-")
    return s[:80] or "frame"


# ---------------------------------------------------------------- AKILA

def akila_products() -> list[dict]:
    """Return Akila products.json -> list of normalized dicts."""
    raw = json.loads(fetch_text("https://akila.la/products.json?limit=250"))
    out = []
    for p in raw.get("products", []):
        out.append({
            "title": p["title"],
            "handle": p["handle"],
            "product_type": p.get("product_type", ""),
            "tags": p.get("tags", []),
            "images": [i.get("src") for i in p.get("images", []) if i.get("src")],
            "body": p.get("body_html", ""),
        })
    return out


def akila_pick_image(images: list[str]) -> str | None:
    """Prefer the P2 variant (3/4 angle, arms open). Fallback: P1 then first."""
    for needle in ("-P2.", "-P2_"):
        for img in images:
            if needle in img:
                return img
    for img in images:
        if "-P1" in img:
            return img
    return images[0] if images else None


def akila_frames(section: str) -> list[dict]:
    """section: 'sunglasses' or 'optical'."""
    prods = akila_products()
    if section == "optical":
        wanted_types = {"Optical"}
    else:
        wanted_types = {"Essentials", "Limited", "Titanium", "Lab"}
    out = []
    seen_titles = set()
    for p in prods:
        if p["product_type"] not in wanted_types:
            continue
        if p["title"] in seen_titles:
            continue
        img = akila_pick_image(p["images"])
        if not img:
            continue
        seen_titles.add(p["title"])
        out.append({
            "model": p["title"],
            "image_url": img,
            "detail_url": f"https://akila.la/products/{p['handle']}",
            "description": "Designed in Los Angeles. Made in Japan.",
        })
        if len(out) >= COUNT_PER_BRAND:
            break
    return out


# ---------------------------------------------------------------- YUICHI TOYAMA

YT_OPT_LIST = "https://yuichitoyama.com/category/products/yuichi-toyama/yt-optical/"
YT_SUN_LIST = "https://yuichitoyama.com/category/products/yuichi-toyama/yt-sun/"
YT5_OPT_LIST = "https://yuichitoyama.com/category/products/yuichi-toyama5/yt5-optical/"
YT5_SUN_LIST = "https://yuichitoyama.com/category/products/yuichi-toyama5/yt5-sun/"


YT_THUMB_RE = re.compile(
    r'https?://yuichitoyama\.com/system/wp-content/uploads/'
    r'(U[D]?-?\d+[A-Z]*)_COL\.\d+_?[A-Z]*_(?:サムネイル|%E3%82%B5%E3%83%A0%E3%83%8D%E3%82%A4%E3%83%AB)\.(?:jpg|jpeg|png)',
    re.I,
)


def yt_collect(listing_urls: list[str], max_pages: int = 6) -> list[dict]:
    """Parse YT listing HTML pages for thumbnail-named product image URLs.
    Each thumbnail is `<MODEL_CODE>_COL.<NN>_[SUN_]サムネイル.jpg`.
    """
    out: list[dict] = []
    seen_codes: set[str] = set()
    for base in listing_urls:
        for page in range(1, max_pages + 1):
            url = base if page == 1 else base.rstrip("/") + f"/page/{page}/"
            try:
                html = fetch_text(url)
            except Exception:
                break
            srcs = re.findall(
                r'src="(https?://yuichitoyama\.com/system/wp-content/uploads/[^"]+)"',
                html,
            )
            page_codes_before = len(seen_codes)
            for src in srcs:
                m = YT_THUMB_RE.search(src)
                if not m:
                    continue
                code = m.group(1).upper()
                if code in seen_codes:
                    continue
                seen_codes.add(code)
                out.append({
                    "model": code,
                    "image_url": src,
                    "detail_url": "https://yuichitoyama.com/",
                    "description": "Made in Japan. Available to try in store at Eye Noon Optical.",
                })
            if len(seen_codes) == page_codes_before:
                break
            time.sleep(0.3)
    return out


def yt_frames(section: str) -> list[dict]:
    if section == "optical":
        urls = [YT_OPT_LIST, YT5_OPT_LIST]
    else:
        urls = [YT_SUN_LIST, YT5_SUN_LIST]
    frames = yt_collect(urls)
    return frames[:COUNT_PER_BRAND]


# ---------------------------------------------------------------- CUTLER & GROSS

def cg_pick_arms_open(html: str) -> str | None:
    """Find the front-view arms-open image URL.

    Marble arms-folded (REJECT): `CG..._<MODEL>_<COLOR>_<SIZE>-1.jpg`
        — fields separated by underscores, hyphen-number at the end.
    Arms-open front (ACCEPT): `CG...-<MODEL>-<SIZE>-<COLOR>_<1|01>.jpg`
        — fields separated by hyphens, underscore-1 at the end. Optional
        uuid suffix.
    """
    urls = re.findall(
        r'//www\.cutlerandgross\.com/cdn/shop/files/[^"\'<>\s?]+\.(?:jpg|jpeg|png|webp)',
        html,
        re.I,
    )
    marble_re = re.compile(r"_\d{2}_\d+-\d+\.(?:jpg|jpeg)$", re.I)
    open_re = re.compile(
        r"-\d+-[A-Z0-9]+_0?1(?:_[a-f0-9-]{8,})?\.(?:jpg|jpeg)$",
        re.I,
    )
    candidates: list[str] = []
    for u in urls:
        fname = u.rsplit("/", 1)[-1]
        if marble_re.search(fname):
            continue
        if "2048x2048_Edits" in fname:
            continue
        if "preview_images" in u or "thumbnail" in u.lower():
            continue
        if open_re.search(fname):
            candidates.append(u)
    if not candidates:
        return None
    seen: set[str] = set()
    uniq = [u for u in candidates if not (u in seen or seen.add(u))]
    return uniq[0]


def cg_swap_images(existing_frames: list[dict]) -> list[dict]:
    """For each C&G frame, fetch detail page, find arms-open image.
    If no match is found, preserve the existing entry unchanged (keep_existing).
    """
    out = []
    for f in existing_frames:
        url = f.get("detail_url")
        if not url:
            out.append({**f, "keep_existing": True})
            continue
        try:
            html = fetch_text(url)
        except Exception as e:
            print(f"  C&G fetch failed for {url}: {e}")
            out.append({**f, "keep_existing": True})
            continue
        img = cg_pick_arms_open(html)
        if not img:
            print(f"  C&G no arms-open match for {f.get('model')}")
            out.append({**f, "keep_existing": True})
            time.sleep(0.3)
            continue
        out.append({**f, "image_url": img})
        time.sleep(0.3)
    return out


# ---------------------------------------------------------------- DOWNLOAD

def download_brand_images(section: str, brand_id: str, frames: list[dict]) -> list[dict]:
    bdir = IMG / section / brand_id
    bdir.mkdir(parents=True, exist_ok=True)
    out: list[dict] = []
    used: set[str] = set()
    for i, f in enumerate(frames):
        if f.get("keep_existing"):
            # Preserve old catalog entry, including the existing image path.
            existing = {k: v for k, v in f.items() if k in ("model", "image", "detail_url", "description")}
            if existing.get("image"):
                used.add(Path(existing["image"]).name)
                out.append(existing)
            continue
        url = f.get("image_url")
        if not url:
            continue
        ext = ".jpg"
        low = url.lower()
        if ".png" in low:
            ext = ".png"
        elif ".webp" in low:
            ext = ".webp"
        try:
            data = fetch_bytes(url)
        except Exception as e:
            try:
                print(f"  download failed for {f.get('model')}: {e}")
            except UnicodeEncodeError:
                print(f"  download failed for <model>: <non-ascii error>")
            continue
        base = sanitize(f["model"]) or f"item-{i}"
        fname = base + ext
        j = 1
        while fname in used:
            fname = f"{base}-{j}{ext}"
            j += 1
        used.add(fname)
        (bdir / fname).write_bytes(data)
        out.append({
            "model": f["model"],
            "image": f"images/{section}/{brand_id}/{fname}",
            "detail_url": f.get("detail_url", ""),
            "description": f.get("description", ""),
        })
        time.sleep(0.2)
    return out


def cleanup_old_images(section: str, brand_id: str, keep_names: set[str]) -> int:
    """Remove old image files in the brand folder that aren't in the new set
    or their .orig backups. Preserves .orig.* backups."""
    bdir = IMG / section / brand_id
    if not bdir.is_dir():
        return 0
    removed = 0
    for f in list(bdir.iterdir()):
        if f.name in keep_names:
            continue
        if f.stem.endswith(".orig"):
            continue
        f.unlink()
        removed += 1
    return removed


# ---------------------------------------------------------------- ORCHESTRATION

def process_section(section: str) -> None:
    cat_path = DATA / f"{section}-catalog.json"
    bak = DATA / f"{section}-catalog.bak.json"
    if not bak.exists():
        shutil.copy2(cat_path, bak)
    catalog = json.loads(cat_path.read_text(encoding="utf-8"))

    for brand in catalog["brands"]:
        bid = brand["id"]
        if bid not in ("akila", "yuichi-toyama", "cutler-gross"):
            continue
        print(f"\n--- {section} / {brand['name']} ---")
        if bid == "akila":
            frames = akila_frames(section)
        elif bid == "yuichi-toyama":
            frames = yt_frames(section)
        else:
            frames = cg_swap_images(brand.get("frames", []))
        if not frames:
            print(f"  no frames discovered, skipping")
            continue
        local = download_brand_images(section, bid, frames)
        print(f"  downloaded {len(local)} images")
        keep = {Path(f["image"]).name for f in local}
        rm = cleanup_old_images(section, bid, keep)
        if rm:
            print(f"  cleaned up {rm} old images")
        brand["frames"] = local

    cat_path.write_text(
        json.dumps(catalog, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    print(f"\nWrote {cat_path}")


def main() -> int:
    for section in ("sunglasses", "optical"):
        process_section(section)
    return 0


if __name__ == "__main__":
    sys.exit(main())
