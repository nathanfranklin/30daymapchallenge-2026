"""Ring forts in OpenStreetMap: GeoJSON for the web map in docs/day06/.

Reads <data_dir>/ring_forts_osm.json (fetch.py) and <data_dir>/ring_forts.csv (stats.py). Writes:
  <web_dir>/forts.geojson     one point per fort (its centre) with the fields the map shows, including
                              `smr`, its Sites and Monuments Record number where OSM has one (ref:IE:smr)
  <web_dir>/outlines.geojson  the mapped outlines (ways only), rounded to ~1 m

Usage:
    python3 -I day06_vintage_ring_forts/export_web.py data/osm docs/day06
"""

import csv
import json
import sys
from pathlib import Path


def dump(path, features):
    with open(path, "w", encoding="utf-8") as f:
        json.dump({"type": "FeatureCollection", "features": features}, f, ensure_ascii=False, separators=(",", ":"))
    print(f"wrote {path} ({len(features):,} features, {path.stat().st_size / 1e6:.1f} MB)")


def main():
    data, web = Path(sys.argv[1]), Path(sys.argv[2])
    web.mkdir(parents=True, exist_ok=True)
    with open(data / "ring_forts.csv", encoding="utf-8") as f:
        rows = {r["osm"]: r for r in csv.DictReader(f)}

    # SMR numbers are 13 characters, padded with trailing hyphens that the Historic Environment Viewer needs.
    elements = json.load(open(data / "ring_forts_osm.json", encoding="utf-8"))["elements"]
    smr = {f"{e['type']}/{e['id']}": e["tags"]["ref:IE:smr"].strip().ljust(13, "-")
           for e in elements if "ref:IE:smr" in e.get("tags", {})}

    points = []
    for r in rows.values():
        props = {"osm": r["osm"], "county": r["county"], "kind": r["source_kind"]}
        for k in ("name", "source", "area_m2"):
            if r[k]:
                props[k] = int(r[k]) if k == "area_m2" else r[k]
        if r["osm"] in smr:
            props["smr"] = smr[r["osm"]]
        if r["fortification_type"] != "ringfort":
            props["type"] = r["fortification_type"]
        points.append({"type": "Feature", "properties": props,
                       "geometry": {"type": "Point", "coordinates": [float(r["lon"]), float(r["lat"])]}})

    outlines = []
    for e in elements:
        osm = f"{e['type']}/{e.get('id')}"
        if e["type"] != "way" or osm not in rows:
            continue
        ring = [[round(p["lon"], 5), round(p["lat"], 5)] for p in e["geometry"]]
        closed = len(ring) >= 4 and ring[0] == ring[-1]
        outlines.append({"type": "Feature", "properties": {"osm": osm, "kind": rows[osm]["source_kind"]},
                         "geometry": {"type": "Polygon", "coordinates": [ring]} if closed
                         else {"type": "LineString", "coordinates": ring}})

    dump(web / "forts.geojson", points)
    dump(web / "outlines.geojson", outlines)
    print(f"{sum('smr' in p['properties'] for p in points):,} forts have an SMR number")


if __name__ == "__main__":
    main()
