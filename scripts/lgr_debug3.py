import urllib.request

u = "https://www.lgrworld.com/en/shop/optical"
html = urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0"}), timeout=40).read().decode("utf-8", errors="replace")
i = html.find("Congo")
print(html[i - 500 : i + 800])
