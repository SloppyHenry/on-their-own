"""Zufallsfolge wie `wRng` in world.js (mulberry32): unabhängig von der Python-Version, damit Seeds immer dasselbe Dorf ergeben."""

import math

M = 0xFFFFFFFF


def _imul(a: int, b: int) -> int:
    return (a * b) & M


class Rng:
    def __init__(self, seed: int):
        self.a = seed & M

    def random(self) -> float:
        self.a = (self.a + 0x6D2B79F5) & M
        t = _imul(self.a ^ (self.a >> 15), 1 | self.a)
        t = ((t + _imul(t ^ (t >> 7), 61 | t)) & M) ^ t
        return ((t ^ (t >> 14)) & M) / 4294967296

    def rnd(self, a: float, b: float) -> float:
        return a + self.random() * (b - a)

    def pick(self, seq):
        return seq[math.floor(self.random() * len(seq))]

    def shuffle(self, seq: list) -> list:
        out = list(seq)
        for i in range(len(out) - 1, 0, -1):
            j = math.floor(self.random() * (i + 1))
            out[i], out[j] = out[j], out[i]
        return out


def jr(x: float) -> int:
    """Runden wie `Math.round` (halbe Werte nach oben)."""
    return math.floor(x + 0.5)
