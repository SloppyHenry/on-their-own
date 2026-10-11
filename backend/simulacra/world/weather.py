"""Wetter: Zustand mit Dauer, deterministische natürliche Wechsel, Wirkungen auf Welt und Aktionen."""

import random

KINDS = ("clear", "cloudy", "rain", "storm", "fog", "snow")
MOVE_MULT = {"clear": 1.0, "cloudy": 1.0, "rain": 1.25, "storm": 1.6, "fog": 1.1, "snow": 1.5}
WATERS_PLANTS = {"rain", "storm"}
BLOCKS_PLANTING = {"storm"}
BLOCKS_OUTDOOR_BUILD = {"storm"}
# Gewichte für den Folgezustand
_NEXT = {
    "clear": {"clear": 5, "cloudy": 4, "fog": 1},
    "cloudy": {"clear": 3, "cloudy": 3, "rain": 3, "fog": 1},
    "rain": {"cloudy": 4, "rain": 3, "storm": 1, "clear": 1},
    "storm": {"rain": 5, "cloudy": 3},
    "fog": {"clear": 4, "cloudy": 3},
    "snow": {"cloudy": 4, "snow": 3, "clear": 1},
}


def next_weather(seed: int, minute: int, current: str) -> tuple[str, int]:
    """Folgewetter und Dauer in Minuten, rein aus (Seed, Zeitpunkt) bestimmt."""
    rng = random.Random(f"{seed}:{minute}")
    kinds, weights = zip(*_NEXT[current].items())
    return rng.choices(kinds, weights)[0], rng.randrange(120, 601, 30)
