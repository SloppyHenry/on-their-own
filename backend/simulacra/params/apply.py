"""Übernahme von Parameteränderungen im Betrieb (§9): prüfen, anwenden, speichern, melden. Werte außerhalb des Bereichs werden abgelehnt, nie stillschweigend begrenzt."""

from typing import Any

from .registry import REGISTRY, SPEC_LIST
from .spec import ParamSpec, validate
from .store import ParamStore

ORDER = {s.key: i for i, s in enumerate(SPEC_LIST)}
STATUS = {"immediate": "applied", "next_decision": "pending_next_decision", "restart_model": "requires_model_restart"}


class ParamService:
    def __init__(self, sim):
        self.sim = sim
        self.store = ParamStore(sim.engine.state.conn)

    # --- Lesen ---------------------------------------------------------------------------------------
    def get(self, key: str, agent: str | None = None) -> Any:
        """Gespeicherter Wert oder Standard (für Regler, die voneinander abhängen)."""
        spec = REGISTRY[key]
        return self.store.get(key, agent, spec.default_value(self.sim, agent))

    def agents(self) -> list[str]:
        return self.sim.store.ai_agent_ids()

    def current(self, spec: ParamSpec, agent: str | None = None) -> Any:
        """Der Wert **beim Verbraucher**."""
        return spec.read(self.sim, agent)

    def current_value(self, key: str, agent: str | None = None) -> Any:
        return self.current(REGISTRY[key], agent)

    def values(self) -> dict[str, Any]:
        out: dict[str, Any] = {}
        for s in SPEC_LIST:
            out[s.key] = {a: self.current(s, a) for a in self.agents()} if s.scope == "agent" else self.current(s)
        return out

    def defaults(self) -> dict[str, Any]:
        return {s.key: ({a: s.default_value(self.sim, a) for a in self.agents()} if s.scope == "agent" else s.default) for s in SPEC_LIST}

    def overrides(self) -> list[dict[str, Any]]:
        return [{"key": k, "agent": a, "value": v} for k, a, v in self.store.all()]

    # --- Prüfen --------------------------------------------------------------------------------------
    def check(self, key: str, value: Any, agent: str | None) -> tuple[ParamSpec | None, Any, str | None]:
        spec = REGISTRY.get(key)
        if spec is None:
            return None, None, f"Unbekannter Parameter '{key}'."
        if spec.scope == "agent" and (agent is None or agent not in self.agents()):
            return spec, None, "Dieser Parameter gilt je Agent: eine gültige Agentenkennung ist nötig."
        if spec.scope == "global" and agent is not None:
            return spec, None, "Dieser Parameter gilt für alle Agenten: keine Agentenkennung angeben."
        if spec.locked:
            return spec, None, spec.locked
        ok, normalized = validate(spec, value)
        return (spec, normalized, None) if ok else (spec, None, str(normalized))

    # --- Anwenden ----------------------------------------------------------------------------------------
    def _apply(self, spec: ParamSpec, agent: str | None, value: Any, *, emit: bool = True, persist: bool = True) -> dict[str, Any]:
        """Läuft auf dem DB-Thread: setzt den Wert beim Verbraucher, speichert die Abweichung und meldet das Ereignis."""
        old = self.current(spec, agent)
        default = spec.default_value(self.sim, agent)
        if not persist:
            pass
        elif value == default:
            self.store.delete(spec.key, agent)
        else:
            self.store.set(spec.key, agent, value, self.sim.engine.minute)
        spec.apply(self.sim, value, agent)
        status = STATUS[spec.effect]
        if emit and spec.key in ("sim.speed", "sim.tick_pause_ms"):               # die Oberfläche zeigt das Tempo aus diesem Ereignis
            delay = self.sim.runner.tick_delay_s
            self.sim.engine.emit_event("simulation.speed_changed", data={"tick_delay_s": delay, "level": self.current_value("sim.speed")})
        if emit and old != value:
            self.sim.engine.emit_event("simulation.parameter_changed", [agent] if agent else [], None,
                                       {"group": spec.group, "key": spec.key, "agent": agent, "old": old, "new": value, "status": status})
        return {"key": spec.key, "agent": agent, "status": status, "old": old, "new": value, "reason": None}

    async def patch(self, changes: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Liste von Änderungen {key, value, agent?}. Jede wird einzeln geprüft; abgelehnte stehen mit Grund in der Antwort, die übrigen werden übernommen."""
        results: list[dict[str, Any]] = []
        valid: list[tuple[ParamSpec, str | None, Any]] = []
        for c in changes:
            agent = c.get("agent")
            spec, value, err = await self.sim.engine.db.run(lambda c=c, a=agent: self.check(str(c.get("key")), c.get("value"), a))
            if err is None and spec is not None and spec.check is not None:
                err = await spec.check(self.sim, value)
            if err:
                results.append({"key": c.get("key"), "agent": agent, "status": "rejected", "old": None, "new": c.get("value"), "reason": err})
            else:
                valid.append((spec, agent, value))
        valid.sort(key=lambda t: ORDER[t[0].key])                      # abhängige Regler in fester Reihenfolge (Rate nach Schalter, Sperrliste nach Auswahl)
        for spec, agent, value in valid:
            results.append(await self.sim.engine.db.run(lambda s=spec, a=agent, v=value: self._apply(s, a, v)))
        return results

    async def reset(self, keys: list[str] | None = None, group: str | None = None, agent: str | None = None) -> list[dict[str, Any]]:
        """Zurück auf den Standard (einzeln, je Gruppe oder alles)."""
        def collect() -> list[dict[str, Any]]:
            changes = []
            for s in SPEC_LIST:
                if (keys and s.key not in keys) or (group and s.group != group) or s.locked:
                    continue
                for a in (self.agents() if s.scope == "agent" else [None]):
                    if agent and a != agent:
                        continue
                    changes.append({"key": s.key, "agent": a, "value": s.default_value(self.sim, a)})
            return changes
        return await self.patch(await self.sim.engine.db.run(collect))

    # --- Neustart und Zurücksetzen der Welt ---------------------------------------------------------------------
    def export(self) -> list[tuple[str, str | None, Any]]:
        return self.store.all()

    def restore(self, items: list[tuple[str, str | None, Any]], persist: bool = False) -> None:
        """Gespeicherte Abweichungen wieder anwenden (nach einem Neustart, Laden oder Zurücksetzen der Welt), ohne Ereignisse. `persist=False`: sie stehen schon in der Datenbank
        und bleiben dort unverändert (ein geladener Spielstand bleibt Bit für Bit gleich); `True` für eine frische Datenbank."""
        for key, agent, value in sorted(items, key=lambda t: ORDER.get(t[0], 10**6)):
            spec = REGISTRY.get(key)
            if spec is None or spec.locked or (spec.scope == "agent" and (agent not in self.agents() or not persist)):
                continue                                                  # Werte je Agent stehen schon in dessen Profil (nur nach einem Zurücksetzen nötig)
            ok, normalized = validate(spec, value)
            if ok:
                self._apply(spec, agent, normalized, emit=False, persist=persist)
