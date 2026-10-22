"""AP16a: Gestalten-Aktionen auf einer Weltdatei – einzeln, abgelehnt, und als Eigenschaftstest über zufällige Folgen (Datei = Engine, Bild = Kacheln)."""

import copy
import random

import pytest

from simulacra.db.connection import Database
from simulacra.generator.blank import blank_world
from simulacra.generator.edit import entwurf
from simulacra.generator.edit.ableiten import ableiten
from simulacra.generator.generate import new_world
from simulacra.generator.stil import Stil
from simulacra.world import loader
from simulacra.world.engine import WorldEngine
from simulacra.world.export import world_file


def leer():
    return blank_world("T", "klein", "wald")


def engine(w):
    return WorldEngine.create(Database(":memory:"), {**copy.deepcopy(w), "agents": []})


def ein(w, *akt, **kw):
    r = entwurf.anwenden(w, list(akt), **kw)
    return r


def an_engine_gleich(w, r):
    """Der Patch auf der Engine ergibt dieselbe Welt wie die Datei, die `anwenden` liefert."""
    e = engine(w)
    e.edit.apply_patch(r.patch)
    f = world_file(e.state)
    assert f["tiles"] == r.welt["tiles"]
    assert f["size"] == r.welt["size"]
    key = lambda l: l["id"]                                                                                 # noqa: E731
    assert sorted(({k: v for k, v in l.items() if k != "discovered_by"} for l in f["locations"]), key=key) == sorted(r.welt["locations"], key=key)
    obj = lambda o: (o["id"], o["kind"], o["name"], tuple(o["tile"]))                                      # noqa: E731
    assert sorted(map(obj, f["objects"])) == sorted(map(obj, r.welt["objects"]))
    assert sorted(n["id"] for n in f["resource_nodes"]) == sorted(n["id"] for n in r.welt["resource_nodes"])
    assert sorted(map(str, f["links"])) == sorted(map(str, r.welt["links"]))
    assert f["look"] == r.welt["look"]
    return e


def test_weg():
    w = leer()
    r = ein(w, {"art": "weg", "punkte": [[5, 10], [12, 10], [12, 16]]})
    assert r.stati[0]["ok"]
    assert all(r.welt["tiles"][10][x] == "," for x in range(5, 13)) and all(r.welt["tiles"][y][12] == "," for y in range(10, 17))
    assert w["tiles"][10][8] == "."                                                                         # die Eingabe bleibt unberührt
    an_engine_gleich(w, r)


def test_see_garten_baum_bank():
    w = leer()
    r = ein(w, {"art": "see", "mitte": [30, 10], "rx": 3}, {"art": "garten", "rechteck": [16, 12, 6, 4]}, {"art": "deko", "sorte": "baum", "tile": [8, 6]},
            {"art": "deko", "sorte": "bank", "tile": [7, 11]}, {"art": "deko", "sorte": "laterne", "tile": [9, 11]})
    assert all(s["ok"] for s in r.stati), r.stati
    t = r.welt["tiles"]
    assert t[10][30] == "~" and t[8][30] in "~s" and t[8][8 - 2] == "." and t[6][8] == "T"
    assert t[11][16:22] == "ffffff"
    assert [o["kind"] for o in r.welt["objects"]].count("seedbed") >= 3
    assert {o["kind"] for o in r.welt["objects"]} >= {"bench", "lantern"}
    an_engine_gleich(w, r)


def test_haus():
    w = leer()
    r = ein(w, {"art": "haus", "gebaeude": "house", "tuer": [20, 20]})
    assert r.stati[0]["ok"], r.stati
    assert r.welt["tiles"][20][20] == "+" and r.welt["tiles"][19][20] == "#"
    assert len(r.welt["links"]) == 1 and r.welt["links"][0][0] == [20, 20]
    assert len(r.welt["tiles"]) > len(w["tiles"])                                                           # die Tasche hat die Karte nach Süden wachsen lassen
    assert any(l["id"].startswith("house.e1h1") for l in r.welt["locations"])
    assert not [m for m in r.meldungen if m["stufe"] == "fehler"], r.meldungen
    e = an_engine_gleich(w, r)
    assert e.state.get_meta("size") == r.welt["size"]
    r2 = ein(r.welt, {"art": "haus", "gebaeude": "shop", "tuer": [30, 20]})                                  # ein zweites Haus nutzt den Streifen weiter
    assert r2.stati[0]["ok"] and len(r2.welt["tiles"]) == len(r.welt["tiles"])
    an_engine_gleich(r.welt, r2)


def test_abgelehnt_mit_grund():
    w = leer()
    r = ein(w, {"art": "see", "mitte": [30, 10], "rx": 3}, {"art": "weg", "punkte": [[25, 10], [35, 10]]}, {"art": "deko", "sorte": "baum", "tile": [30, 10]},
            {"art": "weg", "punkte": [[0, 5], [4, 5]]}, {"art": "loeschen", "tile": [10, 10]}, {"art": "zauber"}, {"art": "karte", "richtung": "ost", "kacheln": 7})
    gruende = [s["grund"] for s in r.stati]
    assert r.stati[0]["ok"]
    assert gruende[1] == "Dort ist Wasser" and r.stati[1]["ort"] is not None
    assert gruende[2] == "Dort ist Wasser"
    assert gruende[3] == "Dort steht ein Baum" and r.stati[3]["ort"] == [0, 5]
    assert gruende[4].startswith("Dort ist nichts")
    assert gruende[5].startswith("Unbekannte Aktion")
    assert gruende[6].startswith("Die Karte wächst")
    an_engine_gleich(w, r)                                                                                  # abgelehnte Aktionen ändern nichts


def test_belegt_im_spiel():
    w = leer()
    r = ein(w, {"art": "deko", "sorte": "baum", "tile": [10, 10]}, {"art": "see", "mitte": [11, 11], "rx": 2}, belegt={(10, 10): "Alex"}, spiel=True)
    assert r.stati[0]["grund"] == "Dort steht Alex" and r.stati[1]["grund"] == "Dort steht Alex"


def test_loeschen_ding_deko_form_haus():
    w = leer()
    r = ein(w, {"art": "deko", "sorte": "baum", "tile": [8, 6]}, {"art": "deko", "sorte": "bank", "tile": [9, 6]}, {"art": "garten", "rechteck": [16, 12, 6, 4]},
            {"art": "weg", "punkte": [[5, 10], [12, 10]]}, {"art": "haus", "gebaeude": "house", "tuer": [20, 20]})
    hoehe = len(r.welt["tiles"])
    r2 = ein(r.welt, {"art": "loeschen", "tile": [8, 6]}, {"art": "loeschen", "tile": [9, 6]}, {"art": "loeschen", "tile": [18, 13]}, {"art": "loeschen", "tile": [7, 10]},
             {"art": "loeschen", "tile": [20, 20]})
    assert all(s["ok"] for s in r2.stati), r2.stati
    t = r2.welt["tiles"]
    assert t[6][8] == "." and t[13][17] == "." and t[11][17] == "." and t[10][7] == "." and t[20][20] != "+" and t[19][20] == "."
    assert not r2.welt["objects"] and not r2.welt["links"] and not r2.welt["resource_nodes"]
    assert len(r2.welt["locations"]) == 1 and len(t) == hoehe
    assert all(t[y][x] not in "#+f~m_" for y in range(hoehe) for x in range(len(t[0])))
    an_engine_gleich(r.welt, r2)


def test_loeschen_bewohntes_haus_und_bett():
    w, _ = new_world(7)
    assert w["look"]["regions"][0]["houses"]
    bett = next(o for o in w["objects"] if o["kind"] == "bed")
    r = ein(w, {"art": "loeschen", "tile": bett["tile"]})
    assert r.stati[0]["ok"] or "gehört" in r.stati[0]["grund"]
    w2 = copy.deepcopy(w)
    for o in w2["objects"]:
        if o["kind"] == "bed":
            o["owner"] = "alex"
    h = w2["look"]["regions"][0]["houses"][0]
    r = ein(w2, {"art": "loeschen", "tile": h["door"]["outside"]})
    assert r.stati[0]["grund"] == "In dem Haus wohnt jemand."


def test_karte_erweitern():
    w = leer()
    r = ein(w, {"art": "karte", "richtung": "ost", "kacheln": 8}, {"art": "karte", "richtung": "sued", "kacheln": 16})
    assert r.welt["size"] == [56, 48] and all(len(z) == 56 for z in r.welt["tiles"])
    assert r.welt["look"]["regions"][0]["bounds"]["right"] == 56 * 16 and r.welt["look"]["regions"][0]["bounds"]["bottom"] == 48 * 16
    an_engine_gleich(w, r)
    gross = ein(copy.deepcopy(w), *[{"art": "karte", "richtung": "ost", "kacheln": 32}] * 8)
    assert gross.welt["size"][0] == 48 + 32 * 6 and not gross.stati[6]["ok"] and "256" in gross.stati[6]["grund"]


def test_startplatz_nur_werkstatt():
    w = leer()
    r = ein(w, {"art": "startplatz", "tile": [10, 10]})
    assert r.welt["startplatz"] == [10, 10] and not [m for m in r.meldungen if "Startplatz" in m["text"] and m["stufe"] == "hinweis"]
    r = ein(w, {"art": "startplatz", "tile": [10, 10]}, spiel=True)
    assert not r.stati[0]["ok"]
    assert any(m["stufe"] == "hinweis" and "Startplatz" in m["text"] for m in ein(w).meldungen)


def test_pruefung_unerreichbar():
    """Eine Mauer um den Startplatz: die Haustür ist nicht mehr erreichbar (✗); ein Fehler, der schon vorher bestand, zählt nur als Hinweis."""
    w = leer()
    w["startplatz"] = [3, 3]
    r = ein(w, {"art": "haus", "gebaeude": "shop", "tuer": [20, 20]})
    assert not [m for m in r.meldungen if m["stufe"] == "fehler"]
    dicht = copy.deepcopy(r.welt)
    for x, y in [(3 + dx, 3 + dy) for dx in (-1, 0, 1) for dy in (-1, 0, 1) if (dx, dy) != (0, 0)]:
        dicht["tiles"][y] = dicht["tiles"][y][:x] + "#" + dicht["tiles"][y][x + 1:]
    r2 = ein(dicht, {"art": "deko", "sorte": "stein", "tile": [30, 3]})
    assert any(m["stufe"] == "hinweis" and "Haustür" in m["text"] and "schon vorher" in m["text"] for m in r2.meldungen)
    r3 = ein(w, {"art": "deko", "sorte": "stein", "tile": [30, 3]})
    from simulacra.generator.edit import pruefung
    assert [m for m in pruefung.befund(dicht, {}) if m["stufe"] == "fehler" and "Haustür" in m["text"]]


def ziele(w, rng, n):
    W, H = len(w["tiles"][0]), len(w["tiles"])
    arten = ["weg", "see", "garten", "deko", "haus", "loeschen", "loeschen", "karte"]
    out = []
    for _ in range(n):
        a = rng.choice(arten)
        x, y = rng.randrange(1, W - 1), rng.randrange(1, H - 1)
        if a == "weg":
            out.append({"art": a, "punkte": [[x, y], [min(W - 2, x + rng.randrange(0, 8)), y], [min(W - 2, x + rng.randrange(0, 8)), min(H - 2, y + rng.randrange(1, 8))]]})
        elif a == "see":
            out.append({"art": a, "mitte": [x, y], "rx": rng.choice([2, 3, 4]), "ry": rng.choice([2, 3])})
        elif a == "garten":
            out.append({"art": a, "rechteck": [x, y, rng.randrange(3, 9), rng.randrange(3, 7)]})
        elif a == "deko":
            out.append({"art": a, "sorte": rng.choice(["baum", "kiefer", "busch", "stein", "bank", "laterne", "brunnen", "briefkasten", "wegweiser"]), "tile": [x, y]})
        elif a == "haus":
            out.append({"art": a, "gebaeude": rng.choice(["house", "shop", "workshop", "barn", "stable"]), "tuer": [x, y]})
        elif a == "loeschen":
            out.append({"art": a, "tile": [x, y]})
        else:
            out.append({"art": a, "richtung": rng.choice(["ost", "sued"]), "kacheln": 8})
    return out


BASEN = {"leer": leer, "dorf7": lambda: new_world(7)[0], "fluss": lambda: new_world(6, stil=Stil.of({"form": "fluss"}))[0], "startwelt": lambda: {**loader.load_world_file(loader.DATA_DIR / "world_default.json"), "agents": []}}


@pytest.mark.parametrize("basis", list(BASEN))
@pytest.mark.parametrize("seed", range(10))
def test_zufallsfolgen(basis, seed):
    """Zufällige Aktionsfolgen: die Engine ergibt dieselbe Welt wie die Datei, und Kacheln folgen den Formen (wo sich das Ableiten ändert, gilt der neue Wert, sonst bleibt der alte)."""
    rng = random.Random(seed * 101 + len(basis))
    w = BASEN[basis]()
    akt = ziele(w, rng, 14)
    r = ein(w, *akt)
    assert len(r.stati) == len(akt)
    an_engine_gleich(w, r)
    # Bild und Kacheln: überall, wo die Formen nachher etwas anderes ergeben als vorher, steht der neue Wert
    from simulacra.world import look as lk
    vor = w["look"] if lk.is_v2(w["look"]) else lk.upgrade_v1(w["look"])
    rect = (0, 0, min(len(w["tiles"][0]), len(r.welt["tiles"][0])), len(w["tiles"]))
    a, b = ableiten(vor, rect), ableiten(r.welt["look"], rect)
    nachher = {tuple(h["interior"]["rect"]) for g in r.welt["look"]["regions"] for h in g["houses"]}
    weg = [h["interior"]["rect"] for g in vor["regions"] for h in g["houses"] if tuple(h["interior"]["rect"]) not in nachher]          # gelöschte Häuser: ihre Tasche wird wieder Wald
    for (x, y), c in b.items():
        if any(rx <= x < rx + rw and ry <= y < ry + rh for rx, ry, rw, rh in weg):
            continue
        assert r.welt["tiles"][y][x] == (c if a[(x, y)] != c else w["tiles"][y][x]), (x, y)
    # Prüfung: keine unerwartete Ausnahme, Befund hat Text
    assert all(m["text"] for m in r.meldungen)


def test_unveraenderte_startwelt_bleibt_unveraendert():
    """Die Startwelt-Gestaltung wird nur kopiert: `anwenden` verändert die Eingabe nie."""
    w = {**loader.load_world_file(loader.DATA_DIR / "world_default.json"), "agents": []}
    vorher = copy.deepcopy(w)
    ein(w, {"art": "weg", "punkte": [[3, 3], [6, 3]]}, {"art": "see", "mitte": [20, 20], "rx": 2})
    assert w == vorher


def test_startwelt_bestand_wird_ausgeblendet_nicht_gestrichen():
    """Dorf A (Block `legacy`): Löschen trägt den Eintrag in `look.mask` ein, die Listen bleiben unverändert (der Zufall des Bodens hängt an ihrer Reihenfolge); Neues darf überall hin."""
    w = {**loader.load_world_file(loader.DATA_DIR / "world_default.json"), "agents": []}
    vor = copy.deepcopy(w["look"])
    r = ein(w, {"art": "loeschen", "tile": [17, 11]}, {"art": "loeschen", "tile": [8, 11]}, {"art": "weg", "punkte": [[4, 6], [8, 6]]}, {"art": "loeschen", "tile": [6, 6]})
    assert [s["ok"] for s in r.stati] == [True, True, True, True], r.stati
    look = r.welt["look"]
    reg, alt = look["regions"][0], vor["regions"][0]
    assert reg["shapes"]["lakes"] == alt["shapes"]["lakes"] and reg["shapes"]["paths"][:len(alt["shapes"]["paths"])] == alt["shapes"]["paths"]            # nichts gestrichen
    assert [m["liste"] for m in look["mask"]] == ["lakes", "paths", "paths"]                                               # auch das neue, gelöschte Stück bleibt ausgeblendet in der Liste
    assert len(reg["shapes"]["paths"]) == len(alt["shapes"]["paths"]) + 1
    assert r.welt["tiles"][11][17] != "~" and r.welt["tiles"][11][8] != ","
    an_engine_gleich(w, r)
    assert w["look"] == vor
