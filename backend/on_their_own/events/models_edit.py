"""Datenmodelle der Welt-Änderungsereignisse (Karte, Übergänge, Gestaltung, Patches); ausgelagert, damit `models.py` klein bleibt."""

from typing import Any

from pydantic import Field

from .models import D


class MapExtended(D):
    from_: list[int] = Field(alias="from")
    to: list[int]
    fill: str


class LinksAdded(D):
    links: list[list[list[int]]]


class LookChanged(D):
    """Gebiete und Landstraßen, die an die Gestaltung der Welt angehängt wurden (siehe docs/welt-erweitern.md)."""
    regions: list[dict[str, Any]]
    roads: list[list[list[float]]]
    upgraded: bool


class LookAdded(D):
    """Ein Bewohner hat etwas gebaut, das die Darstellung braucht (Weg, Beet, Baum, Laterne, Brunnen): das Stück wird an das Gebiet gehängt."""
    region: str
    upgraded: bool = False
    paths: list[list[list[float]]] = []
    gardens: list[dict[str, Any]] = []
    decor: list[list[Any]] = []
    lights: list[list[float]] = []
    place: dict[str, dict[str, Any]] = {}


class LookEdited(D):
    """Die Gestaltung wurde im Editor geändert (AP16a): Formen und Deko eingetragen oder entfernt, Bildstellen gesetzt, Gebiete vergrößert (Operationen siehe `world/look_ops.py`)."""
    ops: list[dict[str, Any]]
    upgraded: bool = False


class Edited(D):
    """Der Entwurf aus dem Editor (Gestalten) wurde in einem Zug übernommen; steht nur im Protokoll der Leitstelle, die Bewohner erfahren davon nichts."""
    patch: str
    actions: int
    summary: dict[str, int] = {}


class LocationRemoved(D):
    id: str
    name: str
    reassigned: dict[str, int] = {}


class ResourceRemoved(D):
    node: str


class LinksRemoved(D):
    links: list[list[list[int]]]


class Generated(D):
    """Ein Dorf wurde mit dem Weltgenerator erzeugt (Erweiterung oder neue Simulation); `seed` ist der Seed, der die Prüfung bestanden hat."""
    kind: str
    seed: int
    requested_seed: int
    village: str
    patch: str | None = None
    summary: dict[str, int]


class PatchApplied(D):
    id: str
    description: str = ""
    counts: dict[str, int]
