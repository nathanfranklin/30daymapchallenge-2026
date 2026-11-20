"""Met Éireann 1 km daily rainfall grid for one year, averaged into the same hexagons as hexes.py.

Inputs (in <data_dir>, from fetch.sh):
  grids_daily/IRL_DLY_RR_<YEAR>_grid.csv.gz   east, north (Irish Grid TM65), then one column per day, in tenths of a mm

Output (in <out_dir>):
  hex_daily_<YEAR>_<W>km.csv   one row per hexagon: hex_q, hex_r, n_cells, annual_mm, then one column per day (mm)

Usage:
    uv run --with numpy --with pyproj --with shapely --with pyshp python -I \
        day20_rainfall_hexagons/daily.py data/met_eireann day20_rainfall_hexagons/output 10 2025
"""

import csv
import gzip
import sys
from pathlib import Path

import numpy as np

sys.dont_write_bytecode = True  # no __pycache__ in the repo folder
sys.path.insert(0, str(Path(__file__).resolve().parent))
from hexes import TM65_TO_ITM, hex_index  # noqa: E402


def main(data_dir, out_dir, width_km, year):
    data_dir, out_dir = Path(data_dir), Path(out_dir)
    with gzip.open(data_dir / "grids_daily" / f"IRL_DLY_RR_{year}_grid.csv.gz", "rt") as f:
        header = f.readline().strip().split(",")
        days = [h[1:] for h in header[2:]]  # X20250101 -> 20250101
        table = np.loadtxt(f, delimiter=",", dtype=np.float32)
    rain = table[:, 2:] / 10  # tenths of a mm -> mm

    x, y = TM65_TO_ITM.transform(table[:, 0], table[:, 1])
    q, r = hex_index(np.asarray(x), np.asarray(y), width_km * 1000 / np.sqrt(3))

    cells = {}
    for i, key in enumerate(zip(q.tolist(), r.tolist())):
        cells.setdefault(key, []).append(i)

    out = out_dir / f"hex_daily_{year}_{width_km:g}km.csv"
    with open(out, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["hex_q", "hex_r", "n_cells", "annual_mm", *days])
        for (hq, hr), idx in sorted(cells.items()):
            daily = rain[idx].mean(axis=0)
            w.writerow([hq, hr, len(idx), round(float(daily.sum()), 1), *np.round(daily, 1).tolist()])

    print(f"{out}: {len(cells)} hexagons, {len(days)} days, {len(rain):,} grid cells")
    print(f"  national cell mean {rain.sum(axis=1).mean():.0f} mm; wettest cell-day {rain.max():.1f} mm")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], float(sys.argv[3]), int(sys.argv[4]))
