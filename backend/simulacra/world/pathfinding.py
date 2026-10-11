"""A* auf dem Kachelraster (4er-Nachbarschaft) mit Ergebnis-Cache je Rasterversion."""

import heapq

from .grid import Grid

Pos = tuple[int, int]


class Pathfinder:
    def __init__(self, grid: Grid, cache_size: int = 2048):
        self.grid = grid
        self._cache: dict[tuple[Pos, Pos], list[Pos] | None] = {}
        self._version = grid.version
        self._cache_size = cache_size

    def find(self, start: Pos, goal: Pos) -> list[Pos] | None:
        """Pfad ohne Startkachel bis einschließlich Ziel; None, wenn unerreichbar."""
        if self._version != self.grid.version:
            self._cache.clear()
            self._version = self.grid.version
        key = (start, goal)
        if key in self._cache:
            return self._cache[key]
        path = self._search(start, goal)
        if len(self._cache) >= self._cache_size:
            self._cache.clear()
        self._cache[key] = path
        return path

    def _search(self, start: Pos, goal: Pos) -> list[Pos] | None:
        g = self.grid
        if start == goal:
            return []
        if not g.is_open(*goal):
            return None
        open_heap: list[tuple[int, int, Pos]] = [(0, 0, start)]
        best = {start: 0}
        came: dict[Pos, Pos] = {}
        counter = 0
        while open_heap:
            _, _, cur = heapq.heappop(open_heap)
            if cur == goal:
                path = [cur]
                while path[-1] in came:
                    path.append(came[path[-1]])
                path.reverse()
                return path[1:]
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = cur[0] + dx, cur[1] + dy
                if not g.is_open(nx, ny):
                    continue
                cost = best[cur] + g.cost(nx, ny)
                if cost < best.get((nx, ny), 1 << 30):
                    best[(nx, ny)] = cost
                    came[(nx, ny)] = cur
                    counter += 1
                    h = abs(nx - goal[0]) + abs(ny - goal[1])  # zulässig: Mindestkosten je Kachel = 1
                    heapq.heappush(open_heap, (cost + h, counter, (nx, ny)))
        return None
