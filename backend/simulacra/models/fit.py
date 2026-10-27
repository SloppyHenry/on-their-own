"""Passung eines Modells zum Rechner und grobe Zeitschätzung (AP17c-2). Eine Wahrheit für Tool und install.sh. Nur Standardbibliothek."""

from __future__ import annotations

import re
from dataclasses import dataclass

CONTEXT = 8192                  # Kontext, mit dem das Spiel das Modell startet
OVERHEAD_MB = 300               # Rechenpuffer der Laufzeit
# Stufen: Anteil des nötigen am nutzbaren Speicher
LEVELS = [("good", 0.70, "passt gut"), ("ok", 0.90, "passt"), ("tight", 1.00, "knapp")]
NO_FIT = ("no", "zu groß")
# Schätzung der Geschwindigkeit: Token je Sekunde ≈ Speicherbandbreite / aktive Modellgröße × Wirkungsgrad
EFFICIENCY = 0.7
TOKENS_PER_DECISION = 90        # Ø Antwortlänge einer Entscheidung (AP00)
DECISION_OVERHEAD_S = 1.2       # Prompt-Verarbeitung und Zuschlag je Anfrage
LEVEL_ORDER = {"good": 0, "ok": 1, "tight": 2, "no": 3}


@dataclass
class Fit:
    level: str                  # good | ok | tight | no
    label: str                  # passt gut | passt | knapp | zu groß
    need_mb: int
    ratio: float


@dataclass
class Estimate:
    tokens_per_s: float
    seconds_per_decision: float


def kv_cache_mb(params_b: float, context: int = CONTEXT) -> int:
    """Grober KV-Cache (f16) in MB. Je Token ≈ 120 KB + 4,5 KB je Milliarde Parameter. Der Ansatz folgt den Dichtemodellen von Qwen3
    (4B und 8B: 144 KB, 14B: 160 KB, 32B: 256 KB je Token) und überschätzt Modelle mit Mischaufmerksamkeit oder wenigen KV-Köpfen."""
    return int(context * (120 + 4.5 * params_b) / 1024)


def need_mb(size_mb: float, params_b: float) -> int:
    """Speicher, den Datei, KV-Cache (Kontext 8192) und Rechenpuffer zusammen brauchen."""
    return int(size_mb + kv_cache_mb(params_b) + OVERHEAD_MB)


def fit(size_mb: float, params_b: float, usable_mb: int) -> Fit:
    need = need_mb(size_mb, params_b)
    ratio = need / usable_mb if usable_mb > 0 else 99.0
    for level, limit, label in LEVELS:
        if ratio <= limit:
            return Fit(level, label, need, round(ratio, 3))
    return Fit(NO_FIT[0], NO_FIT[1], need, round(ratio, 3))


def estimate(size_mb: float, params_b: float | None, active_b: float | None, bandwidth_gbs: float) -> Estimate:
    """Zeit je Entscheidung. Bei Mischmodellen (MoE) zählt nur der aktive Teil der Datei; ohne Angabe die ganze Datei (pessimistisch)."""
    active_gb = size_mb / 1024
    if params_b and active_b and 0 < active_b < params_b:
        active_gb *= active_b / params_b
    tps = bandwidth_gbs / max(active_gb, 0.05) * EFFICIENCY
    return Estimate(round(tps, 1), round(TOKENS_PER_DECISION / tps + DECISION_OVERHEAD_S, 1))


# ---------- Quantisierung und Parameter aus Dateinamen ----------

QUANT_RE = re.compile(r"(?<![A-Za-z0-9])((?:IQ|Q)\d_[A-Z0-9_]+|BF16|F16|F32|MXFP4(?:_MOE)?)(?![A-Za-z0-9])", re.I)
# Bits je Gewicht (grob) zum Schätzen der Parameterzahl aus der Dateigröße, wenn die Liste sie nicht nennt
BITS = {4: 4.8, 5: 5.7, 6: 6.6, 7: 7.5, 8: 8.5}


def quant_of(filename: str) -> str | None:
    """Quantisierung aus dem Dateinamen, z. B. „Qwen3-8B-Q4_K_M.gguf“ -> „Q4_K_M“, „…-UD-Q4_K_XL.gguf“ -> „Q4_K_XL“."""
    found = QUANT_RE.findall(filename.rsplit("/", 1)[-1].removesuffix(".gguf"))
    return found[-1].upper() if found else None


def quant_bits(quant: str) -> int | None:
    """Ganzzahlige Bit-Stufe 4–8 (Q4_K_M, IQ4_XS, Q8_0 …); None für alles andere (Q2, Q3, F16 …)."""
    m = re.match(r"(?:IQ|Q)(\d)_", quant)
    return int(m.group(1)) if m and 4 <= int(m.group(1)) <= 8 else None


def params_from_size(size_mb: float, quant: str) -> float:
    bits = BITS.get(quant_bits(quant) or 4, 4.8)
    return round(size_mb * 1048576 * 8 / bits / 1e9, 1)


def active_from_name(name: str) -> float | None:
    """„Qwen3-30B-A3B“ -> 3,0; „…-A2.5B-…“ -> 2,5 (aktive Parameter eines MoE-Modells)."""
    m = re.search(r"(?<![A-Za-z0-9])A(\d+(?:\.\d+)?)B(?![A-Za-z])", name, re.I)
    return float(m.group(1)) if m else None


def params_from_name(name: str) -> float | None:
    """Größenangabe im Namen („8B“, „27B“, „E4B“, „0.6B“); bei MoE die erste Zahl (Gesamtgröße), „A3B“ zählt nicht."""
    m = re.search(r"(?<![A-Za-z0-9.])E?(\d+(?:\.\d+)?)B(?![A-Za-z])", name, re.I)
    return float(m.group(1)) if m else None
