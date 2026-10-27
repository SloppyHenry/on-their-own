"""Modellkatalog (AP17c-2): Live-Liste von Hugging Face und kuratierte Liste, zusammengeführt, gefiltert, nach Passung zum Rechner geordnet.

Ablauf: Trend- und Herausgeberlisten holen (6 h Zwischenspeicher) -> Metadaten filtern (filters.py) -> von den Treffern die Dateilisten holen ->
Dateien Q4–Q8 je Rechner bewerten (rank.py/fit.py) -> mit der kuratierten Liste mischen. Ohne Netz bleiben Zwischenspeicher und kuratierte Liste."""

from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable

import httpx

from . import curated as cur
from .filters import NO_FILE, display_name, is_moe, is_uncensored, license_of, reject_reason, usable_files
from .fit import active_from_name, need_mb, params_from_name
from .hardware import Hardware
from .hf import HFClient, Got, list_params
from .rank import Item, make_variant, pick_variant, rank_key, recommend

TOO_BIG = "zu groß für diesen Rechner"
NO_TREE = "Dateiliste nicht geladen"
OVER_CAP = "über der Obergrenze der Abfragen"
MAX_TREES = 80                  # Dateilisten je Abruf (jede ist eine Anfrage, danach 6 h im Zwischenspeicher)
LIST_LIMIT = 100                # Treffer der Trendliste
AUTHOR_LIMIT = 20               # Treffer je Herausgeber
SEARCH_LIMIT = 40
Q4_MIN_BITS = 4.3               # kleinste Q4-Datei (IQ4_XS) je Gewicht, um offensichtlich zu große Modelle ohne Dateiliste auszusortieren


@dataclass
class CatalogResult:
    items: list[Item]
    recommended: list[Item]
    source: str                 # live | cache | stale | curated
    fetched_at: float | None
    note: str | None
    hidden: dict[str, int] = field(default_factory=dict)
    total: int = 0              # Treffer vor der Begrenzung auf `limit`


def _params_b(meta: dict, name: str) -> float | None:
    total = (meta.get("gguf") or {}).get("total")
    return round(total / 1e9, 2) if isinstance(total, (int, float)) and total > 0 else params_from_name(name)


def build_item(meta: dict, tree: list[dict], hw: Hardware, curated: dict | None) -> Item | None:
    """Ein Eintrag mit allen Dateien Q4–Q8; None, wenn keine Datei übrig bleibt."""
    repo = meta["id"]
    name = curated["name"] if curated else display_name(repo)
    tags = [t for t in meta.get("tags") or [] if isinstance(t, str)]
    arch = (meta.get("gguf") or {}).get("architecture")
    params = _params_b(meta, repo) or (curated or {}).get("params_b")
    active = active_from_name(repo)
    files = usable_files(tree)
    if not files:
        return None
    variants = [make_variant(f["file"], f["quant"], f["size_mb"], f["sha256"], params, active, hw) for f in files]
    pick = next((v for v in variants if curated and v.file == curated["file"]), None) or pick_variant(variants)
    gated = meta.get("gated") not in (False, None)
    return Item(repo, name, meta.get("author") or repo.split("/")[0], license_of(tags) or (curated or {}).get("license"), "curated" if curated else "live", pick, variants,
                params, active, is_moe(tags, arch) or active is not None, meta.get("pipeline_tag") in ("image-text-to-text", "any-to-any"), is_uncensored(repo, tags), gated,
                meta.get("downloads"), meta.get("likes"), meta.get("lastModified"), curated["key"] if curated else None)


def _too_big_without_tree(meta: dict, hw: Hardware) -> bool:
    """Schon aus der Parameterzahl ersichtlich, dass selbst die kleinste Q4-Datei nicht passt."""
    params = _params_b(meta, meta.get("id", ""))
    if not params:
        return False
    size_mb = params * 1e9 * Q4_MIN_BITS / 8 / 1048576
    return need_mb(size_mb, params) > hw.usable_mb


class Catalog:
    def __init__(self, data_dir: Path, curated: cur.Curated | None = None, transport: httpx.AsyncBaseTransport | None = None, now: Callable[[], float] = time.time):
        self.curated = curated or cur.load()
        self._hf = HFClient(Path(data_dir) / "models" / "cache", transport=transport, now=now)

    async def aclose(self) -> None:
        await self._hf.aclose()

    async def _lists(self, q: str | None, trusted: bool, refresh: bool) -> list[Got]:
        reqs = [list_params("trendingScore", LIST_LIMIT)]
        if trusted:
            reqs += [list_params("trendingScore", AUTHOR_LIMIT, author=p) for p in self.curated.publishers]
        if q:
            reqs.append(list_params("downloads", SEARCH_LIMIT, search=q))
        return list(await asyncio.gather(*(self._hf.get("/api/models", p, refresh) for p in reqs)))

    async def load(self, hw: Hardware, *, q: str | None = None, only_fit: bool = False, trusted_only: bool = True, refresh: bool = False, limit: int = 50) -> CatalogResult:
        q = (q or "").strip() or None
        lists = await self._lists(q, trusted_only, refresh)
        publishers = set(self.curated.publishers) if trusted_only else None
        curated_by_repo = {m["repo"]: m for m in self.curated.models}
        hidden: dict[str, int] = {}

        def hide(reason: str) -> None:
            hidden[reason] = hidden.get(reason, 0) + 1

        # Metadaten zusammenführen (erste Fundstelle gewinnt: Trend vor Herausgeber vor Suche) und filtern
        metas: dict[str, dict] = {}
        base_ids: set[str] = set()
        for i, got in enumerate(lists):
            is_search = q is not None and i == len(lists) - 1
            for m in got.data or []:
                if isinstance(m, dict) and isinstance(m.get("id"), str):
                    metas.setdefault(m["id"], m)
                    if not is_search:
                        base_ids.add(m["id"])
        candidates: list[dict] = []
        for repo, m in metas.items():
            if repo in curated_by_repo:
                candidates.append(m)
                continue
            why = reject_reason(m, publishers)
            if why:
                hide(why)
            elif only_fit and _too_big_without_tree(m, hw):
                hide(TOO_BIG)
            else:
                candidates.append(m)
        # kuratierte Repositories gehören immer dazu (genaue Größe und Prüfsumme), auch wenn die Liste sie nicht nennt
        for repo, c in curated_by_repo.items():
            if repo not in metas:
                candidates.append({"id": repo, "author": repo.split("/")[0], "tags": [f"license:{c['license']}"] if c.get("license") else [], "pipeline_tag": "text-generation", "gated": False})
                base_ids.add(repo)
        candidates.sort(key=lambda m: m["id"] not in curated_by_repo)       # kuratierte zuerst, damit die Obergrenze sie nie abschneidet
        for m in candidates[MAX_TREES:]:
            hide(OVER_CAP)
        candidates = candidates[:MAX_TREES]

        trees = await asyncio.gather(*(self._hf.get(f"/api/models/{m['id']}/tree/main", refresh=refresh) for m in candidates))
        items: list[Item] = []
        for m, t in zip(candidates, trees):
            if not isinstance(t.data, list):
                hide(NO_TREE)
                continue
            it = build_item(m, t.data, hw, curated_by_repo.get(m["id"]))
            if it is None:
                hide(NO_FILE)
                continue
            items.append(it)
        got_any = any(g.data is not None for g in lists) and any(isinstance(t.data, list) for t in trees)
        if not got_any:                                                    # ohne Netz und ohne Zwischenspeicher: nur die kuratierte Liste
            items, hidden = cur.items(self.curated, hw), {}
        statuses = [g.status for g in list(lists) + list(trees)] if got_any else []
        source = "curated" if not got_any else "stale" if "stale" in statuses else "live" if "network" in statuses else "cache"
        stamps = [g.fetched_at for g in list(lists) + list(trees) if g.fetched_at]
        notes = {"curated": "Hugging Face ist nicht erreichbar und nichts im Zwischenspeicher: nur die kuratierte Liste.",
                 "stale": "Hugging Face ist nicht erreichbar oder antwortet nicht; angezeigt wird der ältere Zwischenspeicher."}
        for it in items:
            if it.curated_key is None and it.repo in curated_by_repo:
                it.curated_key = curated_by_repo[it.repo]["key"]

        shown = [i for i in items if i.repo in base_ids]
        recommended = recommend(shown)
        if q:
            tokens = q.lower().split()
            items = [i for i in items if all(t in f"{i.name} {i.publisher} {i.repo} {i.variant.file}".lower() for t in tokens)]
        else:
            items = shown
        if only_fit:
            items = [i for i in items if i.variant.fit.level != "no"]
        items.sort(key=rank_key)
        return CatalogResult(items[:limit], recommended, source, min(stamps) if stamps and got_any else None, notes.get(source), hidden, len(items))
