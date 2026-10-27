"""Freie Dorfformen (AP18f): Anger, Fluss quer und Streusiedlung. Jede ist bespielbar, hängt vom Seed ab (verschiedene Seeds, verschiedene Dörfer) und bleibt bei gleichem Seed gleich."""

import math

import pytest

from on_their_own.generator.generate import dumps, new_world
from on_their_own.generator.stil import ECHTE_FORMEN, Stil, echte_form

NEU = ("anger", "fluss", "streu")


def people(n):
    return [{"id": f"r{i}", "name": f"R{i}", "home": None} for i in range(n)]


def houses(w):
    return [tuple(h["at"]) for h in w["look"]["regions"][0]["houses"]]


@pytest.mark.parametrize("form", NEU)
def test_jede_form_ist_bespielbar_und_alle_gebaeude_passen(form):
    for seed in (1, 2, 3, 4):
        w, rep = new_world(seed, residents=people(4), stil=Stil(form=form))
        assert rep.ok, rep.errors
        assert not any(c["name"].startswith("Gebäude:") for c in rep.checks)                    # nichts blieb übrig
        assert len(houses(w)) == 4 // 2 + 2                                                    # zwei Wohnhäuser, Werkstatt, Laden
        assert w["generator"]["stil"] == {"form": form}


@pytest.mark.parametrize("form", NEU)
def test_gleicher_seed_gleiches_dorf_andere_seeds_andere_doerfer(form):
    st = Stil(form=form)
    a, _ = new_world(7, residents=people(4), stil=st)
    b, _ = new_world(7, residents=people(4), stil=st)
    assert dumps(a) == dumps(b)
    lagen = {tuple(sorted(houses(new_world(s, residents=people(4), stil=st)[0]))) for s in range(1, 9)}
    assert len(lagen) == 8                                                                     # kein Dorf gleicht dem anderen


def test_anger_hat_ringstrassen_um_die_wiese():
    for seed in (1, 5, 9):
        w, rep = new_world(seed, residents=people(6), stil=Stil(form="anger"))
        S = w["look"]["regions"][0]["shapes"]
        sq = S["squares"][0]
        ringe = [p for p in S["paths"] if len(p) > 20 and p[0] == p[-1]]                       # geschlossene Linien
        assert ringe and all(math.hypot(x - sq["x"], y - sq["y"]) > sq["r"] for x, y in ringe[0])
        d = [math.hypot(x - sq["x"], (y - sq["y"]) * 1.2) for x, y in ringe[0]]
        assert max(d) - min(d) < 60                                                            # rundherum ungefähr gleich weit vom Platz


def test_fluss_quer_hat_wasser_ueber_die_ganze_breite_und_eine_bruecke():
    for seed in (1, 4, 8):
        w, rep = new_world(seed, residents=people(6), stil=Stil(form="fluss"))
        S = w["look"]["regions"][0]["shapes"]
        b = w["look"]["regions"][0]["bounds"]
        river = max(S["streams"], key=lambda pl: max(x for x, _ in pl) - min(x for x, _ in pl))
        assert min(x for x, _ in river) <= b["left"] and max(x for x, _ in river) >= b["right"]
        assert S["bridges"], "die Südstraße kreuzt den Fluss unter einer Brücke"
        assert S["lakes"] and S["docks"]                                                       # der Mühlteich im Fluss, mit Steg zum Angeln
    w, rep = new_world(4, residents=people(2), stil=Stil(form="fluss", wasser="fluss"))
    assert len(w["look"]["regions"][0]["shapes"]["streams"]) == 5 and rep.ok                  # der breite Fluss hat fünf Stränge


def test_streusiedlung_liegt_weit_auseinander():
    for seed in (2, 6):
        w, rep = new_world(seed, residents=people(6), stil=Stil(form="streu"))
        pts = houses(w)
        nearest = sorted(min(math.hypot(a[0] - b[0], a[1] - b[1]) for b in pts if b is not a) for a in pts)
        assert nearest[len(nearest) // 2] > 55                                                 # das Haus daneben ist im Schnitt weit weg
        paths = w["look"]["regions"][0]["shapes"]["paths"]
        assert len(paths) >= len(pts)                                                          # eine Gasse oder ein Weg je Hof


def test_zufall_waehlt_je_seed_eine_der_sechs_formen():
    assert {echte_form(s, "zufall") for s in range(1, 60)} == set(ECHTE_FORMEN)
    assert echte_form(3, "anger") == "anger"
    a, _ = new_world(11, residents=people(2), stil=Stil(form="zufall"))
    b, _ = new_world(11, residents=people(2), stil=Stil(form=echte_form(11, "zufall")))
    assert houses(a) == houses(b)


@pytest.mark.parametrize("form", NEU)
def test_viele_gebaeude_und_alle_stellgroessen_gehen(form):
    mix = {"house": 8, "shop": 2, "workshop": 2, "barn": 1, "stable": 1}
    w, rep = new_world(3, residents=people(8), mix=mix, stil=Stil(form=form, seen=3, wasser="fluss", wald="dicht", baeume=25, gaerten=3, felder=2, wege="gerade"))
    assert rep.ok, rep.errors
    assert w["size"][0] <= 256 and w["size"][1] <= 256
    w0, rep0 = new_world(3, residents=people(3), stil=Stil(form=form, seen=0, wasser="keiner", gaerten=0))
    S0 = w0["look"]["regions"][0]["shapes"]
    assert rep0.ok and S0["docks"] == [] and S0["gardens"] == []
    assert (S0["streams"] != []) == (form == "fluss")                                          # Fluss quer hat immer Wasser, die anderen ohne Wasserlauf keines


def test_vorgaben_aendern_sich_nicht():
    """Die neuen Formen berühren das Straßendorf nicht: die Vorgaben ergeben weiter dasselbe Dorf."""
    a, _ = new_world(5, residents=people(3))
    b, _ = new_world(5, residents=people(3), stil=Stil(form="strasse"))
    assert dumps(a) == dumps(b)


def test_anger_mit_wenigen_gebaeuden_liegt_im_kartenrand_und_zu_wenige_haeuser_werden_erklaert():
    """Regression: Mit zwei Gebäuden rückte der Platz über den rechten Rand hinaus (IndexError); zu wenig Betten stehen in der Fehlermeldung."""
    from on_their_own.generator.generate import GenerationError
    w, rep = new_world(53857 + 3 * 1000003, mix={"house": 1, "shop": 1}, residents=people(1), stil=Stil(form="anger"))
    assert rep.ok
    with pytest.raises(GenerationError, match="Betten"):
        new_world(53857, mix={"house": 1, "shop": 1}, residents=people(6), stil=Stil(form="zufall"))
