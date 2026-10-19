"""Modelle für Hardware und Modellkatalog (AP17c-2)."""

from typing import Literal

from ..models import hardware as hw
from ..models import rank
from ..models.catalog import CatalogResult
from .models import Out

FitLevel = Literal["good", "ok", "tight", "no"]


class HardwareOut(Out):
    kind: Literal["nvidia", "metal", "amd", "vulkan", "cpu"]
    name: str
    vram_mb: int                                  # Grafikspeicher gesamt (Metal: gemeinsamer Speicher)
    vram_free_mb: int                             # davon frei (andere Prozesse können die Karte belegen)
    ram_mb: int
    free_disk_mb: int                             # frei im Datenordner
    os: str
    arch: str
    cuda_version: str | None
    gpu_count: int
    gpu_names: list[str]
    usable_mb: int                                # Speicher, der einem Modell zur Verfügung steht
    bandwidth_gbs: float                          # Speicherbandbreite (Herstellerangabe oder Richtwert)
    bandwidth_known: bool                         # False: Richtwert je Art, Karte nicht in der Tabelle
    summary: str                                  # eine Zeile für den Kopf


class FitOut(Out):
    level: FitLevel
    label: str                                    # passt gut | passt | knapp | zu groß
    need_mb: int                                  # Datei + KV-Cache (Kontext 8192) + Puffer
    ratio: float                                  # need_mb / nutzbarer Speicher


class EstimateOut(Out):
    tokens_per_s: float
    seconds_per_decision: float
    is_estimate: Literal[True] = True             # immer eine Schätzung, nie eine Messung


class VariantOut(Out):
    file: str
    quant: str
    size_mb: float
    sha256: str | None
    fit: FitOut
    estimate: EstimateOut


class CatalogItemOut(Out):
    repo: str                                     # z. B. Qwen/Qwen3-8B-GGUF
    name: str
    publisher: str
    license: str | None
    source: Literal["curated", "live"]
    curated_key: str | None
    moe: bool
    multimodal: bool                              # kann auch Bilder; geladen wird nur das Textmodell
    uncensored: bool                              # nur Hinweis, keine inhaltliche Vorauswahl
    gated: bool                                   # Anmeldung bei Hugging Face nötig: nicht unterstützt
    downloadable: bool
    params_b: float | None
    active_b: float | None
    downloads: int | None
    likes: int | None
    updated: str | None
    url: str
    file: VariantOut                              # Standarddatei
    variants: list[VariantOut]


class CatalogOut(Out):
    hardware: HardwareOut
    source: Literal["live", "cache", "stale", "curated"]
    fetched_at: str | None                        # Zeitpunkt der ältesten verwendeten Antwort (ISO, UTC)
    note: str | None
    hidden: dict[str, int]                        # ausgeblendete Treffer nach Grund
    total: int
    recommended: list[CatalogItemOut]
    items: list[CatalogItemOut]


def hardware_out(h: hw.Hardware) -> HardwareOut:
    bw, known = h.bandwidth_gbs
    return HardwareOut(kind=h.kind, name=h.name, vram_mb=h.vram_mb, vram_free_mb=h.vram_free_mb, ram_mb=h.ram_mb, free_disk_mb=h.free_disk_mb, os=h.os, arch=h.arch, cuda_version=h.cuda_version,
                       gpu_count=h.gpu_count, gpu_names=h.gpu_names, usable_mb=h.usable_mb, bandwidth_gbs=bw, bandwidth_known=known, summary=h.summary())


def variant_out(v: rank.Variant) -> VariantOut:
    return VariantOut(file=v.file, quant=v.quant, size_mb=round(v.size_mb, 1), sha256=v.sha256, fit=FitOut(level=v.fit.level, label=v.fit.label, need_mb=v.fit.need_mb, ratio=v.fit.ratio),
                      estimate=EstimateOut(tokens_per_s=v.estimate.tokens_per_s, seconds_per_decision=v.estimate.seconds_per_decision))


def item_out(i: rank.Item) -> CatalogItemOut:
    return CatalogItemOut(repo=i.repo, name=i.name, publisher=i.publisher, license=i.license, source=i.source, curated_key=i.curated_key, moe=i.moe, multimodal=i.multimodal,
                          uncensored=i.uncensored, gated=i.gated, downloadable=i.downloadable, params_b=i.params_b, active_b=i.active_b, downloads=i.downloads, likes=i.likes,
                          updated=i.updated, url=f"https://huggingface.co/{i.repo}", file=variant_out(i.variant), variants=[variant_out(v) for v in sorted(i.variants, key=lambda v: v.size_mb)])


def catalog_out(h: hw.Hardware, r: CatalogResult) -> CatalogOut:
    from datetime import datetime, timezone
    stamp = datetime.fromtimestamp(r.fetched_at, timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ") if r.fetched_at else None
    return CatalogOut(hardware=hardware_out(h), source=r.source, fetched_at=stamp, note=r.note, hidden=r.hidden, total=r.total,
                      recommended=[item_out(i) for i in r.recommended], items=[item_out(i) for i in r.items])
