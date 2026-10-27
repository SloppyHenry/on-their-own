"""Modelle bewerten und ordnen (AP17c-2): Passung je Datei, Auswahl der Standarddatei, Rangfolge. Nur Standardbibliothek."""

from __future__ import annotations

from dataclasses import dataclass, field

from .fit import LEVEL_ORDER, Estimate, Fit, estimate, fit, params_from_size, quant_bits
from .hardware import Hardware

# Bevorzugte Quantisierung je Repository: erst die übliche Q4-Stufe, dann kleinere, dann größere
QUANT_PREFERENCE = ["Q4_K_M", "Q4_K_S", "Q4_K_XL", "IQ4_XS", "Q4_0", "IQ4_NL", "Q4_1", "Q5_K_M", "Q5_K_S", "Q5_K_XL", "Q5_0", "Q5_1", "Q6_K", "Q6_K_XL", "Q8_0", "Q8_K_XL"]


@dataclass
class Variant:
    file: str
    quant: str
    size_mb: float
    sha256: str | None
    fit: Fit
    estimate: Estimate


@dataclass
class Item:
    repo: str
    name: str
    publisher: str
    license: str | None
    source: str                         # curated | live
    variant: Variant                    # Standarddatei
    variants: list[Variant]             # alle Dateien Q4–Q8 (inklusive der Standarddatei)
    params_b: float | None = None
    active_b: float | None = None
    moe: bool = False
    multimodal: bool = False
    uncensored: bool = False
    gated: bool = False
    downloads: int | None = None
    likes: int | None = None
    updated: str | None = None
    curated_key: str | None = None
    notes: list[str] = field(default_factory=list)

    @property
    def downloadable(self) -> bool:
        return not self.gated


def make_variant(file: str, quant: str, size_mb: float, sha256: str | None, params_b: float | None, active_b: float | None, hw: Hardware) -> Variant:
    params = params_b or params_from_size(size_mb, quant)
    bw, _ = hw.bandwidth_gbs
    return Variant(file, quant, size_mb, sha256, fit(size_mb, params, hw.usable_mb), estimate(size_mb, params, active_b, bw))


def pick_variant(variants: list[Variant]) -> Variant:
    """Standarddatei: die bevorzugte Quantisierung, die noch in den Speicher passt; passt keine, die kleinste Datei."""
    order = {q: i for i, q in enumerate(QUANT_PREFERENCE)}
    ranked = sorted(variants, key=lambda v: (order.get(v.quant, len(order) + (quant_bits(v.quant) or 9)), v.size_mb))
    for v in ranked:
        if v.fit.level != "no":
            return v
    return min(variants, key=lambda v: v.size_mb)


def rank_key(item: Item) -> tuple:
    """Besser = kleiner: ladbar vor gesperrt, bessere Passung, kuratierte vor Live-Modellen, größeres Modell vor kleinerem, beliebtere vor weniger beliebten."""
    return (not item.downloadable, LEVEL_ORDER[item.variant.fit.level], item.source != "curated", -item.variant.size_mb, -(item.downloads or 0), item.repo)


def recommend(items: list[Item], count: int = 3) -> list[Item]:
    """Die besten ladbaren Modelle, die passen: die erste Stufe, in der es überhaupt Treffer gibt („passt gut“, sonst „passt“, sonst „knapp“)."""
    ok = sorted((i for i in items if i.downloadable and i.variant.fit.level != "no"), key=rank_key)
    if not ok:
        return []
    best = ok[0].variant.fit.level
    return [i for i in ok if i.variant.fit.level == best][:count]
