"""Deutsche Namen für Dörfer, Häuser und Orte (aus dem Seed gewählt, je Dorf ohne Wiederholung) und die Namensräume der IDs."""

from dataclasses import dataclass

from .rng import Rng

VILLAGES = ["Birkenau", "Eschenbach", "Lindental", "Weidenfeld", "Haselbach", "Erlenhof", "Tannenau", "Buchenried", "Ahornthal", "Kastanienhain", "Wiesenburg", "Eichenrode",
            "Mühlbach", "Rosenfeld", "Silberbach", "Lerchenberg", "Fischerau", "Hirschfeld", "Nebelmoor", "Sonnenhang", "Kieselbrunn", "Immenhof", "Falkenried",
            "Grünwinkel", "Hopfenau", "Quellenthal", "Schwanenteich", "Storchenwiese", "Heidehausen", "Brombeerhain", "Alte Furt", "Wacholderhöhe", "Krähenbusch", "Rehwiese",
            "Bernsteinau", "Klosterbrunn", "Gänsebach", "Weißdorn", "Mondscheinau", "Lindenhagen", "Schilfrode", "Honigtal", "Wolkenstein am Bach"]
HOUSES = ["Haus Birke", "Haus Eiche", "Haus Linde", "Haus Ahorn", "Haus Erle", "Haus Weide", "Haus Hasel", "Haus Esche", "Haus Buche", "Haus Tanne", "Haus Kastanie", "Haus Pappel"]
SHOPS = ["Dorfladen", "Kramladen", "Krämerei", "Laden zur Linde"]
WORKSHOPS = ["Schreinerei", "Werkstatt am Bach", "Töpferei", "Schmiede"]
BARNS = ["Große Scheune", "Heuscheune"]
STABLES = ["Pferdestall", "Stall am Hang"]


def village_name(rng: Rng, taken: set[str]) -> str:
    free = [v for v in VILLAGES if v not in taken] or [f"{v} II" for v in VILLAGES]
    return rng.pick(free)


def building_names(roles: list[str], rng: Rng) -> list[str]:
    """Ein Name je Gebäude (gleiche Reihenfolge wie `roles`)."""
    pools = {"house": rng.shuffle(HOUSES), "shop": rng.shuffle(SHOPS), "workshop": rng.shuffle(WORKSHOPS), "barn": rng.shuffle(BARNS), "stable": rng.shuffle(STABLES)}
    used = {k: 0 for k in pools}
    out = []
    for r in roles:
        k = "house" if r == "home" else r
        out.append("Heimhaus" if r == "home" else pools[k][used[k] % len(pools[k])] + ("" if used[k] < len(pools[k]) else " II"))
        used[k] += 1
    return out


@dataclass(frozen=True)
class Naming:
    """IDs eines Dorfs: `prefix` leer = die Rollen der Startwelt (square, garden, lake …), sonst z. B. „v2“ (v2.square, v2_boat)."""
    prefix: str = ""
    village: str = ""

    @property
    def canonical(self) -> bool:
        return not self.prefix

    def loc(self, name: str) -> str:
        return name if self.canonical else f"{self.prefix}.{name}"

    def obj(self, name: str) -> str:
        return name if self.canonical else f"{self.prefix}_{name}"

    def house_loc(self, n: int) -> str:
        return f"house.{self.prefix}h{n}" if self.prefix else f"house.h{n}"

    def house_obj(self, n: int) -> str:
        return f"{self.prefix}h{n}" if self.prefix else f"h{n}"

    def region(self) -> str:
        return "dorf" if self.canonical else self.prefix
