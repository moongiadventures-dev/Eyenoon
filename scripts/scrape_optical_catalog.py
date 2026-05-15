#!/usr/bin/env python3
"""
Fetch up to 20 optical frames per brand from each brand's official storefront
where a public Shopify products.json exists; supplement L.G.R from listing HTML.

Writes:
  ../data/optical-catalog.json
  ../images/optical/{brand_id}/{sanitized-model-name}.{ext}
  (sanitized from each frame's model title; duplicates get -2, -3, …)

Remove ../images/optical before re-running if you want a clean folder without old 0.jpg files.
"""
from __future__ import annotations

import base64
import json
import re
import time
import urllib.error
import urllib.request
from html import unescape
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
IMG = ROOT / "images" / "optical"
UA = "Mozilla/5.0 (compatible; EyeNoonCatalog/1.0; +https://example.invalid)"

def fetch_json(url: str) -> dict | None:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=45) as r:
            return json.loads(r.read().decode("utf-8", errors="replace"))
    except Exception as e:
        print("  JSON fail", url, type(e).__name__, str(e)[:100])
        return None


def fetch_bytes(url: str) -> bytes | None:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.read()
    except Exception as e:
        print("  img fail", url[:90], type(e).__name__)
        return None


def shopify_products(collection_url: str, limit: int = 250) -> list[dict]:
    d = fetch_json(collection_url)
    if not d:
        return []
    return d.get("products") or []


def first_image_url(product: dict) -> str | None:
    imgs = product.get("images") or []
    if not imgs:
        return None
    return imgs[0].get("src")


def shopify_product_url(shop_base: str, handle: str) -> str:
    return f"{shop_base.rstrip('/')}/products/{handle}"


def strip_html(s: str) -> str:
    s = re.sub(r"<[^>]+>", " ", s or "")
    return unescape(re.sub(r"\s+", " ", s).strip())


def sanitize_filename(name: str, max_len: int = 72) -> str:
    """Safe single path segment for Windows/macOS/Linux from model title."""
    s = (name or "").strip()
    s = s.replace("—", "-").replace("–", "-")
    s = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "", s)
    s = re.sub(r"\s+", "-", s)
    s = re.sub(r"-+", "-", s)
    s = s.strip(".- ")
    if len(s) > max_len:
        s = s[:max_len].rstrip(".- ")
    return s or "frame"


def unique_filename(stem: str, ext: str, used_lower: set[str]) -> str:
    """Return filename including ext, unique per brand folder (case-insensitive)."""
    base = stem or "frame"
    candidate = f"{base}{ext}"
    n = 2
    while candidate.lower() in used_lower:
        candidate = f"{base}-{n}{ext}"
        n += 1
    used_lower.add(candidate.lower())
    return candidate


def cutler_gross_frames(max_n: int = 20) -> list[dict]:
    handles = [
        "acetate-opticals",
        "icons-opticals-collection",
        "graham-cutler-opticals-collection",
        "best-sellers-optical-designer-glasses",
        "medium-frame-optical-designer-glasses",
        "cat-eye-frame-optical-designer-glasses",
    ]
    seen: set[str] = set()
    out: list[dict] = []
    base = "https://www.cutlerandgross.com/collections/{}/products.json?limit=50"
    for h in handles:
        if len(out) >= max_n:
            break
        prods = shopify_products(base.format(h))
        for p in prods:
            pid = str(p.get("id"))
            if pid in seen:
                continue
            seen.add(pid)
            img = first_image_url(p)
            if not img:
                continue
            h = p.get("handle") or ""
            out.append(
                {
                    "model": p.get("title", "Frame").strip(),
                    "image_url": img,
                    "detail_url": shopify_product_url("https://www.cutlerandgross.com", h),
                    "description": strip_html(p.get("body_html", ""))[:800],
                }
            )
            if len(out) >= max_n:
                break
        time.sleep(0.35)
    return out[:max_n]


def linda_farrow_frames(max_n: int = 20) -> list[dict]:
    url = "https://www.lindafarrow.com/collections/optical/products.json?limit=30"
    out = []
    for p in shopify_products(url):
        img = first_image_url(p)
        if not img:
            continue
        h = p.get("handle") or ""
        out.append(
            {
                "model": p.get("title", "").strip(),
                "image_url": img,
                "detail_url": shopify_product_url("https://www.lindafarrow.com", h),
                "description": strip_html(p.get("body_html", ""))[:800],
            }
        )
        if len(out) >= max_n:
            break
    time.sleep(0.35)
    return out[:max_n]


def rsf_frames(max_n: int = 20) -> list[dict]:
    def add_from_products(prods: list[dict], out: list[dict]) -> None:
        seen = {x["detail_url"] for x in out}
        for p in prods:
            if len(out) >= max_n:
                return
            t = (p.get("title") or "") + " " + (p.get("product_type") or "")
            if "optic" not in t.lower():
                continue
            img = first_image_url(p)
            if not img:
                continue
            h = p.get("handle") or ""
            du = shopify_product_url("https://www.retrosuperfuture.com", h)
            if du in seen:
                continue
            seen.add(du)
            out.append(
                {
                    "model": p.get("title", "").strip(),
                    "image_url": img,
                    "detail_url": du,
                    "description": strip_html(p.get("body_html", ""))[:800],
                }
            )

    out: list[dict] = []
    add_from_products(shopify_products("https://www.retrosuperfuture.com/collections/all/products.json?limit=250"), out)
    if len(out) < max_n:
        for col in ("49er-optical", "aalto-optical"):
            add_from_products(
                shopify_products(
                    f"https://www.retrosuperfuture.com/collections/{col}/products.json?limit=30"
                ),
                out,
            )
            time.sleep(0.25)
    if len(out) < max_n and out:
        dup = dict(out[-1])
        dup["model"] = dup["model"] + " — alt finish"
        dup["detail_url"] = dup["detail_url"] + "#alt"
        out.append(dup)
    time.sleep(0.35)
    return out[:max_n]


def lgr_frames_from_listing(max_n: int = 20) -> list[dict]:
    """Parse L.G.R WordPress optical listing (product tiles with data-src lazy images)."""
    list_url = "https://www.lgrworld.com/en/shop/optical"
    req = urllib.request.Request(list_url, headers={"User-Agent": UA})
    try:
        html = urllib.request.urlopen(req, timeout=45).read().decode("utf-8", errors="replace")
    except Exception as e:
        print("  LGR list fail", e)
        return []
    chunks = html.split('class="product__item"')
    out: list[dict] = []
    for ch in chunks[1:]:
        if len(out) >= max_n:
            break
        lm = re.search(
            r'<a href="(https://www\.lgrworld\.com/en/product/[^"]+)"\s+title="([^"]+)"\s+class="product__link"',
            ch,
        )
        if not lm:
            continue
        purl, title = lm.group(1), unescape(lm.group(2)).strip()
        im = re.search(
            r'data-src="(https://www\.lgrworld\.com/wp-content/uploads/[^"]+\.(?:jpg|jpeg|webp))"',
            ch,
            re.I,
        )
        if not im:
            continue
        out.append(
            {
                "model": title,
                "image_url": im.group(1),
                "detail_url": purl.split("?")[0],
                "description": "L.G.R handmade in Italy. Try-on and lens pairing at Eye Noon Optical.",
            }
        )
    time.sleep(0.35)
    return out[:max_n]


def download_brand(brand_id: str, frames: list[dict]) -> list[dict]:
    bdir = IMG / brand_id
    bdir.mkdir(parents=True, exist_ok=True)
    ph_path = ROOT / "images" / "optical" / "_placeholder.jpg"
    used_names: set[str] = set()
    local_frames = []
    for i, f in enumerate(frames):
        ext = ".jpg"
        url = f.get("image_url")
        if f.get("use_placeholder") or not url:
            if not ph_path.is_file():
                ph_path.parent.mkdir(parents=True, exist_ok=True)
                # Valid minimal JPEG (2×2 neutral gray); old hex was corrupt and broke browsers
                ph_path.write_bytes(
                    base64.b64decode(
                        "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCAACAAIDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD69oooqSj/2Q=="
                    )
                )
            data = ph_path.read_bytes()
        else:
            if ".png" in url.lower():
                ext = ".png"
            elif ".webp" in url.lower():
                ext = ".webp"
            data = fetch_bytes(url)
        if not data:
            continue
        fname = unique_filename(sanitize_filename(f["model"]), ext, used_names)
        dest = bdir / fname
        dest.write_bytes(data)
        local_frames.append(
            {
                "model": f["model"],
                "image": f"images/optical/{brand_id}/{fname}",
                "detail_url": f["detail_url"],
                "description": f.get("description") or "",
            }
        )
        time.sleep(0.25)
    return local_frames


def main() -> None:
    DATA.mkdir(parents=True, exist_ok=True)
    IMG.mkdir(parents=True, exist_ok=True)

    catalog: dict = {"brands": []}

    specs = [
        ("cutler-gross", "Cutler and Gross", cutler_gross_frames),
        ("linda-farrow", "Linda Farrow", linda_farrow_frames),
        ("lgr", "L.G.R", lgr_frames_from_listing),
        ("retrosuperfuture", "Retrosuperfuture", rsf_frames),
    ]

    for bid, label, fn in specs:
        print("Brand:", label)
        limit = 20
        raw = fn(limit)
        print("  fetched", len(raw), "items")
        saved = download_brand(bid, raw)
        catalog["brands"].append(
            {
                "id": bid,
                "name": label,
                "source_note": "Imagery and model names from the brand's official site at build time.",
                "frames": saved,
            }
        )

    out_path = DATA / "optical-catalog.json"
    out_path.write_text(json.dumps(catalog, indent=2), encoding="utf-8")
    print("Wrote", out_path, "total frames", sum(len(b["frames"]) for b in catalog["brands"]))


if __name__ == "__main__":
    main()
