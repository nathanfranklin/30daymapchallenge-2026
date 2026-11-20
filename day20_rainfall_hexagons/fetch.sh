#!/bin/sh
# Download Met Éireann's 1 km monthly rainfall grids for 2020–2025 (~33 MB), the 1991–2020 normals
# grid (2.4 MB) and the 2025 daily grid (~20 MB) into data/met_eireann/. CC BY 4.0, no account needed.
#
# Usage: sh day20_rainfall_hexagons/fetch.sh [data/met_eireann]
set -eu
DATA=${1:-data/met_eireann}
UA="30daymapchallenge-2026 (https://github.com/nathanfranklin)"

mkdir -p "$DATA/grids_monthly" "$DATA/grids_daily" "$DATA/rr_9120"
for y in 2020 2021 2022 2023 2024 2025; do
  curl -sSfL -A "$UA" -o "$DATA/grids_monthly/rr_mon_grid_$y.csv" \
    "https://clidata.met.ie/cli/grids/latest/rr_mon_grid_$y.csv"
done
curl -sSfL -A "$UA" -o "$DATA/IE_RR_9120_V2.zip" \
  "https://www.met.ie/cms/assets/uploads/2024/07/IE_RR_9120_V2.zip"
unzip -o -q "$DATA/IE_RR_9120_V2.zip" -d "$DATA/rr_9120"
curl -sSfL -A "$UA" -o "$DATA/grids_daily/IRL_DLY_RR_2025_grid.csv.gz" \
  "https://clidata.met.ie/cli/grids_daily/latest/rain/IRL_DLY_RR_2025_grid.csv.gz"
ls -l "$DATA/grids_monthly" "$DATA/grids_daily" "$DATA/rr_9120"
