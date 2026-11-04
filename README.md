# #30DayMapChallenge 2026

My maps for the [#30DayMapChallenge](https://30daymapchallenge.com/), November 2026.

## Day 1 · Points: DesignSafe on the map

A step-by-step web map of projects published in the [NHERI DesignSafe](https://www.designsafe-ci.org/) Data Depot Repository and their public Hazmapper maps.

- **Live:** https://nathanfranklin.github.io/30daymapchallenge-2026/day01/
- **Code:** [`docs/day01/`](docs/day01/) (MapLibre GL JS and PMTiles)
- **Data:** served from [30day-map-data-2026](https://github.com/nathanfranklin/30day-map-data-2026)
- **About the data:** [`day01/README.md`](day01/README.md)

To run it locally:

```bash
python3 -m http.server 8765 --directory docs
```

Then open http://127.0.0.1:8765/day01/.
