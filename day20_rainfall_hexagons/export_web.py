"""Hexagons and outlines for the deck.gl page in docs/day20/, in lon/lat.

Inputs (in <out_dir>, from hexes.py and daily.py):
  hex_rainfall_<W>km.geojson, ireland_outlines.geojson, and any hex_daily_<YEAR>_<W>km.csv

Outputs (in <web_dir>):
  hexes_<W>km.json  [{"p": [ring], "m": [12 monthly mm], "a": annual mm, "n": 1991–2020 mm, "w": land km²}, ...]
                 Whole hexagons, not clipped to the coast: in 3D a clipped coastal sliver becomes a thin
                 full-height wall. Each is shrunk towards its centre so the columns stand apart, and
                 hexagons with less than MIN_SHARE of a full hexagon's grid cells (headland tips, islets) are left out.
  daily_<YEAR>_<W>km.json  {"year": YEAR, "days": n, "r": [[n daily totals in tenths of a mm], ...]}
                 one row per hexagon, in the same order as hexes_<W>km.json
  outlines.json  {"ni": [[rings...], ...]} Northern Ireland, simplified, for the flat base

Usage:
    uv run --with numpy --with shapely --with pyproj python -I \
        day20_rainfall_hexagons/export_web.py day20_rainfall_hexagons/output docs/day20 10
"""

import csv
import json
import sys
from pathlib import Path

import numpy as np
import shapely
from pyproj import Transformer
from shapely.geometry import Polygon, shape

sys.dont_write_bytecode = True  # no __pycache__ in the repo folder

MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]
ITM_TO_LL = Transformer.from_crs(2157, 4326, always_xy=True)
SHRINK = 0.86  # share of the hexagon's width each column keeps
MIN_SHARE = 0.115  # share of a full hexagon's 1 km cells it needs to be drawn: 10 of ~87 at 10 km


def to_ll(geom):
    return shapely.transform(geom, lambda xy: np.column_stack(ITM_TO_LL.transform(xy[:, 0], xy[:, 1])))


def rings(poly):
    """A polygon as [outer, *holes], each ring a list of [lon, lat] rounded to ~1 m."""
    return [np.round(np.asarray(r.coords), 5).tolist() for r in [poly.exterior, *poly.interiors]]


def hexagon(cx, cy, width_m):
    """Flat-topped hexagon centred on (cx, cy), width_m across the flats, as in hexes.py."""
    r = width_m / np.sqrt(3) * SHRINK
    a = np.deg2rad(np.arange(0, 360, 60))
    return Polygon(np.column_stack([cx + r * np.cos(a), cy + r * np.sin(a)]))


def parts(geom):
    return list(geom.geoms) if geom.geom_type == "MultiPolygon" else [geom]


def main(out_dir, web_dir, width_km):
    out_dir, web_dir = Path(out_dir), Path(web_dir)
    web_dir.mkdir(parents=True, exist_ok=True)

    feats = json.loads((out_dir / f"hex_rainfall_{width_km:g}km.geojson").read_text())["features"]
    min_cells = int(np.ceil(MIN_SHARE * width_km**2 * np.sqrt(3) / 2))  # a full hexagon holds about width² × √3/2 cells
    hexes = []
    keys = []
    dropped = 0
    for f in feats:
        p = f["properties"]
        if p["n_cells"] < min_cells:
            dropped += 1
            continue
        hexes.append({
            "p": rings(to_ll(hexagon(p["x_itm"], p["y_itm"], width_km * 1000))),
            "m": [p[f"{mon}_mm"] for mon in MONTHS],
            "a": p["annual_mm"],
            "n": p["annual_1991_2020_mm"],
            "w": p["land_km2"],
        })
        keys.append((p["hex_q"], p["hex_r"]))
    hex_name = f"hexes_{width_km:g}km.json"
    (web_dir / hex_name).write_text(json.dumps(hexes, separators=(",", ":")))

    outlines = {f["properties"]["name"]: shape(f["geometry"]) for f in json.loads((out_dir / "ireland_outlines.geojson").read_text())["features"]}
    ni = outlines["Northern Ireland"].simplify(150)
    (web_dir / "outlines.json").write_text(json.dumps({"ni": [rings(p) for p in parts(to_ll(ni))]}, separators=(",", ":")))

    written = [hex_name, "outlines.json"]
    for path in sorted(out_dir.glob(f"hex_daily_*_{width_km:g}km.csv")):
        year = int(path.stem.split("_")[2])
        with open(path, newline="") as f:
            reader = csv.reader(f)
            n_days = len(next(reader)) - 4
            daily = {(int(row[0]), int(row[1])): [round(float(v) * 10) for v in row[4:]] for row in reader}
        missing = [k for k in keys if k not in daily]
        assert not missing, f"{path.name} has no row for {len(missing)} hexagons"
        name = f"daily_{year}_{width_km:g}km.json"
        (web_dir / name).write_text(json.dumps({"year": year, "days": n_days, "r": [daily[k] for k in keys]}, separators=(",", ":")))
        written.append(name)

    for name in written:
        print(web_dir / name, f"{(web_dir / name).stat().st_size / 1e3:,.0f} kB")
    print(f"{len(hexes)} hexagons drawn, {dropped} with fewer than {min_cells} grid cells left out")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], float(sys.argv[3]))
