"""Arbeitsmodell der Gestalten-Aktionen (AP16a): eine Kopie der Weltdatei mit veränderbarem Kachelraster, den Operationen an der Gestaltung und Hilfen für die Aktionen.

Alle Koordinaten der Aktionen sind Kacheln der Welt; die Formen der Gestaltung liegen in Dorfkoordinaten ihres Gebiets (Weltpixel − `frame`). Eine Aktion, die nicht geht, wirft `Abgelehnt` mit Grund
und Kachel; das Modell kehrt dann zum Stand vor der Aktion zurück (`sichern` / `zurueck`). Kacheln ändern sich nur dort, wo sich das Ableiten aus den Formen vor und nach der Aktion unterscheidet.
"""

import copy
import math
from dataclasses import dataclass
from typing import Any

from ...world import look as lk
from ...world import look_ops as lo
from ...world.build_look import _region
from ..tiles import DOOR, FENCE, TREE, WALL, WATER
from . import ableiten as ab

T = 16
OFFEN = set(".,_+s")                                   # begehbare Kachelzeichen
BODEN = {".", ",", "s"}                                # freier Boden: Wiese, Weg, Sand
GRUND = {WALL: "Dort ist eine Mauer", WATER: "Dort ist Wasser", TREE: "Dort steht ein Baum", FENCE: "Dort steht ein Zaun", DOOR: "Dort ist eine Tür", "m": "Dort steht ein Möbel", "_": "Dort ist ein Fußboden"}


class Abgelehnt(Exception):
    """Die Aktion geht nicht: `grund` für den Cursor, `kachel` der Ort (Kachel der Welt)."""

    def __init__(self, grund: str, kachel: tuple[int, int] | None = None):
        super().__init__(grund)
        self.grund, self.kachel = grund, kachel


@dataclass
class Spur:
    ops: list
    stand: tuple


class Welt:
    def __init__(self, w: dict[str, Any], belegt: dict[tuple[int, int], str] | None = None, spiel: bool = False):
        self.w = copy.deepcopy(w)
        self.g = [list(r) for r in self.w["tiles"]]
        self.ops: list[dict] = []                      # alle Operationen an der Gestaltung (für den Patch und das Ereignis)
        self.belegt = belegt or {}                     # Kacheln mit Figuren (nur im Spiel): Name
        self.spiel = spiel
        if not isinstance(self.w.get("look"), dict) or not self.w["look"]:
            raise Abgelehnt("Diese Welt hat keine Gestaltung (look); dort lässt sich nichts gestalten.")
        if not lk.is_v2(self.w["look"]):
            self.w["look"] = lk.upgrade_v1(self.w["look"])                    # wie die Engine beim ersten Ändern
        self.look = self.w["look"]

    # --- Zustand ------------------------------------------------------------------------------------------
    @property
    def breite(self) -> int:
        return len(self.g[0])

    @property
    def hoehe(self) -> int:
        return len(self.g)

    def sichern(self) -> tuple:
        return copy.deepcopy((self.w, self.g, self.ops)), None

    def zurueck(self, s: tuple) -> None:
        (self.w, self.g, self.ops), _ = s
        self.look = self.w["look"]

    def fertig(self) -> dict[str, Any]:
        self.w["tiles"] = ["".join(r) for r in self.g]
        self.w["size"] = [self.breite, self.hoehe]
        return self.w

    # --- Fragen -------------------------------------------------------------------------------------------
    def drin(self, x: int, y: int) -> bool:
        return 0 <= x < self.breite and 0 <= y < self.hoehe

    def art(self, x: int, y: int) -> str:
        if not self.drin(x, y):
            raise Abgelehnt("Das liegt außerhalb der Karte.", (x, y))
        return self.g[y][x]

    def gebiet(self, x: int, y: int) -> dict:
        return _region(self.look, x, y)

    def objekte_bei(self, x: int, y: int) -> list[dict]:
        return [o for o in self.w["objects"] if o["tile"] == [x, y]]

    def belegung(self, x: int, y: int) -> str | None:
        """Was auf der Kachel steht, das man nicht überbauen darf: ein Ding, eine Quelle, ein Übergang oder (im Spiel) eine Figur."""
        if (x, y) in self.belegt:
            return f"Dort steht {self.belegt[(x, y)]}"
        o = self.objekte_bei(x, y)
        if o:
            return f"Dort steht {o[0]['name']}"
        if any(n["tile"] == [x, y] for n in self.w["resource_nodes"]):
            return "Dort ist eine Quelle"
        if any([x, y] in (a, b) for a, b in self.w.get("links", [])):
            return "Dort ist eine Tür"
        return None

    def frei(self, x: int, y: int, erlaubt: set[str] = BODEN) -> None:
        """Wirft `Abgelehnt`, wenn die Kachel nicht aus freiem Boden besteht oder belegt ist."""
        c = self.art(x, y)
        if c not in erlaubt:
            raise Abgelehnt(GRUND.get(c, "Dort geht das nicht."), (x, y))
        b = self.belegung(x, y)
        if b:
            raise Abgelehnt(b, (x, y))

    def pixel(self, x: float, y: float, gebiet: dict) -> list[float]:
        """Weltpixel (aus Kachelkoordinaten ×16) in Dorfkoordinaten des Gebiets."""
        return [x - gebiet["frame"][0], y - gebiet["frame"][1]]

    def neue_id(self) -> str:
        ids = {l["id"] for l in self.w["locations"]} | {o["id"] for o in self.w["objects"]} | {n["id"] for n in self.w["resource_nodes"]}
        n = 1
        while any(i == f"e{n}" or i.startswith((f"e{n}_", f"e{n}.", f"e{n}h", f"house.e{n}")) for i in ids) or n in self.w.setdefault("_e", []):
            n += 1
        self.w["_e"].append(n)
        return f"e{n}"

    # --- Gestaltung ändern ----------------------------------------------------------------------------------
    def op(self, *ops: dict) -> None:
        lo.apply(self.look, list(ops))
        self.ops.extend(ops)

    def mit_kacheln(self, aktion, box: tuple[float, float, float, float]) -> None:
        """Führt `aktion()` aus (ändert die Gestaltung über `op`) und leitet die Kacheln im Rechteck `box` (Weltpixel x0, y0, x1, y1) neu ab. Wirft `Abgelehnt`,
        wenn dabei etwas Belegtes unbegehbar würde."""
        rect = (math.floor(box[0] / T) - 1, math.floor(box[1] / T) - 1, math.ceil(box[2] / T) - math.floor(box[0] / T) + 3, math.ceil(box[3] / T) - math.floor(box[1] / T) + 3)
        x0, y0 = max(0, rect[0]), max(0, rect[1])
        rect = (x0, y0, max(1, min(rect[0] + rect[2], self.breite) - x0), max(1, min(rect[1] + rect[3], self.hoehe) - y0))
        vorher = copy.deepcopy(self.look)
        aktion()
        for (x, y), c in ab.unterschied(vorher, self.look, rect).items():
            if c not in OFFEN and self.g[y][x] in OFFEN:
                b = self.belegung(x, y)
                if b:
                    raise Abgelehnt(b, (x, y))
            self.g[y][x] = c

    def setze_zeile(self, x: int, y: int, text: str) -> None:
        self.g[y][x:x + len(text)] = list(text)
