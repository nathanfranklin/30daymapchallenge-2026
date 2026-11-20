"""Social preview image (1200 x 630) for the Day 20 web map: the 3D hexagons at 31 December, with the title
and the four town gauges.

Screenshots the page in the locally installed Chrome (via Playwright, no browser download), with reduced motion
so it opens on 31 December. Takes the panel's gauges, hides the panel, then puts the title and gauges where it was.

Usage:
    python3 -m http.server 8765 --directory docs   # in another terminal
    uv run --with playwright --with matplotlib --with pillow python -I day20_rainfall_hexagons/make_preview.py \
        http://127.0.0.1:8765/day20/ docs/day20/preview.png
"""

import io
import sys

import matplotlib.font_manager as fm
import matplotlib.pyplot as plt
from PIL import Image
from playwright.sync_api import sync_playwright

W, H = 1200, 630
LEFT = 60  # text margin, in pixels
SCALE = 1.25  # card pixels per page pixel

# Same colours as the page.
BG = "#0b1622"
TEXT = "#e8eef4"
MUTED = "#8a9bb0"


def set_font():
    for name in ["Avenir Next", "Helvetica Neue", "DejaVu Sans"]:
        if any(f.name == name for f in fm.fontManager.ttflist):
            plt.rcParams["font.family"] = name
            return


def screenshot(url):
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome", args=["--use-angle=metal", "--enable-gpu"])
        # A smaller viewport, scaled up, makes the island and its labels fill more of the card.
        page = browser.new_page(viewport={"width": round(W / SCALE), "height": round(H / SCALE)}, device_scale_factor=2.5,
                                reduced_motion="reduce")
        page.goto(url)
        page.wait_for_function("document.getElementById('national').textContent !== '0 mm'")
        page.wait_for_timeout(500)
        # The four town gauges, on the page background, with their tick labels (which sit left of the box).
        page.add_style_tag(content=f"#panel {{ background: {BG} !important; box-shadow: none !important; }}")
        box = page.locator("#gauges").bounding_box()
        clip = {"x": box["x"] - 34, "y": box["y"] - 8, "width": box["width"] + 34, "height": box["height"] + 10}
        gauges = page.screenshot(clip=clip)
        page.add_style_tag(content="#panel { display: none !important; }")
        page.wait_for_timeout(1500)  # let deck.gl draw the final frame
        png = page.screenshot()
        browser.close()
    scale = SCALE / 2.5  # page pixels to card pixels
    gauges = Image.open(io.BytesIO(gauges)).convert("RGB")
    gauges = gauges.resize((round(gauges.width * scale), round(gauges.height * scale)), Image.LANCZOS)
    return Image.open(io.BytesIO(png)).convert("RGB").resize((W, H), Image.LANCZOS), gauges


def main(url, out):
    shot, gauges = screenshot(url)
    shot.paste(gauges, (LEFT, 300))
    set_font()
    fig = plt.figure(figsize=(W / 100, H / 100), dpi=100)
    ax = fig.add_axes([0, 0, 1, 1])
    ax.imshow(shot)
    ax.axis("off")
    fig.text(LEFT / W, 0.89, "#30DayMapChallenge · Day 20 · Hexagons", color=MUTED, fontsize=12, va="top")
    fig.text(LEFT / W, 0.835, "Irish rainfall", color=TEXT, fontsize=40, weight="bold", va="top")
    fig.text(LEFT / W, 0.72, "Rain since 1 January, in 5 km\nhexagons that fill like rain gauges.\n"
             "Mean of 2020–2025.", color=MUTED, fontsize=13, va="top", linespacing=1.4)
    fig.text(LEFT / W, 0.05, "Data: Met Éireann (CC BY 4.0)", color=MUTED, fontsize=9, va="bottom")
    fig.savefig(out, dpi=100)
    print(f"wrote {out}")


if __name__ == "__main__":
    sys.dont_write_bytecode = True
    main(sys.argv[1], sys.argv[2])
