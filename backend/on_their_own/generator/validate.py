"""Prüfung eines erzeugten Dorfs: nur was bespielbar ist, wird angeboten (Plan AP12, Abschnitt „Validierung“).

Die Prüfung läuft auf Weltdaten (Kachelzeilen, Orte, Objekte, Quellen, Übergänge, Gestaltung), nicht auf der Datenbank; so lässt sie sich
vor jedem Anwenden und in Tests über viele Seeds laufen lassen. Erreichbarkeit rechnet wie die Wegsuche der Engine (4er-Nachbarschaft,
Übergänge, gesperrte Kacheln von Möbeln).
"""

from collections import deque
from dataclasses import dataclass, field

from ..world import object_kinds
from .tiles import FENCE, TREE, WALL, WATER

OPEN = set(".,_+s")                                               # begehbare Kachelzeichen (wie die Kachelarten der Startwelt)
ID_ANY_MAX = 40


@dataclass
class Report:
    checks: list[dict] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.errors

    def check(self, name: str, passed: bool, detail: str = "") -> None:
        self.checks.append({"name": name, "ok": passed, "detail": detail})
        if not passed:
            self.errors.append(f"{name}: {detail}" if detail else name)

    def as_dict(self) -> dict:
        return {"ok": self.ok, "errors": self.errors, "checks": self.checks}


def reachable(rows: list[str], links: list, start: tuple[int, int], blocked: set[tuple[int, int]]) -> set[tuple[int, int]]:
    """Alle von `start` aus erreichbaren Kacheln (wie `Pathfinder`: 4er-Nachbarschaft plus Übergänge, Möbel sperren)."""
    h, w = len(rows), len(rows[0])
    nb: dict[tuple[int, int], list[tuple[int, int]]] = {}
    for a, b in links:
        nb.setdefault(tuple(a), []).append(tuple(b)); nb.setdefault(tuple(b), []).append(tuple(a))
    seen, q = {start}, deque([start])
    while q:
        x, y = q.popleft()
        for n in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1), *nb.get((x, y), [])):
            if n in seen or not (0 <= n[0] < w and 0 <= n[1] < h) or rows[n[1]][n[0]] not in OPEN or n in blocked:
                continue
            seen.add(n); q.append(n)
    return seen


def check_world(d: dict, start: tuple[int, int], taken_ids: set[str] | None = None, taken_names: set[str] | None = None, offset: tuple[int, int] = (0, 0),
                full_rows: list[str] | None = None, extra_links: list | None = None) -> Report:
    """`d`: Ergebnis von `compose.place` (Kacheln absolut). `start`: eine Kachel, von der aus alles erreichbar sein muss (z. B. der Dorfplatz oder ein
    Anschluss im Bestand). `full_rows`: das ganze Kachelraster der Welt samt diesem Dorf (bei Erweiterungen), sonst das Fragment selbst."""
    r = Report()
    rows = full_rows or d["rows"]
    ox, oy = (0, 0) if full_rows else (0, 0)
    w = len(rows[0])
    r.check("Kachelraster rechteckig", all(len(x) == w for x in rows))
    links = list(d["links"]) + list(extra_links or [])
    kinds = {o["id"]: o for o in d["objects"]}
    blocked = {tuple(o["tile"]) for o in d["objects"] if object_kinds.spec(o["kind"]).blocks and o["kind"] != "door"}
    inside = lambda t: 0 <= t[0] < w and 0 <= t[1] < len(rows)                                         # noqa: E731
    r.check("Startpunkt begehbar", inside(start) and rows[start[1]][start[0]] in OPEN, str(start))
    seen = reachable(rows, links, tuple(start), blocked) if r.ok else set()

    def reach(t) -> bool:
        t = tuple(t)
        return t in seen or any(n in seen for n in ((t[0] + 1, t[1]), (t[0] - 1, t[1]), (t[0], t[1] + 1), (t[0], t[1] - 1)))

    # Haustüren, Spielfiguren
    unreach = [str(l[0]) for l in d["links"] if not reach(l[0])]
    r.check("jede Haustür ist vom Startpunkt erreichbar", not unreach, ", ".join(unreach))
    for a, b in d["links"]:
        if not (inside(a) and inside(b) and rows[a[1]][a[0]] in OPEN and rows[b[1]][b[0]] in OPEN):
            r.check("Übergänge liegen auf begehbaren Kacheln", False, str((a, b)))
            break
    else:
        r.check("Übergänge liegen auf begehbaren Kacheln", True)
    for who, t in d["spots"].items():
        r.check(f"Startplatz {who} begehbar und erreichbar", inside(t) and rows[t[1]][t[0]] in OPEN and reach(t), str(t))
    # Quellen und Dinge
    bad_nodes = [n["id"] for n in d["resource_nodes"] if not (inside(n["tile"]) and rows[n["tile"][1]][n["tile"][0]] in OPEN and reach(n["tile"]))]
    r.check("jede Quelle liegt auf begehbarer, erreichbarer Kachel", not bad_nodes, ", ".join(bad_nodes[:6]))
    bad_amount = [n["id"] for n in d["resource_nodes"] if not (0 <= n["amount"] <= n["cap"] and n["cap"] > 0)]
    r.check("Mengen der Quellen gültig", not bad_amount, ", ".join(bad_amount))
    bad_obj = [o["id"] for o in d["objects"] if not inside(o["tile"]) or (o["kind"] not in ("boat", "well", "fishing_spot") and not reach(o["tile"]) and o["kind"] not in ("floor_lamp", "armchair", "wardrobe", "crate"))]
    r.check("jedes Ding ist erreichbar", not bad_obj, ", ".join(bad_obj[:6]))
    # Orte und IDs
    taken = set(taken_ids or [])
    ids = [x["id"] for x in d["locations"]] + [x["id"] for x in d["objects"]] + [x["id"] for x in d["resource_nodes"]]
    dup = sorted({i for i in ids if ids.count(i) > 1} | (set(ids) & taken))
    r.check("IDs eindeutig", not dup, ", ".join(dup[:6]))
    r.check("IDs nicht länger als 40 Zeichen", all(len(i) <= ID_ANY_MAX for i in ids))
    names = [x["name"] for x in d["locations"]]
    dupn = sorted({n for n in names if names.count(n) > 1} | (set(names) & set(taken_names or [])))
    r.check("Ortsnamen eindeutig", not dupn, ", ".join(dupn[:6]))
    overlap = _overlaps([x for x in d["locations"]])
    r.check("Orte überlappen sich nicht", not overlap, overlap)
    # Gebäude
    houses = d["region"]["houses"]
    r.check("jedes Gebäude hat eine Tür und Räume", all(h["door"] and h["interior"]["rooms"] for h in houses))
    by_loc: dict[str, set[str]] = {}
    for o in d["objects"]:
        by_loc.setdefault(next((l["id"] for l in d["locations"] if _in(l, o["tile"])), ""), set()).add(o["kind"])
    homes = [h for h in houses if any(k for k in h["interior"]["rooms"])]
    r.check("Wohnhäuser haben ein Bett", _every(d, "bedroom", "bed", by_loc))
    return r


def _in(loc: dict, t) -> bool:
    x, y, w, h = loc["rect"]
    return x <= t[0] < x + w and y <= t[1] < y + h


def _overlaps(locs: list[dict]) -> str:
    for i, a in enumerate(locs):
        for b in locs[i + 1:]:
            ax, ay, aw, ah = a["rect"]; bx, by, bw, bh = b["rect"]
            if ax < bx + bw and bx < ax + aw and ay < by + bh and by < ay + ah:
                return f"{a['id']} und {b['id']}"
    return ""


def _every(d: dict, room_kind: str, kind: str, by_loc: dict) -> bool:
    """Jeder Raum der Art (aus dem Namen erkennbar: „Schlafzimmer“, „Kammer“ …) hat ein Objekt der Art `kind`."""
    words = {"bedroom": ("Schlafzimmer", "Gästezimmer", "Kammer"), "kitchen": ("Küche",)}[room_kind]
    for l in d["locations"]:
        if l["id"].startswith("house.") and any(l["name"].startswith(w) for w in words) and not l["name"].startswith("Vorratskammer"):
            if kind not in by_loc.get(l["id"], set()):
                return False
    return True
