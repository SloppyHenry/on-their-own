"""Registry der Objektarten: Eigenschaften und Zustandsschemata. Neue Arten (AP08) nur hier ergänzen."""

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class ObjectKind:
    kind: str
    label: str
    blocks: bool = False
    portable: bool = False
    modes: tuple[str, ...] = ()
    schema: dict[str, tuple[type | tuple[type, ...], Any]] = field(default_factory=dict)  # Schlüssel -> (Typ, Standard)


def _k(kind, label, **kw) -> ObjectKind:
    return ObjectKind(kind, label, **kw)


KINDS: dict[str, ObjectKind] = {k.kind: k for k in [
    _k("bed", "Bett", modes=("sleep",)),
    _k("chest", "Truhe", blocks=True, modes=("store", "retrieve"), schema={"contents": (list, []), "goods": (dict, {})}),
    _k("desk", "Schreibtisch", blocks=True, modes=("write", "read"), schema={"notes": (list, [])}),
    _k("workbench", "Werkbank", blocks=True),
    _k("axe", "Axt", portable=True),
    _k("pickaxe", "Spitzhacke", portable=True),
    _k("key", "Schlüssel", portable=True),
    _k("stove", "Herd", blocks=True, modes=("cook",), schema={"powered": (bool, True)}),
    _k("tap", "Wasserhahn", blocks=True),
    _k("sofa", "Sofa", modes=("sit",)),
    _k("table", "Tisch", blocks=True),
    _k("bookshelf", "Bücherregal", blocks=True, modes=("read",), schema={"books": (list, [])}),
    _k("fireplace", "Kamin", blocks=True, modes=("light", "extinguish"), schema={"lit": (bool, False)}),
    _k("door", "Tür", modes=("lock", "unlock"), schema={"locked": (bool, False), "needs_key": (bool, False)}),
    _k("seedbed", "Beet"),
    _k("plant", "Pflanze", modes=("harvest",),
       schema={"stage": (int, 0), "crop": (str, "carrot"), "planted_at": (int, 0), "watered_at": ((int, type(None)), None),
               "seedbed_id": (str, ""), "growth_minutes": (int, 0)}),
    _k("well", "Brunnen", blocks=True),
    _k("bench", "Bank", modes=("sit",)),
    _k("board", "Anschlagtafel", blocks=True, modes=("read", "write"), schema={"notes": (list, [])}),
    _k("fishing_spot", "Angelplatz", modes=("fish",)),
    _k("birdhouse", "Vogelhaus"),
    _k("fence", "Zaun", blocks=True),
    _k("firepit", "Feuerstelle", modes=("light", "extinguish"), schema={"lit": (bool, False)}),
    _k("pier_plank", "Steg-Planke"),
    _k("construction_site", "Baustelle",
       schema={"blueprint": (str, ""), "progress": (int, 0), "total": (int, 1), "builder": (str, "")}),
    _k("meal", "Mahlzeit", portable=True, schema={"nourishment": (int, 60)}),
    _k("map", "Karte", portable=True, schema={"text": (str, "")}),
    _k("note", "Notiz", portable=True, schema={"text": (str, "")}),
    _k("item", "Gegenstand", portable=True, schema={"description": (str, "")}),
    # Dinge im Dorf (AP15): aus der Deko von Mockup A und innen2
    _k("boat", "Boot", modes=("row", "fish")),
    _k("lantern", "Laterne", modes=("light", "extinguish"), schema={"lit": (bool, False)}),
    _k("candle", "Kerze", modes=("light", "extinguish"), schema={"lit": (bool, False)}),
    _k("floor_lamp", "Stehlampe", modes=("light", "extinguish"), schema={"lit": (bool, False)}),
    _k("mailbox", "Briefkasten", modes=("post", "collect"), schema={"letters": (list, [])}),
    _k("signpost", "Wegweiser", modes=("read",)),
    _k("scarecrow", "Vogelscheuche", modes=("fix",), schema={"upright": (bool, True)}),
    _k("cat", "Katze", modes=("pet",), schema={"spots": (list, []), "spot": (int, 0)}),
    _k("armchair", "Sessel", modes=("sit",)),
    _k("wardrobe", "Schrank", blocks=True, modes=("store", "retrieve"), schema={"contents": (list, []), "goods": (dict, {})}),
    _k("crate", "Kiste", blocks=True, modes=("store", "retrieve"), schema={"contents": (list, []), "goods": (dict, {})}),
    _k("basket", "Korb", portable=True, schema={"extra_slots": (int, 4)}),
]}


UNKNOWN = ObjectKind("unknown", "Unbekanntes Objekt", portable=False)


def get(kind: str) -> ObjectKind:
    """Streng: nur bekannte Arten (für neue Objekte)."""
    try:
        return KINDS[kind]
    except KeyError:
        raise ValueError(f"unbekannte Objektart: {kind}") from None


def spec(kind: str) -> ObjectKind:
    """Tolerant: unbekannte Arten aus älteren Spielständen laden als harmlose, passive Objekte."""
    return KINDS.get(kind, UNKNOWN)


def normalize_state(kind: str, state: dict[str, Any]) -> dict[str, Any]:
    """Ergänzt Standardwerte und prüft Typen; unbekannte Schlüssel oder falsche Typen sind Fehler."""
    if kind not in KINDS:        # alter Spielstand mit inzwischen entfernter Art: Zustand unverändert lassen
        return dict(state)
    spec = KINDS[kind]
    unknown = set(state) - set(spec.schema)
    if unknown:
        raise ValueError(f"{kind}: unbekannte Zustandsfelder {sorted(unknown)}")
    out: dict[str, Any] = {}
    for key, (typ, default) in spec.schema.items():
        value = state.get(key, default)
        if isinstance(value, bool) and typ is int:
            raise ValueError(f"{kind}.{key}: bool statt int")
        if not isinstance(value, typ):
            raise ValueError(f"{kind}.{key}: erwartet {typ}, bekam {type(value).__name__}")
        out[key] = list(value) if isinstance(value, list) else value
    return out
