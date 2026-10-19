"""llama.cpp aus den offiziellen Releases (AP17c-3): dieselbe Auswahl wie `scripts/install/runtime.sh`, aber im Tool („Laufzeit installieren“).

Quelle ist die Release-Liste von `ggml-org/llama.cpp` (GitHub-API); jede Datei hat dort einen `digest` (SHA-256), gegen den geprüft wird. Entpackt wird nach
`data/runtime/llama.cpp/<Version>-<Art>/`, `current` zeigt auf die zuletzt funktionierende Version. Ältere Versionen werden entfernt, wie im Skript."""

from __future__ import annotations

import asyncio
import os
import re
import shutil
import subprocess
import tarfile
import uuid
from dataclasses import dataclass
from pathlib import Path

import httpx

from .. import __version__
from .hardware import Hardware
from .transfer import GITHUB_HOSTS, Transfer, TransferError, TransferManager, sha256_of, stream_to

RELEASES_URL = "https://api.github.com/repos/ggml-org/llama.cpp/releases?per_page=12"
VERSION_CHECK_S = 20.0


@dataclass
class Candidate:
    kind: str               # metal | cuda | vulkan | cpu
    tag: str
    name: str
    url: str
    sha256: str
    size: int = 0
    cudart_url: str = ""
    cudart_sha256: str = ""
    cudart_size: int = 0


def _suffixes(hw: Hardware) -> list[tuple[str, str]]:
    """(Art, Dateiendung der Release-Datei) in der Reihenfolge der Vorliebe."""
    cuda = int((hw.cuda_version or "0").split(".")[0] or 0)
    if hw.os == "macos":
        return [("metal", "macos-arm64" if hw.arch == "arm64" else "macos-x64")]
    if hw.os != "linux":
        return []                                                            # Windows und anderes: nicht unterstützt
    a = "x64" if hw.arch == "x64" else "arm64"
    out: list[tuple[str, str]] = []
    if hw.kind == "nvidia" and a == "x64":
        if cuda >= 13:
            out.append(("cuda", "ubuntu-cuda-13.4-x64"))
        if cuda >= 12:
            out.append(("cuda", "ubuntu-cuda-12.8-x64"))
    elif hw.kind == "nvidia" and cuda >= 13:
        out.append(("cuda", "ubuntu-cuda-13.4-arm64"))
    if hw.kind in ("nvidia", "amd", "vulkan"):
        out.append(("vulkan", f"ubuntu-vulkan-{a}"))
    return out + [("cpu", f"ubuntu-{a}")]


def candidates(releases: list[dict], hw: Hardware) -> list[Candidate]:
    """Passende Dateien aus den Releases, beste zuerst (je Art das jüngste Release, das sie enthält)."""
    def find(rel: dict, pat: str) -> dict | None:
        return next((a for a in rel.get("assets", []) if re.fullmatch(pat, a.get("name", ""))), None)

    out: list[Candidate] = []
    for kind, suffix in _suffixes(hw):
        for rel in releases:
            a = find(rel, r"llama-b\d+-bin-" + re.escape(suffix) + r"\.tar\.gz")
            if not a:
                continue
            c = find(rel, r"cudart-llama-b\d+-bin-" + re.escape(suffix) + r"\.tar\.gz") if kind == "cuda" else None
            out.append(Candidate(kind, rel["tag_name"], a["name"], a["browser_download_url"], (a.get("digest") or "").replace("sha256:", ""), int(a.get("size") or 0),
                                 (c or {}).get("browser_download_url", ""), ((c or {}).get("digest") or "").replace("sha256:", ""), int((c or {}).get("size") or 0)))
            break
    return out


def find_binary(runtime_dir: Path) -> Path | None:
    """`llama-server` in `current`, sonst auf dem Suchpfad."""
    cur = runtime_dir / "current"
    if cur.exists():
        hit = next((p for p in sorted(cur.rglob("llama-server")) if p.is_file()), None)
        if hit:
            return hit
    found = shutil.which("llama-server")
    return Path(found) if found else None


def version_of(runtime_dir: Path) -> tuple[str | None, str | None]:
    """(Version, Art) aus dem Ordnernamen hinter `current`, z. B. („b6532“, „metal“)."""
    cur = runtime_dir / "current"
    if not cur.exists():
        return None, None
    m = re.match(r"^(b\d+)-(\w+)$", cur.resolve().name)
    return (m.group(1), m.group(2)) if m else (None, None)


def _check(binary: Path) -> bool:
    env_path = str(binary.parent)
    env = dict(os.environ, LD_LIBRARY_PATH=env_path + ":" + os.environ.get("LD_LIBRARY_PATH", ""), DYLD_LIBRARY_PATH=env_path + ":" + os.environ.get("DYLD_LIBRARY_PATH", ""))
    try:
        binary.chmod(binary.stat().st_mode | 0o111)
        return subprocess.run([str(binary), "--version"], env=env, capture_output=True, timeout=VERSION_CHECK_S).returncode == 0
    except (OSError, subprocess.SubprocessError):
        return False


def _unpack(archive: Path, dest: Path) -> None:
    dest.mkdir(parents=True, exist_ok=True)
    with tarfile.open(archive) as tf:
        tf.extractall(dest, filter="data")                                  # lehnt Pfade außerhalb, Geräte und gefährliche Links ab


class RuntimeInstaller:
    def __init__(self, runtime_dir: Path, manager: TransferManager, transport: httpx.AsyncBaseTransport | None = None, releases_url: str = RELEASES_URL):
        self.dir, self.manager, self.releases_url = runtime_dir, manager, releases_url
        self._client = httpx.AsyncClient(transport=transport, timeout=httpx.Timeout(30.0, read=60.0), headers={"User-Agent": f"simulacra/{__version__}"}, follow_redirects=False)

    async def aclose(self) -> None:
        await self._client.aclose()

    async def start(self, hw: Hardware) -> Transfer:
        if self.manager.busy:
            raise TransferError(409, f"Es läuft schon eine Übertragung ({self.manager.current.label}). Bitte warten oder abbrechen.")  # type: ignore[union-attr]
        if not _suffixes(hw):
            raise TransferError(422, f"Für {hw.os} {hw.arch} gibt es hier keine fertige llama.cpp-Version. Bitte selbst bauen oder einen externen Server verwenden.")
        try:
            r = await self._client.get(self.releases_url)
            r.raise_for_status()
            cands = candidates(r.json(), hw)
        except (httpx.HTTPError, ValueError):
            raise TransferError(502, "Die Release-Liste von llama.cpp (GitHub) ist nicht erreichbar.") from None
        if not cands:
            raise TransferError(422, f"In den Releases von llama.cpp steht keine passende Datei für {hw.os} {hw.arch} ({hw.kind}).")
        if any(not c.sha256 for c in cands):
            cands = [c for c in cands if c.sha256]
            if not cands:
                raise TransferError(422, "Die Releases nennen keine Prüfsumme für die passende Datei; sie wird nicht geladen.")
        first = cands[0]
        t = Transfer(str(uuid.uuid4()), "runtime", f"llama.cpp {first.tag} ({first.kind})", first.name, first.url.split("?")[0])
        return self.manager.start(t, lambda tr, m: self._work(tr, m, cands))

    async def _work(self, t: Transfer, m: TransferManager, cands: list[Candidate]) -> None:
        errors: list[str] = []
        for c in cands:
            target = self.dir / f"{c.tag}-{c.kind}"
            tmp = self.dir / f".laden-{t.id[:8]}"
            try:
                t.label, t.file = f"llama.cpp {c.tag} ({c.kind})", c.name
                if not (target.exists() and any(target.rglob("llama-server"))):
                    tmp.mkdir(parents=True, exist_ok=True)
                    await self._fetch(t, m, c.url, tmp / c.name, c.sha256, c.size)
                    m.phase(t, "unpacking")
                    await _in_thread(_unpack, tmp / c.name, target)
                    if c.cudart_url:
                        await self._fetch(t, m, c.cudart_url, tmp / "cudart.tar.gz", c.cudart_sha256, c.cudart_size)
                        m.phase(t, "unpacking")
                        await _in_thread(_unpack, tmp / "cudart.tar.gz", target)
                binary = next((p for p in sorted(target.rglob("llama-server")) if p.is_file()), None)
                if binary is not None and await _in_thread(_check, binary):
                    link = self.dir / "current"
                    if link.is_symlink() or link.exists():
                        link.unlink()
                    link.symlink_to(target.name)
                    for old in self.dir.glob("b*-*"):
                        if old != target and old.is_dir():
                            shutil.rmtree(old, ignore_errors=True)           # ältere Versionen aufräumen
                    return
                errors.append(f"{c.name} läuft auf diesem Rechner nicht")
                shutil.rmtree(target, ignore_errors=True)
            finally:
                shutil.rmtree(tmp, ignore_errors=True)
        raise TransferError(422, "Keine der llama.cpp-Versionen läuft auf diesem Rechner: " + "; ".join(errors))

    async def _fetch(self, t: Transfer, m: TransferManager, url: str, dest: Path, sha: str, size: int) -> None:
        m.phase(t, "downloading")
        m.reset(t, 0)
        t.total = size
        await stream_to(self._client, url, dest, allowed=GITHUB_HOSTS, total=size, on_bytes=lambda n: m.advance(t, n), check=m.check, restart=lambda: m.reset(t, 0))
        m.phase(t, "verifying")
        m.reset(t, 0)
        got = await sha256_of(dest, lambda n: m.advance(t, n), lambda: m.cancelled)
        if got != sha:
            dest.unlink(missing_ok=True)
            raise TransferError(502, f"Die Prüfsumme von {dest.name} stimmt nicht mit der Angabe von GitHub überein; die Datei wurde verworfen.")


async def _in_thread(fn, *args):
    return await asyncio.to_thread(fn, *args)
