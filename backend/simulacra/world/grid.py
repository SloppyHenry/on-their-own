"""Kachelraster mit Kachelarten, Bewegungskosten und zusätzlichen Sperren."""

from dataclasses import dataclass, field

TILE_PROPS: dict[str, tuple[bool, int]] = {  # Art -> (begehbar, Kosten in Minuten)
    "grass": (True, 2), "path": (True, 1), "floor": (True, 1), "door": (True, 1), "sand": (True, 2),
    "wall": (False, 0), "water": (False, 0), "tree": (False, 0),
}
LEGEND = {".": "grass", ",": "path", "_": "floor", "#": "wall", "~": "water", "T": "tree", "+": "door", "s": "sand"}


@dataclass
class Grid:
    width: int
    height: int
    cells: list[list[str]]
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
        return self.in_bounds(x, y) and TILE_PROPS[self.cells[y][x]][0]

    def is_open(self, x: int, y: int) -> bool:
        return self.walkable(x, y) and (x, y) not in self.blocked and (x, y) not in self.forbidden

    def cost(self, x: int, y: int) -> int:
        return TILE_PROPS[self.cells[y][x]][1]

    def set_blocked(self, tiles: set[tuple[int, int]]) -> None:
        if tiles != self.blocked:
            self.blocked = tiles
            self.version += 1

    def set_forbidden(self, tiles: set[tuple[int, int]]) -> None:
        if tiles != self.forbidden:
            self.forbidden = tiles
            self.version += 1

    @classmethod
    def from_rows(cls, rows: list[str]) -> "Grid":
        return cls(len(rows[0]), len(rows), [[LEGEND[c] for c in row] for row in rows])
