"""Profilmaske (AP17b): Grenzen mit deutschen Meldungen, Wortprüfung, Kennungen, Vorlagendatei."""

import pytest

from simulacra.agents.model import AgentProfile, Personality, load_default
from simulacra.agents.schema import (LIM, TemplateInvalid, check_profile, meta_hits, parse_template, profile_warnings, slug, template_data, template_errors,
                                     unique_id)


def good(**kw) -> AgentProfile:
    return AgentProfile(name="Ida", gender="weiblich", age=40, description="Freundlich.", background="Kommt vom Land.", interests=["Brot"], dislikes=[], goals=["backen"],
                        communication_style="leise", **kw)


def test_mitgelieferte_vorlagen_halten_die_grenzen_ein():
    for tid in ("alex", "mira", "hanne", "jonas", "rosa", "kim"):
        p, q = load_default(tid)
        assert check_profile(p, q) == [], tid


def test_grenzen_nennen_feld_und_zahl():
    p = good().model_copy(update={"name": "X" * 30, "description": "a" * 700, "interests": ["i"] * 9, "goals": ["g"] * 4, "communication_style": "s" * 200})
    e = check_profile(p)
    assert any(x.startswith("Name: höchstens 24") for x in e) and any("Beschreibung: höchstens 600 Zeichen (hat 700)" in x for x in e)
    assert any("Interessen: höchstens 8 Einträge (hat 9)" in x for x in e) and any("Ziele: höchstens 3 Einträge" in x for x in e)
    assert any("Kommunikationsstil: höchstens 160" in x for x in e)


def test_gesamtlaenge_der_texte_ist_begrenzt():
    p = good().model_copy(update={"description": "a" * 600, "background": "b" * 600, "interests": ["c" * 40] * 8, "dislikes": ["e" * 40] * 8, "goals": ["d" * 120] * 3})
    assert any(x.startswith(f"Alle Texte zusammen: höchstens {LIM['total']}") for x in check_profile(p))


@pytest.mark.parametrize("name", ["", "  ", "A!B", "_x"])
def test_namen_sind_buchstaben(name):
    assert check_profile(good().model_copy(update={"name": name}))


def test_wortpruefung_findet_hinweise_auf_hoehere_instanz():
    assert meta_hits("Der Spieler und die Leitstelle der Simulation, ein Programmierer") == ["Spieler", "Leitstelle", "Simulation"]
    assert meta_hits("Ski fahren, Kinder, Skizze") == []                         # „ki“ nur als eigenes Wort
    assert meta_hits("Eine KI weiß das") == ["KI"]
    p = good().model_copy(update={"background": "Wurde vom Schöpfer erdacht."})
    w = profile_warnings(p)
    assert len(w) == 1 and "Schöpfer" in w[0] and "Hintergrund" in w[0]


def test_kennungen():
    assert slug("Jörg-Peter") == "joerg_peter" and slug("Åse") == "ase" and slug("   ") == "figur"
    assert unique_id("Ida", {"ida", "ida2"}) == "ida3" and unique_id("Alex", set()) == "alex"


def test_vorlagendatei_rundlauf_und_alle_fehler_auf_einmal():
    p, q = good(), Personality()
    d = template_data(p, q)
    assert template_errors(d) == [] and parse_template(d)[0] == p
    bad = {"format": "x", "version": 2, "profile": {"name": "n" * 49, "gender": "?", "age": 150, "description": "x" * 700, "interests": ["a"] * 9}, "personality": {"sociability": 120}}
    e = template_errors(bad)
    assert len(e) >= 17 and any("Version 2" in x for x in e) and any("Geselligkeit: eine ganze Zahl von 0 bis 100." in x for x in e) and any("Neugier" in x and "fehlt" in x for x in e)
    with pytest.raises(TemplateInvalid) as ex:
        parse_template(bad)
    assert ex.value.errors == e
    assert template_errors([1]) == ["Die Datei enthält kein JSON-Objekt."]
    assert template_errors({"format": "simulacra-vorlage", "version": True, "profile": {}, "personality": {}})[0] == "„version“ fehlt."
