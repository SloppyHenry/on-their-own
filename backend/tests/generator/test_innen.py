"""AP16c: Haus von innen einrichten – Möbel, Wandschmuck, Teppiche, Farben, Löschen; Datei = Engine, Wege im Haus bleiben frei."""

import pytest

from simulacra.generator.edit import entwurf
from simulacra.generator.edit.innen import MOEBEL
from tests.generator.test_gestalten import an_engine_gleich, ein, leer


def mit_haus():
    w = leer()
    r = ein(w, {"art": "haus", "tuer": [24, 16], "gebaeude": "house", "breite": 66, "dach": "rot", "wand": "creme"})
    assert r.stati[0]["ok"], r.stati
    return r.welt


def freie_bodenkacheln(w, raum_nr=0):
    loc = [l for l in w["locations"] if l["id"].startswith("house.e") and not l.get("props", {}).get("fallback")][raum_nr]
    x0, y0, bw, bh = loc["rect"]
    objs = {tuple(o["tile"]) for o in w["objects"]}
    return [(x, y) for y in range(y0, y0 + bh) for x in range(x0, x0 + bw) if w["tiles"][y][x] == "_" and (x, y) not in objs], loc


def test_moebel_setzen_und_an_engine_gleich():
    w = mit_haus()
    frei, _ = freie_bodenkacheln(w)
    t = next(p for p in frei if not any(w["tiles"][j][i] == "+" for i, j in ((p[0] + 1, p[1]), (p[0] - 1, p[1]), (p[0], p[1] + 1), (p[0], p[1] - 1))))
    r = ein(w, {"art": "moebel", "kind": "sofa", "tile": list(t)})
    assert r.stati[0]["ok"], r.stati
    sofa = [o for o in r.welt["objects"] if o["kind"] == "sofa" and o["tile"] == list(t)]
    assert len(sofa) == 1 and sofa[0]["name"] == "Sofa"
    assert r.welt["tiles"][t[1]][t[0]] == "_"                                  # ein Sofa sperrt den Weg nicht
    an_engine_gleich(w, r)


def test_sperrendes_moebel_macht_die_kachel_unbegehbar_und_loeschen_gibt_sie_frei():
    w = mit_haus()
    frei, _ = freie_bodenkacheln(w)
    t = next(p for p in frei if not any(w["tiles"][j][i] == "+" for i, j in ((p[0] + 1, p[1]), (p[0] - 1, p[1]), (p[0], p[1] + 1), (p[0], p[1] - 1))))
    r = ein(w, {"art": "moebel", "kind": "bookshelf", "tile": list(t)})
    if r.stati[0]["ok"]:
        assert r.welt["tiles"][t[1]][t[0]] == "m"
        r2 = ein(r.welt, {"art": "loeschen", "tile": list(t)})
        assert r2.stati[0]["ok"], r2.stati
        assert r2.welt["tiles"][t[1]][t[0]] == "_"
        assert not any(o["tile"] == list(t) for o in r2.welt["objects"])


def test_abgelehnt_vor_der_tuer_auf_belegtem_und_draussen():
    w = mit_haus()
    tuer = next(l for l in w["links"] if True)[1]
    r = ein(w, {"art": "moebel", "kind": "table", "tile": [tuer[0], tuer[1] - 1]}, {"art": "moebel", "kind": "table", "tile": [5, 5]}, {"art": "moebel", "kind": "ufo", "tile": tuer},
            {"art": "moebel", "kind": "bed", "tile": [24, 20]})
    assert [s["ok"] for s in r.stati] == [False, False, False, False]
    assert "Tür" in r.stati[0]["grund"] or "Boden" in r.stati[0]["grund"]
    assert "Haus" in r.stati[1]["grund"]
    assert "Unbekannt" in r.stati[2]["grund"]


def test_belegter_platz_und_zweites_moebel_auf_derselben_kachel():
    w = mit_haus()
    frei, _ = freie_bodenkacheln(w)
    t = next(p for p in frei if not any(w["tiles"][j][i] == "+" for i, j in ((p[0] + 1, p[1]), (p[0] - 1, p[1]), (p[0], p[1] + 1), (p[0], p[1] - 1))))
    r = ein(w, {"art": "moebel", "kind": "chest", "tile": list(t)}, {"art": "moebel", "kind": "sofa", "tile": list(t)})
    assert [s["ok"] for s in r.stati][1] is False


def test_wege_im_haus_bleiben_zusammenhaengend():
    """Auf jede freie Kachel eines Raums nacheinander sperrende Möbel setzen: kein Teil des Hauses wird abgeschnitten."""
    w = mit_haus()
    for _ in range(40):
        frei, _ = freie_bodenkacheln(w)
        if not frei:
            break
        aktionen = [{"art": "moebel", "kind": "crate", "tile": list(t)} for t in frei[:6]]
        w = ein(w, *aktionen).welt
    from simulacra.generator.edit.innen import _zusammenhang
    from simulacra.generator.edit.modell import Welt
    m = Welt(w)
    haus = m.look["regions"][0]["houses"][-1]
    assert _zusammenhang(m, haus["interior"]["rect"]) == 1
    r = ein(w)
    assert not any(me["stufe"] == "fehler" for me in r.meldungen if "erreichbar" in me["text"])


def test_wandschmuck_teppich_farben():
    w = mit_haus()
    frei, raum = freie_bodenkacheln(w)
    x0, y0, bw, bh = raum["rect"]
    t = frei[0]
    r = ein(w, {"art": "farbe", "tile": [x0, y0], "tapete": "kacheln", "boden": "parkett", "vorhang": "#7fa878"}, {"art": "teppich", "tile": list(t), "farbe": "rosa"},
            {"art": "wand", "kind": "uhr", "tile": [x0 + bw - 1, y0]}, {"art": "farbe", "tile": [x0, y0], "tapete": "gibtsnicht"}, {"art": "wand", "kind": "uhr", "tile": [x0 + bw - 1, y0]})
    ok = [s["ok"] for s in r.stati]
    assert ok[0] and ok[1] and ok[3] is False
    haus = r.welt["look"]["regions"][0]["houses"][-1]
    assert haus["interior"]["rooms"][raum["id"]] == {**w["look"]["regions"][0]["houses"][-1]["interior"]["rooms"][raum["id"]], "paper": "kacheln", "floor": "parkett", "curtain": "#7fa878"}
    assert any(g[0] == "oval" and g[1] == t[0] + 0.5 for g in haus["interior"]["rugs"])
    assert len(r.welt["look"]["regions"][0]["houses"]) == len(w["look"]["regions"][0]["houses"])      # Reihenfolge und Anzahl der Häuser bleiben
    an_engine_gleich(w, r)
    ent = ein(r.welt, {"art": "loeschen", "tile": list(t)})                                     # Teppich wieder weg
    assert ent.stati[0]["ok"]
    assert not any(g[0] == "oval" and g[1] == t[0] + 0.5 for g in ent.welt["look"]["regions"][0]["houses"][-1]["interior"]["rugs"])


def test_katalog_moebel_sind_bekannte_arten():
    from simulacra.generator.edit.katalog import katalog
    k = katalog()["innen"]
    assert [m["kind"] for m in k["moebel"]] == MOEBEL
    assert all(m["name"] for m in k["moebel"])


@pytest.mark.parametrize("kind", MOEBEL)
def test_jedes_moebel_wird_ein_objekt_mit_seinen_handlungen(kind):
    w = mit_haus()
    frei, _ = freie_bodenkacheln(w)
    ok = False
    for t in frei:
        r = ein(w, {"art": "moebel", "kind": kind, "tile": list(t)})
        if r.stati[0]["ok"]:
            ok = True
            o = next(o for o in r.welt["objects"] if o["kind"] == kind and o["tile"] == list(t))
            assert o["id"].endswith(f"_{kind}")
            break
    assert ok, f"{kind} lässt sich nirgends setzen"
