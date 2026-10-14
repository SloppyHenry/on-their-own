"""Kleine Geometrie für Wege, Seen und Bäche (Dorfkoordinaten in Weltpixeln)."""

import math

Pt = tuple[float, float]


def seg_dist(px: float, py: float, a: Pt, b: Pt) -> float:
    dx, dy = b[0] - a[0], b[1] - a[1]
    t = max(0.0, min(1.0, ((px - a[0]) * dx + (py - a[1]) * dy) / (dx * dx + dy * dy))) if dx or dy else 0.0
    return math.hypot(a[0] + t * dx - px, a[1] + t * dy - py)


def line_dist(lines: list[list[Pt]], x: float, y: float) -> float:
    d = 1e9
    for pl in lines:
        for j in range(len(pl) - 1):
            d = min(d, seg_dist(x, y, pl[j], pl[j + 1]))
    return d


def lerp_y(poly: list[Pt], x: float, default: float) -> float:
    """Höhe eines Linienzugs (von links nach rechts) an der Stelle x."""
    for i in range(len(poly) - 1):
        if poly[i][0] <= x <= poly[i + 1][0]:
            return poly[i][1] + (poly[i + 1][1] - poly[i][1]) * (x - poly[i][0]) / max(1.0, poly[i + 1][0] - poly[i][0])
    return default
