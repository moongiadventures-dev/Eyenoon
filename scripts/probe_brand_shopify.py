"""Probe brand sites for Shopify products.json (quick check)."""
import json
import urllib.request

urls = [
    "https://www.cutlerandgross.com/collections/optical/products.json?limit=3",
    "https://us.retrosuperfuture.com/collections/optical/products.json?limit=3",
    "https://www.retrosuperfuture.com/collections/optical/products.json?limit=3",
    "https://lindafarrow.com/collections/optical/products.json?limit=3",
    "https://www.lindafarrow.com/collections/optical/products.json?limit=3",
    "https://www.lgrworld.com/collections/optical/products.json?limit=3",
    "https://lgrworld.com/collections/optical/products.json?limit=3",
]

opener = urllib.request.build_opener()
opener.addheaders = [("User-Agent", "EyeNoonCatalogProbe/1.0")]

for u in urls:
    try:
        r = opener.open(u, timeout=20)
        data = json.loads(r.read().decode("utf-8", errors="replace"))
        n = len(data.get("products", []))
        print("OK", n, u)
        if n:
            p0 = data["products"][0]
            img0 = (p0.get("images") or [{}])[0].get("src", "")[:80]
            print("   sample:", p0.get("title"), "|", img0)
    except Exception as e:
        print("FAIL", u, "->", type(e).__name__, str(e)[:120])
