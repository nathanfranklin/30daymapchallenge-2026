"""Social preview image (1200 x 630) for the Day 6 web map: one fort on the 1st and 2nd edition six-inch sheets.

Usage:
    uv run --with matplotlib --with pillow python -I day06_vintage_ring_forts/make_preview.py \
        docs/day06/outlines.geojson data/nls_tiles docs/day06/preview.png

Fetches the few National Library of Scotland tiles it needs into <tile_dir> (gitignored), once.
"""

import io
import json
import math
import sys
import urllib.request
from pathlib import Path

import matplotlib.font_manager as fm
import matplotlib.pyplot as plt
from PIL import Image

UA = "30daymapchallenge-2026/0.1 (Irish ring forts; github.com/nathanfranklin)"
NLS = "https://mapseries-tilesets.s3.amazonaws.com/os/{}/{}/{}/{}.png"
EDITIONS = [("cork", "Ordnance Survey 1st edition, 1830s–40s"), ("cork_2nd", "2nd edition, 1888–1915")]
CENTRE = (-8.58262, 52.18185)  # a double ring fort in Co. Cork
Z = 17
W, H = 480, 350  # pixels per panel
LEFT, GAP = 100, 40  # margin and gap between panels, in pixels

# Same colours as Day 5's light card.
BG = "#f7f6f3"
TEXT = "#1f2328"
MUTED = "#6b7280"
FRAME = "#d6d3cc"
OUTLINE = "#d95926"


def set_font():
    for name in ["Avenir Next", "Helvetica Neue", "DejaVu Sans"]:
        if any(f.name == name for f in fm.fontManager.ttflist):
            plt.rcParams["font.family"] = name
            return


def pixel(lon, lat):
    """Global pixel coordinates at zoom Z (Web Mercator)."""
    n = 256 * 2 ** Z
    y = math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))
    return (lon + 180) / 360 * n, (1 - y / math.pi) / 2 * n


def tile(tiles, layer, x, y):
    path = tiles / layer / f"{Z}_{x}_{y}.png"
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        req = urllib.request.Request(NLS.format(layer, Z, x, y), headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=60) as r:
            path.write_bytes(r.read())
    return Image.open(io.BytesIO(path.read_bytes())).convert("RGB")


def panel(tiles, layer, x0, y0):
    """The W x H crop whose top-left global pixel is (x0, y0)."""
    tx0, ty0, tx1, ty1 = int(x0 // 256), int(y0 // 256), int((x0 + W) // 256), int((y0 + H) // 256)
    canvas = Image.new("RGB", ((tx1 - tx0 + 1) * 256, (ty1 - ty0 + 1) * 256))
    for tx in range(tx0, tx1 + 1):
        for ty in range(ty0, ty1 + 1):
            canvas.paste(tile(tiles, layer, tx, ty), ((tx - tx0) * 256, (ty - ty0) * 256))
    left, top = int(x0 - tx0 * 256), int(y0 - ty0 * 256)
    return canvas.crop((left, top, left + W, top + H))


def main(outlines_path, tiles, out):
    cx, cy = pixel(*CENTRE)
    x0, y0 = cx - W / 2, cy - H / 2
    # Every OSM outline with a point inside the panel, in panel pixels.
    outlines = []
    for f in json.loads(Path(outlines_path).read_text())["features"]:
        g = f["geometry"]
        pts = [pixel(lon, lat) for lon, lat in (g["coordinates"][0] if g["type"] == "Polygon" else g["coordinates"])]
        if any(0 <= x - x0 <= W and 0 <= y - y0 <= H for x, y in pts):
            outlines.append([(x - x0, y - y0) for x, y in pts])

    set_font()
    fig = plt.figure(figsize=(12, 6.3), dpi=100, facecolor=BG)
    fig.text(LEFT / 1200, 0.93, "#30DayMapChallenge · Day 6 · Vintage", color=MUTED, fontsize=12, va="top")
    fig.text(LEFT / 1200, 0.875, "Ireland’s ring forts and the Ordnance Survey", color=TEXT, fontsize=27,
             weight="bold", va="top")
    fig.text(LEFT / 1200, 0.785, "17,007 ring forts are mapped in OpenStreetMap, most of them derived from "
             "Ordnance Survey maps.", color=MUTED, fontsize=12.5, va="top")

    for i, (layer, label) in enumerate(EDITIONS):
        x = (LEFT + i * (W + GAP)) / 1200
        ax = fig.add_axes([x, 0.15, W / 1200, H / 630])
        ax.imshow(panel(tiles, layer, x0, y0), extent=(0, W, H, 0))
        for ring in outlines:
            ax.plot([x for x, _ in ring], [y for _, y in ring], color=OUTLINE, linewidth=2)
        ax.set_xlim(0, W)
        ax.set_ylim(H, 0)
        ax.set_xticks([])
        ax.set_yticks([])
        for s in ax.spines.values():
            s.set_color(FRAME)
        fig.text(x, 0.125, label, color=MUTED, fontsize=10.5, va="top")

    fig.text(LEFT / 1200, 0.035, "Orange: OpenStreetMap outlines of a double ring fort in Co. Cork. "
             "Maps: Ordnance Survey six-inch, reproduced with the permission of the National Library of Scotland (CC-BY). "
             "Outlines © OpenStreetMap contributors.", color=MUTED, fontsize=7.5, va="bottom", wrap=True)
    fig.savefig(out, dpi=100, facecolor=BG)
    print(f"wrote {out}")


if __name__ == "__main__":
    sys.dont_write_bytecode = True
    main(sys.argv[1], Path(sys.argv[2]), sys.argv[3])
