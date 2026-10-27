"""llama.cpp aus den Releases (AP17c-3): Auswahl je Rechner, Laden, Prüfsumme, Einrichten."""

import asyncio

import pytest

from on_their_own.models import llamacpp as lc
from on_their_own.models.hardware import Hardware
from on_their_own.models.transfer import TransferError, TransferManager

from .fakes import FakeHub, asset, tar_with_server


def release(tag: str, *suffixes: str, cudart=()) -> dict:
    names = [f"llama-{tag}-bin-{s}.tar.gz" for s in suffixes] + [f"cudart-llama-{tag}-bin-{s}.tar.gz" for s in cudart]
    return {"tag_name": tag, "assets": [{"name": n, "browser_download_url": f"https://github.com/x/{n}", "digest": "sha256:" + "a" * 64, "size": 10} for n in names]}


ALL = ["macos-arm64", "macos-x64", "ubuntu-x64", "ubuntu-arm64", "ubuntu-vulkan-x64", "ubuntu-vulkan-arm64", "ubuntu-cuda-12.8-x64", "ubuntu-cuda-13.4-x64", "ubuntu-cuda-13.4-arm64"]
RELEASES = [release("b200", *ALL, cudart=["ubuntu-cuda-12.8-x64", "ubuntu-cuda-13.4-x64"]), release("b199", *ALL)]


def machine(kind, os_="linux", arch="x64", cuda=None):
    return Hardware(kind, "x", 0, 0, 16384, 1000, os_, arch, cuda_version=cuda)


@pytest.mark.parametrize("hw,expect", [
    (machine("metal", "macos", "arm64"), ["metal"]),
    (machine("metal", "macos", "x64"), ["metal"]),
    (machine("nvidia", cuda="13.2"), ["cuda", "cuda", "vulkan", "cpu"]),
    (machine("nvidia", cuda="12.4"), ["cuda", "vulkan", "cpu"]),
    (machine("nvidia", cuda="11.8"), ["vulkan", "cpu"]),
    (machine("amd"), ["vulkan", "cpu"]),
    (machine("vulkan"), ["vulkan", "cpu"]),
    (machine("cpu"), ["cpu"]),
    (machine("cpu", arch="arm64"), ["cpu"]),
    (machine("nvidia", arch="arm64", cuda="13.0"), ["cuda", "vulkan", "cpu"]),
])
def test_auswahl_je_rechner(hw, expect):
    assert [c.kind for c in lc.candidates(RELEASES, hw)] == expect


def test_dateinamen_und_cudart():
    c = lc.candidates(RELEASES, machine("nvidia", cuda="12.4"))
    assert c[0].name == "llama-b200-bin-ubuntu-cuda-12.8-x64.tar.gz" and c[0].cudart_url.endswith("cudart-llama-b200-bin-ubuntu-cuda-12.8-x64.tar.gz")
    assert c[1].name == "llama-b200-bin-ubuntu-vulkan-x64.tar.gz" and c[1].cudart_url == ""
    assert c[0].sha256 == "a" * 64 and c[0].size == 10


def test_jungstes_release_das_die_datei_enthaelt():
    rels = [release("b300", "macos-arm64"), release("b299", "ubuntu-x64"), release("b298", "ubuntu-x64")]
    assert [(c.kind, c.tag) for c in lc.candidates(rels, machine("cpu"))] == [("cpu", "b299")]
    assert lc.candidates(rels, machine("cpu", "windows")) == [] and lc.candidates([], machine("cpu")) == []


def test_aehnliche_dateinamen_passen_nicht():
    rels = [{"tag_name": "b1", "assets": [{"name": "llama-b1-bin-ubuntu-x64.zip", "browser_download_url": "u", "digest": ""}, {"name": "llama-b1-bin-ubuntu-x64-extra.tar.gz", "browser_download_url": "u", "digest": ""}]}]
    assert lc.candidates(rels, machine("cpu")) == []


def test_version_und_binary(tmp_path):
    assert lc.version_of(tmp_path) == (None, None)
    d = tmp_path / "b6532-metal"
    (d / "llama-b6532").mkdir(parents=True)
    (d / "llama-b6532" / "llama-server").write_text("x")
    (tmp_path / "current").symlink_to("b6532-metal")
    assert lc.version_of(tmp_path) == ("b6532", "metal") and lc.find_binary(tmp_path) == tmp_path / "current" / "llama-b6532" / "llama-server"       # über den Verweis, damit eine neue Version ohne Neustart gilt


# ---------- Einrichten ----------

@pytest.fixture
def env(tmp_path):
    hub = FakeHub()
    mgr = TransferManager(lambda: None)
    inst = lc.RuntimeInstaller(tmp_path / "runtime", mgr, hub.transport)
    return hub, mgr, inst


def setup_release(hub, data=None, tag="b100", sha_ok=True):
    data = data or tar_with_server()
    a = asset(f"llama-{tag}-bin-ubuntu-x64.tar.gz", data)
    if not sha_ok:
        a["digest"] = "sha256:" + "0" * 64
    hub.release_assets[a["name"]] = data
    hub.releases = [{"tag_name": tag, "assets": [a]}]


async def wait(mgr):
    while mgr.busy:
        await asyncio.sleep(0.01)
    return mgr.current


async def test_laedt_prueft_entpackt_und_richtet_ein(env, tmp_path):
    hub, mgr, inst = env
    setup_release(hub)
    t = await inst.start(machine("cpu"))
    assert t.kind == "runtime" and t.label == "llama.cpp b100 (cpu)"
    done = await wait(mgr)
    assert done.phase == "done", done.error
    binary = lc.find_binary(tmp_path / "runtime")
    assert binary is not None and binary.name == "llama-server" and lc.version_of(tmp_path / "runtime") == ("b100", "cpu")
    assert [r.url.host for r in hub.requests] == ["api.github.com", "github.com"]
    await inst.aclose()


async def test_neue_version_ersetzt_die_alte(env, tmp_path):
    hub, mgr, inst = env
    setup_release(hub, tag="b100")
    await inst.start(machine("cpu")); await wait(mgr)
    setup_release(hub, tag="b101")
    await inst.start(machine("cpu")); await wait(mgr)
    rt = tmp_path / "runtime"
    assert lc.version_of(rt) == ("b101", "cpu") and not (rt / "b100-cpu").exists() and (rt / "b101-cpu").is_dir()
    await inst.aclose()


async def test_falsche_pruefsumme_wird_abgelehnt(env, tmp_path):
    hub, mgr, inst = env
    setup_release(hub, sha_ok=False)
    await inst.start(machine("cpu"))
    t = await wait(mgr)
    assert t.phase == "failed" and "Prüfsumme" in t.error and lc.version_of(tmp_path / "runtime") == (None, None)
    assert not list((tmp_path / "runtime").glob(".laden-*")), "Zwischenordner wird aufgeräumt"
    await inst.aclose()


async def test_version_die_nicht_laeuft_wird_verworfen(env, tmp_path):
    hub, mgr, inst = env
    import io, tarfile
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tf:
        data = b"#!/bin/sh\nexit 1\n"
        info = tarfile.TarInfo("llama-b1/llama-server")
        info.size, info.mode = len(data), 0o755
        tf.addfile(info, io.BytesIO(data))
    setup_release(hub, buf.getvalue())
    await inst.start(machine("cpu"))
    t = await wait(mgr)
    assert t.phase == "failed" and "läuft auf diesem Rechner nicht" in t.error and not (tmp_path / "runtime" / "b100-cpu").exists()
    await inst.aclose()


async def test_archiv_mit_pfad_nach_draussen_wird_abgelehnt(env, tmp_path):
    hub, mgr, inst = env
    import io, tarfile
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tf:
        info = tarfile.TarInfo("../../ausbruch.txt")
        info.size = 1
        tf.addfile(info, io.BytesIO(b"x"))
    setup_release(hub, buf.getvalue())
    await inst.start(machine("cpu"))
    t = await wait(mgr)
    assert t.phase == "failed" and not (tmp_path / "ausbruch.txt").exists() and not (tmp_path.parent / "ausbruch.txt").exists()
    await inst.aclose()


async def test_fehlerfaelle_beim_start(env):
    hub, mgr, inst = env
    with pytest.raises(TransferError) as e:
        await inst.start(machine("cpu", "windows"))
    assert e.value.status == 422 and "windows" in e.value.text
    hub.releases = []
    with pytest.raises(TransferError) as e:
        await inst.start(machine("cpu"))
    assert e.value.status == 422 and "keine passende Datei" in e.value.text
    hub.releases = [{"tag_name": "b1", "assets": [{"name": "llama-b1-bin-ubuntu-x64.tar.gz", "browser_download_url": "https://github.com/x", "digest": ""}]}]
    with pytest.raises(TransferError) as e:
        await inst.start(machine("cpu"))
    assert "Prüfsumme" in e.value.text
    await inst.aclose()


async def test_github_nicht_erreichbar(tmp_path):
    import httpx
    inst = lc.RuntimeInstaller(tmp_path, TransferManager(lambda: None), httpx.MockTransport(lambda r: httpx.Response(503)))
    with pytest.raises(TransferError) as e:
        await inst.start(machine("cpu"))
    assert e.value.status == 502
    await inst.aclose()
