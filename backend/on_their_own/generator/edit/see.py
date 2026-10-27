"""See ausheben (AP16a): eine Ellipse von der Mitte aus; Ufer (Sand) und Wasser kommen aus denselben Formen wie im Bild."""

from .modell import BODEN, Abgelehnt, Welt, T


def ausfuehren(m: Welt, a: dict) -> None:
    mx, my = a.get("mitte", [None, None])
    rx = a.get("rx", 3)
    ry = a.get("ry", rx * 0.75)
    if not (isinstance(mx, int) and isinstance(my, int) and isinstance(rx, (int, float)) and isinstance(ry, (int, float))) or not (1.5 <= rx <= 12 and 1.5 <= ry <= 12):
        raise Abgelehnt("Ein See braucht eine Mitte [x, y] und eine Größe von 1,5 bis 12 Kacheln.")
    g = m.gebiet(mx, my)
    cx, cy = mx * T + 8, my * T + 8
    prx, pry = rx * T, ry * T
    for y in range(int(my - ry * 1.4) - 1, int(my + ry * 1.4) + 2):
        for x in range(int(mx - rx * 1.4) - 1, int(mx + rx * 1.4) + 2):
            if not m.drin(x, y):
                if ((x * T + 8 - cx) / (prx * 1.3)) ** 2 + ((y * T + 8 - cy) / (pry * 1.3)) ** 2 < 1:
                    raise Abgelehnt("Der See würde über den Kartenrand reichen.", (x, y))
                continue
            if ((x * T + 8 - cx) / (prx * 1.3)) ** 2 + ((y * T + 8 - cy) / (pry * 1.3)) ** 2 < 1:
                if m.art(x, y) != "~":
                    m.frei(x, y, BODEN)
    item = {"x": round(cx - g["frame"][0]), "y": round(cy - g["frame"][1]), "rx": round(prx), "ry": round(pry)}
    m.mit_kacheln(lambda: m.op({"op": "add", "region": g["id"], "liste": "lakes", "item": item}), (cx - prx * 1.4, cy - pry * 1.4, cx + prx * 1.4, cy + pry * 1.4))
