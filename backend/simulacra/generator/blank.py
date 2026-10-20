"""Leere Welt (AP18e): nur Wiese, wahlweise mit Waldrand, ohne Häuser und ohne Startplatz. Der Ausgangspunkt der Welt-Werkstatt (Editoren › Welten › Leere Welt).

Die Gestaltung (`look`) ist ein einziges Gebiet über die ganze Karte, damit die Ansicht nach Mockup A die Wiese zeichnet; Bäume am Rand stehen als Kacheln (`tree`, nicht begehbar)
und als Deko. Wege, Seen, Häuser usw. kommen mit den Werkzeugen der Werkstatt (AP16) oder mit „Gebiet erzeugen“.
"""

from typing import Any

from ..world import loader

SIZES = {"klein": (48, 32), "mittel": (96, 60), "gross": (128, 80)}
EDGES = ("wald", "offen")
T = 16


def blank_world(name: str = "Neue Welt", size: str = "mittel", edge: str = "wald") -> dict[str, Any]:
    if size not in SIZES or edge not in EDGES:
        raise ValueError(f"Unbekannte Größe oder Rand (Größe: {', '.join(SIZES)}; Rand: {', '.join(EDGES)}).")
    W, H = SIZES[size]
    tpl = loader.load_world_file(loader.DATA_DIR / "world_default.json")
    by = {n: t["char"] for n, t in tpl["tile_types"].items()}
    rows, decor = [], []
    for y in range(H):
        row = ""
        for x in range(W):
            rim = edge == "wald" and (x in (0, W - 1) or y in (0, H - 1))
            row += by["tree"] if rim else by["grass"]
            if rim and (x + y) % 2 == 0:
                decor.append(["pine" if (x * 3 + y) % 3 == 0 else "tree", x * T + 8, y * T + T - 2, (x * 7 + y * 5) % 7])
        rows.append(row)
    region = {"id": "welt", "frame": [0, 0], "bounds": {"left": 0, "right": W * T, "top": 0, "bottom": H * T},
              "shapes": {"paths": [], "squares": [], "lakes": [], "gardens": [], "docks": [], "streams": [], "bridges": [], "pads": []},
              "decor": decor, "lights": [], "place": {}, "houses": []}
    home = [W // 2, H // 2]
    look = {"version": 2, "style": "mockup-a", "texShift": [0, 0], "legacy": None, "home": [home[0] * T + 8, home[1] * T + 8], "regions": [region], "roads": []}
    locations = [{"id": "paths", "name": "Wege und Wiesen", "rect": [0, 0, W, H], "entrances": [], "extra_tiles": [],
                  "props": {"fallback": True, "to": "auf die Wege", "at": "auf den Wegen", "themes": []}}]
    return {"schema": tpl["schema"], "home": home, "tile_types": tpl["tile_types"], "name": name, "size": [W, H], "tiles": rows, "locations": locations, "objects": [],
            "resource_nodes": [], "agents": [], "start": tpl["start"], "links": [], "look": look, "startplatz": None}
