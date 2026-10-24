#!/usr/bin/env python3
"""Builds lib/outlook/basemap.ts (land, lakes and country borders as SVG paths).

Data: Natural Earth 1:10m (public domain), https://www.naturalearthdata.com
Usage: python3 scripts/build-outlook-basemap.py <folder with the Natural Earth geojson files>

The map projection and extent below MUST match lib/outlook/geo.ts.
Re-run this script only if you change the extent or the level of detail.
"""

import json
import math
import sys
from pathlib import Path

# ---- must match lib/outlook/geo.ts -------------------------------------
LON_MIN, LON_MAX = -30.0, 50.0
LAT_MIN, LAT_MAX = 25.0, 62.0
SCALE = 15.0  # map units per degree (Mercator degrees)
# -------------------------------------------------------------------------


def merc_y(lat: float) -> float:
    return math.degrees(math.log(math.tan(math.pi / 4 + math.radians(lat) / 2)))


Y_TOP = merc_y(LAT_MAX)
Y_BOTTOM = merc_y(LAT_MIN)
WIDTH = (LON_MAX - LON_MIN) * SCALE
HEIGHT = (Y_TOP - Y_BOTTOM) * SCALE

# Clip a little outside the visible area so edges never show.
PAD = 3.0
CLIP = (LON_MIN - PAD, LAT_MIN - PAD, LON_MAX + PAD, LAT_MAX + PAD)


def project(lon: float, lat: float):
    return ((lon - LON_MIN) * SCALE, (Y_TOP - merc_y(lat)) * SCALE)


# ---- level of detail (map units; 1 unit = 1/15 degree) ------------------
def tolerance(lon: float, lat: float) -> float:
    if 19 <= lon <= 30 and 34 <= lat <= 42:  # Greece and the Aegean
        return 0.10
    if -6 <= lon <= 37 and 29 <= lat <= 47:  # rest of the Mediterranean
        return 0.18
    return 0.35


def min_area(lon: float, lat: float) -> float:
    if 19 <= lon <= 30 and 34 <= lat <= 42:
        return 0.25
    if -6 <= lon <= 37 and 29 <= lat <= 47:
        return 0.8
    return 3.0


# ---- geometry helpers ------------------------------------------------------
def clip_ring(points, box):
    """Sutherland-Hodgman against an axis-aligned box, in lon/lat."""
    x0, y0, x1, y1 = box

    def clip(pts, inside, intersect):
        out = []
        if not pts:
            return out
        prev = pts[-1]
        for cur in pts:
            if inside(cur):
                if not inside(prev):
                    out.append(intersect(prev, cur))
                out.append(cur)
            elif inside(prev):
                out.append(intersect(prev, cur))
            prev = cur
        return out

    def at_x(a, b, x):
        t = (x - a[0]) / (b[0] - a[0])
        return (x, a[1] + t * (b[1] - a[1]))

    def at_y(a, b, y):
        t = (y - a[1]) / (b[1] - a[1])
        return (a[0] + t * (b[0] - a[0]), y)

    pts = list(points)
    pts = clip(pts, lambda p: p[0] >= x0, lambda a, b: at_x(a, b, x0))
    pts = clip(pts, lambda p: p[0] <= x1, lambda a, b: at_x(a, b, x1))
    pts = clip(pts, lambda p: p[1] >= y0, lambda a, b: at_y(a, b, y0))
    pts = clip(pts, lambda p: p[1] <= y1, lambda a, b: at_y(a, b, y1))
    return pts


def clip_line(points, box):
    """Clips a polyline to the box, returns a list of polylines (Liang-Barsky)."""
    x0, y0, x1, y1 = box
    pieces = []
    current = []

    def clip_segment(a, b):
        dx, dy = b[0] - a[0], b[1] - a[1]
        t0, t1 = 0.0, 1.0
        for p, q in ((-dx, a[0] - x0), (dx, x1 - a[0]), (-dy, a[1] - y0), (dy, y1 - a[1])):
            if p == 0:
                if q < 0:
                    return None
            else:
                r = q / p
                if p < 0:
                    if r > t1:
                        return None
                    t0 = max(t0, r)
                else:
                    if r < t0:
                        return None
                    t1 = min(t1, r)
        return (
            (a[0] + t0 * dx, a[1] + t0 * dy),
            (a[0] + t1 * dx, a[1] + t1 * dy),
        )

    for a, b in zip(points, points[1:]):
        seg = clip_segment(a, b)
        if seg is None:
            if len(current) > 1:
                pieces.append(current)
            current = []
            continue
        if not current:
            current = [seg[0], seg[1]]
        elif current[-1] == seg[0]:
            current.append(seg[1])
        else:
            pieces.append(current)
            current = [seg[0], seg[1]]
    if len(current) > 1:
        pieces.append(current)
    return pieces


def simplify(points, closed):
    """Douglas-Peucker with a tolerance that depends on where the point is.

    points: list of (lon, lat). Returns the kept points (lon, lat).
    """
    if len(points) < 3:
        return points

    proj = [project(*p) for p in points]
    tol = [tolerance(*p) for p in points]
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]

    while stack:
        a, b = stack.pop()
        if b <= a + 1:
            continue
        ax, ay = proj[a]
        bx, by = proj[b]
        dx, dy = bx - ax, by - ay
        length = math.hypot(dx, dy)
        worst, worst_i = 0.0, -1
        for i in range(a + 1, b):
            px, py = proj[i]
            if length == 0:
                d = math.hypot(px - ax, py - ay)
            else:
                d = abs(dy * (px - ax) - dx * (py - ay)) / length
            excess = d - tol[i]
            if excess > worst:
                worst, worst_i = excess, i
        if worst_i != -1:
            keep[worst_i] = True
            stack.append((a, worst_i))
            stack.append((worst_i, b))

    out = [p for p, k in zip(points, keep) if k]
    return out


def ring_area(proj):
    s = 0.0
    for (x1, y1), (x2, y2) in zip(proj, proj[1:] + proj[:1]):
        s += x1 * y2 - x2 * y1
    return abs(s) / 2


def fmt(v: int) -> str:
    text = f"{v / 10:.1f}"
    return text[:-2] if text.endswith(".0") else text


def to_path(points, close):
    """points in map units -> compact path (relative lineto, 1 decimal)."""
    ints = [(round(x * 10), round(y * 10)) for x, y in points]
    # drop repeated points created by rounding
    dedup = [ints[0]]
    for p in ints[1:]:
        if p != dedup[-1]:
            dedup.append(p)
    if len(dedup) < (3 if close else 2):
        return ""
    parts = [f"M{fmt(dedup[0][0])} {fmt(dedup[0][1])}l"]
    deltas = []
    for (x1, y1), (x2, y2) in zip(dedup, dedup[1:]):
        deltas.append(f"{fmt(x2 - x1)} {fmt(y2 - y1)}")
    parts.append(" ".join(deltas))
    if close:
        parts.append("z")
    return "".join(parts)


def rings_of(geometry):
    if geometry["type"] == "Polygon":
        return [geometry["coordinates"]]
    if geometry["type"] == "MultiPolygon":
        return geometry["coordinates"]
    return []


def build_polygons(path: Path, min_area_scale=1.0):
    data = json.loads(path.read_text(encoding="utf-8"))
    out = []
    for feature in data["features"]:
        for polygon in rings_of(feature["geometry"]):
            for ring in polygon:
                pts = [(p[0], p[1]) for p in ring]
                lons = [p[0] for p in pts]
                lats = [p[1] for p in pts]
                # skip rings that cannot touch the visible area
                if (
                    max(lons) < CLIP[0]
                    or min(lons) > CLIP[2]
                    or max(lats) < CLIP[1]
                    or min(lats) > CLIP[3]
                ):
                    continue
                clipped = clip_ring(pts, CLIP)
                if len(clipped) < 3:
                    continue
                kept = simplify(clipped, True)
                if len(kept) < 3:
                    continue
                proj = [project(*p) for p in kept]
                cx = sum(p[0] for p in kept) / len(kept)
                cy = sum(p[1] for p in kept) / len(kept)
                if ring_area(proj) < min_area(cx, cy) * min_area_scale:
                    continue
                encoded = to_path(proj, True)
                if encoded:
                    out.append(encoded)
    return out


def build_lines(path: Path):
    data = json.loads(path.read_text(encoding="utf-8"))
    out = []
    for feature in data["features"]:
        geometry = feature["geometry"]
        lines = (
            [geometry["coordinates"]]
            if geometry["type"] == "LineString"
            else geometry["coordinates"]
            if geometry["type"] == "MultiLineString"
            else []
        )
        for line in lines:
            pts = [(p[0], p[1]) for p in line]
            for piece in clip_line(pts, CLIP):
                kept = simplify(piece, False)
                if len(kept) < 2:
                    continue
                encoded = to_path([project(*p) for p in kept], False)
                if encoded:
                    out.append(encoded)
    return out


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    folder = Path(sys.argv[1])

    land = build_polygons(folder / "ne_10m_land.geojson")
    lakes = build_polygons(folder / "ne_10m_lakes.geojson", min_area_scale=40.0)
    borders = build_lines(folder / "ne_10m_admin_0_boundary_lines_land.geojson")

    target = Path(__file__).resolve().parent.parent / "lib" / "outlook" / "basemap.ts"

    def const(name, parts):
        return f'export const {name} =\n\t"{"".join(parts)}";\n'

    header = (
        "// GENERATED by scripts/build-outlook-basemap.py - do not edit by hand.\n"
        "// Data: Natural Earth (public domain). Simplified for the web.\n\n"
    )
    body = (
        const("LAND_PATH", land)
        + "\n"
        + const("LAKES_PATH", lakes)
        + "\n"
        + const("BORDERS_PATH", borders)
    )
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(header + body, encoding="utf-8")

    print(f"map size: {WIDTH:.1f} x {HEIGHT:.1f} units")
    print(f"land rings: {len(land)}, lakes: {len(lakes)}, border lines: {len(borders)}")
    print(f"written {target} ({target.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
