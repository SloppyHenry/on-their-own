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
