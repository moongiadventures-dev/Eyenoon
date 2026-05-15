import urllib.request

u = "https://www.lgrworld.com/en/shop/optical"
req = urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0"})
html = urllib.request.urlopen(req, timeout=40).read().decode("utf-8", errors="replace")
for needle in ["Congo", "Tunisi", "shop/optical", "graphql", "__NEXT_DATA__", "product", "cdn"]:
    print(needle, html.lower().find(needle.lower()))
