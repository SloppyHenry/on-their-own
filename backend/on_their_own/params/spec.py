"""Beschreibung eines Parameters. Jeder Parameter steht genau einmal in der Registry; Oberfläche, Validierung, Dokumentation und Tests bauen darauf auf.

`read` liest den Wert **vom Verbraucher** (dem Objekt, das ihn verwendet), `apply` setzt ihn dort. So kann ein Regler nicht nur dekorativ sein: der Test
setzt einen Wert, liest ihn wieder aus dem Verbraucher und prüft das Verhalten (`effect_test`).
"""

from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

EFFECTS = {"immediate": "sofort", "next_decision": "ab der nächsten Entscheidung", "restart_model": "nur mit Neustart des Modells"}
GROUPS = {"autonomy": "Autonomie und Entscheidungen", "personality": "Persönlichkeit", "persona": "Charakter", "memory": "Gedächtnis und Reflexion",
          "world": "Welt und Bedürfnisse", "llm": "Modell und Inferenz", "sim": "Geschwindigkeit und Last", "mode": "Beobachtungsmodus"}


@dataclass(frozen=True)
class ParamSpec:
    key: str
    group: str
    scope: str                                   # global | agent
    type: str                                    # int | float | bool | enum | text
    label: str
    help: str
    default: Any = None
    min: float | None = None
    max: float | None = None
    step: float | None = None
    unit: str = ""
    options: tuple[tuple[str, str], ...] = ()    # enum: (Wert, Anzeige)
    effect: str = "next_decision"
    apply: Callable[[Any, Any, str | None], None] | None = None      # (Simulation, Wert, Agent)
    read: Callable[[Any, str | None], Any] | None = None             # (Simulation, Agent) -> aktueller Wert beim Verbraucher
    default_for: Callable[[Any, str], Any] | None = None             # Standard je Agent (Persönlichkeit aus den Startprofilen)
    consumers: tuple[str, ...] = ()              # "modul:attribut", wo der Wert gelesen wird (geprüft im Test)
    effect_test: str = ""                        # Wirkungstest: "datei.py::testname"
    locked: str | None = None                    # Begründung, warum er im Betrieb nicht geändert werden kann
    warn: str | None = None                      # Hinweis in der Oberfläche
    max_len: int | None = None
    check: Callable[[Any, Any], Any] | None = None                   # async Vorprüfung (z. B. Verbindungstest), gibt None oder Fehlertext zurück
    tags: tuple[str, ...] = field(default_factory=tuple)

    def default_value(self, sim: Any = None, agent: str | None = None) -> Any:
        return self.default_for(sim, agent) if self.default_for and agent else self.default

    def to_schema(self) -> dict[str, Any]:
        return {"key": self.key, "group": self.group, "scope": self.scope, "type": self.type, "label": self.label, "help": self.help, "default": self.default,
                "min": self.min, "max": self.max, "step": self.step, "unit": self.unit, "options": [list(o) for o in self.options], "effect": self.effect,
                "effect_text": EFFECTS[self.effect], "locked": self.locked, "warn": self.warn, "max_len": self.max_len}


def validate(spec: ParamSpec, value: Any) -> tuple[bool, Any]:
    """(ok, normalisierter Wert) oder (False, Grund). Werte außerhalb des Bereichs werden **abgelehnt**, nie stillschweigend begrenzt."""
    t = spec.type
    if t == "bool":
        return (True, value) if isinstance(value, bool) else (False, "Erwartet wird ein Wahrheitswert (true oder false).")
    if t in ("int", "float"):
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            return False, "Erwartet wird eine Zahl."
        if t == "int":
            if isinstance(value, float) and not value.is_integer():
                return False, "Erwartet wird eine ganze Zahl."
            value = int(value)
        if spec.min is not None and value < spec.min or spec.max is not None and value > spec.max:
            return False, f"Der Wert muss zwischen {spec.min:g} und {spec.max:g} liegen."
        if t == "int" and spec.step and spec.step > 1 and (value - int(spec.min or 0)) % int(spec.step):
            return False, f"Erlaubt sind Schritte von {spec.step:g} ab {spec.min:g}."
        return True, value if t == "int" else float(value)
    if t == "enum":
        return (True, value) if value in {o[0] for o in spec.options} else (False, f"Erlaubt sind: {', '.join(o[0] for o in spec.options)}.")
    if t == "text":
        if not isinstance(value, str):
            return False, "Erwartet wird Text."
        if spec.max_len is not None and len(value) > spec.max_len:
            return False, f"Höchstens {spec.max_len} Zeichen erlaubt (sind {len(value)})."
        return True, value.strip()
    return False, f"Unbekannter Typ {t}."
