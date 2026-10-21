"""Gebiet erzeugen (AP18e, Werkzeug der Welt-Werkstatt): ein Dorf an eine gewählte Stelle einer bestehenden Welt setzen, ohne Landstraße.

Wie `extension_patch` (dasselbe Dorf, derselbe Patch), aber das Dorf liegt mit seiner linken oberen Ecke auf `at` (Kachel) und überschreibt nur Wiese und Wald; wo Wege, Wasser,
Mauern oder Orte stehen, wird abgelehnt. Die Karte wächst, wenn das Dorf über den Rand reicht.
"""

import math

from .compose import T, build_village, place
from .generate import MAX_MAP, TILE_TYPES, TRIES, GenerationError, WorldInfo, _obj
from .layout import Params
from .names import Naming, village_name
from .rng import Rng
from .stil import Stil
from .validate import Report, check_world

FREE = ".T"                                                         # Wiese und Wald dürfen einem Dorf weichen


def area_patch(info: WorldInfo, seed: int, at: tuple[int, int], *, lake: str = "auto", mix: dict[str, int] | None = None, stil: Stil | None = None) -> tuple[dict, Report]:
    """Ohne `stil` entscheidet der Seed über die Dorfform (alle sechs): jedes Gebiet sieht anders aus."""
    regions = info.look["regions"]
    n = 2
    while f"v{n}" in {r["id"] for r in regions} or any(i.startswith(f"v{n}_") or i.startswith(f"v{n}.") for i in info.ids):
        n += 1
    prefix, last = f"v{n}", None
    tx0, ty0 = at
    if tx0 < 0 or ty0 < 0 or tx0 >= info.size[0] or ty0 >= info.size[1]:
        raise GenerationError("Der gewählte Punkt liegt außerhalb der Karte.")
    for attempt in range(TRIES):
        s = seed + attempt * 1000003
        vn = village_name(Rng(s), {nm.split(" bei ")[-1].split(" in ")[-1].replace("Platz von ", "") for nm in info.names})
        v = build_village(Params(s, lake, mix, home=False, stil=stil or Stil(form="zufall")), Naming(prefix, vn), vn)
        d = place(v, tx0, ty0)
        W, H = d["size"]
        newW, newH = max(info.size[0], tx0 + W), max(info.size[1], ty0 + H)
        if newW > MAX_MAP or newH > MAX_MAP:
            raise GenerationError(f"Die Karte würde {newW}×{newH} Kacheln groß; erlaubt sind {MAX_MAP}×{MAX_MAP}.")
        busy = sorted({(x, y) for y in range(ty0, min(ty0 + H, info.size[1])) for x in range(tx0, min(tx0 + W, info.size[0])) if info.rows[y][x] not in FREE})
        if busy:
            raise GenerationError(f"Hier ist nicht genug freie Fläche ({W}×{H} Kacheln ab {tx0},{ty0}): bei {busy[0][0]},{busy[0][1]} steht schon etwas. Wiese und Wald weichen, Wege, Wasser und Häuser nicht.")
        rows = [r.ljust(newW, ".") for r in info.rows] + ["." * newW for _ in range(newH - info.size[1])]
        for j, r in enumerate(d["rows"]):
            rows[ty0 + j] = rows[ty0 + j][:tx0] + r + rows[ty0 + j][tx0 + W:]
        region = d["region"]
        sq = region["shapes"]["squares"][0]
        start = (math.floor((region["frame"][0] + sq["x"]) / T), math.floor((region["frame"][1] + sq["y"] + sq["r"] + 4) / T))
        rep = check_world(d, start, taken_ids=info.ids, taken_names=info.names, full_rows=rows)
        last = rep
        if not rep.ok:
            continue
        patch = {"id": f"gebiet-{prefix}-{seed}", "description": f"Neues Dorf {vn} (Seed {s})", "max_objects": 500,
                 "tile_types": {k: t for k, t in TILE_TYPES.items() if k not in info.char_of},
                 "tiles": [{"at": [tx0, ty0], "rows": d["rows"]}],
                 "locations": d["locations"], "objects": [_obj(o) for o in d["objects"]], "resource_nodes": d["resource_nodes"], "links": d["links"],
                 "look": {"regions": [region], "roads": []}}
        if (newW, newH) != tuple(info.size):
            patch["extend_map"] = {"width": newW, "height": newH, "fill": "grass"}
        return {k: v_ for k, v_ in patch.items() if v_ not in ({}, [])}, rep
    raise GenerationError(f"Kein gültiges Dorf nach {TRIES} Versuchen (Seed {seed})." + (f" Zuletzt: {last.errors[0]}" if last and last.errors else ""), last)
