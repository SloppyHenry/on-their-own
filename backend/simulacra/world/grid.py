"""Kachelraster mit Kachelarten (aus der Datenbank), Bewegungskosten und zusätzlichen Sperren."""

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

    @classmethod
    def from_rows(cls, rows: list[str], types: dict[str, TileType]) -> "Grid":
        by_char = {t.char: t.id for t in types.values() if t.char}
        return cls(len(rows[0]), len(rows), [[by_char[c] for c in row] for row in rows], types)
