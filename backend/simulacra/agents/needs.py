"""Bedürfnisse über Energie, Hunger und Durst (Körper, Engine) hinaus: Geselligkeit, Ruhe, Wärme (Zustand des Agenten).

Alle Werte sind **Dringlichkeit 0–100** (hoch = dringend). Einzeln schaltbar: ein ausgeschaltetes Bedürfnis taucht weder in der Bewertung noch im
Prompt auf (§8.4). Die Raten sind Parameter (AP07).
"""

from dataclasses import dataclass, field

from ..world.engine import WorldEngine

SOFT = ("social", "calm", "warmth")
LABELS = {"energy": "Energie", "hunger": "Hunger", "thirst": "Durst", "social": "Geselligkeit", "calm": "Ruhe", "warmth": "Wärme"}
CRITICAL = {"energy": 15.0, "hunger": 80.0, "thirst": 80.0, "social": 90.0, "calm": 90.0, "warmth": 85.0}   # ab hier ein dringender Anlass (Energie: darunter)


@dataclass
class NeedParams:
    enabled: dict[str, bool] = field(default_factory=lambda: {"energy": True, "hunger": True, "thirst": True, "social": True, "calm": True, "warmth": False})
    social_rise_per_hour: float = 5.0          # allein
    social_relief_per_min_talking: float = 1.2
    social_relief_per_min_together: float = 0.15
    social_relief_per_min_petting: float = 1.5         # Katze streicheln
    calm_relief_per_min_rowing: float = 0.5            # mit dem Boot auf dem See
    calm_rise_per_min_talking: float = 0.25
    calm_relief_per_hour_alone: float = 8.0
    calm_relief_per_hour_quiet_place: float = 14.0
    calm_rise_per_hour_storm: float = 6.0
    warmth_rise_per_hour_cold: float = 14.0    # draußen bei Regen, Sturm, Schnee oder Nacht
    warmth_relief_per_hour_indoors: float = 20.0
    warmth_relief_per_hour_fire: float = 40.0


class NeedsStore:
    def __init__(self, engine: WorldEngine, params: NeedParams | None = None):
        self.engine, self.params = engine, params or NeedParams()

    @property
    def conn(self):
        return self.engine.state.conn

    def get(self, agent_id: str) -> dict[str, float]:
        self.conn.execute("INSERT OR IGNORE INTO agent_needs(agent_id) VALUES(?)", (agent_id,))
        r = self.conn.execute("SELECT social, calm, warmth, updated FROM agent_needs WHERE agent_id=?", (agent_id,)).fetchone()
        return {"social": r["social"], "calm": r["calm"], "warmth": r["warmth"], "updated": r["updated"]}

    def _save(self, agent_id: str, values: dict[str, float], minute: int) -> None:
        self.conn.execute("UPDATE agent_needs SET social=?, calm=?, warmth=?, updated=? WHERE agent_id=?",
                          (values["social"], values["calm"], values["warmth"], minute, agent_id))

    def on(self, need: str) -> bool:
        return self.params.enabled.get(need, True)

    def tick(self, agent_ids: list[str], minute: int, talking: set[str]) -> None:
        """Eine Minute Simulationszeit: Werte fortschreiben (aufgerufen je Tick auf dem DB-Thread)."""
        st, p = self.engine.state, self.params
        weather, night = st.weather()["kind"], minute % 1440 < 300 or minute % 1440 >= 1260
        bodies = {a.id: a for a in st.agents()}
        for aid in agent_ids:
            body = bodies.get(aid)
            if body is None:
                continue
            v = self.get(aid)
            others = [b for b in bodies.values() if b.id != aid and b.location_id == body.location_id]
            loc = st.locations.get(body.location_id)
            themes = set(loc.props.get("themes", [])) if loc else set()
            indoors = body.location_id.startswith("house.")
            mode = body.action.data.get("mode") if body.action is not None and body.action.type == "use" else None   # Dinge im Dorf (AP15)
            if p.enabled["social"]:
                if mode == "pet":
                    v["social"] -= p.social_relief_per_min_petting
                if aid in talking:
                    v["social"] -= p.social_relief_per_min_talking
                elif others:
                    v["social"] -= p.social_relief_per_min_together
                else:
                    v["social"] += p.social_rise_per_hour / 60
            if p.enabled["calm"]:
                if aid in talking:
                    v["calm"] += p.calm_rise_per_min_talking
                elif not others:
                    v["calm"] -= (p.calm_relief_per_hour_quiet_place if themes & {"calm", "rest"} else p.calm_relief_per_hour_alone) / 60
                if weather == "storm" and not indoors:
                    v["calm"] += p.calm_rise_per_hour_storm / 60
                if mode == "row":
                    v["calm"] -= p.calm_relief_per_min_rowing
            if p.enabled["warmth"]:
                cold = not indoors and (weather in ("rain", "storm", "snow") or night)
                fire = indoors and any(o.kind in ("fireplace", "firepit") and o.state.get("lit") for o in st.objects_at(body.location_id))
                if cold:
                    v["warmth"] += p.warmth_rise_per_hour_cold / 60
                elif fire:
                    v["warmth"] -= p.warmth_relief_per_hour_fire / 60
                elif indoors:
                    v["warmth"] -= p.warmth_relief_per_hour_indoors / 60
            self._save(aid, {k: max(0.0, min(100.0, v[k])) for k in SOFT}, minute)

    def active(self, body_needs: dict[str, float], soft: dict[str, float]) -> dict[str, float]:
        """Alle eingeschalteten Bedürfnisse als Dringlichkeit 0–100 (Energie umgekehrt)."""
        out = {"energy": 100 - body_needs["energy"], "hunger": body_needs["hunger"], "thirst": body_needs["thirst"], **{k: soft[k] for k in SOFT}}
        return {k: v for k, v in out.items() if self.on(k)}

    def critical(self, body_needs: dict[str, float], soft: dict[str, float]) -> list[str]:
        out = []
        for k, v in self.active(body_needs, soft).items():
            limit = CRITICAL[k]
            if (k == "energy" and body_needs["energy"] < limit) or (k != "energy" and v >= limit):
                out.append(k)
        return out


def need_words(soft: dict[str, float], enabled: dict[str, bool]) -> list[str]:
    """Nur die zusätzlichen Bedürfnisse, die gerade spürbar sind, für den Prompt (ausgeschaltete fehlen ganz)."""
    out = []
    if enabled.get("social") and soft["social"] >= 60:
        out.append("du sehnst dich nach Gesellschaft")
    if enabled.get("calm") and soft["calm"] >= 60:
        out.append("du brauchst Ruhe")
    if enabled.get("warmth") and soft["warmth"] >= 60:
        out.append("dir ist kalt")
    return out
