"""Spike AP16a: Kacheln aus den gespeicherten Formen (`look`) ableiten, mit derselben Abtastung wie der Generator."""

import pytest

from simulacra.generator.edit.ableiten import ableiten
from simulacra.generator.generate import new_world
from simulacra.generator.stil import Stil

FAELLE = [(7, {}), (12, {}), (31, {}), (58, {}), (5, {"stil": Stil.of({"form": "anger"})}), (6, {"stil": Stil.of({"form": "fluss"})}), (9, {"stil": Stil.of({"form": "streu"})})]


def aussen(w: dict) -> tuple[int, int, int, int]:
    reg = w["look"]["regions"][0]
    fx, fy = reg["frame"]
    b = reg["bounds"]
    x0, y0 = max(0, (fx + b["left"] - 64) // 16), max(0, (fy - 96) // 16)
    x1, y1 = min(w["size"][0], (fx + b["right"] + 64) // 16), min(w["size"][1], (fy + b["bottom"] + 8) // 16)
    return x0, y0, x1 - x0, y1 - y0


@pytest.mark.parametrize("seed,kw", FAELLE, ids=[f"seed{s}" for s, _ in FAELLE])
def test_ableiten_gleich_generator(seed, kw):
    """Die Formen ergeben dieselben Kacheln wie der Generator; einzige Ausnahme ist der Waldpfad (`props.clearing` des Waldes), den keine Form beschreibt."""
    w, _ = new_world(seed, **kw)
    rect = aussen(w)
    got = ableiten(w["look"], rect)
    forest = next(l for l in w["locations"] if l["id"].endswith("forest"))
    cx, cy, cw, ch = forest["props"]["clearing"]
    bad = [(x, y) for (x, y), c in got.items() if w["tiles"][y][x] != c and not (cy <= y < cy + ch and cx <= x < cx + cw)]
    assert bad == []


def test_ableiten_nur_rechteck():
    w, _ = new_world(7)
    x, y, bw, bh = aussen(w)
    teil = ableiten(w["look"], (x + 3, y + 5, 10, 8))
    alles = ableiten(w["look"], (x, y, bw, bh))
    assert len(teil) == 80 and all(alles[t] == c for t, c in teil.items())
