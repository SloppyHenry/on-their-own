"""Stellgrößen des Generators (AP18f): Vorgaben ergeben das bisherige Dorf, gleiche Stellgrößen dasselbe Dorf, jede Kombination ist bespielbar, Ungeeignetes wird abgelehnt."""

import random

import pytest

from simulacra.generator.generate import GenerationError, dumps, new_world
from simulacra.generator.stil import CHOICES, RANGES, Stil, StilError


def people(n):
    return [{"id": f"r{i}", "name": f"R{i}", "home": None} for i in range(n)]


def test_vorgaben_ergeben_das_bisherige_dorf():
    for seed in (3, 12):
        a, _ = new_world(seed, residents=people(4))
        b, _ = new_world(seed, residents=people(4), stil=Stil())
        assert dumps(a) == dumps(b) and "stil" not in a["generator"]


def test_gleiche_stellgroessen_gleiches_dorf_und_andere_stellgroessen_anderes():
    st = Stil(form="beidseitig", seen=3, wasser="fluss", wald="dicht", baeume=25, gaerten=3, felder=2, wege="gerade")
    a, _ = new_world(9, residents=people(5), stil=st)
    b, _ = new_world(9, residents=people(5), stil=st)
    c, _ = new_world(9, residents=people(5))
    assert dumps(a) == dumps(b) and dumps(a) != dumps(c)
    assert a["generator"]["stil"] == st.changed()


def test_ungueltige_stellgroessen_werden_mit_klarem_text_abgelehnt():
    with pytest.raises(StilError, match="Dorfform"):
        Stil.of({"form": "stadt"})
    with pytest.raises(StilError, match="Seen"):
        Stil.of({"seen": 9})
    with pytest.raises(StilError, match="Unbekannte"):
        Stil.of({"hoehe": 3})
    assert Stil.of(None) == Stil() and Stil.of({"seen": 2}).seen == 2


def test_jede_kombination_ist_bespielbar():
    """Zufällige Stellgrößen und Seeds: immer ein gültiges Dorf (alle Türen, Quellen und Startplätze erreichbar; Bett für alle). Der Prüfbericht ist grün."""
    rnd = random.Random(11)
    for _ in range(24):
        kw = {k: rnd.choice(v) for k, v in CHOICES.items()} | {k: rnd.randint(lo, hi) for k, (lo, hi) in RANGES.items()}
        n = rnd.randint(1, 8)
        w, rep = new_world(rnd.randint(1, 99999), residents=people(n), stil=Stil(**kw))
        assert rep.ok, (kw, n, rep.errors)
        assert len(w["agents"]) == n and sum(o["kind"] == "bed" for o in w["objects"]) >= n


def test_seen_wasser_gaerten_felder_erscheinen_im_bild():
    w, rep = new_world(5, residents=people(2), stil=Stil(seen=4, wasser="fluss", gaerten=3, felder=2))
    S = w["look"]["regions"][0]["shapes"]
    fehlt = next((c["detail"] for c in rep.checks if c["name"].startswith("Auch nicht alles")), "")          # was nicht passte, steht im Bericht
    assert len(S["lakes"]) + fehlt.count("ein See") == 4 and len(S["streams"]) == 3 and len(S["gardens"]) + fehlt.count("ein Garten") + fehlt.count("ein Feld") == 5
    assert sum(1 for g in S["gardens"][1:] if not g.get("beds")) == 0
    w0, _ = new_world(5, residents=people(2), stil=Stil(seen=0, wasser="keiner", gaerten=0))
    S0 = w0["look"]["regions"][0]["shapes"]
    assert S0["lakes"] == [] and S0["docks"] == [] and S0["streams"] == [] and S0["gardens"] == [] and S0["bridges"] == []
    assert all(l["id"] not in ("lake", "garden") and not l["id"].endswith(".lake") for l in w0["locations"] if l["name"].startswith(("See", "Garten")) is False)


def test_dorfformen_unterscheiden_sich_und_nicht_passendes_steht_im_bericht():
    forms = {}
    for f in ("strasse", "beidseitig", "haufen"):
        w, rep = new_world(4, residents=people(6), stil=Stil(form=f))
        forms[f] = [(h["at"][0], h["at"][1]) for h in w["look"]["regions"][0]["houses"]]
    spread = {f: max(y for _, y in p) - min(y for _, y in p) for f, p in forms.items()}
    assert spread["strasse"] <= 12 and spread["beidseitig"] > 40 and spread["haufen"] > 12 and len({tuple(p) for p in forms.values()}) == 3
    w, rep = new_world(4, residents=people(2), mix={"house": 1, "shop": 12, "workshop": 12}, stil=Stil(form="haufen"))
    assert any(c["name"].startswith("Gebäude:") and "passten nicht" in c["detail"] for c in rep.checks) or rep.ok


def test_ohne_see_bleibt_wasser_und_ankunft_moeglich():
    w, rep = new_world(8, residents=people(3), stil=Stil(seen=0, gaerten=0))
    assert rep.ok and any(o["kind"] == "well" for o in w["objects"])
