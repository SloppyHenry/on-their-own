"""Übertragungen (AP17c-3): fortsetzbarer Download mit Fortschritt, feste Liste erlaubter Hosts, SHA-256-Prüfung, ein Auftrag zugleich.

Geladen wird nur über HTTPS von den Hosts der Liste; Weiterleitungen (Hugging Face leitet auf sein CDN) folgt der Code von Hand und prüft jeden Schritt gegen
die Liste. Nichts hier führt heruntergeladene Dateien aus."""

from __future__ import annotations

import asyncio
import hashlib
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Awaitable, Callable
from urllib.parse import urljoin, urlsplit

import httpx

HF_HOSTS = ("huggingface.co", "hf.co")                                     # Hugging Face und sein CDN (cdn-lfs.huggingface.co, cas-bridge.xethub.hf.co …)
GITHUB_HOSTS = ("github.com", "githubusercontent.com")                     # Releases von llama.cpp (objects/release-assets.githubusercontent.com)
CHUNK = 1 << 20
MAX_HOPS = 5
ATTEMPTS = 4                                                               # Verbindungsabbrüche: bis zu dreimal von der Abbruchstelle weiter
PUBLISH_GAP_S = 0.2                                                        # Fortschritt höchstens fünfmal je Sekunde melden


class TransferError(Exception):
    """Fehler mit Statuscode für die API (409 belegt/Zustand, 422 Eingabe, 502 Quelle, 507 Platz)."""

    def __init__(self, status: int, text: str):
        super().__init__(text)
        self.status, self.text = status, text


class Cancelled(Exception):
    pass


def host_ok(url: str, allowed: tuple[str, ...]) -> bool:
    parts = urlsplit(url)
    host = (parts.hostname or "").lower()
    return parts.scheme == "https" and any(host == h or host.endswith("." + h) for h in allowed)


@dataclass
class Transfer:
    id: str
    kind: str                       # model | runtime
    label: str                      # was geladen wird, für die Anzeige
    file: str
    source: str                     # Quelle (Adresse ohne Parameter), für die Anzeige
    total: int = 0                  # Bytes laut Quelle; 0 = unbekannt
    done: int = 0
    phase: str = "preparing"        # preparing | downloading | verifying | unpacking | done | failed | cancelled
    speed_bps: float = 0.0
    error: str | None = None
    model_id: str | None = None     # bei kind=model: Name im Bestand, sobald fertig
    started: float = field(default_factory=time.time)
    finished: float | None = None
    _mark: tuple[float, int] = field(default=(0.0, 0), repr=False)

    @property
    def active(self) -> bool:
        return self.phase in ("preparing", "downloading", "verifying", "unpacking")

    @property
    def eta_s(self) -> float | None:
        return round((self.total - self.done) / self.speed_bps) if self.phase == "downloading" and self.speed_bps > 0 and self.total > self.done else None


class TransferManager:
    """Ein Auftrag zugleich (Modell oder Laufzeit). Der letzte bleibt mit Ergebnis sichtbar, bis ein neuer beginnt oder `dismiss()` kommt."""

    def __init__(self, notify: Callable[[], None]):
        self.current: Transfer | None = None
        self._notify = notify
        self._task: asyncio.Task | None = None
        self._cancel = asyncio.Event()
        self._last_pub = 0.0

    @property
    def busy(self) -> bool:
        return self.current is not None and self.current.active

    def start(self, t: Transfer, work: Callable[[Transfer, "TransferManager"], Awaitable[None]]) -> Transfer:
        if self.busy:
            raise TransferError(409, f"Es läuft schon eine Übertragung ({self.current.label}). Bitte warten oder abbrechen.")  # type: ignore[union-attr]
        self.current, self._cancel = t, asyncio.Event()
        self._task = asyncio.create_task(self._run(t, work))
        self._notify()
        return t

    async def _run(self, t: Transfer, work: Callable[[Transfer, "TransferManager"], Awaitable[None]]) -> None:
        try:
            await work(t, self)
            t.phase = "done"
        except Cancelled:
            t.phase, t.error = "cancelled", None
        except TransferError as e:
            t.phase, t.error = "failed", e.text
        except Exception as e:                                               # unerwartet: melden statt still sterben
            t.phase, t.error = "failed", f"{type(e).__name__}: {e}"
        t.finished, t.speed_bps = time.time(), 0.0
        self._notify()

    def cancel(self) -> bool:
        if not self.busy:
            return False
        self._cancel.set()
        return True

    def dismiss(self) -> None:
        if self.current is not None and not self.current.active:
            self.current = None
            self._notify()

    @property
    def cancelled(self) -> bool:
        return self._cancel.is_set()

    def check(self) -> None:
        if self._cancel.is_set():
            raise Cancelled()

    def phase(self, t: Transfer, phase: str) -> None:
        t.phase = phase
        self._notify()

    def reset(self, t: Transfer, done: int) -> None:
        """Fortschritt auf `done` setzen (Fortsetzen, Neubeginn, nächste Phase)."""
        t.done, t.speed_bps, t._mark = done, 0.0, (0.0, done)

    def advance(self, t: Transfer, n: int) -> None:
        """n Bytes mehr; die Geschwindigkeit ist der Schnitt über das letzte Sekundenfenster."""
        t.done += n
        now = time.monotonic()
        if now - t._mark[0] >= 1.0:
            t.speed_bps = (t.done - t._mark[1]) / (now - t._mark[0]) if t._mark[0] else 0.0
            t._mark = (now, t.done)
        if now - self._last_pub >= PUBLISH_GAP_S:
            self._last_pub = now
            self._notify()

    async def aclose(self) -> None:
        if self._task is not None and not self._task.done():
            self._cancel.set()
            try:
                await asyncio.wait_for(self._task, 10)
            except (asyncio.TimeoutError, asyncio.CancelledError):
                self._task.cancel()


async def _open(client: httpx.AsyncClient, url: str, pos: int, allowed: tuple[str, ...]) -> httpx.Response:
    """GET (ab Byte `pos`), Weiterleitungen von Hand und nur auf erlaubte Hosts."""
    for _ in range(MAX_HOPS + 1):
        if not host_ok(url, allowed):
            raise TransferError(422, f"Die Adresse {urlsplit(url).hostname or url} ist nicht erlaubt (geladen wird nur von {', '.join(allowed)}).")
        req = client.build_request("GET", url, headers={"Accept-Encoding": "identity", **({"Range": f"bytes={pos}-"} if pos else {})})
        resp = await client.send(req, stream=True, follow_redirects=False)
        if resp.status_code in (301, 302, 303, 307, 308) and resp.headers.get("location"):
            await resp.aclose()
            url = urljoin(url, resp.headers["location"])
            continue
        return resp
    raise TransferError(502, "Zu viele Weiterleitungen.")


async def stream_to(client: httpx.AsyncClient, url: str, part: Path, *, allowed: tuple[str, ...], total: int, on_bytes: Callable[[int], None], check: Callable[[], None],
                    restart: Callable[[], None] | None = None) -> None:
    """Lädt `url` nach `part` und setzt eine vorhandene Teildatei fort (`Range`). Bei Verbindungsabbruch bis zu dreimal weiter. `restart` meldet, dass der Server
    das Fortsetzen ablehnt und von vorn beginnt (der Fortschritt zählt dann neu)."""
    part.parent.mkdir(parents=True, exist_ok=True)
    last: Exception | None = None
    for attempt in range(ATTEMPTS):
        pos = part.stat().st_size if part.exists() else 0
        if total and pos > total:
            part.unlink()
            pos = 0
        if total and pos == total:
            return
        try:
            resp = await _open(client, url, pos, allowed)
            try:
                if resp.status_code == 416:                                  # Teildatei passt nicht zur Quelle: neu beginnen
                    part.unlink(missing_ok=True)
                    if restart:
                        restart()
                    continue
                if resp.status_code not in (200, 206):
                    raise TransferError(502 if resp.status_code >= 500 else 422, f"Die Quelle antwortet mit HTTP {resp.status_code}.")
                if resp.status_code == 200 and pos:                          # Server ignoriert Range: von vorn
                    pos = 0
                    if restart:
                        restart()
                with part.open("ab" if pos else "wb") as f:
                    async for chunk in resp.aiter_raw():                      # Stücke so, wie sie ankommen: bei einem Abbruch geht nichts Gepuffertes verloren
                        check()
                        f.write(chunk)
                        on_bytes(len(chunk))
            finally:
                await resp.aclose()
        except (httpx.TransportError, httpx.DecodingError) as e:
            last = e
            await asyncio.sleep(min(2.0 * (attempt + 1), 5.0))
            continue
        if not total or part.stat().st_size >= total:
            return
        last = TransferError(502, "Die Übertragung endete vor der Zeit.")
    if isinstance(last, TransferError):
        raise last
    raise TransferError(502, f"Verbindung zur Quelle verloren ({type(last).__name__ if last else 'unbekannt'}). Die Teildatei bleibt; erneut laden setzt fort.")


def _hash(path: Path, progress: Callable[[int], None], cancelled: Callable[[], bool]) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        while chunk := f.read(8 * CHUNK):
            if cancelled():
                raise Cancelled()
            h.update(chunk)
            progress(len(chunk))
    return h.hexdigest()


async def sha256_of(path: Path, progress: Callable[[int], None], cancelled: Callable[[], bool]) -> str:
    """Prüfsumme in einem Thread (blockiert die Ereignisschleife nicht); `progress` kommt aus dem Thread und wird auf die Schleife übertragen."""
    loop = asyncio.get_running_loop()
    return await asyncio.to_thread(_hash, path, lambda n: loop.call_soon_threadsafe(progress, n), cancelled)
