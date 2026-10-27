"""Garten setzen (AP16a): ein Rechteck mit Zaun an drei Seiten (die Südseite bleibt offen) und Beeten, dazu Beet-Objekte zum Säen (wie die Gärten des Generators)."""

from .modell import Abgelehnt, Welt, T


def beete(x0: int, y0: int, w: int, reihen: int) -> list[list[int]]:
    return [[x0 + 8, y0 + 7 + 14 * r, w - 16, 9] for r in range(reihen)]


def ausfuehren(m: Welt, a: dict) -> None:
    r = a.get("rechteck")
    if not (isinstance(r, list) and len(r) == 4 and all(isinstance(v, int) and not isinstance(v, bool) for v in r)) or r[2] < 3 or r[3] < 3 or r[2] > 20 or r[3] > 14:
        raise Abgelehnt("Ein Garten braucht ein Rechteck [x, y, Breite, Höhe] von 3 × 3 bis 20 × 14 Kacheln.")
    x, y, w, h = r
    for j in range(y - 1, y + h + 1):
        for i in range(x - 1, x + w + 1):
            m.frei(i, j)
    g = m.gebiet(x, y)
    fx, fy = g["frame"]
    x0, y0, pw, ph = x * T - fx, y * T - fy, w * T, h * T
    garten = {"x0": x0, "y0": y0, "x1": x0 + pw, "y1": y0 + ph, "beds": beete(x0, y0, pw, max(1, (ph - 8) // 14))}
    zaun = []
    px = x0
    while px < x0 + pw - 4:
        zaun.append(["fence", px + 7, y0, 0])
        px += 12
    py = y0 + 8
    while py < y0 + ph - 6:
        zaun += [["post", x0, py, 0], ["post", x0 + pw, py, 0]]
        py += 8
    nr = m.neue_id()
    dinge, plaetze = [], {}
    benutzt: set[tuple[int, int]] = set()
    for rr, bed in enumerate(garten["beds"][:3]):
        for c in range(max(1, min(3, bed[2] // 22))):
            bx, by = bed[0] + 12 + 20 * c, bed[1] + 4
            t = ((bx + fx) // T, (by + fy) // T)
            if t in benutzt or m.art(*t) != "." or m.belegung(*t):
                continue
            benutzt.add(t)
            oid = f"{nr}_seedbed_{rr}_{c}"
            dinge.append({"id": oid, "kind": "seedbed", "name": "Beet", "tile": [t[0], t[1]]})
            plaetze[oid] = {"at": [bx, by], "sprite": "none", "e": 0}
    m.w["objects"].extend(dinge)

    def tun():
        m.op({"op": "add", "region": g["id"], "liste": "gardens", "item": garten}, *({"op": "add", "region": g["id"], "liste": "decor", "item": d} for d in zaun),
             *({"op": "place", "region": g["id"], "id": k, "value": v} for k, v in plaetze.items()))
    m.mit_kacheln(tun, (x * T - 8, y * T - 8, (x + w) * T + 8, (y + h) * T + 8))
