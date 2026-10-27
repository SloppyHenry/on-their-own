"""Entfernen und Gestaltung ändern (AP16a): Orte, Quellen und Übergänge löschen, einzelne Änderungen an der Gestaltung (`look.ops`). Gleiche Regeln wie `extend.py`: eine Operation, ein Ereignis."""

from typing import Any

from .actions.base import Ctx
from .extend import WorldEditError, _reassign_locations, _tile_list


def remove_location(ctx: Ctx, id_: str) -> None:
    st = ctx.state
    loc = st.locations.get(id_)
    if loc is None:
        raise WorldEditError("unknown", f"Der Ort '{id_}' ist unbekannt.")
    if loc.props.get("fallback"):
        raise WorldEditError("invalid", "Der Ort, der alles andere abdeckt, lässt sich nicht entfernen.")
    st.conn.execute("DELETE FROM locations WHERE id=?", (id_,))
    st.reload_caches()
    moved = _reassign_locations(ctx)
    ctx.emit("world.location_removed", data={"id": id_, "name": loc.name, "reassigned": moved})


def remove_resource_node(ctx: Ctx, id_: str) -> None:
    st = ctx.state
    row = st.conn.execute("SELECT location_id FROM resources WHERE id=?", (id_,)).fetchone()
    if row is None:
        raise WorldEditError("unknown", f"Die Quelle '{id_}' gibt es nicht.")
    st.conn.execute("DELETE FROM resources WHERE id=?", (id_,))
    ctx.emit("world.resource_removed", [], row["location_id"], {"node": id_})


def remove_links(ctx: Ctx, pairs: Any) -> None:
    """Entfernt Übergänge (egal in welcher Richtung angegeben); was es nicht gibt, ist ein Fehler."""
    st = ctx.state
    cur = st.get_meta("links") or []
    gone: list[list[list[int]]] = []
    for pair in pairs:
        a, b = _tile_list(ctx, pair, "Übergang")
        hit = next((p for p in cur if {tuple(p[0]), tuple(p[1])} == {a, b}), None)
        if hit is None:
            raise WorldEditError("unknown", f"Den Übergang {list(a)} – {list(b)} gibt es nicht.")
        cur = [p for p in cur if p is not hit]
        gone.append([list(a), list(b)])
    st.set_meta("links", cur)
    st.reload_caches()
    ctx.emit("world.links_removed", data={"links": gone})


def edit_look(ctx: Ctx, ops: Any) -> None:
    """Einzelne Änderungen an der Gestaltung (siehe world/look_ops.py): Formen und Deko eintragen oder entfernen, Bildstellen setzen, Gebiete vergrößern."""
    import copy

    from . import look as lk
    from . import look_ops
    st = ctx.state
    cur = st.get_meta("look")
    if not cur:
        raise WorldEditError("invalid", "Die Welt hat keine Gestaltung (look); dort lässt sich nichts ändern.")
    if not isinstance(ops, list) or not all(isinstance(o, dict) for o in ops):
        raise WorldEditError("invalid", "look.ops braucht eine Liste von Operationen.")
    look = copy.deepcopy(cur if lk.is_v2(cur) else lk.upgrade_v1(cur))
    try:
        look_ops.apply(look, ops)
    except (look_ops.LookOpError, KeyError, TypeError) as e:
        raise WorldEditError("invalid", f"Gestaltung: {e}") from None
    st.set_meta("look", look)
    ctx.emit("world.look_edited", data={"ops": ops, "upgraded": not lk.is_v2(cur)})
