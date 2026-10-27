"""Kommandozeile `python -m simulacra.models` (von install.sh genutzt) und ihre Übereinstimmung mit dem Skript."""

import json
import shutil
import subprocess
import sys
from pathlib import Path

import pytest
from test_install_script import dry, machine as shell_machine

from simulacra.models import __main__ as cli
from simulacra.models.hardware import Hardware

from .conftest import machine

CORE = ["__init__", "__main__", "hardware", "fit", "rank", "curated"]
PKG = Path(cli.__file__).parent


def run(capsys, *argv):
    code = cli.main(list(argv))
    return code, capsys.readouterr().out


def test_empfehlung_fuer_die_m1_ist_qwen3_8b(capsys):
    code, out = run(capsys, "recommend", "--shell", "--kind", "metal", "--name", "Apple M1", "--ram-mb", "16384", "--os", "macos", "--arch", "arm64")
    key, name, repo, file, size, fit, secs, quant, level = out.strip().split("|")
    assert code == 0 and (key, name, repo, file, size, fit, quant, level) == ("qwen3-8b", "Qwen3-8B", "Qwen/Qwen3-8B-GGUF", "Qwen3-8B-Q4_K_M.gguf", "5.0", "passt gut", "Q4_K_M", "good")
    assert float(secs) > 0


@pytest.mark.parametrize("args, expected, level", [
    (["--kind", "nvidia", "--name", "NVIDIA GeForce RTX 4090", "--ram-mb", "65536", "--vram-mb", "24576"], "qwen3-14b", "good"),
    (["--kind", "nvidia", "--name", "NVIDIA GeForce RTX 3080", "--ram-mb", "32768", "--vram-mb", "10240"], "qwen3-8b", "good"),
    (["--kind", "cpu", "--ram-mb", "8192"], "qwen3-4b", "ok"),                                  # 4,8 GB nutzbar: nichts passt „gut“, das 4B-Modell „passt“
    (["--kind", "cpu", "--ram-mb", "4096"], "qwen3-4b", "no"),                                  # nichts passt: das kleinste, als „zu groß“ gekennzeichnet
    (["--kind", "nvidia", "--name", "NVIDIA GeForce RTX 3060", "--ram-mb", "16384", "--vram-mb", "12288", "--vram-free-mb", "1260"], "qwen3-4b", "no"),
])
def test_empfehlung_je_rechner(capsys, args, expected, level):
    _, out = run(capsys, "recommend", "--shell", *args)
    f = out.strip().split("|")
    assert (f[0], f[8]) == (expected, level)


def test_modell_waehlen_und_unbekanntes(capsys):
    _, out = run(capsys, "recommend", "--shell", "--kind", "metal", "--ram-mb", "65536", "--model", "qwen3-4b")
    assert out.startswith("qwen3-4b|")
    _, out = run(capsys, "recommend", "--shell", "--kind", "cpu", "--ram-mb", "8192", "--model", "gibtesnicht")
    assert out.startswith("FEHLER|unbekanntes Modell gibtesnicht (bekannt: qwen3-4b, qwen3-8b, qwen3-14b, stheno-8b, rocinante-12b, dolphin-8b, llama32-3b-unc)")


def test_liste_mit_zusatzmodellen_empfiehlt_nur_normale(capsys):
    _, out = run(capsys, "list", "--kind", "metal", "--name", "Apple M1", "--ram-mb", "16384")
    rows = [r.split("|") for r in out.strip().splitlines()]
    assert {r[1] for r in rows} >= {"qwen3-8b", "stheno-8b", "dolphin-8b"}
    assert [r[1] for r in rows if r[0] == "*"] == ["qwen3-8b"]
    assert {r[1]: r[-2] for r in rows}["stheno-8b"] == "roleplay" and {r[1]: r[-2] for r in rows}["dolphin-8b"] == "uncensored"
    _, out = run(capsys, "recommend", "--shell", "--kind", "metal", "--name", "Apple M1", "--ram-mb", "16384", "--model", "dolphin-8b")
    assert out.startswith("dolphin-8b|")


def test_json_und_hardware(capsys):
    _, out = run(capsys, "recommend", "--json", "--kind", "metal", "--name", "Apple M1", "--ram-mb", "16384")
    d = json.loads(out)
    assert d["repo"] == "Qwen/Qwen3-8B-GGUF" and d["fit"] == "good" and d["size_mb"] == 4768
    _, out = run(capsys, "hardware", "--json", "--kind", "metal", "--name", "Apple M1", "--ram-mb", "16384")
    h = json.loads(out)
    assert h["usable_mb"] == 10922 and h["bandwidth_gbs"] == 68.0 and h["bandwidth_known"] is True
    _, out = run(capsys, "hardware", "--kind", "cpu", "--ram-mb", "8192")
    assert "nutzbar für Modelle: 4915 MB" in out


def test_nutzbarer_speicher_stimmt_mit_dem_skript_ueberein(tmp_path):
    """Zwei Rechnungen (Shell für die Anzeige, Python für die Wahl) dürfen nicht auseinanderlaufen."""
    cases = [(dict(os_name="Darwin", arch="arm64", mem_gb=16), machine("metal", 16)),
             (dict(nvidia=("NVIDIA GeForce RTX 3080", 10240, "12.4", 8000)), Hardware("nvidia", "x", 10240, 8000, 16384, 0, "linux", "x64")),
             (dict(mem_gb=8), machine("cpu", 8))]
    for i, (shell_args, hw) in enumerate(cases):
        d = tmp_path / str(i)
        d.mkdir()
        out = dry(shell_machine(d, **shell_args)).stdout
        shown = out.split("nutzbar für Modelle ca. ")[1].split(" GB")[0]
        assert shown == f"{hw.usable_mb / 1024:.1f}".replace(".", ","), (shell_args, shown)


def test_kern_laeuft_mit_dem_system_python_von_install_sh():
    """install.sh ruft das Modul mit dem Python des Rechners auf (macOS: 3.9). Die Kern-Module brauchen deshalb `from __future__ import annotations` und keine Zusatzpakete."""
    for name in CORE:
        src = (PKG / f"{name}.py").read_text()
        assert name == "__init__" or "from __future__ import annotations" in src, name
        assert "import httpx" not in src and "import pydantic" not in src, name
    py39 = shutil.which("python3.9") or ("/usr/bin/python3" if Path("/usr/bin/python3").exists() else None)
    if py39 and subprocess.run([py39, "-c", "import sys; sys.exit(0 if sys.version_info < (3, 10) else 1)"]).returncode == 0:
        env = {"PYTHONPATH": str(PKG.parent.parent), "PATH": "/usr/bin:/bin"}
        r = subprocess.run([py39, "-m", "simulacra.models", "recommend", "--shell", "--kind", "cpu", "--ram-mb", "16384"], capture_output=True, text=True, env=env)
        assert r.returncode == 0 and r.stdout.startswith("qwen3-8b|"), r.stderr
    else:
        pytest.skip("kein Python 3.9 zum Gegenprüfen")
