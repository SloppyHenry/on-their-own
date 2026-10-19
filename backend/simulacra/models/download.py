"""Modell laden (AP17c-3): Datei, Größe und Prüfsumme kommen vom Server aus der Dateiliste von Hugging Face (nie vom Browser); geladen wird fortsetzbar nach
`<Datei>.part`, geprüft gegen SHA-256 und erst dann umbenannt und in den Bestand eingetragen."""

from __future__ import annotations

import re
import shutil
import uuid
from pathlib import Path

import httpx

from .. import __version__
from .filters import display_name, license_of
from .fit import quant_of
from .hf import HF_URL, HFClient
from .store import Installed, ModelStore
from .transfer import HF_HOSTS, Cancelled, Transfer, TransferError, TransferManager, sha256_of, stream_to

REPO = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,95}/[A-Za-z0-9][A-Za-z0-9._-]{0,95}$")
FILE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._+-]{0,150}\.gguf$")
SHA256 = re.compile(r"^[0-9a-f]{64}$")
RESERVE = 1.10                          # Platz: Größe plus 10 %


class ModelDownloader:
    def __init__(self, store: ModelStore, manager: TransferManager, hf: HFClient, transport: httpx.AsyncBaseTransport | None = None):
        self.store, self.manager, self.hf = store, manager, hf
        self._client = httpx.AsyncClient(transport=transport, timeout=httpx.Timeout(30.0, read=60.0), headers={"User-Agent": f"simulacra/{__version__}"})

    async def aclose(self) -> None:
        await self._client.aclose()

    async def start(self, repo: str, file: str) -> Transfer:
        """Prüft Eingabe, Quelle und Platz und startet den Auftrag. Die Bestätigung des Menschen hat die API schon verlangt."""
        if not REPO.match(repo) or not FILE.match(file):
            raise TransferError(422, "Repository oder Dateiname sind nicht zulässig (nur eine .gguf-Datei im obersten Ordner eines Hugging-Face-Repositories).")
        if self.manager.busy:
            raise TransferError(409, f"Es läuft schon eine Übertragung ({self.manager.current.label}). Bitte warten oder abbrechen.")  # type: ignore[union-attr]
        tree = await self.hf.get(f"/api/models/{repo}/tree/main", refresh=True)
        if not isinstance(tree.data, list):
            raise TransferError(502 if tree.status == "failed" else 422, "Das Repository ist nicht erreichbar oder verlangt eine Anmeldung bei Hugging Face (nicht unterstützt).")
        entry = next((e for e in tree.data if e.get("path") == file and e.get("type") == "file"), None)
        if entry is None:
            raise TransferError(422, f"Die Datei {file} gibt es in {repo} nicht.")
        sha = (entry.get("lfs") or {}).get("oid") or ""
        total = int(entry.get("size") or 0)
        if not SHA256.match(sha) or total <= 0:
            raise TransferError(422, "Hugging Face nennt für diese Datei keine Prüfsumme; sie wird nicht geladen.")
        mid = file[:-5]
        part = self.store.dir / f"{file}.part"
        self.store.dir.mkdir(parents=True, exist_ok=True)
        need = int((total - (part.stat().st_size if part.exists() else 0)) * RESERVE)
        free = shutil.disk_usage(self.store.dir).free
        if free < need:
            raise TransferError(507, f"Nicht genug Platz: gebraucht werden etwa {need / 1e9:.1f} GB, frei sind {free / 1e9:.1f} GB.")
        meta = await self.hf.get(f"/api/models/{repo}")
        tags = [t for t in (meta.data or {}).get("tags", []) if isinstance(t, str)] if isinstance(meta.data, dict) else []
        t = Transfer(str(uuid.uuid4()), "model", display_name(repo), file, f"{HF_URL}/{repo}", total=total, model_id=mid)
        installed = Installed(mid, file, display_name(repo), total, quant_of(file), repo, sha, license_of(tags))
        return self.manager.start(t, lambda tr, m: self._work(tr, m, repo, installed, part))

    async def _work(self, t: Transfer, m: TransferManager, repo: str, installed: Installed, part: Path) -> None:
        m.phase(t, "downloading")
        m.reset(t, part.stat().st_size if part.exists() else 0)
        try:
            await stream_to(self._client, f"{HF_URL}/{repo}/resolve/main/{installed.file}", part, allowed=HF_HOSTS, total=t.total,
                            on_bytes=lambda n: m.advance(t, n), check=m.check, restart=lambda: m.reset(t, 0))
            m.phase(t, "verifying")
            m.reset(t, 0)
            got = await sha256_of(part, lambda n: m.advance(t, n), lambda: m.cancelled)
        except Cancelled:
            part.unlink(missing_ok=True)                                     # Abbruch räumt die Teildatei weg; nach einem Verbindungsfehler bleibt sie zum Fortsetzen
            raise
        if got != installed.sha256:
            part.unlink(missing_ok=True)                                     # kaputte Datei nie behalten
            raise TransferError(502, "Die Prüfsumme stimmt nicht mit der Angabe von Hugging Face überein; die Datei wurde verworfen.")
        part.replace(self.store.path(installed.id))
        self.store.add(installed)
