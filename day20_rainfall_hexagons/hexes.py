"""Met Éireann 1 km monthly rainfall grids, 2020–2025, averaged into hexagons.

Inputs (in <data_dir>, from fetch.sh):
  grids_monthly/rr_mon_grid_YYYY.csv   one year of monthly totals per 1 km cell
  rr_9120/IE_RR_9120_V2.txt            1991–2020 normals, for comparison

Outputs (in <out_dir>):
  hex_rainfall_<W>km.csv     one row per hexagon: monthly and annual means (mm)
  hex_rainfall_<W>km.geojson the clipped hexagons in EPSG:2157, same values
  ireland_outlines.geojson   Republic and Northern Ireland in EPSG:2157 (for export_web.py)

Usage:
    uv run --with numpy --with shapely --with pyproj --with pyshp python -I \
        day20_rainfall_hexagons/hexes.py data/met_eireann day20_rainfall_hexagons/output 12
"""

import csv
import json
import sys
from pathlib import Path

import numpy as np
import shapefile
import shapely
from pyproj import Transformer
from shapely.geometry import Polygon, mapping, shape

sys.dont_write_bytecode = True  # no __pycache__ in the repo folder

YEARS = range(2020, 2026)
MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]
NE_ADMIN1 = Path.home() / ".local/share/cartopy/shapefiles/natural_earth/cultural/ne_10m_admin_1_states_provinces_lakes.shp"

# Met Éireann grids are on Irish Grid TM65 (EPSG:29902); hexes are built in ITM (EPSG:2157).
TM65_TO_ITM = Transformer.from_crs(29902, 2157, always_xy=True)
LL_TO_ITM = Transformer.from_crs(4326, 2157, always_xy=True)


def read_monthly(data_dir):
    """Mean of each calendar month over YEARS, per 1 km cell. Returns (east, north, [n_cells, 12])."""
    tables = []
    for year in YEARS:
        path = data_dir / "grids_monthly" / f"rr_mon_grid_{year}.csv"
        with open(path) as f:
            header = f.readline().strip().split(",")
        assert header[2:] == [f"X{year}{m:02d}" for m in range(1, 13)], header
        tables.append(np.genfromtxt(path, delimiter=",", skip_header=1, missing_values=("", "NA"), filling_values=np.nan))
    # Cells can differ between years: align on (east, north) and keep only months present in every year.
    keys = np.unique(np.vstack([t[:, :2] for t in tables]), axis=0)
    stack = np.full((len(YEARS), len(keys), 12), np.nan)
    for i, t in enumerate(tables):
        j = np.searchsorted(keys[:, 0] * 1e7 + keys[:, 1], t[:, 0] * 1e7 + t[:, 1])
        stack[i, j] = t[:, 2:14]
    monthly = stack.mean(axis=0)  # NaN where any year is missing
    return keys[:, 0], keys[:, 1], monthly


def read_normals(data_dir):
    """1991–2020 annual normal per 1 km cell, keyed by (east, north) in TM65."""
    out = {}
    with open(data_dir / "rr_9120" / "IE_RR_9120_V2.txt") as f:
        header = [h.strip('"') for h in f.readline().split()]
        i_ann = header.index("ANN")
        for line in f:
            p = line.split()
            out[(int(float(p[0])), int(float(p[1])))] = float(p[i_ann])
    return out


def outlines():
    """Republic of Ireland and Northern Ireland from Natural Earth 10m admin-1, in ITM."""
    reader = shapefile.Reader(str(NE_ADMIN1))
    roi, ni = [], []
    for sr in reader.iterShapeRecords(fields=["admin", "geonunit"]):
        if sr.record["admin"] == "Ireland":
            target = roi
        elif sr.record["geonunit"] == "Northern Ireland":
            target = ni
        else:
            continue
        geom = shapely.transform(shape(sr.shape.__geo_interface__), lambda xy: np.column_stack(LL_TO_ITM.transform(xy[:, 0], xy[:, 1])))
        target.append(geom.buffer(0))
    return shapely.union_all(roi), shapely.union_all(ni)


def hex_index(x, y, r):
    """Axial (q, r) of the flat-topped hexagon (circumradius r) containing each point."""
    q = (2 / 3 * x) / r
    rr = (-1 / 3 * x + np.sqrt(3) / 3 * y) / r
    # cube rounding
    cx, cz = q, rr
    cy = -cx - cz
    rx, ry, rz = np.round(cx), np.round(cy), np.round(cz)
    dx, dy, dz = np.abs(rx - cx), np.abs(ry - cy), np.abs(rz - cz)
    fix_x = (dx > dy) & (dx > dz)
    fix_y = ~fix_x & (dy > dz)
    rx = np.where(fix_x, -ry - rz, rx)
    ry = np.where(fix_y, -rx - rz, ry)
    rz = np.where(~fix_x & ~fix_y, -rx - ry, rz)
    return rx.astype(int), rz.astype(int)


def hex_polygon(q, rr, r):
    cx = r * 1.5 * q
    cy = r * np.sqrt(3) * (rr + q / 2)
    angles = np.deg2rad(np.arange(0, 360, 60))
    return Polygon(np.column_stack([cx + r * np.cos(angles), cy + r * np.sin(angles)])), (cx, cy)


def main(data_dir, out_dir, width_km):
    data_dir, out_dir = Path(data_dir), Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    # width_km is the flat-to-flat width; circumradius = width / sqrt(3)
    r = width_km * 1000 / np.sqrt(3)

    east, north, monthly = read_monthly(data_dir)
    normals = read_normals(data_dir)
    normal = np.array([normals.get((int(e), int(n)), np.nan) for e, n in zip(east, north)])
    x, y = TM65_TO_ITM.transform(east, north)
    q, rr = hex_index(np.asarray(x), np.asarray(y), r)

    roi, ni = outlines()
    (out_dir / "ireland_outlines.geojson").write_text(json.dumps({
        "type": "FeatureCollection",
        "crs": {"type": "name", "properties": {"name": "EPSG:2157"}},
        "features": [
            {"type": "Feature", "properties": {"name": "Republic of Ireland"}, "geometry": mapping(shapely.set_precision(roi, 10))},
            {"type": "Feature", "properties": {"name": "Northern Ireland"}, "geometry": mapping(shapely.set_precision(ni, 10))},
        ],
    }))

    rows, features = [], []
    cells = {}
    for i, key in enumerate(zip(q, rr)):
        cells.setdefault(key, []).append(i)
    for (hq, hr), idx in sorted(cells.items()):
        idx = np.array(idx)
        m = monthly[idx]
        complete = ~np.isnan(m).any(axis=1)
        if not complete.any():
            continue
        poly, (cx, cy) = hex_polygon(hq, hr, r)
        clipped = poly.intersection(roi)
        if clipped.is_empty:
            continue  # grid cells just offshore of the Natural Earth coastline
        mm = m[complete].mean(axis=0)
        ann = mm.sum()
        ann_9120 = np.nanmean(normal[idx]) if np.isfinite(normal[idx]).any() else np.nan
        row = {
            "hex_q": int(hq), "hex_r": int(hr),
            "x_itm": round(cx), "y_itm": round(cy),
            "n_cells": int(complete.sum()),
            "land_km2": round(clipped.area / 1e6, 1),
            **{f"{mon}_mm": round(float(v), 1) for mon, v in zip(MONTHS, mm)},
            "annual_mm": round(float(ann), 1),
            "annual_1991_2020_mm": round(float(ann_9120), 1),
            "pct_vs_1991_2020": round(float(100 * (ann / ann_9120 - 1)), 1),
        }
        rows.append(row)
        features.append({"type": "Feature", "properties": row, "geometry": mapping(shapely.set_precision(clipped, 10))})

    stem = f"hex_rainfall_{width_km:g}km"
    with open(out_dir / f"{stem}.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)
    (out_dir / f"{stem}.geojson").write_text(json.dumps({
        "type": "FeatureCollection",
        "crs": {"type": "name", "properties": {"name": "EPSG:2157"}},
        "features": features,
    }))

    ann = np.array([row["annual_mm"] for row in rows])
    print(f"{width_km:g} km hexes: {len(rows)} hexes from {len(east):,} grid cells "
          f"(median {int(np.median([row['n_cells'] for row in rows]))} cells/hex)")
    print(f"  annual mean 2020–2025: min {ann.min():.0f}, median {np.median(ann):.0f}, max {ann.max():.0f} mm")
    pct = np.array([row["pct_vs_1991_2020"] for row in rows])
    print(f"  vs 1991–2020 normal: median {np.median(pct):+.1f}% (10th–90th pct {np.percentile(pct, 10):+.1f}% to {np.percentile(pct, 90):+.1f}%)")
    for mon in MONTHS:
        v = np.array([row[f"{mon}_mm"] for row in rows])
        print(f"  {mon}: median {np.median(v):5.0f}  p10 {np.percentile(v, 10):5.0f}  p90 {np.percentile(v, 90):5.0f}  ratio {np.percentile(v, 90) / np.percentile(v, 10):.2f}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], float(sys.argv[3]))
