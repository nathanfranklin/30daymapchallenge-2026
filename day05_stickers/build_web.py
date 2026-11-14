"""Build the data and photos for the Day 5 web map (docs/day05/).

Inputs:
  <sightings_csv>  one row per photo: id, file, lat, lon, club (from prepare_photos.py)
  <clubs_csv>      one row per club: stadium and its coordinates (from clubs.py)
  <clean_dir>      the location-only photo copies (sticker-NNN.jpg)

Outputs, in <out_dir>:
  stickers.json    every sticker with its club, and every club's stadium
  photos/          web-sized copies of the photos (1200 px), keeping only their GPS location

Usage:
    uv run --with pillow python -I day05_stickers/build_web.py day05_stickers/sightings.csv \
        day05_stickers/clubs.csv day05_stickers/data/clean docs/day05
"""

import csv
import json
import math
import sys
from pathlib import Path

from PIL import Image

GALWAY = (-9.0492, 53.2744)  # Eyre Square: distances to each stadium are measured from here
WEB_SIDE = 1200


def read_csv(path):
    with open(path, newline="") as f:
        return list(csv.DictReader(f))


def km_from_galway(lon, lat):
    """Great-circle distance from Galway, in km."""
    lon0, lat0 = map(math.radians, GALWAY)
    lon1, lat1 = math.radians(lon), math.radians(lat)
    a = math.sin((lat1 - lat0) / 2) ** 2 + math.cos(lat0) * math.cos(lat1) * math.sin((lon1 - lon0) / 2) ** 2
    return 6371 * 2 * math.asin(math.sqrt(a))


def main(sightings_csv, clubs_csv, clean_dir, out_dir):
    clean_dir, out_dir = Path(clean_dir), Path(out_dir)
    photos = out_dir / "photos"
    photos.mkdir(parents=True, exist_ok=True)

    sightings = sorted(read_csv(sightings_csv), key=lambda s: s["id"])
    clubs = {c["club"]: c for c in read_csv(clubs_csv)}
    used = sorted({s["club"] for s in sightings})

    for s in sightings:
        with Image.open(clean_dir / s["file"]) as image:
            exif = image.info.get("exif", b"")  # the clean copies hold only GPS latitude/longitude
            image.thumbnail((WEB_SIDE, WEB_SIDE))
            image.save(photos / s["file"], "JPEG", quality=80, exif=exif)

    data = {
        "galway": list(GALWAY),
        "stickers": [{"id": s["id"], "n": int(s["id"].split("-")[1]), "club": s["club"],
                      "lon": float(s["lon"]), "lat": float(s["lat"]), "photo": f"photos/{s['file']}"}
                     for s in sightings],
        "clubs": {name: {"label": clubs[name]["label"], "ground": clubs[name]["place"],
                         "wikidata": clubs[name]["wikidata"],
                         "lon": float(clubs[name]["lon"]), "lat": float(clubs[name]["lat"]),
                         "km": round(km_from_galway(float(clubs[name]["lon"]), float(clubs[name]["lat"])))}
                  for name in used},
    }
    (out_dir / "stickers.json").write_text(json.dumps(data, indent=1, ensure_ascii=False) + "\n")
    print(f"wrote {len(sightings)} stickers and {len(used)} clubs to {out_dir}")


if __name__ == "__main__":
    main(*sys.argv[1:5])
