"""Ring forts in OpenStreetMap: download every OSM ring fort on the island of Ireland.

One Overpass request (ROI + NI). Writes, skipping the file if it already exists (--force to refetch):
  <data_dir>/ring_forts_osm.json   Overpass JSON with, in order:
      - ring forts and ring ditches (historic=archaeological_site + archaeological_site=fortification
        + fortification_type=ringfort|ring_ditch): all tags and full geometry
      - county boundaries: 26 ROI counties, 6 NI historic counties, with geometry

Usage:
    python -I day06_vintage_ring_forts/fetch.py data/osm [--force]

Stdlib only. Overpass answers 406 without a User-Agent, and 429/502/504 when busy (retried with backoff).
"""

import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

UA = "30daymapchallenge-2026/0.1 (Irish ring forts; github.com/nathanfranklin)"
OVERPASS = "https://overpass-api.de/api/interpreter"

# NI's six counties are not administrative units any more; OSM keeps them as boundary=historic.
QUERY = """[out:json][timeout:900];
area["ISO3166-1"="IE"]["admin_level"="2"]->.ie;
area["ISO3166-2"="GB-NIR"]->.ni;
nwr["historic"="archaeological_site"](area.ie)->.ie_sites;
nwr["historic"="archaeological_site"](area.ni)->.ni_sites;
(.ie_sites; .ni_sites;)->.sites;
nwr.sites["archaeological_site"="fortification"]["fortification_type"~"^(ringfort|ring_ditch)$"]->.forts;
.forts out tags geom;
(rel["boundary"="administrative"]["admin_level"="6"](area.ie);
 rel["boundary"="historic"]["admin_level"="6"]["name"~"^County "](area.ni););
out geom;
"""


def post(query, tries=6):
    data = urllib.parse.urlencode({"data": query}).encode()
    wait = 30
    for i in range(tries):
        try:
            req = urllib.request.Request(OVERPASS, data, {"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=1200) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code not in (429, 502, 503, 504) or i == tries - 1:
                raise
            print(f"  {e.code}, retrying in {wait}s")
            time.sleep(wait)
            wait *= 2


def main():
    path = Path(sys.argv[1]) / "ring_forts_osm.json"
    if path.exists() and "--force" not in sys.argv:
        print(f"have {path}")
        return
    print(f"fetching {path} ...")
    path.parent.mkdir(parents=True, exist_ok=True)
    body = post(QUERY)
    path.write_bytes(body)
    print(f"  {len(body) / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
