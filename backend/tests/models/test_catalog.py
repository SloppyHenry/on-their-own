"""Katalog: Zusammenführen von Live- und kuratierter Liste, Zwischenspeicher, Netzfehler, Filter, Rangfolge. Mock-Transport mit aufgezeichneten Antworten."""

import json

import pytest

from on_their_own.models import catalog as cat
from on_their_own.models.catalog import Catalog

from .conftest import FakeHF, machine


class Clock:
    def __init__(self):
        self.t = 1_800_000_000.0

    def __call__(self):
        return self.t


@pytest.fixture
def clock():
    return Clock()


def make(tmp_path, hf, clock):
    return Catalog(tmp_path, transport=hf.transport, now=clock)


async def test_m1_empfehlung_ist_qwen3_8b_und_das_rauschen_fehlt(tmp_path, hf, clock, m1):
    c = make(tmp_path, hf, clock)
    r = await c.load(m1)
    assert r.source == "live" and r.note is None and r.fetched_at == clock.t
    top = r.recommended[0]
    assert (top.repo, top.curated_key, top.source) == ("Qwen/Qwen3-8B-GGUF", "qwen3-8b", "curated")
    assert top.variant.file == "Qwen3-8B-Q4_K_M.gguf" and top.variant.fit.level == "good"
    assert top.variant.sha256 and len(top.variant.sha256) == 64 and top.variant.sha256.startswith("d98cdcbd")      # aus lfs.oid der Dateiliste
    assert top.variant.size_mb == pytest.approx(5027783488 / 1048576) and top.license == "Apache-2.0" and top.publisher == "Qwen"
    repos = [i.repo for i in r.items]
    assert not any("Image" in x or "MiniCPM" in x or "embedding" in x.lower() or "-VL-" in x for x in repos)
    assert "DavidAU/Qwen3.8-27B-TURBO-Fable-Cold-Fusion-735-882-Heretic-Uncensored-NEO-CODER-MAX-MTP-GGUF" not in repos     # Herausgeber nicht auf der Liste
    for reason in ("kein Textmodell", "Vision-Modell", "Adapter", "Herausgeber nicht auf der Liste"):
        assert r.hidden.get(reason, 0) > 0, reason
    await c.aclose()


async def test_stufen_und_eigenschaften_der_eintraege(tmp_path, hf, clock, m1):
    c = make(tmp_path, hf, clock)
    r = await c.load(m1)
    by = {i.repo: i for i in r.items}
    assert by["Qwen/Qwen3-4B-GGUF"].variant.fit.level == "good"
    assert by["Qwen/Qwen3-14B-GGUF"].variant.fit.level == "tight"                  # 9 GB + Cache auf 10,7 GB nutzbaren Speicher
    mellum = by["JetBrains/Mellum2.1-12B-A2.5B-Thinking-GGUF"]
    assert mellum.variant.quant == "Q4_K_M" and mellum.variant.fit.level == "ok" and not mellum.multimodal and mellum.license == "Apache-2.0"
    assert by["unsloth/Qwen3.8-27B-GGUF"].variant.fit.level == "no" and by["unsloth/Qwen3.8-27B-GGUF"].variant.quant == "IQ4_XS"      # kleinste Datei Q4+, passt trotzdem nicht
    lfm = by["LiquidAI/LFM2.5-24B-A2B-GGUF"]
    assert lfm.moe and lfm.active_b == 2 and lfm.license == "Sonstige (siehe Modellseite)"
    assert mellum.moe and mellum.variant.estimate.seconds_per_decision < by["Qwen/Qwen3-14B-GGUF"].variant.estimate.seconds_per_decision     # MoE: nur aktiver Teil zählt
    assert all(e.variant.estimate.seconds_per_decision > 0 for e in r.items)
    levels = [i.variant.fit.level for i in r.items]
    assert levels == sorted(levels, key=["good", "ok", "tight", "no"].index)         # passende oben, zu große unten
    await c.aclose()


async def test_nur_passende(tmp_path, hf, clock, m1):
    c = make(tmp_path, hf, clock)
    r = await c.load(m1, only_fit=True)
    assert r.items and all(i.variant.fit.level != "no" for i in r.items)
    assert "unsloth/Qwen3.8-27B-GGUF" not in [i.repo for i in r.items]
    assert r.hidden.get(cat.TOO_BIG, 0) > 0
    assert not any("Qwen3.8-27B" in p for p in hf.trees())                          # offensichtlich zu große Modelle kosten keine Dateiliste
    await c.aclose()


async def test_gesperrte_modelle_sind_gekennzeichnet_nicht_angeboten(tmp_path, hf, clock, m1):
    c = make(tmp_path, hf, clock)
    r = await c.load(m1, trusted_only=False)
    g = next(i for i in r.items if i.repo == "orcarouter/Qwen3.8-27B-Uncensored-GGUF")
    assert g.gated and not g.downloadable and g.uncensored and g.variant.sha256 is None
    assert g not in r.recommended and r.items[-1].gated                              # ganz unten
    # Standard: Herausgeber nicht auf der Liste -> gar nicht erst abgefragt
    assert "orcarouter/Qwen3.8-27B-Uncensored-GGUF" not in [i.repo for i in (await c.load(m1)).items]
    await c.aclose()


async def test_alle_herausgeber_zeigen_unzensierte_mit_hinweis(tmp_path, hf, clock, m1):
    c = make(tmp_path, hf, clock)
    r = await c.load(m1, trusted_only=False)
    assert "Herausgeber nicht auf der Liste" not in r.hidden
    assert any("DavidAU" in p for p in hf.trees())                                          # wurde abgefragt, nicht vorab verworfen
    assert any(i.uncensored for i in r.items)                                               # nur ein Hinweis (Frage 39), keine Vorauswahl
    await c.aclose()


async def test_zwischenspeicher_6_stunden_und_refresh(tmp_path, hf, clock, m1):
    c = make(tmp_path, hf, clock)
    await c.load(m1)
    n = len(hf.requests)
    assert n > 5
    r = await c.load(m1)
    assert len(hf.requests) == n and r.source == "cache" and r.fetched_at == clock.t        # nichts neu geholt
    clock.t += 5.9 * 3600
    await c.load(m1)
    assert len(hf.requests) == n
    clock.t += 0.2 * 3600
    r = await c.load(m1)
    assert len(hf.requests) > n and r.source == "live"                                       # abgelaufen
    n = len(hf.requests)
    await c.load(m1, refresh=True)
    assert len(hf.requests) > n                                                              # „Liste aktualisieren“
    await c.aclose()


async def test_zwischenspeicher_gilt_fuer_jeden_rechner(tmp_path, hf, clock, m1):
    c = make(tmp_path, hf, clock)
    await c.load(m1)
    n = len(hf.requests)
    r = await c.load(machine("nvidia", 0, 24, name="NVIDIA GeForce RTX 3090"))
    assert len(hf.requests) == n
    assert r.recommended[0].repo == "Qwen/Qwen3-14B-GGUF"                                    # auf 24 GB ist das größte kuratierte Modell das beste
    by = {i.repo: i for i in r.items}
    q27 = by["unsloth/Qwen3.8-27B-GGUF"].variant
    assert (q27.quant, q27.fit.level) == ("Q4_K_M", "ok")                                    # und das 27B-Modell passt jetzt (auf der M1 nicht)
    await c.aclose()


async def test_belegte_karte_nichts_passt(tmp_path, hf, clock):
    busy = machine("nvidia", 0, 12, free_gb=749 / 1024, name="NVIDIA GeForce RTX 3060")     # thirdtux: ein fremder Dienst belegt fast alles
    c = make(tmp_path, hf, clock)
    r = await c.load(busy, only_fit=True)
    assert r.recommended == [] and r.items == []
    await c.aclose()


async def test_ohne_netz_und_ohne_zwischenspeicher_nur_die_kuratierte_liste(tmp_path, clock, m1):
    off = FakeHF(offline=True)
    c = make(tmp_path, off, clock)
    r = await c.load(m1)
    assert r.source == "curated" and "nur die kuratierte Liste" in r.note and r.fetched_at is None and r.hidden == {}
    assert [i.curated_key for i in r.items] == ["qwen3-8b", "qwen3-4b", "qwen3-14b"]
    assert r.recommended[0].curated_key == "qwen3-8b" and r.recommended[0].variant.sha256 is None
    await c.aclose()


@pytest.mark.parametrize("status", [429, 500, 503])
async def test_fehlerstatus_von_hugging_face_wie_kein_netz(tmp_path, clock, m1, status):
    c = make(tmp_path, FakeHF(status=status), clock)
    r = await c.load(m1)
    assert r.source == "curated" and len(r.items) == 3
    await c.aclose()


async def test_netz_faellt_aus_aelterer_zwischenspeicher_gilt(tmp_path, hf, clock, m1):
    c = make(tmp_path, hf, clock)
    live = await c.load(m1)
    clock.t += 30 * 3600
    c2 = make(tmp_path, FakeHF(offline=True), clock)
    r = await c2.load(m1)
    assert r.source == "stale" and "Zwischenspeicher" in r.note and r.fetched_at == pytest.approx(clock.t - 30 * 3600)
    assert [i.repo for i in r.items] == [i.repo for i in live.items]
    await c.aclose(); await c2.aclose()


async def test_kaputter_zwischenspeicher_wird_ignoriert(tmp_path, hf, clock, m1):
    c = make(tmp_path, hf, clock)
    await c.load(m1)
    for f in (tmp_path / "models" / "cache").glob("*.json"):
        f.write_text("{kaputt")
    n = len(hf.requests)
    r = await c.load(m1)
    assert len(hf.requests) > n and r.source == "live" and r.recommended
    await c.aclose()


async def test_fehlende_dateilisten_werden_gezaehlt_nicht_geworfen(tmp_path, hf, clock, m1):
    c = make(tmp_path, hf, clock)
    r = await c.load(m1)
    assert r.hidden.get(cat.NO_TREE, 0) > 0 and r.source == "live"                           # für manche Repositories gibt es keine aufgezeichnete Liste (404)
    await c.aclose()


async def test_kuratierte_immer_dabei_auch_wenn_die_liste_sie_nicht_nennt(tmp_path, clock, m1):
    class OnlyTrees(FakeHF):
        def handle(self, request):
            import httpx
            if request.url.path == "/api/models":
                self.requests.append(request.url)
                return httpx.Response(200, json=[])
            return super().handle(request)
    c = make(tmp_path, OnlyTrees(), clock)
    r = await c.load(m1)
    assert {i.curated_key for i in r.items} >= {"qwen3-4b", "qwen3-8b", "qwen3-14b"}
    assert next(i for i in r.items if i.curated_key == "qwen3-8b").variant.sha256.startswith("d98cdcbd")
    await c.aclose()


async def test_obergrenze_der_abfragen_schneidet_nie_kuratierte_ab(tmp_path, hf, clock, m1, monkeypatch):
    monkeypatch.setattr(cat, "MAX_TREES", 4)
    c = make(tmp_path, hf, clock)
    r = await c.load(m1)
    assert len(hf.trees()) == 4 and r.hidden[cat.OVER_CAP] > 0
    assert {"qwen3-4b", "qwen3-8b", "qwen3-14b"} <= {i.curated_key for i in r.items}
    await c.aclose()


async def test_suche_und_begrenzung(tmp_path, hf, clock, m1):
    c = make(tmp_path, hf, clock)
    r = await c.load(m1, q="gemma")
    assert r.items and all("gemma" in (i.name + i.repo + i.variant.file).lower() for i in r.items)
    gemma = next(i for i in r.items if i.repo == "unsloth/gemma-4-12b-it-GGUF")
    assert gemma.variant.quant == "Q4_K_M" and gemma.variant.fit.level == "ok" and gemma.multimodal and gemma.license == "Apache-2.0"
    assert r.recommended and r.recommended[0].repo == "Qwen/Qwen3-8B-GGUF"                  # Empfehlung bleibt unabhängig von der Suche
    assert any(u.query and b"search=gemma" in u.query for u in hf.requests)
    assert (await c.load(m1, q="Qwen3-8B", limit=1)).items[0].repo == "Qwen/Qwen3-8B-GGUF"
    one = await c.load(m1, limit=2)
    assert len(one.items) == 2 and one.total > 2
    assert (await c.load(m1, q="gibt-es-nicht-xyz")).items == []
    await c.aclose()


async def test_alle_varianten_eines_modells(tmp_path, hf, clock, m1):
    c = make(tmp_path, hf, clock)
    q8 = next(i for i in (await c.load(m1)).items if i.repo == "Qwen/Qwen3-8B-GGUF")
    assert [v.quant for v in sorted(q8.variants, key=lambda v: v.size_mb)] == ["Q4_K_M", "Q5_0", "Q5_K_M", "Q6_K", "Q8_0"]
    assert q8.variants[-1].fit.level == "tight"                                              # Q8_0 (8,1 GiB) mit Cache: 90,3 % des nutzbaren Speichers
    await c.aclose()


def test_zwischenspeicherdatei_hat_url_und_zeit(tmp_path, hf, clock, m1):
    import asyncio

    async def go():
        c = make(tmp_path, hf, clock)
        await c.load(m1)
        await c.aclose()
    asyncio.run(go())
    files = list((tmp_path / "models" / "cache").glob("*.json"))
    assert files and all({"url", "fetched_at", "data"} <= set(json.loads(f.read_text())) for f in files)
    assert all(not f.name.endswith(".tmp") for f in (tmp_path / "models" / "cache").iterdir())
