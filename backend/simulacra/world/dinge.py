"""Was die Dinge im Dorf von selbst tun (AP15): Sturm wirft die Vogelscheuche um, die Katze wechselt ihren Platz."""

from typing import TYPE_CHECKING

from . import clock

if TYPE_CHECKING:
    from .actions.base import Ctx

FALL_CHANCE = 0.3          # je Sturmstunde
CAT_EVERY = 180            # Minuten zwischen zwei Plätzen der Katze
CAT_NIGHT = (22 * 60, 6 * 60)


def tick(ctx: "Ctx") -> None:
    st = ctx.state
    if ctx.minute % 60 == 0 and st.weather()["kind"] == "storm":
        for o in st.objects_of_kind("scarecrow"):
            if o.state.get("upright", True) and ctx.rng(o.id, "fall").random() < FALL_CHANCE:
                o.state["upright"] = False
                st.save_object(o)
                ctx.emit("world.object_changed", [], o.location_id, {**ctx.object_data(o), "change": "fell"})
    if ctx.minute % CAT_EVERY == 0:
        for cat in st.objects_of_kind("cat"):
            _wander(ctx, cat)


def _wander(ctx: "Ctx", cat) -> None:
    """Nachts auf dem ersten Platz (Schlafplatz), tagsüber reihum auf den anderen; nicht, solange jemand sie streichelt."""
    st, spots = ctx.state, cat.state.get("spots") or []
    if len(spots) < 2 or cat.holder is not None:
        return
    if any(a.action is not None and a.action.data.get("object") == cat.id for a in st.agents()):
        return
    m = clock.minute_of_day(ctx.minute)
    night = m >= CAT_NIGHT[0] or m < CAT_NIGHT[1]
    nxt = 0 if night else 1 + (cat.state.get("spot", 0) % (len(spots) - 1))
    if nxt == cat.state.get("spot") and (cat.x, cat.y) == tuple(spots[nxt]):
        return
    x, y = spots[nxt]
    cat.state["spot"], cat.x, cat.y, cat.location_id = nxt, x, y, st.location_at(x, y)
    st.save_object(cat)
    ctx.emit("world.object_changed", [], cat.location_id, {**ctx.object_data(cat), "change": "moved"})


def slow_growth(ctx: "Ctx") -> set[str]:
    """Orte, an denen eine umgefallene Vogelscheuche liegt: dort wachsen Pflanzen halb so schnell (Vögel)."""
    return {o.location_id for o in ctx.state.objects_of_kind("scarecrow") if not o.state.get("upright", True) and o.location_id}
