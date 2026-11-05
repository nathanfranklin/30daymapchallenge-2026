# Day 1 · Points: DesignSafe’s published projects, mapped

A step-by-step web map of projects published in the [NHERI DesignSafe](https://www.designsafe-ci.org/) Data Depot Repository and their public Hazmapper maps.

- **Live:** https://nathanfranklin.github.io/30daymapchallenge-2026/day01/
- **Code:** [`docs/day01/`](../docs/day01/)
- **Data:** served from [30day-map-data-2026](https://github.com/nathanfranklin/30day-map-data-2026) (`day1_designsafe/`)

## Where the data comes from

**Published projects (snapshot 28 Oct 2026)**
- **Project list:** from the DesignSafe publications API, `https://www.designsafe-ci.org/api/publications/v2`. It returned 1,680 published projects (`PRJ-` IDs). Older NEES datasets aren't in this list.
- **Per-project details:** from `https://www.designsafe-ci.org/api/publications/v2/PRJ-xxxx`. Each gives the project's natural hazard events (name, place, dates and latitude/longitude), its hazard types, and its linked Hazmapper maps.
- **Locations:** 262 projects are on the map.
  - 247 come from their event latitude/longitude. 25 of those were entered with a flipped sign (for example, an event in Texas with a positive longitude) and are corrected.
  - 15 projects have a public Hazmapper map but no event location, so they're placed at the middle of their map.

**Hazmapper maps and features (archive built 18 Aug 2026)**
- **Archive:** GeoAPI, Hazmapper's backend, builds a nightly PMTiles archive of every feature in the public Hazmapper maps of published projects. Its current address is listed at `https://hazmapper.tacc.utexas.edu/geoapi/designsafe/published-maps/pmtiles`. The map uses an unchanged copy of the archive built 18 Aug 2026: 37 maps from 36 projects. It holds 89,696 features, but 84,118 of them are one map's census-tract points (PRJ-6361), and a point cloud counts as one feature however many points it has, so the page doesn't show a total.
- **Map list and counts:** decoded from the archive's most detailed tiles (zoom 14), one point per feature. That gives each map's feature counts by type and its extent (the middle 96% of its points).
- **Order:** the Browse steps run newest first, by each project's publication date in the DesignSafe list.

Data comes from DesignSafe (Rathje et al., 2017, [doi:10.1061/(ASCE)NH.1527-6996.0000246](https://doi.org/10.1061/(ASCE)NH.1527-6996.0000246)) and each published project's authors; see each project's landing page for its citation and licence.
