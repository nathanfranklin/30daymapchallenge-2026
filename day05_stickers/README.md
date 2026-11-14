# Day 5 · Sight: Fussball stickers around Galway

- **Live:** https://nathanfranklin.github.io/30daymapchallenge-2026/day05/
- **Static map:** [`output/stickers_galway.png`](output/stickers_galway.png)

## Rebuild

Photos go in `data/raw/`. Everything in `data/` stays local. Stickers 5 and 6 are placed at Clarinbridge village centre, not where they were photographed.

Make location-only photo copies and `sightings.csv` (then fill in each club):

```bash
uv run --with pillow --with pillow-heif --with piexif python -I day05_stickers/prepare_photos.py day05_stickers/data/raw day05_stickers/data/clean day05_stickers/sightings.csv
```

Build the web map's data in `docs/day05/`:

```bash
uv run --with pillow python -I day05_stickers/build_web.py day05_stickers/sightings.csv day05_stickers/clubs.csv day05_stickers/data/clean docs/day05
```
