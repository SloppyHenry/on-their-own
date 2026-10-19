"""Laufzeit (AP17c-3): echter Kindprozess mit einem falschen `llama-server` auf einem freien Port."""

import asyncio

import httpx
import pytest

from simulacra.models.runtime import LlamaRuntime, RuntimeFail

from .fakes import make_fake_llama, put_model


@pytest.fixture
async def rt(tmp_path):
    changes = []
    r = LlamaRuntime(tmp_path, lambda: changes.append(r.state), ready_timeout=8.0)
    r.changes, r.binary = changes, make_fake_llama(tmp_path / "bin" / "llama-server")
    yield r
    await r.stop()


async def test_start_bereit_antwort_stopp(rt, tmp_path):
    m = put_model(tmp_path, "m1")
    assert rt.state == "stopped" and rt.base_url is None
    await rt.start(rt.binary, m, "m1")
    assert rt.state == "running" and rt.model_id == "m1" and rt.base_url == f"http://127.0.0.1:{rt.port}/v1"
    async with httpx.AsyncClient() as c:
        assert (await c.get(f"{rt.base_url}/models")).json()["data"][0]["id"] == "m1", "der Server meldet das Modell unter seiner Kennung (--alias)"
    assert "starting" in rt.changes and rt.changes[-1] == "running"
    pid_port = rt.port
    await rt.stop()
    assert rt.state == "stopped" and rt.base_url is None and rt.model_id is None
    async with httpx.AsyncClient() as c:
        with pytest.raises(httpx.HTTPError):
            await c.get(f"http://127.0.0.1:{pid_port}/health", timeout=1)


async def test_langsames_laden_wird_abgewartet(rt, tmp_path):
    await rt.start(rt.binary, put_model(tmp_path, "slow", "slow"), "slow")
    assert rt.state == "running"


async def test_gleiches_modell_startet_nicht_neu(rt, tmp_path):
    m = put_model(tmp_path, "m1")
    await rt.start(rt.binary, m, "m1")
    port = rt.port
    await rt.start(rt.binary, m, "m1")
    assert rt.port == port


async def test_wechsel_beendet_das_alte_modell(rt, tmp_path):
    await rt.start(rt.binary, put_model(tmp_path, "m1"), "m1")
    old = rt.port
    await rt.start(rt.binary, put_model(tmp_path, "m2"), "m2")
    assert rt.model_id == "m2" and rt.state == "running"
    async with httpx.AsyncClient() as c:
        assert (await c.get(f"{rt.base_url}/models")).json()["data"][0]["id"] == "m2"
        if old != rt.port:
            with pytest.raises(httpx.HTTPError):
                await c.get(f"http://127.0.0.1:{old}/health", timeout=1)


async def test_beendet_sich_beim_start_mit_fehler(rt, tmp_path):
    with pytest.raises(RuntimeFail) as e:
        await rt.start(rt.binary, put_model(tmp_path, "kaputt", "crash"), "kaputt")
    assert "beendet" in str(e.value) and "Modell kaputt" in str(e.value)
    assert rt.state == "failed" and "Modell kaputt" in rt.error and rt.model_id == "kaputt"
    assert any("Modell kaputt" in line for line in rt.log_tail())


async def test_binary_laesst_sich_nicht_starten(rt, tmp_path):
    with pytest.raises(RuntimeFail):
        await rt.start(tmp_path / "gibt-es-nicht", put_model(tmp_path, "m"), "m")
    assert rt.state == "failed" and "lässt sich nicht starten" in rt.error


async def test_absturz_im_betrieb_wird_gemeldet(rt, tmp_path):
    await rt.start(rt.binary, put_model(tmp_path, "m1"), "m1")
    rt._proc.kill()
    for _ in range(100):
        if rt.state == "failed":
            break
        await asyncio.sleep(0.05)
    assert rt.state == "failed" and "abgestürzt" in rt.error


async def test_zeitueberschreitung(tmp_path):
    r = LlamaRuntime(tmp_path, lambda: None, ready_timeout=0.5)
    binary = make_fake_llama(tmp_path / "bin" / "llama-server")
    try:
        with pytest.raises(RuntimeFail) as e:
            await r.start(binary, put_model(tmp_path, "slow", "slow"), "slow")          # braucht 1 s, erlaubt sind 0,5
        assert "nicht bereit" in str(e.value) and r.state == "failed"
    finally:
        await r.stop()


async def test_stop_bricht_das_starten_ab(tmp_path):
    r = LlamaRuntime(tmp_path, lambda: None, ready_timeout=20.0)
    binary = make_fake_llama(tmp_path / "bin" / "llama-server")
    starting = asyncio.create_task(r.start(binary, put_model(tmp_path, "slow", "slow"), "slow"))
    await asyncio.sleep(0.2)
    await r.stop()
    with pytest.raises(RuntimeFail):
        await starting
    assert r.state == "stopped"
