"""Übertragung (AP17c-3): erlaubte Hosts, Weiterleitungen, Fortsetzen, Verbindungsabbruch, Prüfsumme."""

import asyncio
import os

import httpx
import pytest

from simulacra.models.transfer import HF_HOSTS, Cancelled, TransferError, host_ok, sha256_of, stream_to

from .fakes import FakeHub

DATA = os.urandom(300_000)


def test_host_ok():
    assert host_ok("https://huggingface.co/a/b", HF_HOSTS) and host_ok("https://cdn-lfs.huggingface.co/x", HF_HOSTS) and host_ok("https://cas-bridge.xethub.hf.co/x", HF_HOSTS)
    assert not host_ok("http://huggingface.co/a", HF_HOSTS), "nur HTTPS"
    assert not host_ok("https://evilhuggingface.co/a", HF_HOSTS), "kein Teilstück des Namens"
    assert not host_ok("https://huggingface.co.evil.example/a", HF_HOSTS)
    assert not host_ok("https://example.com/huggingface.co", HF_HOSTS)
    assert not host_ok("file:///etc/passwd", HF_HOSTS)


async def fetch(hub: FakeHub, part, url="https://huggingface.co/a/b/resolve/main/m.gguf", total=len(DATA), **kw):
    got = []
    async with httpx.AsyncClient(transport=hub.transport) as c:
        await stream_to(c, url, part, allowed=HF_HOSTS, total=total, on_bytes=got.append, check=lambda: None, **kw)
    return got


async def test_laedt_und_folgt_der_weiterleitung_zum_cdn(tmp_path):
    hub = FakeHub()
    hub.add("a/b", "m.gguf", DATA)
    got = await fetch(hub, tmp_path / "m.part")
    assert (tmp_path / "m.part").read_bytes() == DATA and sum(got) == len(DATA)
    assert [r.url.host for r in hub.requests] == ["huggingface.co", "cdn-lfs.huggingface.co"]


async def test_setzt_eine_teildatei_fort(tmp_path):
    hub = FakeHub()
    hub.add("a/b", "m.gguf", DATA)
    part = tmp_path / "m.part"
    part.write_bytes(DATA[:100_000])
    got = await fetch(hub, part)
    assert part.read_bytes() == DATA and sum(got) == len(DATA) - 100_000
    assert hub.requests[-1].headers["range"] == "bytes=100000-"


async def test_server_ohne_range_beginnt_von_vorn(tmp_path):
    hub = FakeHub()
    hub.add("a/b", "m.gguf", DATA)
    hub.ignore_range = True
    part = tmp_path / "m.part"
    part.write_bytes(DATA[:100_000])
    restarts = []
    await fetch(hub, part, restart=lambda: restarts.append(1))
    assert part.read_bytes() == DATA and restarts == [1]


async def test_verbindungsabbruch_wird_fortgesetzt(tmp_path, monkeypatch):
    real_sleep = asyncio.sleep
    monkeypatch.setattr(asyncio, "sleep", lambda s: real_sleep(0))                  # keine Wartezeit zwischen den Versuchen
    hub = FakeHub()
    hub.add("a/b", "m.gguf", DATA)
    hub.cut_first["m.gguf"] = 128 * 1024
    part = tmp_path / "m.part"
    await fetch(hub, part)
    assert part.read_bytes() == DATA
    assert any(r.headers.get("range", "").startswith("bytes=") for r in hub.requests), "der zweite Versuch setzt fort"


async def test_dauerhafter_abbruch_laesst_die_teildatei_und_meldet(tmp_path, monkeypatch):
    real_sleep = asyncio.sleep
    monkeypatch.setattr(asyncio, "sleep", lambda s: real_sleep(0))
    hub = FakeHub()
    hub.add("a/b", "m.gguf", DATA)
    real = hub.handle

    def always_cut(request):
        hub.cut_first["m.gguf"] = 64 * 1024
        return real(request)
    hub.transport = httpx.MockTransport(always_cut)
    part = tmp_path / "m.part"
    with pytest.raises(TransferError) as e:
        await fetch(hub, part)
    assert e.value.status == 502 and "Teildatei bleibt" in e.value.text and part.exists()


async def test_weiterleitung_auf_fremden_host_wird_abgelehnt(tmp_path):
    hub = FakeHub()
    hub.add("a/b", "m.gguf", DATA)
    hub.redirect_to = "evil.example.com"
    with pytest.raises(TransferError) as e:
        await fetch(hub, tmp_path / "m.part")
    assert e.value.status == 422 and "evil.example.com" in e.value.text
    assert not (tmp_path / "m.part").exists()
    assert all(r.url.host != "evil.example.com" for r in hub.requests), "der fremde Host wird gar nicht erst angefragt"


async def test_fremde_startadresse_wird_abgelehnt(tmp_path):
    with pytest.raises(TransferError):
        await fetch(FakeHub(), tmp_path / "m.part", url="https://example.com/m.gguf")


async def test_fehlerstatus_der_quelle(tmp_path):
    hub = FakeHub()                                                                 # Datei gibt es nicht -> 404 vom CDN
    with pytest.raises(TransferError) as e:
        await fetch(hub, tmp_path / "m.part")
    assert e.value.status == 422 and "404" in e.value.text


async def test_zu_grosse_teildatei_wird_verworfen(tmp_path):
    hub = FakeHub()
    hub.add("a/b", "m.gguf", DATA)
    part = tmp_path / "m.part"
    part.write_bytes(DATA + b"x" * 10)
    await fetch(hub, part)
    assert part.read_bytes() == DATA


async def test_abbruch_waehrend_des_ladens(tmp_path):
    hub = FakeHub()
    hub.add("a/b", "m.gguf", DATA)

    def check():
        raise Cancelled()
    async with httpx.AsyncClient(transport=hub.transport) as c:
        with pytest.raises(Cancelled):
            await stream_to(c, "https://huggingface.co/a/b/resolve/main/m.gguf", tmp_path / "m.part", allowed=HF_HOSTS, total=len(DATA), on_bytes=lambda k: None, check=check)


async def test_pruefsumme(tmp_path):
    f = tmp_path / "x"
    f.write_bytes(DATA)
    seen = []
    from .fakes import sha
    assert await sha256_of(f, seen.append, lambda: False) == sha(DATA) and sum(seen) == len(DATA)
    with pytest.raises(Cancelled):
        await sha256_of(f, lambda n: None, lambda: True)
