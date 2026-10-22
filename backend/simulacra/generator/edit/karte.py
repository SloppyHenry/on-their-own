"""Karte erweitern und Startplatz (AP16a): Die Karte wächst nach Osten oder Süden um 8, 16 oder 32 Kacheln Wiese (höchstens 256 × 256); der Bestand bleibt unberührt, die Gebiete am Rand wachsen mit."""

from .modell import Abgelehnt, Welt, T

MAX_KARTE = 256


def ausfuehren(m: Welt, a: dict) -> None:
    richtung, n = a.get("richtung"), a.get("kacheln")
    if richtung not in ("ost", "sued") or n not in (8, 16, 32):
        raise Abgelehnt("Die Karte wächst nach Osten oder Süden um 8, 16 oder 32 Kacheln.")
    alt_b, alt_h = m.breite, m.hoehe
    neu_b, neu_h = (alt_b + n, alt_h) if richtung == "ost" else (alt_b, alt_h + n)
    if neu_b > MAX_KARTE or neu_h > MAX_KARTE:
        raise Abgelehnt(f"Die Karte darf höchstens {MAX_KARTE} × {MAX_KARTE} Kacheln groß sein (jetzt {alt_b} × {alt_h}).")
    if richtung == "ost":
        for r in m.g:
            r.extend("." * n)
    else:
        m.g.extend(list("." * alt_b) for _ in range(n))
    ops = []
    for g in m.look["regions"]:
        fx, fy = g["frame"]
        b = g["bounds"]
        if richtung == "ost" and b.get("right") is not None and fx + b["right"] >= alt_b * T - 8:
            ops.append({"op": "bounds", "region": g["id"], "right": neu_b * T - fx})
        if richtung == "sued" and b.get("bottom") is not None and fy + b["bottom"] >= alt_h * T - 8:
            ops.append({"op": "bounds", "region": g["id"], "bottom": neu_h * T - fy})
    m.op(*ops)
    m.w["size"] = [neu_b, neu_h]


def startplatz(m: Welt, a: dict) -> None:
    t = a.get("tile")
    if m.spiel:
        raise Abgelehnt("Den Startplatz gibt es nur in der Welt-Werkstatt.")
    if not (isinstance(t, list) and len(t) == 2 and all(isinstance(v, int) for v in t)):
        raise Abgelehnt("Es fehlt die Kachel [x, y].")
    c = m.art(*t)
    if c not in ".,s_":
        raise Abgelehnt("Dort kann niemand stehen.", tuple(t))
    m.w["startplatz"] = list(t)
