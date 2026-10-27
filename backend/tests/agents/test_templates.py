"""Vorlagenspeicher (AP17b): mitgelieferte schreibgeschützt, eigene als Dateien, Import legt nie über Bestehendes."""

import json

import pytest

from on_their_own.agents.model import AgentProfile, Personality
from on_their_own.agents.schema import template_data
from on_their_own.agents.templates import TemplateError, TemplateStore


@pytest.fixture(params=["datei", "speicher"])
def store(request, tmp_path):
    return TemplateStore(tmp_path / "vorlagen" if request.param == "datei" else None)


def ida(**kw):
    return AgentProfile(name="Ida", gender="weiblich", age=40, **kw), Personality(sociability=77)


def test_liste_beginnt_mit_den_sechs_mitgelieferten(store):
    ts = store.list()
    assert [t["id"] for t in ts] == ["alex", "mira", "hanne", "jonas", "rosa", "kim"] and all(t["builtin"] for t in ts)


def test_eigene_vorlage_anlegen_aendern_duplizieren_loeschen(store):
    t = store.create(*ida(description="Backt gern."))
    assert t["id"] == "eigene-ida" and not t["builtin"] and t["personality"]["sociability"] == 77
    assert store.create(*ida())["id"] == "eigene-ida-2"                       # nie über eine bestehende Vorlage
    t2 = store.update("eigene-ida", *ida(description="Neu."))
    assert t2["profile"]["description"] == "Neu."
    d = store.duplicate("eigene-ida")
    assert d["profile"]["name"] == "Ida (Kopie)" and d["id"].startswith("eigene-")
    store.delete("eigene-ida")
    with pytest.raises(TemplateError) as e:
        store.get("eigene-ida")
    assert e.value.status == 404


def test_mitgelieferte_sind_schreibgeschuetzt(store):
    with pytest.raises(TemplateError) as e:
        store.update("alex", *ida())
    assert e.value.status == 403
    with pytest.raises(TemplateError) as e:
        store.delete("mira")
    assert e.value.status == 403
    assert store.duplicate("hanne")["profile"]["name"] == "Hanne (Kopie)"


def test_ungueltige_vorlage_wird_abgelehnt(store):
    with pytest.raises(TemplateError) as e:
        store.create(AgentProfile(name="Ida", description="x" * 700), Personality())
    assert e.value.status == 422 and any("Beschreibung" in x for x in e.value.errors)


def test_export_und_import_rundlauf(store):
    raw = json.dumps(store.export("kim")).encode()
    t, warnings = store.import_bytes(raw)
    assert t["id"] == "eigene-kim" and t["profile"]["name"] == "Kim" and warnings == []
    assert store.import_bytes(raw)[0]["id"] == "eigene-kim-2"
    assert {x["id"] for x in store.list()} >= {"kim", "eigene-kim", "eigene-kim-2"}


def test_import_meldet_alle_fehler_und_schreibt_nichts(store):
    before = [t["id"] for t in store.list()]
    bad = template_data(*ida())
    bad["profile"]["description"] = "x" * 700
    bad["personality"].pop("curiosity")
    with pytest.raises(TemplateError) as e:
        store.import_bytes(json.dumps(bad).encode())
    assert e.value.status == 422 and len(e.value.errors) == 2
    for raw, status in ((b"kein json", 422), (b"\xff\xfe", 422), (b"x" * 30_000, 413)):
        with pytest.raises(TemplateError) as e:
            store.import_bytes(raw)
        assert e.value.status == status
    assert [t["id"] for t in store.list()] == before


def test_import_warnt_vor_hinweisen_auf_hoehere_instanz(store):
    p, q = ida(background="Ein Spieler hat sie erfunden.")
    _, warnings = store.import_bytes(json.dumps(template_data(p, q)).encode())
    assert len(warnings) == 1 and "Spieler" in warnings[0]


def test_beschaedigte_datei_verhindert_die_liste_nicht(tmp_path):
    s = TemplateStore(tmp_path)
    s.create(*ida())
    (tmp_path / "eigene-kaputt.json").write_text("{nicht json")
    assert [t["id"] for t in s.list()][-1] == "eigene-ida"
