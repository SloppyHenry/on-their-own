"""Kleiner Hugging-Face-Client mit Zwischenspeicher (AP17c-2). Nur lesende Abfragen der öffentlichen API; nichts wird geladen oder geschrieben außer dem Zwischenspeicher."""

from __future__ import annotations

import asyncio
import hashlib
import json
import os
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable

import httpx

from .. import __version__

HF_URL = "https://huggingface.co"
CACHE_TTL_S = 6 * 3600
LIST_FIELDS = ["gguf", "tags", "pipeline_tag", "gated", "downloads", "lastModified", "likes", "trendingScore", "author"]
MAX_PARALLEL = 8


@dataclass
class Got:
    data: Any                       # None, wenn nicht erreichbar, nicht vorhanden oder gesperrt
    status: str                     # network | cache | stale | missing (404/401/403, ebenfalls zwischengespeichert) | failed
    fetched_at: float | None


class HFClient:
    """GET mit Zwischenspeicher je Adresse in `cache_dir` (6 h). Bei Netzfehler gilt ein älterer Eintrag („stale“) statt eines Fehlers."""

    def __init__(self, cache_dir: Path, transport: httpx.AsyncBaseTransport | None = None, now: Callable[[], float] = time.time, ttl: float = CACHE_TTL_S, timeout: float = 15.0):
        self.cache_dir, self._now, self._ttl = cache_dir, now, ttl
        self._client = httpx.AsyncClient(transport=transport, timeout=timeout, headers={"User-Agent": f"simulacra/{__version__}"}, follow_redirects=True)
        self._sem = asyncio.Semaphore(MAX_PARALLEL)

    async def aclose(self) -> None:
        await self._client.aclose()

    def _path(self, url: str) -> Path:
        return self.cache_dir / (hashlib.sha256(url.encode()).hexdigest()[:24] + ".json")

    def _read(self, url: str) -> tuple[Any, float] | None:
        try:
            e = json.loads(self._path(url).read_text())
            return (None if e.get("missing") else e["data"]), float(e["fetched_at"])
        except (OSError, ValueError, KeyError, TypeError):
            return None

    def _write(self, url: str, data: Any, missing: int | None = None) -> None:
        try:
            self.cache_dir.mkdir(parents=True, exist_ok=True)
            p = self._path(url)
            tmp = p.with_suffix(f".{os.getpid()}.tmp")
            tmp.write_text(json.dumps({"url": url, "fetched_at": self._now(), "data": data, "missing": missing}, ensure_ascii=False))
            tmp.replace(p)
        except OSError:
            pass                    # ohne Zwischenspeicher geht es weiter, nur langsamer

    async def get(self, path: str, params: list[tuple[str, str]] | None = None, refresh: bool = False) -> Got:
        url = str(httpx.URL(HF_URL + path, params=params))
        cached = self._read(url)
        if cached and not refresh and self._now() - cached[1] < self._ttl:
            return Got(cached[0], "cache" if cached[0] is not None else "missing", cached[1])
        try:
            async with self._sem:
                r = await self._client.get(url)
            if r.status_code in (401, 403, 404):          # Repository gelöscht oder gesperrt: nicht bei jedem Abruf neu fragen
                self._write(url, None, r.status_code)
                return Got(None, "missing", self._now())
            r.raise_for_status()
            data = r.json()
        except (httpx.HTTPError, ValueError):
            return Got(cached[0], "stale", cached[1]) if cached and cached[0] is not None else Got(None, "failed", None)
        self._write(url, data)
        return Got(data, "network", self._now())


def list_params(sort: str, limit: int, *, author: str | None = None, search: str | None = None) -> list[tuple[str, str]]:
    p = [("filter", "gguf"), ("sort", sort), ("limit", str(limit))]
    if author:
        p.append(("author", author))
    if search:
        p.append(("search", search))
    return p + [("expand[]", f) for f in LIST_FIELDS]
