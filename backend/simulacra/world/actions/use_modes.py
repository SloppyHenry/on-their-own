"""Modi des Befehls `use`: je (Objektart, Modus) Prüfung, Wirkung und Dauer."""

from ..models import Accepted, ActiveAction, AgentBody, RejectCode, Rejected, WorldObject
from .base import Ctx, held_kind, rej

MAX_NOTES = 20
MAX_TEXT = 300


class Mode:
    def validate(self, ctx: Ctx, actor: AgentBody, o: WorldObject, params: dict) -> Accepted | Rejected:
        return Accepted(duration=5)

    def start(self, ctx: Ctx, actor: AgentBody, o: WorldObject, act: ActiveAction) -> None:
        pass

    def step(self, ctx: Ctx, actor: AgentBody, o: WorldObject, act: ActiveAction) -> None:
        pass

    def finish(self, ctx: Ctx, actor: AgentBody, o: WorldObject, act: ActiveAction) -> Rejected | None:
        return None


class Sleep(Mode):
    def validate(self, ctx, actor, o, params):
        from .needs import validate_sleep
        return validate_sleep(ctx, actor, o, params)

    def start(self, ctx, actor, o, act):
        from .needs import claim_bed
        claim_bed(ctx, actor, o)

    def step(self, ctx, actor, o, act):
        from .needs import sleep_step
        sleep_step(ctx, actor, act)

    def finish(self, ctx, actor, o, act):
        ctx.emit("agent.slept", [actor.id], actor.location_id, {"energy": round(actor.needs["energy"], 1), "minutes": act.ends_at - act.started_at})
        return None


class Sit(Mode):
    def validate(self, ctx, actor, o, params):
        from .needs import validate_rest
        return validate_rest(ctx, actor, o, params)

    def step(self, ctx, actor, o, act):
        from .needs import rest_step
        rest_step(ctx, actor, act)

    def finish(self, ctx, actor, o, act):
        ctx.emit("agent.rested", [actor.id], actor.location_id, {"energy": round(actor.needs["energy"], 1)})
        return None


class Cook(Mode):
    def validate(self, ctx, actor, o, params):
        if not o.state.get("powered", True):
            return rej(RejectCode.FORBIDDEN_BY_RULES, "Der Herd hat keinen Strom.")
        if actor.inventory.get("food", 0) < 1 or actor.inventory.get("wood", 0) < 1:
            return rej(RejectCode.MISSING_RESOURCE, "Zum Kochen braucht es 1 Nahrung und 1 Holz.")
        return Accepted(duration=20)

    def finish(self, ctx, actor, o, act):
        if actor.inventory.get("food", 0) < 1 or actor.inventory.get("wood", 0) < 1:
            return rej(RejectCode.MISSING_RESOURCE, "Zutaten fehlen inzwischen.")
        ctx.inv_add(actor, "food", -1)
        ctx.inv_add(actor, "wood", -1)
        meal = WorldObject(id=ctx.state.next_object_id("meal"), kind="meal", name="Warme Mahlzeit", portable=True,
                           holder=actor.id, created_by=actor.id, created_at=ctx.minute, state={"nourishment": 60})
        ctx.state.save_object(meal, new=True)
        ctx.emit("world.object_created", [actor.id], actor.location_id, {"object": ctx.object_data(meal), "cause": "cook"})
        return None


class Read(Mode):
    def validate(self, ctx, actor, o, params):
        return Accepted(duration=15)

    def finish(self, ctx, actor, o, act):
        content = o.state.get("books") if o.kind == "bookshelf" else o.state.get("notes")
        ctx.emit("agent.read", [actor.id], actor.location_id, {"object": o.id, "name": o.name, "content": list(content or [])})
        return None


class Write(Mode):
    def validate(self, ctx, actor, o, params):
        text = params.get("text")
        if not isinstance(text, str) or not text.strip():
            return rej(RejectCode.INVALID_TARGET, "Es fehlt der Text zum Schreiben.")
        if len(text) > MAX_TEXT:
            return rej(RejectCode.INVALID_TARGET, f"Der Text darf höchstens {MAX_TEXT} Zeichen lang sein.")
        if len(o.state.get("notes", [])) >= MAX_NOTES:
            return rej(RejectCode.CAPACITY, f"{o.name} ist voll beschrieben.")
        return Accepted(duration=5 + len(text) // 40, data={"text": text.strip()})

    def finish(self, ctx, actor, o, act):
        if len(o.state["notes"]) >= MAX_NOTES:
            return rej(RejectCode.CAPACITY, f"{o.name} ist voll beschrieben.")
        o.state["notes"].append({"by": actor.id, "at": ctx.minute, "text": act.data["text"]})
        ctx.state.save_object(o)
        ctx.emit("world.object_changed", [actor.id], o.location_id, {**ctx.object_data(o), "change": "written"})
        return None


class Light(Mode):
    wood = 1                 # Holz je Anzünden (Laternen und Lampen: 0)

    def validate(self, ctx, actor, o, params):
        if o.state["lit"]:
            return rej(RejectCode.INVALID_TARGET, f"{o.name} brennt bereits.")
        if actor.inventory.get("wood", 0) < self.wood:
            return rej(RejectCode.MISSING_RESOURCE, "Zum Anzünden braucht es 1 Holz.")
        return Accepted(duration=5 if self.wood else 1)

    def finish(self, ctx, actor, o, act):
        if actor.inventory.get("wood", 0) < self.wood:
            return rej(RejectCode.MISSING_RESOURCE, "Das Holz fehlt inzwischen.")
        if self.wood:
            ctx.inv_add(actor, "wood", -self.wood)
        o.state["lit"] = True
        ctx.state.save_object(o)
        ctx.emit("world.object_changed", [actor.id], o.location_id, {**ctx.object_data(o), "change": "lit"})
        return None


class Extinguish(Mode):
    def validate(self, ctx, actor, o, params):
        if not o.state["lit"]:
            return rej(RejectCode.INVALID_TARGET, f"{o.name} brennt gar nicht.")
        return Accepted(duration=2)

    def finish(self, ctx, actor, o, act):
        o.state["lit"] = False
        ctx.state.save_object(o)
        ctx.emit("world.object_changed", [actor.id], o.location_id, {**ctx.object_data(o), "change": "extinguished"})
        return None


class Lock(Mode):
    def validate(self, ctx, actor, o, params):
        if o.state["locked"]:
            return rej(RejectCode.INVALID_TARGET, f"{o.name} ist schon verschlossen.")
        return Accepted(duration=1)

    def finish(self, ctx, actor, o, act):
        o.state["locked"] = True
        ctx.state.save_object(o)
        ctx.emit("world.object_changed", [actor.id], o.location_id, {**ctx.object_data(o), "change": "locked"})
        return None


class Unlock(Mode):
    def validate(self, ctx, actor, o, params):
        if not o.state["locked"]:
            return rej(RejectCode.INVALID_TARGET, f"{o.name} ist nicht verschlossen.")
        if o.state.get("needs_key") and held_kind(ctx, actor, "key") is None:
            return rej(RejectCode.LOCKED, f"{o.name} lässt sich nur mit einem Schlüssel öffnen.")
        return Accepted(duration=1)

    def finish(self, ctx, actor, o, act):
        o.state["locked"] = False
        ctx.state.save_object(o)
        ctx.emit("world.object_changed", [actor.id], o.location_id, {**ctx.object_data(o), "change": "unlocked"})
        return None


class Fish(Mode):
    chance = 0.7

    def validate(self, ctx, actor, o, params):
        if ctx.free_slots(actor) < 1:
            return rej(RejectCode.CAPACITY, "Du kannst keinen Fang mehr tragen.")
        return Accepted(duration=25)

    def finish(self, ctx, actor, o, act):
        if ctx.rng(actor.id, "fish").random() < self.chance:
            if ctx.free_slots(actor) < 1:
                return rej(RejectCode.CAPACITY, "Du kannst keinen Fang mehr tragen.")
            ctx.inv_add(actor, "food", 1)
            ctx.emit("agent.fished", [actor.id], actor.location_id, {"caught": True})
        else:
            ctx.emit("agent.fished", [actor.id], actor.location_id, {"caught": False})
        return None


class Harvest(Mode):
    def validate(self, ctx, actor, o, params):
        if o.state["stage"] < 4:
            return rej(RejectCode.INVALID_TARGET, f"{o.name} ist noch nicht reif (Stufe {o.state['stage']} von 4).")
        if ctx.free_slots(actor) < 4:
            return rej(RejectCode.CAPACITY, "Zum Ernten brauchst du 4 freie Plätze (3 Nahrung, 1 Samen).")
        return Accepted(duration=5)

    def finish(self, ctx, actor, o, act):
        if o.state["stage"] < 4 or ctx.free_slots(actor) < 4:
            return rej(RejectCode.CAPACITY, "Ernte nicht mehr möglich.")
        ctx.state.remove_object(o.id)
        ctx.emit("world.object_removed", [actor.id], o.location_id, {"object": ctx.object_data(o), "cause": "harvest"})
        ctx.inv_add(actor, "food", 3)
        ctx.inv_add(actor, "seeds", 1)
        return None


MODES: dict[tuple[str, str], Mode] = {
    ("bed", "sleep"): Sleep(), ("sofa", "sit"): Sit(), ("bench", "sit"): Sit(), ("stove", "cook"): Cook(),
    ("bookshelf", "read"): Read(), ("desk", "read"): Read(), ("board", "read"): Read(),
    ("desk", "write"): Write(), ("board", "write"): Write(),
    ("fireplace", "light"): Light(), ("firepit", "light"): Light(),
    ("fireplace", "extinguish"): Extinguish(), ("firepit", "extinguish"): Extinguish(),
    ("door", "lock"): Lock(), ("door", "unlock"): Unlock(), ("fishing_spot", "fish"): Fish(), ("plant", "harvest"): Harvest(),
}


def all_modes() -> dict[tuple[str, str], Mode]:
    """Alle Modi einschließlich der Dinge im Dorf (AP15, eigene Datei)."""
    from .use_dinge import MODES_DINGE
    return {**MODES, **MODES_DINGE}
