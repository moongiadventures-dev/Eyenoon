import re
import urllib.request

u = "https://www.lgrworld.com/en/shop/optical"
req = urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0"})
html = urllib.request.urlopen(req, timeout=40).read().decode("utf-8", errors="replace")
print("len", len(html))
for pat in [
    r'href="(/en/shop/optical/[^"#]+)"',
    r"href='(/en/shop/optical/[^'#]+)'",
    r'/en/shop/optical/[a-z0-9\-]+',
]:
    m = re.findall(pat, html, re.I)
    print(pat, "->", len(m), m[:8])
