# Ring forts in OpenStreetMap (Day 6 · Vintage)

A web map of every ring fort OpenStreetMap has on the island of Ireland, over the old Ordnance Survey and War Office maps most of them were derived from (`docs/day06/`).

This is OSM's record, not the archaeological record. The official one is the National Monuments Service's Sites and Monuments Record, which lists many more.

## The data

17,007 forts (Overpass snapshot 2026-11-06): 16,480 in the Republic and 527 in Northern Ireland. That's `historic=archaeological_site` + `archaeological_site=fortification` + `fortification_type=ringfort` or `ring_ditch`. Cashels are tagged the same way, so they're included.

What the fort's `source` tag says:

| Source | Forts |
|---|---:|
| British War Office map (GSGS 3906) | 5,328 |
| Ordnance Survey 1st or 2nd edition | 4,715 |
| Aerial imagery, National Monuments Service, other | 551 |
| No source tag | 6,413 |

Most counties come mainly from one source, so the pattern shows where people mapped more than where forts are.

## Backgrounds

| Background | Source | Licence |
|---|---|---|
| OS six-inch, 1st edition (1830s–40s) and 2nd edition (1888–1915, the default) | National Library of Scotland, one tile set per county | CC-BY, "Reproduced with the permission of the National Library of Scotland" |
| 1940 War Office map (GSGS 3906) | Glucksman Map Library, Trinity College Dublin, via mapwarper.net | Out of copyright, credit the library |
| Aerial imagery | Esri World Imagery | Not open; free to view with credit |
| OpenStreetMap | `tile.openstreetmap.org` | ODbL; light use only, credit must stay visible |

Forts with an SMR number (`ref:IE:smr`, 1,777 of them) link to their record in the Historic Environment Viewer.

## Make it

```bash
python3 -I day06_vintage_ring_forts/fetch.py data/osm
```

```bash
uv run --with shapely --with pyproj --with numpy python -I day06_vintage_ring_forts/stats.py data/osm
```

```bash
python3 -I day06_vintage_ring_forts/export_web.py data/osm docs/day06
```

```bash
uv run --with matplotlib --with pillow python -I day06_vintage_ring_forts/make_preview.py docs/day06/outlines.geojson data/nls_tiles docs/day06/preview.png
```

```bash
python3 -m http.server 8765 --directory docs
```

Then open http://127.0.0.1:8765/day06/.

- `fetch.py` downloads the forts and county boundaries in one Overpass request to `data/osm/` (gitignored).
- `stats.py` turns the download into `data/osm/ring_forts.csv`, one row per fort.
- `export_web.py` writes `forts.geojson` (3.3 MB) and `outlines.geojson` (9.4 MB) for the web map. Both are committed in `docs/day06/`, so GitHub Pages serves them next to the page.
- `make_preview.py` draws `preview.png`, the 1200 × 630 card for the landing page and link previews, from 18 NLS tiles cached in `data/nls_tiles/`.

## Not checked

- A comparison with the official Sites and Monuments Record. It's open data on [data.gov.ie](https://data.gov.ie/en_GB/dataset/national-monuments-service-archaeological-survey-of-ireland) (CC BY 4.0) but wasn't downloaded.
- Who mapped what, and when: edit history wasn't fetched.
- The licence on individual NLS sheets; only NLS's general terms were read.
