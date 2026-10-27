"""Kachelraster mit Kachelarten (aus der Datenbank), Bewegungskosten, zusätzlichen Sperren und Übergängen.

Ein Übergang verbindet zwei Kacheln, die auf der Karte nicht nebeneinander liegen (z. B. Haustür draußen und Flur im
Innenbereich eines Hauses). Wegsuche und Bewegung gehen hindurch wie durch eine Nachbarkachel."""

from dataclasses import dataclass, field


@dataclass(frozen=True)
class TileType:
    id: str
    walkable: bool
    cost: int                 # Minuten je Kachel (nur sinnvoll, wenn begehbar)
    char: str | None = None
    color: str | None = None
    label: str = ""


@dataclass
class Grid:
    width: int
    height: int
    cells: list[list[str]]
    types: dict[str, TileType]
    blocked: set[tuple[int, int]] = field(default_factory=set)    # Objekte, verschlossene Türen
    forbidden: set[tuple[int, int]] = field(default_factory=set)  # Weltregeln (Bewegungsfreiheit)
    version: int = 0                                              # steigt bei jeder Änderung (Pfad-Cache)
    links: dict[tuple[int, int], list[tuple[int, int]]] = field(default_factory=dict)   # Übergänge, in beide Richtungen

    def in_bounds(self, x: int, y: int) -> bool:
        return 0 <= x < self.width and 0 <= y < self.height

    def tile(self, x: int, y: int) -> str:
        return self.cells[y][x]

    def set_tile(self, x: int, y: int, kind: str) -> None:
        self.cells[y][x] = kind
        self.version += 1

    def walkable(self, x: int, y: int) -> bool:
        return self.in_bounds(x, y) and self.types[self.cells[y][x]].walkable

    def is_open(self, x: int, y: int) -> bool:
        return self.walkable(x, y) and (x, y) not in self.blocked and (x, y) not in self.forbidden

    def cost(self, x: int, y: int) -> int:
        return self.types[self.cells[y][x]].cost

    def set_blocked(self, tiles: set[tuple[int, int]]) -> None:
        if tiles != self.blocked:
            self.blocked = tiles
            self.version += 1

    def set_forbidden(self, tiles: set[tuple[int, int]]) -> None:
        if tiles != self.forbidden:
            self.forbidden = tiles
            self.version += 1

    def set_links(self, pairs: list[list[list[int]]] | list[tuple[tuple[int, int], tuple[int, int]]]) -> None:
        """Übergänge setzen: Liste von Paaren [[x, y], [x, y]]; jedes Paar gilt in beide Richtungen."""
        links: dict[tuple[int, int], list[tuple[int, int]]] = {}
        for a, b in pairs:
            pa, pb = (int(a[0]), int(a[1])), (int(b[0]), int(b[1]))
            links.setdefault(pa, []).append(pb)
            links.setdefault(pb, []).append(pa)
        self.links = links
        self.version += 1

    def neighbors(self, x: int, y: int) -> list[tuple[int, int]]:
        """Nachbarkacheln (4er-Nachbarschaft) und Ziele von Übergängen, ohne Prüfung auf Begehbarkeit."""
        out = [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
        out += self.links.get((x, y), [])
        return out

    def adjacent(self, a: tuple[int, int], b: tuple[int, int]) -> bool:
        """Liegen a und b nebeneinander oder sind über einen Übergang verbunden?"""
        return abs(a[0] - b[0]) + abs(a[1] - b[1]) == 1 or b in self.links.get(a, [])

    @classmethod
    def from_rows(cls, rows: list[str], types: dict[str, TileType]) -> "Grid":
        by_char = {t.char: t.id for t in types.values() if t.char}
        return cls(len(rows[0]), len(rows), [[by_char[c] for c in row] for row in rows], types)
