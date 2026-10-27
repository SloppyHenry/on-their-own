"""Ressourcen und Pflanzen: gather, plant, water, eat, drink."""

import math

from .. import weather
from ..models import Accepted, ActiveAction, AgentBody, RejectCode, Rejected, WorldObject
from .base import Action, Ctx, find_object, held_kind, rej

NODE_LIMIT = 900   # Knoten mit Obergrenze ab hier gelten als unerschöpflich (Wasser)
FOOD_RESTORE = 25
MEAL_RESTORE = 60
DRINK_RESTORE = 40


def _int_param(params: dict, key: str, default: int, lo: int, hi: int) -> int | None:
    v = params.get(key, default)
    return v if isinstance(v, int) and not isinstance(v, bool) and lo <= v <= hi else None


def _node_for(ctx: Ctx, actor: AgentBody, resource: str, node_id: str | None):
    nodes = [n for n in ctx.state.nodes_at(actor.location_id) if n.resource == resource and (node_id is None or n.id == node_id)]
    return next((n for n in nodes if n.amount >= 1), nodes[0] if nodes else None)


class Gather(Action):
    name = "gather"

    def validate(self, ctx, actor, params):
        res = params.get("resource")
        amount = _int_param(params, "amount", 1, 1, 5)
        if amount is None:
            return rej(RejectCode.INVALID_TARGET, "Die Menge muss zwischen 1 und 5 liegen.")
        node = _node_for(ctx, actor, res, params.get("node"))
        if node is None:
            return rej(RejectCode.NOT_HERE, f"Hier gibt es keine Quelle für '{res}'.")
        if node.amount < 1:
            return rej(RejectCode.MISSING_RESOURCE, f"Die Quelle für {res} ist erschöpft.")
        if node.requires_tool and held_kind(ctx, actor, node.requires_tool) is None:
            return rej(RejectCode.MISSING_RESOURCE, f"Dafür brauchst du das Werkzeug '{node.requires_tool}' in der Hand.")
        if ctx.free_slots(actor) < 1:
            return rej(RejectCode.CAPACITY, "Du kannst nichts mehr tragen.")
        minutes = math.ceil(node.gather_minutes * amount * ctx.rules.gather_time_mult)
        return Accepted(duration=minutes, data={"node": node.id, "amount": amount, "resource": res})

    def finish(self, ctx, actor, act):
        node = ctx.state.node(act.data["node"])
        take = min(act.data["amount"], int(node.amount), ctx.free_slots(actor))
        if take < 1:
            code = RejectCode.CAPACITY if ctx.free_slots(actor) < 1 else RejectCode.MISSING_RESOURCE
            return rej(code, "Es war nichts mehr zu holen." if code == RejectCode.MISSING_RESOURCE else "Du kannst nichts mehr tragen.")
        if node.cap < NODE_LIMIT:
            ctx.state.set_node_amount(node.id, node.amount - take)
        ctx.inv_add(actor, node.resource, take)
        ctx.emit("world.resource_changed", [actor.id], node.location_id,
                 {"node": node.id, "resource": node.resource, "amount": node.amount - take if node.cap < NODE_LIMIT else node.amount, "cause": "gathered"})
        return None


class Plant(Action):
    name = "plant"

    def validate(self, ctx, actor, params):
        bed = find_object(ctx, actor, params.get("seedbed_id"), kinds=("seedbed",))
        if isinstance(bed, Rejected):
            return bed
        if _plant_at(ctx, bed) is not None:
            return rej(RejectCode.INVALID_TARGET, f"{bed.name} ist schon bepflanzt.")
        if actor.inventory.get("seeds", 0) < 1:
            return rej(RejectCode.MISSING_RESOURCE, "Du hast keine Samen.")
        if ctx.state.weather()["kind"] in weather.BLOCKS_PLANTING:
            return rej(RejectCode.FORBIDDEN_BY_RULES, "Bei diesem Wetter kann man nichts pflanzen.")
        if ctx.state.object_count() >= ctx.rules.max_objects:
            return rej(RejectCode.FORBIDDEN_BY_RULES, "Die Welt kann keine weiteren Objekte aufnehmen.")
        return Accepted(duration=10, data={"seedbed": bed.id})

    def finish(self, ctx, actor, act):
        bed = ctx.state.obj(act.data["seedbed"])
        if bed is None or _plant_at(ctx, bed) is not None or actor.inventory.get("seeds", 0) < 1:
            return rej(RejectCode.INVALID_TARGET, "Pflanzen ist nicht mehr möglich.")
        ctx.inv_add(actor, "seeds", -1)
        raining = ctx.state.weather()["kind"] in weather.WATERS_PLANTS
        plant = WorldObject(id=ctx.state.next_object_id("plant"), kind="plant", name="Möhrenpflanze", location_id=bed.location_id,
                            x=bed.x, y=bed.y, created_by=actor.id, created_at=ctx.minute,
                            state={"crop": "carrot", "stage": 0, "planted_at": ctx.minute, "seedbed_id": bed.id,
                                   "watered_at": ctx.minute if raining else None, "growth_minutes": 0})
        ctx.state.save_object(plant, new=True)
        ctx.emit("world.object_created", [actor.id], plant.location_id, {"object": ctx.object_data(plant), "cause": "plant"})
        return None


def _plant_at(ctx: Ctx, bed: WorldObject) -> WorldObject | None:
    return next((o for o in ctx.state.objects_at(bed.location_id) if o.kind == "plant" and (o.x, o.y) == (bed.x, bed.y)), None)


class Water(Action):
    name = "water"

    def validate(self, ctx, actor, params):
        o = find_object(ctx, actor, params.get("object_id"), kinds=("plant", "seedbed"))
        if isinstance(o, Rejected):
            return o
        plant = o if o.kind == "plant" else _plant_at(ctx, o)
        if plant is None:
            return rej(RejectCode.INVALID_TARGET, f"Auf {o.name} wächst nichts, das gegossen werden müsste.")
        source = "carried" if actor.inventory.get("water", 0) >= 1 else \
            "node" if any(n.resource == "water" for n in ctx.state.nodes_at(actor.location_id)) else None
        if source is None:
            return rej(RejectCode.MISSING_RESOURCE, "Du hast kein Wasser und hier ist kein Brunnen oder Hahn.")
        return Accepted(duration=5, data={"plant": plant.id, "source": source})

    def finish(self, ctx, actor, act):
        plant = ctx.state.obj(act.data["plant"])
        if plant is None:
            return rej(RejectCode.INVALID_TARGET, "Die Pflanze gibt es nicht mehr.")
        if act.data["source"] == "carried":
            if actor.inventory.get("water", 0) < 1:
                return rej(RejectCode.MISSING_RESOURCE, "Das Wasser fehlt inzwischen.")
            ctx.inv_add(actor, "water", -1)
        plant.state["watered_at"] = ctx.minute
        ctx.state.save_object(plant)
        ctx.emit("world.object_changed", [actor.id], plant.location_id, {**ctx.object_data(plant), "change": "watered"})
        return None


def _consume_from_node(ctx: Ctx, actor: AgentBody, resource: str) -> bool:
    node = next((n for n in ctx.state.nodes_at(actor.location_id) if n.resource == resource and n.amount >= 1 and not n.requires_tool), None)
    if node is None:
        return False
    if node.cap < NODE_LIMIT:
        ctx.state.set_node_amount(node.id, node.amount - 1)
        ctx.emit("world.resource_changed", [actor.id], node.location_id, {"node": node.id, "resource": resource, "amount": node.amount - 1, "cause": "consumed"})
    return True


def _can_source(ctx: Ctx, actor: AgentBody, resource: str) -> bool:
    return actor.inventory.get(resource, 0) >= 1 or any(
        n.resource == resource and n.amount >= 1 and not n.requires_tool for n in ctx.state.nodes_at(actor.location_id))


class Eat(Action):
    name = "eat"

    def validate(self, ctx, actor, params):
        if params.get("item") is not None:
            m = ctx.state.obj(params["item"]) if isinstance(params["item"], str) else None
            if m is None or m.holder != actor.id or m.kind != "meal":
                return rej(RejectCode.INVALID_TARGET, "Diese Mahlzeit trägst du nicht bei dir.")
            return Accepted(duration=5, data={"meal": m.id})
        meal = next((o for o in ctx.state.objects_held(actor.id) if o.kind == "meal"), None)
        if meal is not None:
            return Accepted(duration=5, data={"meal": meal.id})
        if not _can_source(ctx, actor, "food"):
            return rej(RejectCode.MISSING_RESOURCE, "Du hast nichts zu essen und hier gibt es nichts.")
        return Accepted(duration=5, data={})

    def finish(self, ctx, actor, act):
        if "meal" in act.data:
            m = ctx.state.obj(act.data["meal"])
            if m is None or m.holder != actor.id:
                return rej(RejectCode.MISSING_RESOURCE, "Die Mahlzeit ist weg.")
            restore = m.state["nourishment"]
            ctx.state.remove_object(m.id)
            ctx.emit("world.object_removed", [actor.id], actor.location_id, {"object": ctx.object_data(m), "cause": "eaten"})
        elif actor.inventory.get("food", 0) >= 1:
            ctx.inv_add(actor, "food", -1)
            restore = FOOD_RESTORE
        elif _consume_from_node(ctx, actor, "food"):
            restore = FOOD_RESTORE
        else:
            return rej(RejectCode.MISSING_RESOURCE, "Es ist nichts mehr zu essen da.")
        actor.needs["hunger"] = max(0.0, actor.needs["hunger"] - restore)
        ctx.emit("agent.ate", [actor.id], actor.location_id, {"hunger": round(actor.needs["hunger"], 1)})
        return None


class Drink(Action):
    name = "drink"

    def validate(self, ctx, actor, params):
        if not _can_source(ctx, actor, "water"):
            return rej(RejectCode.MISSING_RESOURCE, "Du hast kein Wasser und hier gibt es keine Quelle.")
        return Accepted(duration=2)

    def finish(self, ctx, actor, act):
        if actor.inventory.get("water", 0) >= 1:
            ctx.inv_add(actor, "water", -1)
        elif not _consume_from_node(ctx, actor, "water"):
            return rej(RejectCode.MISSING_RESOURCE, "Es ist kein Wasser da.")
        actor.needs["thirst"] = max(0.0, actor.needs["thirst"] - DRINK_RESTORE)
        ctx.emit("agent.drank", [actor.id], actor.location_id, {"thirst": round(actor.needs["thirst"], 1)})
        return None
