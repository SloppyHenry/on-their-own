"""Aktionskatalog. Neue Aktionen nur hier registrieren."""

from .base import Action
from .building import Build
from .items import Drop, Give, Inspect, Take, Use
from .movement import MoveTo, Wait
from .needs import Rest, Sleep
from .resources import Drink, Eat, Gather, Plant, Water
from .social import Speak

REGISTRY: dict[str, Action] = {a.name: a for a in (
    MoveTo(), Wait(), Inspect(), Take(), Drop(), Give(), Use(), Gather(), Plant(), Water(), Build(),
    Eat(), Drink(), Rest(), Sleep(), Speak())}
