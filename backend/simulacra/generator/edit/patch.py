"""Aus Weltdatei vorher und nachher einen Patch machen (AP16a): ein Entwurf ergibt **einen** Patch für `engine.edit.apply_patch`.

Kacheln als Streifen je Zeile, neue und entfernte Orte, Dinge, Quellen und Übergänge, die Operationen an der Gestaltung (`look.ops`) und, wenn die Karte wächst, `extend_map`
(mit der Kachelart, die in der neuen Fläche überwiegt). Reihenfolge der Anwendung: Karte, Entfernen, Kacheln, Orte, Dinge, Quellen, Übergänge, Gestaltung.
"""

import hashlib
import json
from collections import Counter

ANYWHERE = {"boat", "well", "fishing_spot", "floor_lamp", "armchair", "wardrobe", "crate", "board"}


def _key(o: dict) -> str:
    return json.dumps(o, sort_keys=True, ensure_ascii=False)


def _neu(vorher: list[dict], nachher: list[dict]) -> tuple[list[dict], list[str]]:
    """(hinzugekommen oder geändert, entfernt oder geändert als IDs)."""
    alt = {o["id"]: _key(o) for o in vorher}
    neu = {o["id"]: _key(o) for o in nachher}
    add = [o for o in nachher if alt.get(o["id"]) != _key(o)]
    rem = [i for i in alt if neu.get(i) != alt[i]]
    return add, rem


def kachelart(w: dict) -> dict[str, str]:
    return {t["char"]: n for n, t in w["tile_types"].items() if t.get("char")}


def patch_aus(vorher: dict, nachher: dict, ops: list[dict], aktionen: list[dict] | None = None, beschreibung: str = "Gestalten") -> dict:
    by_char = kachelart(vorher)
    ow, oh = len(vorher["tiles"][0]), len(vorher["tiles"])
    nw, nh = len(nachher["tiles"][0]), len(nachher["tiles"])
    patch: dict = {"description": beschreibung}
    fill = None
    if (nw, nh) != (ow, oh):
        neu_zellen = Counter(nachher["tiles"][y][x] for y in range(nh) for x in range(nw) if x >= ow or y >= oh)
        fill = neu_zellen.most_common(1)[0][0]
        patch["extend_map"] = {"width": nw, "height": nh, "fill": by_char[fill]}
    rem: dict[str, list] = {}
    locs, loc_rem = _neu(vorher["locations"], nachher["locations"])
    objs, obj_rem = _neu(vorher["objects"], nachher["objects"])
    nodes, node_rem = _neu(vorher["resource_nodes"], nachher["resource_nodes"])
    for name, ids in (("locations", loc_rem), ("objects", obj_rem), ("resource_nodes", node_rem)):
        if ids:
            rem[name] = ids
    vl, nl = [json.dumps(p) for p in vorher.get("links", [])], [json.dumps(p) for p in nachher.get("links", [])]
    if [p for p in vorher.get("links", []) if json.dumps(p) not in nl]:
        rem["links"] = [p for p in vorher.get("links", []) if json.dumps(p) not in nl]
    if rem:
        patch["remove"] = rem
    runs = []
    for y in range(nh):
        a = vorher["tiles"][y] if y < oh else None
        b = nachher["tiles"][y]
        x = 0
        while x < nw:
            alt = a[x] if a is not None and x < ow else fill
            if b[x] == alt:
                x += 1
                continue
            e = x
            while e + 1 < nw and b[e + 1] == b[x] and (a[e + 1] if a is not None and e + 1 < ow else fill) != b[e + 1]:
                e += 1
            runs.append({"rect": [x, y, e - x + 1, 1], "type": by_char[b[x]]})
            x = e + 1
    if runs:
        patch["tiles"] = runs
    if locs:
        patch["locations"] = locs
    if objs:
        patch["objects"] = [{**o, "anywhere": True} if o["kind"] in ANYWHERE else o for o in objs]
    if nodes:
        patch["resource_nodes"] = nodes
    add_links = [p for p in nachher.get("links", []) if json.dumps(p) not in vl]
    if add_links:
        patch["links"] = add_links
    if ops:
        patch["look"] = {"ops": ops}
    if len(nachher["objects"]) > 150:
        patch["max_objects"] = 500
    h = hashlib.sha256(json.dumps([aktionen, patch], sort_keys=True, ensure_ascii=False).encode()).hexdigest()[:12]
    return {"id": f"gestalten-{h}", **patch}
