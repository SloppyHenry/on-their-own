"""Einstellbare Größen des Gedächtnisses (in AP07 als Parameter in der Oberfläche)."""

from dataclasses import dataclass

from ..config import Settings


@dataclass
class MemoryParams:
    store_threshold: int = 4            # ab dieser Wichtigkeit wird dauerhaft gespeichert (darunter nur Kurzzeitpuffer)
    w_rel: float = 1.0                  # Gewicht Relevanz
    w_rec: float = 0.6                  # Gewicht Aktualität
    w_imp: float = 0.6                  # Gewicht Wichtigkeit
    w_shared: float = 0.2               # Gewicht gemeinsames Erlebnis
    half_life_h: float = 36.0           # Halbwertszeit der Aktualität in Simulationsstunden
    min_score: float = 0.35             # Schwelle (normierte Punktzahl 0-1)
    max_items: int = 6                  # höchstens so viele Erinnerungen je Prompt
    budget_tokens: int = 450            # Token-Budget für die abgerufenen Erinnerungen
    candidates: int = 40                # Kandidaten aus der Suche je Abruf
    reflect_enabled: bool = True
    reflect_threshold: int = 45         # Summe der Wichtigkeit neuer Erinnerungen seit der letzten Reflexion
    reflect_evening_minute: int = 21 * 60   # sonst einmal am Abend
    reflect_sources: int = 20           # so viele jüngste wichtige Erinnerungen gehen in eine Reflexion
    summary_enabled: bool = True
    archive_after_days: int = 2         # Episoden, die älter sind und eine Zusammenfassung haben, werden archiviert
    archive_below: float = 0.0          # (Reserve) zusätzliche Mindestwichtigkeit zum Behalten
    max_active: int = 2000              # Obergrenze aktiver Erinnerungen je Agent
    debug_skips: bool = False           # `agent.memory_skipped` für nicht Gemerktes erzeugen

    @classmethod
    def from_settings(cls, s: Settings) -> "MemoryParams":
        return cls(store_threshold=s.mem_store_threshold, budget_tokens=s.mem_budget_tokens, max_items=s.mem_max_items,
                   half_life_h=s.mem_half_life_h, min_score=s.mem_min_score, w_rel=s.mem_w_rel, w_rec=s.mem_w_rec, w_imp=s.mem_w_imp,
                   w_shared=s.mem_w_shared, reflect_enabled=s.mem_reflect_enabled, reflect_threshold=s.mem_reflect_threshold,
                   max_active=s.mem_max_active, archive_after_days=s.mem_archive_after_days, debug_skips=s.mem_debug_skips)
