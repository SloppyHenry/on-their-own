"""Weg ziehen (AP16a): ein Linienzug durch Kachelmitten; Wege führen nicht durch Mauern, Wasser, Bäume, Zäune und Türen."""

import math

from .modell import BODEN, Abgelehnt, Welt, T


def kacheln_entlang(punkte: list[list[int]]) -> list[tuple[int, int]]:
    """Alle Kacheln, die der Linienzug zwischen den Kachelmitten berührt."""
    out: list[tuple[int, int]] = []
    for a, b in zip(punkte, punkte[1:]):
        n = max(1, int(math.hypot(b[0] - a[0], b[1] - a[1]) * 4))
        for k in range(n + 1):
            t = (math.floor(a[0] + (b[0] - a[0]) * k / n + 0.5), math.floor(a[1] + (b[1] - a[1]) * k / n + 0.5))
            if not out or out[-1] != t:
                out.append(t)
    return out


def punkte_pruefen(a: dict, m: Welt) -> list[list[int]]:
    p = a.get("punkte")
    if not (isinstance(p, list) and len(p) >= 2 and all(isinstance(q, list) and len(q) == 2 and all(isinstance(v, int) and not isinstance(v, bool) for v in q) for q in p)):
        raise Abgelehnt("Ein Weg braucht mindestens zwei Punkte [x, y].")
    pts = [p[0]] + [q for q, r in zip(p[1:], p) if q != r]
    if len(pts) < 2:
        raise Abgelehnt("Ein Weg braucht mindestens zwei verschiedene Punkte.", tuple(p[0]))
    return pts


def ausfuehren(m: Welt, a: dict) -> None:
    pts = punkte_pruefen(a, m)
    for t in kacheln_entlang(pts):
        c = m.art(*t)
        if c not in BODEN:
            m.frei(*t)                                                   # wirft mit dem Grund zur Kachelart
    g = m.gebiet(*pts[0])
    line = [m.pixel(x * T + 8, y * T + 8, g) for x, y in pts]
    xs, ys = [p[0] * T + 8 for p in pts], [p[1] * T + 8 for p in pts]
    m.mit_kacheln(lambda: m.op({"op": "add", "region": g["id"], "liste": "paths", "item": line}), (min(xs) - 8, min(ys) - 8, max(xs) + 8, max(ys) + 8))
