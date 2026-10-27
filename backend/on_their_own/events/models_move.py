"""Datenmodelle der Bewegungsereignisse.

Ein Weg wird als Fahrplan gemeldet (`agent.walking`): Pfad und die Sim-Minute, zu der jede Kachel erreicht wird.
Die Engine bewegt den Körper weiter Kachel für Kachel; ein neues Ereignis gibt es nur, wenn der Fahrplan nicht mehr
stimmt (neue Route, anderes Wetter, geänderte Kosten). So wächst die Ereignismenge mit der Zahl der Wege, nicht der Schritte.
"""

from pydantic import Field

from .models import D


class Walking(D):
    from_: list[int] = Field(alias="from")   # Kachel beim Erstellen des Fahrplans
    path: list[list[int]]                    # folgende Kacheln bis zum Ziel
    arrive: list[int]                        # Sim-Minute, zu der path[i] erreicht wird (aufsteigend)
    label: str | None = None
    reason: str = "start"                    # start | replan | tempo


class Moved(D):
    """Veraltet (bis AP10): ein Schritt je Ereignis. Steht nur noch in älteren Ereignisprotokollen."""
    from_: list[int] = Field(alias="from")
    to: list[int]
    facing: str
    remaining: int = 0


class Arrived(D):
    target: str | None = None
    label: str | None = None
    at: list[int]


class LocationChanged(D):
    from_location: str
    to_location: str
    at: list[int] | None = None              # Kachel beim Betreten (auch beim Versetzen per Ereignis)


class LocationDiscovered(D):
    location: str
