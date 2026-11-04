# #30DayMapChallenge 2026

My maps for the [#30DayMapChallenge](https://30daymapchallenge.com/), November 2026.

## Day 1 · Points: DesignSafe on the map

A step-by-step web map of projects published in the [NHERI DesignSafe](https://www.designsafe-ci.org/) Data Depot Repository and their public Hazmapper maps.

- **Live:** https://nathanfranklin.github.io/30daymapchallenge-2026/day01/
- **Code:** [`docs/day01/`](docs/day01/) (MapLibre GL JS and PMTiles)
- **Data:** served from [30day-map-data-2026](https://github.com/nathanfranklin/30day-map-data-2026)

To run it locally:

```bash
python3 -m http.server 8765 --directory docs
```

Then open http://127.0.0.1:8765/day01/.

The website is the `docs/` folder, which GitHub Pages serves. Each day gets its own folder there, so links stay the same as days are added.

Data comes from DesignSafe (Rathje et al., 2017, [doi:10.1061/(ASCE)NH.1527-6996.0000246](https://doi.org/10.1061/(ASCE)NH.1527-6996.0000246)) and each published project's authors; see each project's landing page for its citation and licence.
