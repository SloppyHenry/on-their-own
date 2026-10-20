"""Gemeinsame Hilfen für die Stellgrößen des Layouts (AP18f): Platzprüfung gegen See, Garten, Platz, Wasser, Wege und Häuser (Dorfkoordinaten in Weltpixeln)."""

import math

from .geometry import Pt, lerp_y, line_dist


def road_y(lay, x: float) -> float:
    road = lay.paths[0] + lay.paths[1][1:]
    return lerp_y(road, x, lay.sq["y"])


def water_lines(lay) -> list[list[Pt]]:
    return [pl for pl in [lay.stream, *lay.strands] if len(pl) > 1]


def box_of(b) -> tuple[float, float, float, float]:
    """Fläche, die ein Gebäude im Bild und davor braucht (Dorfkoordinaten)."""
    return b.cx - b.w / 2 - 3, b.base - 62, b.cx + b.w / 2 + 3, b.base + 6


def blocked_pt(lay, x: float, y: float, pad: float, paths: bool = True, houses: bool = True, square: bool = True) -> bool:
    """Liegt der Punkt auf etwas, das Platz braucht: See, Teich, Garten, Platz, Wasserlauf, Weg oder Haus?"""
    for k in ([lay.lake] if lay.lake else []) + lay.ponds:
        if ((x - k["x"]) / (k["rx"] + pad)) ** 2 + ((y - k["y"]) / (k["ry"] + pad * 0.8)) ** 2 < 1:
            return True
    for g in ([lay.garden] if lay.garden else []) + lay.gardens2:
        if g["x0"] - pad < x < g["x1"] + pad and g["y0"] - pad < y < g["y1"] + pad:
            return True
    if square and math.hypot(x - lay.sq["x"], (y - lay.sq["y"]) * 1.08) < lay.sq["r"] + pad:
        return True
    if lay.dock and lay.dock["x0"] - pad < x < lay.dock["x1"] + pad and lay.dock["y0"] - pad < y < lay.dock["y1"] + pad:
        return True
    if water_lines(lay) and line_dist(water_lines(lay), x, y) < pad + 2:
        return True
    if paths and line_dist(lay.paths, x, y) < pad:
        return True
    if lay.bridge and lay.bridge["x0"] - pad < x < lay.bridge["x1"] + pad and lay.bridge["y0"] - pad < y < lay.bridge["y1"] + pad:
        return True
    return houses and any(b0 - pad * 0.3 < x < b1 + pad * 0.3 and c0 < y < c1 for b0, b1, c0, c1 in (box_of(b) for b in lay.buildings))


def clear_trees(lay, box: tuple[float, float, float, float]) -> None:
    """Bäume des Grundlayouts (Wald, Rand, einzelne), die in der Fläche stehen, weichen. Apfelbäume sind Quellen und bleiben."""
    x0, y0, x1, y1 = box
    lay.decor = [d for d in lay.decor if not (d[0] in ("tree", "pine") and x0 <= d[1] <= x1 and y0 <= d[2] <= y1)]


def box_blocked(lay, box: tuple[float, float, float, float], pad: float, paths: bool = True) -> bool:
    x0, y0, x1, y1 = box
    xs = [x0 + (x1 - x0) * i / max(1, round((x1 - x0) / 8)) for i in range(max(1, round((x1 - x0) / 8)) + 1)]
    ys = [y0 + (y1 - y0) * j / max(1, round((y1 - y0) / 8)) for j in range(max(1, round((y1 - y0) / 8)) + 1)]
    return any(blocked_pt(lay, x, y, pad, paths) for x in xs for y in ys)


BASE_BOTTOM = 232                                                           # untere Grenze des Dorfs ohne zusätzliche Höhe


def needed_height(lay) -> int:
    """Wie viel das Dorf nach Süden wachsen muss, damit Häuser samt Türweg, Teiche, Gärten und Felder darin liegen (Vielfaches von 16)."""
    bottoms = [b.base + 26 for b in lay.buildings] + [k["y"] + k["ry"] + 12 for k in lay.ponds] + [g["y1"] + 14 for g in lay.gardens2]
    need = max(bottoms, default=0) - BASE_BOTTOM
    return max(0, int(math.ceil(need / 16.0)) * 16)
