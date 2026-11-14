"""Make publishable copies of sticker photos that keep only their location.

For each photo in <raw_dir> (JPEG, PNG or HEIC):
  - read its GPS latitude/longitude from <raw_dir>/../manual_locations.csv (source,lat,lon) if it's
    listed there, otherwise from EXIF; photos with neither are listed and skipped. Use the manual
    file for photos taken with location off, or whose GPS fix is wrong (the script warns when a
    fix is older than the photo, a sign the phone reused an old location)
  - apply the EXIF rotation to the pixels, so the photo shows the right way up without metadata
  - save a JPEG to <clean_dir> as sticker-NNN.jpg whose only metadata is GPS latitude/longitude
    (no date or time, no GPS timestamp, no camera or phone details)
  - add a row to <sightings_csv> (id, file, lat, lon, club) for you to fill in the club

Re-running is safe: photos already listed keep their number and anything you've typed in the
CSV. New photos get the next numbers, and photos removed from <raw_dir> are dropped from the CSV.
To replace a photo but keep its number, change its source filename in photo_index.csv. The original filename -> number map is kept in
<raw_dir>/../photo_index.csv, which stays local, because original names often contain the time.

Usage:
    uv run --with pillow --with pillow-heif --with piexif python -I day05_stickers/prepare_photos.py \
        day05_stickers/data/raw day05_stickers/data/clean day05_stickers/sightings.csv
"""

import csv
import sys
from datetime import datetime, timezone
from fractions import Fraction
from pathlib import Path

import piexif
from PIL import Image, ImageOps
from pillow_heif import register_heif_opener

register_heif_opener()

PHOTO_TYPES = {".jpg", ".jpeg", ".png", ".heic", ".heif"}
MAX_SIDE = 2000  # long side of the published copy, in pixels
FIELDS = ["id", "file", "lat", "lon", "club"]


def to_degrees(dms, ref):
    """EXIF degrees/minutes/seconds rationals + N/S/E/W -> signed decimal degrees."""
    d, m, s = (float(v[0]) / float(v[1]) if isinstance(v, tuple) else float(v) for v in dms)
    value = d + m / 60 + s / 3600
    return -value if ref in ("S", "W") else value


def read_gps(image):
    """(lat, lon) from the image's EXIF, or None."""
    exif = image.getexif()
    gps = exif.get_ifd(0x8825)  # GPS IFD
    if not gps or 2 not in gps or 4 not in gps:
        return None
    lat = to_degrees(gps[2], gps.get(1, "N"))
    lon = to_degrees(gps[4], gps.get(3, "E"))
    return round(lat, 6), round(lon, 6)


def gps_fix_age(image):
    """Minutes between the GPS fix and the moment the photo was taken, or None if unknown."""
    exif = image.getexif()
    gps, photo = exif.get_ifd(0x8825), exif.get_ifd(0x8769)
    taken, offset = photo.get(36867), photo.get(36880)  # DateTimeOriginal, OffsetTimeOriginal
    if not (taken and offset and 7 in gps and 29 in gps):
        return None
    taken = datetime.strptime(taken + (offset.replace("Z", "+00:00")), "%Y:%m:%d %H:%M:%S%z")
    h, m, sec = (float(v) for v in gps[7])
    fixed = datetime.strptime(gps[29], "%Y:%m:%d").replace(tzinfo=timezone.utc)
    fixed = fixed.replace(hour=int(h), minute=int(m), second=int(sec))
    return (taken - fixed).total_seconds() / 60


def rational(value):
    f = Fraction(value).limit_denominator(1_000_000)
    return (f.numerator, f.denominator)


def gps_only_exif(lat, lon):
    """EXIF bytes holding only GPS latitude/longitude (as degrees/minutes/seconds)."""
    def dms(value):
        value = abs(value)
        d = int(value)
        m = int((value - d) * 60)
        s = (value - d - m / 60) * 3600
        return ((d, 1), (m, 1), rational(round(s, 4)))

    gps = {
        piexif.GPSIFD.GPSVersionID: (2, 3, 0, 0),
        piexif.GPSIFD.GPSLatitudeRef: b"N" if lat >= 0 else b"S",
        piexif.GPSIFD.GPSLatitude: dms(lat),
        piexif.GPSIFD.GPSLongitudeRef: b"E" if lon >= 0 else b"W",
        piexif.GPSIFD.GPSLongitude: dms(lon),
    }
    return piexif.dump({"0th": {}, "Exif": {}, "GPS": gps, "1st": {}, "thumbnail": None})


def read_csv(path):
    if not path.exists():
        return []
    with open(path, newline="") as f:
        return list(csv.DictReader(f))


def write_csv(path, rows, fields):
    with open(path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fields, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def main(raw_dir, clean_dir, sightings_csv):
    raw_dir, clean_dir, sightings_csv = Path(raw_dir), Path(clean_dir), Path(sightings_csv)
    clean_dir.mkdir(parents=True, exist_ok=True)
    index_csv = raw_dir.parent / "photo_index.csv"

    index = {r["source"]: r["id"] for r in read_csv(index_csv)}
    manual = {r["source"]: (round(float(r["lat"]), 6), round(float(r["lon"]), 6))
              for r in read_csv(raw_dir.parent / "manual_locations.csv")}
    sightings = {r["id"]: r for r in read_csv(sightings_csv)}
    next_number = max((int(i.split("-")[1]) for i in index.values()), default=0) + 1

    no_gps, stale, seen = [], [], set()
    for source in sorted(p for p in raw_dir.iterdir() if p.suffix.lower() in PHOTO_TYPES):
        with Image.open(source) as image:
            gps = manual.get(source.name) or read_gps(image)
            if gps is None:
                no_gps.append(source.name)
                continue
            age = gps_fix_age(image)
            if source.name not in manual and age is not None and abs(age) > 5:
                stale.append(f"{source.name} ({age:.0f} min)")
            if source.name not in index:
                index[source.name] = f"sticker-{next_number:03d}"
                next_number += 1
            photo_id = index[source.name]
            upright = ImageOps.exif_transpose(image).convert("RGB")
            upright.thumbnail((MAX_SIDE, MAX_SIDE))
            out = clean_dir / f"{photo_id}.jpg"
            upright.save(out, "JPEG", quality=85, exif=gps_only_exif(*gps))

        row = sightings.get(photo_id, {"id": photo_id, "club": ""})
        row.update({"file": out.name, "lat": gps[0], "lon": gps[1]})
        sightings[photo_id] = row
        seen.add(photo_id)

    dropped = sorted(set(sightings) - seen)
    sightings = {k: v for k, v in sightings.items() if k in seen}

    write_csv(index_csv, [{"source": s, "id": i} for s, i in sorted(index.items(), key=lambda kv: kv[1])],
              ["source", "id"])
    write_csv(sightings_csv, [sightings[k] for k in sorted(sightings)], FIELDS)
    print(f"{len(sightings)} photos in {sightings_csv}; clean copies in {clean_dir}")
    if no_gps:
        print(f"Skipped {len(no_gps)} without a location: {', '.join(no_gps)}")
    if dropped:
        print(f"Dropped {len(dropped)} whose photo is no longer in {raw_dir}: {', '.join(dropped)}")
    if stale:
        print(f"GPS fix older than the photo, so the location may be wrong: {', '.join(stale)}")


if __name__ == "__main__":
    main(*sys.argv[1:4])
