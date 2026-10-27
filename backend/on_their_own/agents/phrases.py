"""Deutsche Formulierungen für Handlungen, Orte und Dinge (Optionen, Beobachtungen, Protokoll)."""

from typing import Any

from ..world.state import WorldState

RES_DE = {"wood": "Holz", "food": "Nahrung", "water": "Wasser", "seeds": "Samen", "stone": "Stein", "reed": "Schilf"}

USE_OPTION = {
    ("bed", "sleep"): "Im Bett schlafen", ("sofa", "sit"): "Sich aufs {obj} setzen und ausruhen", ("bench", "sit"): "Sich auf die {obj} setzen und ausruhen",
    ("stove", "cook"): "Am Herd eine warme Mahlzeit kochen (braucht 1 Nahrung und 1 Holz)", ("bookshelf", "read"): "Im Bücherregal stöbern und lesen",
    ("desk", "read"): "Die Notizen auf dem Schreibtisch lesen", ("board", "read"): "Die Anschlagtafel lesen",
    ("desk", "write"): "Eine Notiz auf den Schreibtisch schreiben", ("board", "write"): "Eine Nachricht an die Anschlagtafel schreiben",
    ("fireplace", "light"): "Den Kamin anzünden (braucht 1 Holz)", ("fireplace", "extinguish"): "Das Feuer im Kamin löschen",
    ("firepit", "light"): "Die Feuerstelle anzünden (braucht 1 Holz)", ("firepit", "extinguish"): "Die Feuerstelle löschen",
    ("door", "lock"): "{obj} abschließen", ("door", "unlock"): "{obj} aufschließen",
    ("fishing_spot", "fish"): "Angeln", ("plant", "harvest"): "Die reife Pflanze ernten",
    # Dinge im Dorf (AP15)
    ("boat", "row"): "Mit dem Boot auf den See hinausrudern", ("boat", "fish"): "Vom Boot aus angeln",
    ("lantern", "light"): "Die {obj} anzünden", ("lantern", "extinguish"): "Die {obj} löschen",
    ("candle", "light"): "Die {obj} anzünden", ("candle", "extinguish"): "Die {obj} ausblasen",
    ("floor_lamp", "light"): "Die {obj} einschalten", ("floor_lamp", "extinguish"): "Die {obj} ausschalten",
    ("mailbox", "collect"): "Die Post aus dem Briefkasten holen und lesen", ("signpost", "read"): "Den Wegweiser lesen",
    ("scarecrow", "fix"): "Die umgefallene Vogelscheuche wieder aufrichten", ("cat", "pet"): "Die Katze streicheln",
    ("armchair", "sit"): "Sich in den {obj} setzen und ausruhen",
}
LIGHTS = ("lantern", "candle", "floor_lamp")
USE_THIRD = {"sleep": "legt sich schlafen", "sit": "setzt sich hin", "cook": "kocht etwas", "read": "liest", "write": "schreibt etwas auf",
             "light": "zündet ein Feuer an", "extinguish": "löscht ein Feuer", "lock": "schließt eine Tür ab", "unlock": "schließt eine Tür auf",
             "fish": "angelt", "harvest": "erntet eine Pflanze", "row": "rudert mit dem Boot", "post": "wirft einen Brief ein",
             "collect": "holt die Post", "fix": "richtet die Vogelscheuche auf", "pet": "streichelt die Katze",
             "store": "legt etwas ab", "retrieve": "nimmt etwas heraus"}


BP_DE = {"bench": "eine Bank", "birdhouse": "ein Vogelhaus", "firepit": "eine Feuerstelle", "fence": "einen Gartenzaun", "pier_extension": "den Steg", "basket": "einen Korb",
         "path": "einen Weg", "bed": "ein Beet", "tree": "einen Baum", "lantern": "eine Laterne", "well": "einen Brunnen"}


def loc_to(state: WorldState, loc_id: str) -> str:
    loc = state.locations.get(loc_id)
    return loc.props.get("to", f"zu {loc.name}") if loc else "irgendwohin"


def loc_at(state: WorldState, loc_id: str) -> str:
    loc = state.locations.get(loc_id)
    return loc.props.get("at", f"bei {loc.name}") if loc else "irgendwo"


def target_label(state: WorldState, target: str) -> str:
    """Anzeigename eines Ziels (Ort, Objekt, Quelle, Agent), ohne Präposition."""
    if target in state.locations:
        return state.locations[target].name
    if (o := state.obj(target)) is not None:
        return o.name
    if (n := state.node(target)) is not None:
        return n.label or f"Quelle für {RES_DE.get(n.resource, n.resource)}"
    if (a := state.agent(target)) is not None:
        return a.name
    return target


def third_person(state: WorldState, name: str, action: str, params: dict[str, Any]) -> str:
    """„Mira geht in die Küche“: wie ein anderer Agent eine Handlung wahrnimmt."""
    p = params
    if action == "move_to":
        t = p.get("target")
        if t in state.locations:
            return f"{name} geht {loc_to(state, t)}"
        return f"{name} geht zu {target_label(state, t)}" if t else f"{name} geht los"
    simple = {"wait": "wartet", "eat": "isst etwas", "drink": "trinkt etwas", "rest": "ruht sich aus", "sleep": "schläft", "plant": "pflanzt etwas ein",
              "water": "gießt eine Pflanze", "drop": "legt etwas ab"}
    if action in simple:
        return f"{name} {simple[action]}"
    if action == "use":
        o = state.obj(p.get("object_id", ""))
        if o and o.kind in LIGHTS and p.get("mode") in ("light", "extinguish"):
            return f"{name} {'macht' if p['mode'] == 'light' else 'löscht'} {'Licht an' if p['mode'] == 'light' else 'ein Licht'}: {o.name}"
        return f"{name} {USE_THIRD.get(p.get('mode'), 'benutzt')} {('(' + o.name + ')') if o and p.get('mode') in ('read', 'write') else ''}".strip()
    if action == "gather":
        return f"{name} sammelt {RES_DE.get(p.get('resource'), 'etwas')}"
    if action == "build":
        bp = p.get("blueprint")
        return f"{name} baut etwas" if not bp else f"{name} baut: {BP_DE.get(bp, bp)}"
    if action == "take":
        return f"{name} nimmt {target_label(state, p.get('object_id', ''))}"
    if action == "inspect":
        return f"{name} sieht sich {target_label(state, p.get('object_id', ''))} an"
    if action == "give":
        return f"{name} gibt {target_label(state, p.get('to', ''))} etwas"
    if action == "speak":
        return f"{name} spricht mit {target_label(state, p.get('to', ''))}"
    return f"{name} tut etwas"


def direction_word(frm: tuple[int, int], to: tuple[int, int]) -> str:
    dx, dy = to[0] - frm[0], to[1] - frm[1]
    ns = "Nord" if dy < -abs(dx) * 0.4 else "Süd" if dy > abs(dx) * 0.4 else ""
    ew = "ost" if dx > abs(dy) * 0.4 else "west" if dx < -abs(dy) * 0.4 else ""
    if ns and ew:
        return ns + ew + "en"
    return {"Nord": "Norden", "Süd": "Süden", "ost": "Osten", "west": "Westen"}.get(ns or ew, "ganz in der Nähe")


WEATHER_DE = {"clear": "klar", "cloudy": "bewölkt", "rain": "Regen", "storm": "Sturm", "fog": "Nebel", "snow": "Schnee"}
PHASE_DE = {"night": "Nacht", "dawn": "Morgendämmerung", "day": "Tag", "dusk": "Abenddämmerung"}
