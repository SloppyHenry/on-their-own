"""Modell laden (AP17c-3): Quelle, Prüfsumme, Platz, Abbruch, Fortsetzen."""

import asyncio
import os

import pytest

from on_their_own.models import download as dl
from on_their_own.models.download import ModelDownloader
from on_their_own.models.hf import HFClient
from on_their_own.models.store import ModelStore
from on_their_own.models.transfer import TransferError, TransferManager

from .fakes import FakeHub

DATA = os.urandom(400_000)
REPO, FILE = "Qwen/Qwen3-8B-GGUF", "Qwen3-8B-Q4_K_M.gguf"


@pytest.fixture
def env(tmp_path):
    hub = FakeHub()
    blob = hub.add(REPO, FILE, DATA)
    changes = []
    mgr = TransferManager(lambda: changes.append(1))
    store = ModelStore(tmp_path)
    d = ModelDownloader(store, mgr, HFClient(tmp_path / "models" / "cache", transport=hub.transport), hub.transport)
    d.hub, d.blob, d.changes = hub, blob, changes
    return d, store, mgr


async def finish(mgr: TransferManager):
    while mgr.busy:
        await asyncio.sleep(0.01)
    return mgr.current


async def test_laden_pruefen_eintragen(env):
    d, store, mgr = env
    t = await d.start(REPO, FILE)
    assert t.kind == "model" and t.total == len(DATA) and t.model_id == "Qwen3-8B-Q4_K_M" and t.source == "https://huggingface.co/Qwen/Qwen3-8B-GGUF"
    done = await finish(mgr)
    assert done.phase == "done" and done.error is None
    [m] = store.list()
    assert (m.source, m.repo, m.sha256, m.license, m.quant, m.size_bytes) == ("tool", REPO, d.blob.sha, "Apache-2.0", "Q4_K_M", len(DATA))
    assert store.path(m.id).read_bytes() == DATA and not (store.dir / f"{FILE}.part").exists()
    assert d.changes, "Änderungen werden gemeldet"
    await d._client.aclose()


async def test_falsche_pruefsumme_wird_verworfen(env):
    d, store, mgr = env
    d.hub.repos[REPO][FILE].data = DATA[:-1] + bytes([DATA[-1] ^ 1])               # die Quelle liefert etwas anderes, als die Dateiliste verspricht
    await d.start(REPO, FILE)
    t = await finish(mgr)
    assert t.phase == "failed" and "Prüfsumme" in t.error and store.list() == [] and not (store.dir / f"{FILE}.part").exists()
    await d._client.aclose()


async def test_abbruch_raeumt_die_teildatei_weg(env):
    d, store, mgr = env
    await d.start(REPO, FILE)
    assert mgr.cancel() is True
    t = await finish(mgr)
    assert t.phase == "cancelled" and t.error is None and store.list() == []
    assert not list(store.dir.glob("*.part"))
    assert mgr.cancel() is False
    await d._client.aclose()


async def test_setzt_vorhandene_teildatei_fort(env):
    d, store, mgr = env
    store.dir.mkdir(parents=True, exist_ok=True)
    (store.dir / f"{FILE}.part").write_bytes(DATA[:150_000])
    await d.start(REPO, FILE)
    done = await finish(mgr)
    assert done.phase == "done" and store.path("Qwen3-8B-Q4_K_M").read_bytes() == DATA
    ranges = [r.headers.get("range") for r in d.hub.requests if r.url.host.startswith("cdn")]
    assert ranges == ["bytes=150000-"]
    await d._client.aclose()


@pytest.mark.parametrize("repo,file", [("../etc", FILE), ("a/b/c", FILE), ("Qwen/x", "../x.gguf"), ("Qwen/x", "x.bin"), ("Qwen/x", "sub/x.gguf"), ("Qwen/x", ".gguf"), ("", FILE)])
async def test_unzulaessige_namen(env, repo, file):
    d, _, _ = env
    with pytest.raises(TransferError) as e:
        await d.start(repo, file)
    assert e.value.status == 422
    await d._client.aclose()


async def test_unbekannte_datei_und_repo(env):
    d, _, _ = env
    with pytest.raises(TransferError) as e:
        await d.start(REPO, "gibt-es-nicht.gguf")
    assert e.value.status == 422 and "gibt es in" in e.value.text
    with pytest.raises(TransferError) as e:
        await d.start("Qwen/Nicht-da-GGUF", FILE)
    assert e.value.status == 422
    await d._client.aclose()


async def test_gesperrtes_modell_wird_nicht_geladen(env):
    d, _, _ = env
    d.hub.gated.add(REPO)
    with pytest.raises(TransferError) as e:
        await d.start(REPO, FILE)
    assert e.value.status == 422 and "Anmeldung" in e.value.text
    await d._client.aclose()


async def test_ohne_pruefsumme_wird_nicht_geladen(env):
    d, _, _ = env
    orig = d.hf.get

    async def no_lfs(path, params=None, refresh=False):
        got = await orig(path, params, refresh)
        if isinstance(got.data, list):
            for e in got.data:
                e.pop("lfs", None)
        return got
    d.hf.get = no_lfs
    with pytest.raises(TransferError) as e:
        await d.start(REPO, FILE)
    assert "Prüfsumme" in e.value.text
    await d._client.aclose()


async def test_zu_wenig_platz(env, monkeypatch):
    d, store, _ = env
    monkeypatch.setattr(dl.shutil, "disk_usage", lambda p: type("U", (), {"free": len(DATA)})())          # genau die Dateigröße: ohne die 10 % Reserve zu wenig
    with pytest.raises(TransferError) as e:
        await d.start(REPO, FILE)
    assert e.value.status == 507 and "Platz" in e.value.text and not list(store.dir.glob("*.part"))
    await d._client.aclose()


async def test_nur_ein_auftrag_zugleich(env):
    d, _, mgr = env
    await d.start(REPO, FILE)
    with pytest.raises(TransferError) as e:
        await d.start(REPO, FILE)
    assert e.value.status == 409
    await finish(mgr)
    await d._client.aclose()


async def test_fremder_host_der_weiterleitung_scheitert_ohne_datei(env):
    d, store, mgr = env
    d.hub.redirect_to = "evil.example.com"
    await d.start(REPO, FILE)
    t = await finish(mgr)
    assert t.phase == "failed" and "evil.example.com" in t.error and store.list() == []
    await d._client.aclose()
