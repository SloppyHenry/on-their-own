"""Kuratierte Liste (data/models.json): geprüfte Empfehlungen und Rückfall ohne Netz. Nur Standardbibliothek."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

from .fit import active_from_name, quant_of
from .hardware import Hardware
from .rank import Item, make_variant, recommend

DEFAULT_PATH = Path(__file__).resolve().parent.parent / "data" / "models.json"
GB = 1e9 / 1048576              # size_gb (Milliarden Byte) -> MB (Mebibyte), wie überall in diesem Paket


@dataclass
class Curated:
    publishers: list[str]
    models: list[dict]


def load(path: Path | str | None = None) -> Curated:
    data = json.loads(Path(path or DEFAULT_PATH).read_text())
    return Curated(data.get("publishers", []), data["models"])


def items(cur: Curated, hw: Hardware, extras: bool = False) -> list[Item]:
    """Kuratierte Modelle als bewertete Einträge (Größe aus der Liste; die Live-Liste liefert genaue Größe und Prüfsumme nach).
    Modelle mit "style" (Rollenspiel, ungefiltert) kommen nur mit extras=True: für die Auswahl in install.sh, nie in Empfehlung und Live-Liste."""
    out = []
    for m in cur.models:
        if m.get("style") and not extras:
            continue
        quant = quant_of(m["file"]) or "Q4_K_M"
        active = m.get("active_b") or active_from_name(m["name"])
        v = make_variant(m["file"], quant, round(m["size_gb"] * GB), None, m.get("params_b"), active, hw)
        out.append(Item(m["repo"], m["name"], m["repo"].split("/")[0], m.get("license"), "curated", v, [v], m.get("params_b"), active, bool(active), curated_key=m["key"]))
    return out


def best(cur: Curated, hw: Hardware) -> Item | None:
    """Empfehlung für install.sh: das größte kuratierte Modell der besten Passungsstufe; passt keines, das kleinste (mit Stufe „zu groß“)."""
    its = items(cur, hw)
    rec = recommend(its, count=len(its))
    if rec:
        return rec[0]
    return min(its, key=lambda i: i.variant.size_mb) if its else None
