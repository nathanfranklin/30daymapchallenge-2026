"""Ring forts in OpenStreetMap: one row per fort, for export_web.py.

Reads <data_dir>/ring_forts_osm.json (from fetch.py). Writes:
  <data_dir>/ring_forts.csv   one row per ring fort / ring ditch: id, centre, county, name, source, area

Usage:
    uv run --with shapely --with pyproj --with numpy python -I day06_vintage_ring_forts/stats.py data/osm
"""

import csv
import json
import re
import sys
from pathlib import Path

import numpy as np
import shapely
from pyproj import Transformer
from shapely import STRtree
from shapely.geometry import LineString, Point, Polygon
from shapely.ops import polygonize, unary_union

_ITM = Transformer.from_crs("EPSG:4326", "EPSG:2157", always_xy=True)


def itm(geom):
    return shapely.transform(geom, lambda xy: np.column_stack(_ITM.transform(xy[:, 0], xy[:, 1])))


# NI's two county boroughs are separate historic relations; fold them into their counties.
BOROUGHS = {"County Borough of Belfast": "Antrim", "County Borough of Londonderry": "Londonderry"}


def county_name(tags):
    return BOROUGHS.get(tags["name"]) or re.sub(r"^County ", "", tags["name"])


def source_kind(source):
    s = source.lower()
    if not s:
        return "none"
    if "war office" in s or "gsgs" in s:
        return "war_office"
    if re.search(r"\bos\b|ordnance|osi\b|6 ?inch|6-inch", s):
        return "os_historic"
    if re.search(r"bing|esri|imagery|aerial|mapbox|maxar|ortho", s):
        return "imagery"
    if "monument" in s or "smr" in s or "historic environment" in s:
        return "nms"
    return "other"


def relation_polygon(rel):
    rings = {"outer": [], "inner": []}
    for m in rel["members"]:
        if m["type"] == "way" and "geometry" in m:
            role = "inner" if m.get("role") == "inner" else "outer"
            rings[role].append(LineString([(p["lon"], p["lat"]) for p in m["geometry"]]))
    outer = unary_union(list(polygonize(rings["outer"])))
    inner = unary_union(list(polygonize(rings["inner"]))) if rings["inner"] else None
    return outer.difference(inner) if inner else outer


def fort_shape(el):
    """Centre (lon, lat) and outline (lon/lat polygon or None) of a node, way or relation."""
    if el["type"] == "node":
        return (el["lon"], el["lat"]), None
    if el["type"] == "way":
        pts = [(p["lon"], p["lat"]) for p in el["geometry"]]
        if len(pts) >= 4 and pts[0] == pts[-1]:
            poly = Polygon(pts)
            c = poly.centroid if poly.is_valid else poly.representative_point()
            return (c.x, c.y), poly
        line = LineString(pts)
        c = line.centroid
        return (c.x, c.y), None
    # `out tags geom` gives relations a bounding box but no members: use the box centre.
    poly = relation_polygon(el) if "members" in el else Polygon()
    if poly.is_empty:
        b = el["bounds"]
        return ((b["minlon"] + b["maxlon"]) / 2, (b["minlat"] + b["maxlat"]) / 2), None
    c = poly.centroid
    return (c.x, c.y), poly


def main():
    data = Path(sys.argv[1])
    els = json.load(open(data / "ring_forts_osm.json", encoding="utf-8"))["elements"]

    counties = {}
    forts = []
    for e in els:
        t = e.get("tags", {})
        if t.get("historic") == "archaeological_site":
            if t.get("archaeological_site") == "fortification" and t.get("fortification_type") in (
                    "ringfort", "ring_ditch"):
                forts.append(e)
        elif e["type"] == "relation" and t.get("admin_level") == "6":
            name = county_name(t)
            poly = relation_polygon(e)
            counties[name] = counties[name].union(poly) if name in counties else poly

    names = sorted(counties)
    tree = STRtree([counties[n] for n in names])

    def which_county(lon, lat):
        hits = tree.query(Point(lon, lat), predicate="intersects")
        return names[hits[0]] if len(hits) else ""

    rows = []
    for e in forts:
        t = e["tags"]
        (lon, lat), poly = fort_shape(e)
        county = which_county(lon, lat)
        rows.append({
            "osm": f"{e['type']}/{e['id']}",
            "lon": round(lon, 6), "lat": round(lat, 6),
            "county": county,
            "fortification_type": t["fortification_type"],
            "name": t.get("name", ""),
            "source": t.get("source", ""),
            "source_kind": source_kind(t.get("source", "")),
            "area_m2": round(itm(poly).area) if poly is not None and poly.is_valid else "",
        })
    with open(data / "ring_forts.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)

    print(f"wrote {data / 'ring_forts.csv'} ({len(rows):,} forts)")

if __name__ == "__main__":
    main()
