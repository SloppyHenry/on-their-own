"""install.sh im Trockenlauf mit nachgestellten Rechnern (AP17c).

Die Befehle, die den Rechner beschreiben (`uname`, `nvidia-smi`, `sysctl`) und das Netz (`curl`) sind durch kleine Skripte ersetzt,
die aufgezeichnete Antworten liefern (`tests/fixtures/install/`). So prüft der Test, welche llama.cpp-Datei und welches Modell das Skript
für welchen Rechner wählt, ohne etwas zu laden oder zu verändern."""

import os
import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "install.sh"
FIX = Path(__file__).parent / "fixtures" / "install"

pytestmark = pytest.mark.skipif(shutil.which("bash") is None, reason="braucht bash")


def _stub(dirpath: Path, name: str, body: str) -> None:
    f = dirpath / name
    f.write_text("#!/usr/bin/env bash\n" + body + "\n")
    f.chmod(0o755)


def machine(tmp_path: Path, *, os_name: str = "Linux", arch: str = "x86_64", mem_gb: int = 16, nvidia: tuple[str, int, str] | tuple[str, int, str, int] | None = None) -> dict[str, str]:
    """Umgebung für ein Skript, das auf dem beschriebenen Rechner zu laufen glaubt."""
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    _stub(bin_dir, "uname", f'case "$1" in -s) echo {os_name};; -m) echo {arch};; *) echo {os_name};; esac')
    _stub(bin_dir, "sysctl", f'case "$2" in hw.memsize) echo {mem_gb * 1024**3};; machdep.cpu.brand_string) echo "Apple M3 Pro";; *) exit 1;; esac')
    if nvidia:
        name, vram_mb, cuda, *rest = nvidia
        free_mb = rest[0] if rest else vram_mb
        _stub(bin_dir, "nvidia-smi", f'if [ "$1" = "--query-gpu=name,memory.total" ] || [[ "$*" == *query-gpu* ]]; then echo "{name}, {vram_mb}, {free_mb}"; else echo "| NVIDIA-SMI 550.00   Driver Version: 550.00   CUDA Version: {cuda} |"; fi')
    _stub(bin_dir, "curl", f"""url=""; for a in "$@"; do case "$a" in http*) url="$a";; esac; done
case "$url" in
  *api.github.com/repos/ggml-org/llama.cpp/releases*) cat {FIX}/releases.json;;
  *huggingface.co/api/models/*/tree/main) cat {FIX}/hf-tree.json;;
  *nodejs.org/dist/latest-v24.x/SHASUMS256.txt) cat {FIX}/shasums.txt;;
  *) echo "curl-Attrappe: unbekannte Adresse $url" >&2; exit 22;;
esac""")
    meminfo = tmp_path / "meminfo"
    meminfo.write_text(f"MemTotal:       {mem_gb * 1024 * 1024} kB\n")
    env = dict(os.environ)
    env.update({"PATH": f"{bin_dir}:{env['PATH']}", "OTO_MEMINFO": str(meminfo), "OTO_NO_VULKAN": "1", "SIM_DATA_DIR": str(tmp_path / "data"), "HOME": str(tmp_path / "home")})
    return env


def dry(env: dict[str, str], *args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(["bash", str(SCRIPT), "--dry-run", "--yes", *args], env=env, capture_output=True, text=True, timeout=60, cwd=ROOT)


def test_syntax_und_hilfe():
    assert subprocess.run(["bash", "-n", str(SCRIPT)]).returncode == 0
    r = subprocess.run(["bash", str(SCRIPT), "--help"], capture_output=True, text=True)
    assert r.returncode == 0 and "--dry-run" in r.stdout and "--headless" in r.stdout


@pytest.mark.skipif(shutil.which("shellcheck") is None, reason="shellcheck nicht installiert")
def test_shellcheck_sauber():
    r = subprocess.run(["shellcheck", "-x", "-S", "warning", str(SCRIPT), str(ROOT / "scripts" / "start.sh"), *map(str, sorted((ROOT / "scripts" / "install").glob("*.sh")))], capture_output=True, text=True, cwd=ROOT)
    assert r.returncode == 0, r.stdout


def test_unbekannter_schalter():
    r = subprocess.run(["bash", str(SCRIPT), "--gibtesnicht"], capture_output=True, text=True)
    assert r.returncode == 2 and "Unbekannter Schalter" in r.stderr


def test_mac_apple_silicon_nimmt_metal_und_das_8b_modell(tmp_path):
    r = dry(machine(tmp_path, os_name="Darwin", arch="arm64", mem_gb=16))
    assert r.returncode == 0, r.stderr
    assert "Metal (Apple M3 Pro)" in r.stdout
    assert "metal · b102 · llama-b102-bin-macos-arm64.tar.gz" in r.stdout
    assert "nutzbar für Modelle ca. 10,7 GB" in r.stdout            # zwei Drittel des gemeinsamen Speichers
    assert "Qwen3-8B Q4_K_M (5,0 GB, passt gut)" in r.stdout
    assert "Trockenlauf" in r.stdout
    assert not (tmp_path / "data").exists()                          # der Trockenlauf legt nichts an


def test_nvidia_cuda_12_nimmt_cuda_12_dann_vulkan_dann_cpu_und_greift_auf_das_vorige_release_zurueck(tmp_path):
    r = dry(machine(tmp_path, nvidia=("NVIDIA GeForce RTX 3080", 10240, "12.4")))
    assert r.returncode == 0, r.stderr
    lines = [ln.strip() for ln in r.stdout.splitlines() if ln.strip().startswith("Kandidat")]
    assert [ln.split("·")[0].split()[-1] for ln in lines] == ["cuda", "vulkan", "cpu"] or "cuda" in lines[0]
    assert "ubuntu-cuda-12.8-x64" in lines[0] and "b101" in lines[0]    # das neueste Release (b102) hat noch keine Linux-Dateien
    assert "Qwen3-8B" in r.stdout                                      # 9,7 GB nutzbar: 14B braucht 11,5


def test_nvidia_cuda_13_gross_nimmt_cuda_13_und_das_14b_modell(tmp_path):
    r = dry(machine(tmp_path, nvidia=("NVIDIA GeForce RTX 4090", 24576, "13.0")))
    assert "ubuntu-cuda-13.4-x64" in r.stdout
    assert "Qwen3-14B Q4_K_M (9,0 GB, passt gut)" in r.stdout


def test_ohne_grafikkarte_nimmt_cpu_version(tmp_path):
    r = dry(machine(tmp_path, mem_gb=8))
    assert "cpu · b101 · llama-b101-bin-ubuntu-x64.tar.gz" in r.stdout
    assert "Qwen3-4B" in r.stdout                                      # 4,8 GB nutzbar: 8B braucht 7


def test_knapper_speicher_warnt(tmp_path):
    r = dry(machine(tmp_path, mem_gb=4))
    assert "zu groß" in r.stdout and "passt nicht in den nutzbaren Speicher" in r.stdout and "Standard: nein" in r.stdout


def test_modell_waehlen_und_unbekanntes_ablehnen(tmp_path):
    ok = dry(machine(tmp_path, os_name="Darwin", arch="arm64", mem_gb=64), "--model", "qwen3-4b")
    assert "Qwen3-4B" in ok.stdout
    (tmp_path / "x").mkdir()
    bad = dry(machine(tmp_path / "x", os_name="Darwin", arch="arm64"), "--model", "gibtesnicht")
    assert bad.returncode != 0 and "unbekanntes Modell gibtesnicht" in bad.stderr


def test_no_llm_ueberspringt_laufzeit_und_modell(tmp_path):
    r = dry(machine(tmp_path), "--no-llm")
    assert "übersprungen (--no-llm)" in r.stdout and "Kandidat" not in r.stdout


def test_headless_lauscht_im_netz_ohne_zugangsschutz_standardmaessig(tmp_path):
    r = dry(machine(tmp_path), "--headless")
    assert "lauscht im Netz)" in r.stdout and "Zugangsschutz" not in r.stdout
    (tmp_path / "t").mkdir()
    r2 = dry(machine(tmp_path / "t"), "--headless", "--token")
    assert "lauscht im Netz, mit Zugangsschutz" in r2.stdout
    assert "Standard: ja" in r.stdout and "systemd --user" in r.stdout    # auf Servern ist der Dienst die Vorgabe


def test_nicht_unterstuetztes_system(tmp_path):
    r = dry(machine(tmp_path, os_name="FreeBSD"))
    assert r.returncode != 0 and "wird nicht unterstützt" in r.stderr


def test_projektordner_mit_leerzeichen_wird_abgelehnt(tmp_path):
    copy = tmp_path / "mein ordner"
    copy.mkdir()
    shutil.copy(SCRIPT, copy / "install.sh")
    shutil.copytree(ROOT / "scripts" / "install", copy / "scripts" / "install")
    env_dir = tmp_path / "m"
    env_dir.mkdir()
    r = subprocess.run(["bash", str(copy / "install.sh"), "--dry-run", "--yes"], env=machine(env_dir), capture_output=True, text=True, timeout=60)
    assert r.returncode != 0 and "Leerzeichen" in r.stderr


def test_belegte_grafikkarte_zaehlt_nur_den_freien_speicher(tmp_path):
    r = dry(machine(tmp_path, nvidia=("NVIDIA GeForce RTX 3060", 12288, "13.2", 1260)))
    assert "davon frei 1,2 GB" in r.stdout and "zum großen Teil belegt" in r.stdout
    assert "zu groß" in r.stdout and "Standard: nein" in r.stdout        # kleinstes Modell wird nur vorgeschlagen, nicht still geladen


def test_zweiter_lauf_behaelt_das_token(tmp_path):
    """Echter Lauf (ohne Netz, ohne Dienst): `--headless --token` schreibt den Block; ein zweiter Lauf darf das Token nicht verlieren."""
    root = tmp_path / "on_their_own"
    (root / "backend" / "on_their_own" / "data").mkdir(parents=True)
    shutil.copy(SCRIPT, root / "install.sh")
    shutil.copytree(ROOT / "scripts" / "install", root / "scripts" / "install")
    shutil.copy(ROOT / "backend" / "on_their_own" / "data" / "models.json", root / "backend" / "on_their_own" / "data" / "models.json")
    env_dir = tmp_path / "m"
    env_dir.mkdir()
    env = machine(env_dir)
    # Nur das Schreiben der Einstellungen prüfen: die Funktion aus dem Skript herauslösen
    harness = root / "harness.sh"
    harness.write_text('set -euo pipefail\nsource <(sed -n "/^write_env()/,/^}/p; /^py()/,/^}/p; /^have()/p; /^ok()/p; /^warn()/p; /^plan()/p; /^MARK/p" "$1" "$(dirname "$1")/scripts/install/model.sh")\nROOT="$2"; DRY=0; HEADLESS=1; TOKEN=${TOKEN:-1}; NO_LLM=1; MODEL_ALIAS=""; LLM_PORT=8081; C_W=""; C_0=""; C_OK=""; C_D=""\nwrite_env\n')
    def run_once():
        return subprocess.run(["bash", str(harness), str(SCRIPT), str(root)], env=env, capture_output=True, text=True, timeout=30)
    first = run_once()
    assert first.returncode == 0, first.stderr
    envf = root / "backend" / ".env"
    t1 = [ln for ln in envf.read_text().splitlines() if ln.startswith("SIM_ACCESS_TOKEN=")]
    assert len(t1) == 1 and len(t1[0]) > len("SIM_ACCESS_TOKEN=") + 16
    second = run_once()
    assert second.returncode == 0, second.stderr
    assert [ln for ln in envf.read_text().splitlines() if ln.startswith("SIM_ACCESS_TOKEN=")] == t1
    assert envf.read_text().count("# --- on-their-own install") == 1
    assert oct(envf.stat().st_mode & 0o777) == "0o600"


def test_ohne_token_schalter_steht_kein_token_in_der_env(tmp_path):
    root = tmp_path / "on_their_own"
    (root / "backend").mkdir(parents=True)
    harness = tmp_path / "harness.sh"
    harness.write_text('set -euo pipefail\nsource <(sed -n "/^write_env()/,/^}/p; /^py()/,/^}/p; /^have()/p; /^ok()/p; /^warn()/p; /^plan()/p; /^MARK/p" "$1" "$(dirname "$1")/scripts/install/model.sh")\nROOT="$2"; DRY=0; HEADLESS=1; TOKEN=0; NO_LLM=1; MODEL_ALIAS=""; LLM_PORT=8081; C_W=""; C_0=""; C_OK=""; C_D=""\nwrite_env\n')
    envf = root / "backend" / ".env"
    # ein früher geschriebener Block mit Token (alter Lauf) verschwindet, wenn --token fehlt; eigene Einträge bleiben
    envf.write_text("EIGEN=1\n# --- on-their-own install (verwaltet von install.sh) ---\nSIM_ACCESS_TOKEN=altes\n# --- ende on-their-own install ---\n")
    env_dir = tmp_path / "m"
    env_dir.mkdir()
    r = subprocess.run(["bash", str(harness), str(SCRIPT), str(root)], env=machine(env_dir), capture_output=True, text=True, timeout=30)
    assert r.returncode == 0, r.stderr
    text = envf.read_text()
    assert "SIM_ACCESS_TOKEN" not in text and "EIGEN=1" in text and "SIM_HOST=" in text
    assert "ohne Zugangsschutz" in r.stdout
