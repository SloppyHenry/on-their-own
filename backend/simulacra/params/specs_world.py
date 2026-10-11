"""Weltregeln und Bedürfnisse (global). Die Welt-Engine liest nur das Regelobjekt `WorldRules`; hier werden die Regler darauf abgebildet."""

from .spec import ParamSpec

T = "tests/params/test_effects.py::"
SCARCITY_SPAN = 0.9                 # 100 % Knappheit = Faktor 0,1 (Untergrenze der Regel)
BASE_RATES = {"energy": ("energy_decay_per_hour", 3.0), "hunger": ("hunger_rise_per_hour", 3.0), "thirst": ("thirst_rise_per_hour", 4.0)}
MOVEMENT = (("free", "frei"), ("house_garden", "Haus und Garten"), ("no_forest", "ohne Wald"), ("custom", "eigene Liste"))


def set_rules(sim, **update) -> None:
    sim.engine.set_rules(sim.engine.state.rules.model_copy(update=update))


def _rule(key, label, help_, rule, default, lo, hi, step, to, frm, *, type_="int", unit="", test, effect="immediate", consumers=None):
    return ParamSpec(key=key, group="world", scope="global", type=type_, label=label, help=help_, default=default, min=lo, max=hi, step=step, unit=unit, effect=effect,
                     apply=lambda sim, v, a: set_rules(sim, **{rule: to(v)}), read=lambda sim, a: frm(getattr(sim.engine.state.rules, rule)),
                     consumers=consumers or (f"simulacra.world.engine:{rule}",), effect_test=T + test)


def _need_enabled(need: str, label: str, default: bool) -> ParamSpec:
    def apply(sim, v, a):
        sim.autonomy.needs.params.enabled[need] = bool(v)
        if need in BASE_RATES:
            rule, base = BASE_RATES[need]
            rate = sim.params.get(f"needs.{need}.rate")
            set_rules(sim, **{rule: base * rate / 100 if v else 0.0})

    return ParamSpec(key=f"needs.{need}.enabled", group="world", scope="global", type="bool", label=f"{label}: Bedürfnis", default=default, effect="immediate",
                     help="Ausgeschaltet: das Bedürfnis steigt nicht mehr und taucht weder in der Bewertung noch im Prompt auf.",
                     apply=apply, read=lambda sim, a: sim.autonomy.needs.params.enabled[need], consumers=("simulacra.agents.needs:enabled", "simulacra.agents.factors.needs:relief"),
                     effect_test=T + "test_need_switches_and_rates")


def _need_rate(need: str, label: str) -> ParamSpec:
    rule, base = BASE_RATES[need]

    def apply(sim, v, a):
        if sim.autonomy.needs.params.enabled[need]:
            set_rules(sim, **{rule: base * v / 100})

    def read(sim, a):
        return round(getattr(sim.engine.state.rules, rule) / base * 100) if sim.autonomy.needs.params.enabled[need] else sim.params.get(f"needs.{need}.rate")

    return ParamSpec(key=f"needs.{need}.rate", group="world", scope="global", type="int", label=f"{label}: Rate", help="Wie schnell sich das Bedürfnis verändert (100 % = Normalwert).",
                     default=100, min=0, max=300, step=5, unit="%", effect="immediate", apply=apply, read=read, consumers=(f"simulacra.world.engine:{rule}",),
                     effect_test=T + "test_need_switches_and_rates")


def _movement_blocked(sim, mode: str) -> list[str]:
    locs = [l for l in sim.engine.state.locations.values() if not l.props.get("fallback")]
    if mode == "house_garden":
        return sorted(l.id for l in locs if not l.id.startswith("house.") and l.id != "garden")
    if mode == "no_forest":
        return ["forest"] if "forest" in sim.engine.state.locations else []
    if mode == "custom":
        return [x for x in _split(sim.params.get("world.movement_custom")) if x in sim.engine.state.locations]
    return []


def _split(text: str) -> list[str]:
    return [p.strip() for p in str(text or "").replace(";", ",").split(",") if p.strip()]


def _movement() -> ParamSpec:
    def apply(sim, v, a):
        set_rules(sim, movement_blocked_locations=_movement_blocked(sim, v))

    def read(sim, a):
        cur = sorted(sim.engine.state.rules.movement_blocked_locations)
        return next((m for m, _ in MOVEMENT if m not in ("custom",) and sorted(_movement_blocked(sim, m)) == cur), "custom")

    return ParamSpec(key="world.movement", group="world", scope="global", type="enum", label="Bewegungsfreiheit", options=MOVEMENT, default="free", effect="immediate",
                     help="Welche Orte die Agenten nicht betreten dürfen (gesperrte Orte kommen in der Wegfindung nicht vor).", apply=apply, read=read,
                     consumers=("simulacra.world.engine:movement_blocked_locations",), effect_test=T + "test_movement_blocks_locations")


def _movement_custom() -> ParamSpec:
    def apply(sim, v, a):
        if sim.params.get("world.movement") == "custom":
            set_rules(sim, movement_blocked_locations=_movement_blocked(sim, "custom"))

    return ParamSpec(key="world.movement_custom", group="world", scope="global", type="text", label="Eigene Sperrliste", default="", max_len=300, effect="immediate",
                     help="Kennungen gesperrter Orte, durch Komma getrennt (gilt bei „eigene Liste“), z. B. lake, forest.",
                     apply=apply, read=lambda sim, a: sim.params.get("world.movement_custom"), consumers=("simulacra.params.specs_world:_movement_blocked",), effect_test=T + "test_movement_blocks_locations")


def _tick_minutes() -> ParamSpec:
    return ParamSpec(key="world.minutes_per_tick", group="world", scope="global", type="int", label="Minuten je Takt", default=1, min=1, max=15, step=1, unit="Min.", effect="immediate",
                     help="Wie viel Simulationszeit ein Schritt vorrückt (schnellerer Tageszyklus; Entscheidungen fallen entsprechend seltener).",
                     apply=lambda sim, v, a: setattr(sim.runner, "minutes_per_tick", int(v)), read=lambda sim, a: sim.runner.minutes_per_tick,
                     consumers=("simulacra.simulation.runner:minutes_per_tick",), effect_test=T + "test_minutes_per_tick_advances_the_clock")


SPECS = [
    ParamSpec(key="world.scarcity", group="world", scope="global", type="int", label="Knappheit", default=0, min=0, max=100, step=1, unit="%", effect="immediate",
              help="Wie knapp Ressourcen sind: skaliert Bestand und Nachwuchs sofort (100 % = nur noch ein Zehntel).",
              apply=lambda sim, v, a: set_rules(sim, resource_scarcity=round(1 - SCARCITY_SPAN * v / 100, 4)),
              read=lambda sim, a: round((1 - sim.engine.state.rules.resource_scarcity) / SCARCITY_SPAN * 100), consumers=("simulacra.world.engine:resource_scarcity",),
              effect_test=T + "test_scarcity_shrinks_stock_and_regrowth_immediately"),
    _rule("world.resource_availability", "Ressourcen-Obergrenzen", "Obergrenze der Vorräte je Ort (100 % = normal).", "resource_availability", 100, 0, 200, 5,
          lambda v: v / 100, lambda r: round(r * 100), unit="%", test="test_availability_scales_caps"),
    _need_enabled("energy", "Energie", True), _need_rate("energy", "Energie"), _need_enabled("hunger", "Hunger", True), _need_rate("hunger", "Hunger"),
    _need_enabled("thirst", "Durst", True), _need_rate("thirst", "Durst"),
    _need_enabled("social", "Geselligkeit", True), _need_enabled("calm", "Ruhe", True), _need_enabled("warmth", "Wärme", False),
    _tick_minutes(),
    _rule("world.build_cost", "Baukosten", "Kosten der Bauvorlagen (100 % = normal).", "build_cost_mult", 100, 25, 300, 5, lambda v: v / 100, lambda r: round(r * 100), unit="%", test="test_build_cost_and_duration"),
    _rule("world.build_duration", "Bauzeit", "Dauer des Bauens (100 % = normal).", "build_duration_mult", 100, 25, 300, 5, lambda v: v / 100, lambda r: round(r * 100), unit="%", test="test_build_cost_and_duration"),
    _rule("world.max_objects", "Höchstzahl Objekte", "Grenze für erzeugte Objekte.", "max_objects", 150, 20, 500, 10, lambda v: v, lambda r: r, unit="Objekte", test="test_max_objects_limits_building"),
    _movement(), _movement_custom(),
    ParamSpec(key="world.failure_consequence", group="world", scope="global", type="enum", label="Folge einer Ablehnung", options=(("none", "keine"), ("time", "Zeitverlust"), ("energy", "Zeit + Energie")),
              default="time", effect="immediate", help="Was eine abgelehnte oder gescheiterte Handlung kostet.",
              apply=lambda sim, v, a: set_rules(sim, failure_penalty="time" if v == "time" else v),
              read=lambda sim, a: sim.engine.state.rules.failure_penalty, consumers=("simulacra.world.engine:failure_penalty",), effect_test=T + "test_failure_consequence"),
]
