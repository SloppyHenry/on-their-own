"""Dorf nach Maß für N Bewohner (AP17b): Häuser mit zwei Betten, Startplätze auf dem Platz, kein Besitzer ohne Vorwort, alte Seeds unverändert."""

import pytest

from simulacra.generator.generate import GenerationError, default_mix, dumps, new_world


def residents(n, homes=()):
    return [{"id": f"r{i}", "name": f"Bewohner{i}", "home": homes[i] if i < len(homes) else None} for i in range(n)]


def test_standardgebaeude_wachsen_mit_den_bewohnern():
    assert default_mix(1) == {"house": 1, "workshop": 1, "shop": 1}
    assert default_mix(2)["house"] == 1 and default_mix(3)["house"] == 2 and default_mix(8)["house"] == 4
    assert "stable" not in default_mix(4) and default_mix(5)["stable"] == 1 and default_mix(7)["barn"] == 1


@pytest.mark.parametrize("n", [1, 2, 3, 5, 8])
@pytest.mark.parametrize("seed", [1, 7, 31])
def test_dorf_hat_betten_fuer_alle_und_hoechstens_zwei_je_haus(n, seed):
    w, rep = new_world(seed, residents=residents(n))
    assert rep.ok
    beds = [o for o in w["objects"] if o["kind"] == "bed"]
    assert n <= len(beds) <= 2 * -(-n // 2) and len(beds) == 2 * default_mix(n)["house"]
    assert not any(b.get("owner") for b in beds)                                 # niemand bekommt ein Bett zugeteilt
    houses = w["generator"]["houses"]
    assert len(houses) == default_mix(n)["house"] and all(h["beds"] == 2 for h in houses)
    ids = [a["id"] for a in w["agents"]]
    assert ids == [f"r{i}" for i in range(n)] and len({tuple(a["tile"]) for a in w["agents"]}) == n          # jeder auf eigener Kachel
    assert w["size"][0] <= 256 and w["size"][1] <= 256 and "Heimhaus" not in {l["name"] for l in w["locations"]}


def test_karte_waechst_mit_der_bewohnerzahl():
    sizes = [new_world(7, residents=residents(n))[0]["size"] for n in (2, 4, 8)]
    assert sizes[0][0] * sizes[0][1] < sizes[1][0] * sizes[1][1] < sizes[2][0] * sizes[2][1]


def test_gleicher_seed_gleiches_dorf():
    a, b = new_world(5, residents=residents(4)), new_world(5, residents=residents(4))
    assert dumps(a[0]) == dumps(b[0]) and dumps(new_world(6, residents=residents(4))[0]) != dumps(a[0])


def test_vorwort_wohnt_schon_in_haus_setzt_nur_diesen_besitzer():
    w, _ = new_world(5, residents=residents(4, homes=(2, 2, None, 1)))
    owners = {o["id"]: o["owner"] for o in w["objects"] if o["kind"] == "bed" and o.get("owner")}
    assert sorted(owners.values()) == ["r0", "r1", "r3"]
    h2 = w["generator"]["houses"][1]["prefix"]
    tiles = {a["id"]: a["tile"] for a in w["agents"]}
    loc = lambda t: next(l["id"] for l in w["locations"] if l["id"].startswith("house.") and l["rect"][0] <= t[0] < l["rect"][0] + l["rect"][2] and l["rect"][1] <= t[1] < l["rect"][1] + l["rect"][3])
    assert loc(tiles["r0"]).startswith(h2 + "_") and loc(tiles["r1"]).startswith(h2 + "_")                   # sie starten in ihrem Haus
    assert all(o["name"].startswith("Bett (Bewohner") for o in w["objects"] if o.get("owner"))


def test_haus_ohne_freies_bett_oder_unbekanntes_haus_wird_abgelehnt():
    with pytest.raises(GenerationError, match="kein freies Bett"):
        new_world(5, residents=residents(3, homes=(1, 1, 1)))
    with pytest.raises(GenerationError, match="gibt es nicht"):
        new_world(5, residents=residents(2, homes=(5,)))
    with pytest.raises(GenerationError, match="1 bis 8"):
        new_world(5, residents=residents(9))


def test_ohne_bewohnerangabe_bleibt_alles_wie_bisher():
    w, _ = new_world(5)
    assert [a["id"] for a in w["agents"]] == ["alex", "mira"] and "houses" not in w["generator"]
    assert {o["owner"] for o in w["objects"] if o.get("owner")} == {"alex", "mira"}          # das Heimhaus mit festen Zimmern
