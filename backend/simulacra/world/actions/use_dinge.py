"""Modi für die Dinge im Dorf (AP15): Boot, Lichter ohne Holz, Briefkasten, Wegweiser, Vogelscheuche, Katze, Ablagen."""

import math

from ..models import Accepted, AgentBody, RejectCode, WorldObject
from .base import Ctx, rej
from .use_modes import Extinguish, Fish, Light, Mode, Sit

MAX_LETTERS = 30
MAX_TEXT = 300
CONTAINER_CAP = 20          # Plätze je Ablage (Rohstoffeinheiten plus Dinge)
BOAT_FISH_CHANCE = 0.85


def busy_with(ctx: Ctx, o: WorldObject, actor: AgentBody) -> str | None:
    """Name dessen, der das Ding gerade benutzt (Boot: immer nur eine Person)."""
    for a in ctx.state.agents():
        if a.id != actor.id and a.action is not None and a.action.type == "use" and a.action.data.get("object") == o.id:
            return a.name
    return None


def _minutes(params: dict, default: int, lo: int, hi: int) -> int | None:
    v = params.get("minutes", default)
    return v if isinstance(v, int) and not isinstance(v, bool) and lo <= v <= hi else None


class Row(Mode):
    def validate(self, ctx, actor, o, params):
        if (who := busy_with(ctx, o, actor)):
            return rej(RejectCode.BUSY, f"{who} sitzt gerade im {o.name}.")
        minutes = _minutes(params, 30, 10, 90)
        if minutes is None:
            return rej(RejectCode.INVALID_TARGET, "Rudern geht von 10 bis 90 Minuten.")
        return Accepted(duration=minutes)

    def finish(self, ctx, actor, o, act):
        ctx.emit("agent.rowed", [actor.id], actor.location_id, {"object": o.id, "minutes": act.ends_at - act.started_at})
        return None


class BoatFish(Fish):
    chance = BOAT_FISH_CHANCE

    def validate(self, ctx, actor, o, params):
        if (who := busy_with(ctx, o, actor)):
            return rej(RejectCode.BUSY, f"{who} sitzt gerade im {o.name}.")
        res = super().validate(ctx, actor, o, params)
        if isinstance(res, Accepted):
            res.duration = 30
        return res


class LightFree(Light):
    """Laterne, Kerze, Stehlampe: an und aus ohne Holz."""
    wood = 0


class Post(Mode):
    def validate(self, ctx, actor, o, params):
        to, text = params.get("to"), params.get("text")
        names = {a.id: a.name for a in ctx.state.agents()}
        if to not in names or to == actor.id:
            return rej(RejectCode.INVALID_TARGET, "Der Brief braucht einen Empfänger aus dem Dorf (nicht dich selbst).")
        if not isinstance(text, str) or not text.strip():
            return rej(RejectCode.INVALID_TARGET, "Es fehlt der Text des Briefs.")
        if len(text) > MAX_TEXT:
            return rej(RejectCode.INVALID_TARGET, f"Ein Brief darf höchstens {MAX_TEXT} Zeichen lang sein.")
        if len(o.state["letters"]) >= MAX_LETTERS:
            return rej(RejectCode.CAPACITY, f"Der {o.name} ist voll.")
        return Accepted(duration=5 + len(text) // 40, data={"to": to, "text": text.strip()})

    def finish(self, ctx, actor, o, act):
        if len(o.state["letters"]) >= MAX_LETTERS:
            return rej(RejectCode.CAPACITY, f"Der {o.name} ist voll.")
        o.state["letters"].append({"by": actor.id, "to": act.data["to"], "at": ctx.minute, "text": act.data["text"], "read": False})
        ctx.state.save_object(o)
        ctx.emit("world.object_changed", [actor.id], o.location_id, {**ctx.object_data(o), "change": "letter_posted"})
        return None


def mail_for(o: WorldObject, agent_id: str) -> list[dict]:
    return [m for m in o.state.get("letters", []) if m["to"] == agent_id and not m["read"]]


class Collect(Mode):
    def validate(self, ctx, actor, o, params):
        if not mail_for(o, actor.id):
            return rej(RejectCode.INVALID_TARGET, f"Im {o.name} liegt keine Post für dich.")
        return Accepted(duration=3)

    def finish(self, ctx, actor, o, act):
        names = {a.id: a.name for a in ctx.state.agents()}
        mine = mail_for(o, actor.id)
        for m in mine:
            m["read"] = True
        ctx.state.save_object(o)
        content = [{"by": m["by"], "at": m["at"], "text": f"Brief von {names.get(m['by'], m['by'])}: {m['text']}"} for m in mine]
        ctx.emit("agent.read", [actor.id], actor.location_id, {"object": o.id, "name": o.name, "content": content})
        ctx.emit("world.object_changed", [actor.id], o.location_id, {**ctx.object_data(o), "change": "letters_collected"})
        return None


def compass(frm: tuple[int, int], to: tuple[float, float]) -> str:
    dx, dy = to[0] - frm[0], to[1] - frm[1]
    if math.hypot(dx, dy) < 3:
        return "gleich hier"
    ns = "Nord" if dy < -abs(dx) * 0.4 else "Süd" if dy > abs(dx) * 0.4 else ""
    ew = "ost" if dx > abs(dy) * 0.4 else "west" if dx < -abs(dy) * 0.4 else ""
    return ns + ew + "en" if ns and ew else {"Nord": "Norden", "Süd": "Süden", "ost": "Osten", "west": "Westen"}[ns or ew]


def sign_places(ctx: Ctx, o: WorldObject) -> list[tuple[str, str]]:
    """Orte, die der Wegweiser nennt: alle draußen (ohne Rückfallort), das Haus über seine Haustür."""
    out = []
    for loc in ctx.state.locations.values():
        if loc.props.get("fallback") or loc.id.startswith("house."):
            continue
        x, y, w, h = loc.rect
        out.append((loc.id, f"{loc.name}: {compass((o.x, o.y), (x + w / 2, y + h / 2))}"))
    door = next((d for d in ctx.state.all_objects() if d.kind == "door" and d.name == "Haustür"), None)
    if door is not None:
        link = next((ln for ln in ctx.state.grid.links if (door.x, door.y) in ln), None)
        outside = next((p for p in link if p != (door.x, door.y)), None) if link else None
        if outside:
            out.append(("house", f"Haus: {compass((o.x, o.y), outside)}"))
    return out


class ReadSign(Mode):
    def validate(self, ctx, actor, o, params):
        return Accepted(duration=2)

    def finish(self, ctx, actor, o, act):
        places = sign_places(ctx, o)
        ctx.emit("agent.read", [actor.id], actor.location_id, {"object": o.id, "name": o.name, "content": [t for _, t in places]})
        for lid, _ in places:
            if lid in ctx.state.locations and ctx.state.mark_discovered(lid, actor.id):
                ctx.emit("agent.location_discovered", [actor.id], lid, {"location": lid})
        return None


class Fix(Mode):
    def validate(self, ctx, actor, o, params):
        if o.state["upright"]:
            return rej(RejectCode.INVALID_TARGET, f"Die {o.name} steht schon.")
        return Accepted(duration=5)

    def finish(self, ctx, actor, o, act):
        o.state["upright"] = True
        ctx.state.save_object(o)
        ctx.emit("world.object_changed", [actor.id], o.location_id, {**ctx.object_data(o), "change": "fixed"})
        return None


class Pet(Mode):
    def validate(self, ctx, actor, o, params):
        return Accepted(duration=5)

    def finish(self, ctx, actor, o, act):
        ctx.emit("agent.petted", [actor.id], actor.location_id, {"object": o.id, "name": o.name})
        return None


def _load(o: WorldObject) -> int:
    return len(o.state["contents"]) + sum(o.state["goods"].values())


def _amount(params: dict) -> int | None:
    v = params.get("amount", 1)
    return v if isinstance(v, int) and not isinstance(v, bool) and 1 <= v <= 5 else None


class Store(Mode):
    """Hineinlegen: einen getragenen Gegenstand (`item`) oder Rohstoffe (`resource`, `amount`)."""

    def validate(self, ctx, actor, o, params):
        if (iid := params.get("item")) is not None:
            it = ctx.state.obj(iid) if isinstance(iid, str) else None
            if it is None or it.holder != actor.id:
                return rej(RejectCode.INVALID_TARGET, "Diesen Gegenstand trägst du nicht.")
            if _load(o) + 1 > CONTAINER_CAP:
                return rej(RejectCode.CAPACITY, f"In {o.name} ist kein Platz mehr.")
            return Accepted(duration=1, data={"item": it.id})
        res, amount = params.get("resource"), _amount(params)
        if amount is None:
            return rej(RejectCode.INVALID_TARGET, "Die Menge muss zwischen 1 und 5 liegen.")
        if not isinstance(res, str) or actor.inventory.get(res, 0) < amount:
            return rej(RejectCode.MISSING_RESOURCE, f"So viel {res} hast du nicht dabei.")
        if _load(o) + amount > CONTAINER_CAP:
            return rej(RejectCode.CAPACITY, f"In {o.name} ist kein Platz mehr.")
        return Accepted(duration=1, data={"resource": res, "amount": amount})

    def finish(self, ctx, actor, o, act):
        d = act.data
        if "item" in d:
            it = ctx.state.obj(d["item"])
            if it is None or it.holder != actor.id:
                return rej(RejectCode.INVALID_TARGET, "Diesen Gegenstand trägst du nicht mehr.")
            it.holder = o.id
            ctx.state.save_object(it)
            o.state["contents"].append(it.id)
            what = it.name
        else:
            if actor.inventory.get(d["resource"], 0) < d["amount"]:
                return rej(RejectCode.MISSING_RESOURCE, "Das hast du inzwischen nicht mehr.")
            ctx.inv_add(actor, d["resource"], -d["amount"])
            o.state["goods"][d["resource"]] = o.state["goods"].get(d["resource"], 0) + d["amount"]
            what = f"{d['amount']}× {d['resource']}"
        ctx.state.save_object(o)
        ctx.emit("agent.stored", [actor.id], actor.location_id, {"object": o.id, "name": o.name, "what": what, "into": True,
                                                                 "resource": d.get("resource"), "amount": d.get("amount")})
        return None


class Retrieve(Mode):
    """Herausnehmen: einen Gegenstand (`item`) oder Rohstoffe (`resource`, `amount`)."""

    def validate(self, ctx, actor, o, params):
        if (iid := params.get("item")) is not None:
            if iid not in o.state["contents"]:
                return rej(RejectCode.INVALID_TARGET, f"Das liegt nicht in {o.name}.")
            if ctx.free_slots(actor) < 1:
                return rej(RejectCode.CAPACITY, "Du kannst nichts mehr tragen.")
            return Accepted(duration=1, data={"item": iid})
        res, amount = params.get("resource"), _amount(params)
        if amount is None:
            return rej(RejectCode.INVALID_TARGET, "Die Menge muss zwischen 1 und 5 liegen.")
        if not isinstance(res, str) or o.state["goods"].get(res, 0) < amount:
            return rej(RejectCode.MISSING_RESOURCE, f"So viel {res} liegt nicht in {o.name}.")
        if ctx.free_slots(actor) < amount:
            return rej(RejectCode.CAPACITY, "So viel kannst du nicht tragen.")
        return Accepted(duration=1, data={"resource": res, "amount": amount})

    def finish(self, ctx, actor, o, act):
        d = act.data
        if "item" in d:
            it = ctx.state.obj(d["item"])
            if it is None or d["item"] not in o.state["contents"] or ctx.free_slots(actor) < 1:
                return rej(RejectCode.INVALID_TARGET, "Das geht nicht mehr.")
            o.state["contents"].remove(it.id)
            it.holder = actor.id
            ctx.state.save_object(it)
            what = it.name
        else:
            have = o.state["goods"].get(d["resource"], 0)
            if have < d["amount"] or ctx.free_slots(actor) < d["amount"]:
                return rej(RejectCode.MISSING_RESOURCE, "Das geht nicht mehr.")
            if have == d["amount"]:
                o.state["goods"].pop(d["resource"])
            else:
                o.state["goods"][d["resource"]] = have - d["amount"]
            ctx.inv_add(actor, d["resource"], d["amount"])
            what = f"{d['amount']}× {d['resource']}"
        ctx.state.save_object(o)
        ctx.emit("agent.stored", [actor.id], actor.location_id, {"object": o.id, "name": o.name, "what": what, "into": False,
                                                                 "resource": d.get("resource"), "amount": d.get("amount")})
        return None


_LIGHT, _OFF, _STORE, _RETRIEVE = LightFree(), Extinguish(), Store(), Retrieve()
MODES_DINGE: dict[tuple[str, str], Mode] = {
    ("boat", "row"): Row(), ("boat", "fish"): BoatFish(),
    **{(k, "light"): _LIGHT for k in ("lantern", "candle", "floor_lamp")}, **{(k, "extinguish"): _OFF for k in ("lantern", "candle", "floor_lamp")},
    ("mailbox", "post"): Post(), ("mailbox", "collect"): Collect(), ("signpost", "read"): ReadSign(),
    ("scarecrow", "fix"): Fix(), ("cat", "pet"): Pet(), ("armchair", "sit"): Sit(),
    **{(k, "store"): _STORE for k in ("chest", "wardrobe", "crate")}, **{(k, "retrieve"): _RETRIEVE for k in ("chest", "wardrobe", "crate")},
}
