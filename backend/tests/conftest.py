"""Gemeinsame Testeinstellung: Jedes erzeugte Ereignis wird gegen sein Datenmodell geprüft.

Die Mechanik-Tests (Wege, Aktionen, Wahrnehmung …) laufen auf einer festen Testwelt (`fixtures/world_mechanik.json`, die
Startwelt bis AP13), damit sie nicht an der Gestaltung der Startwelt hängen. Die echte Startwelt (nach Mockup A) prüft
`tests/world/test_startwelt.py` ausdrücklich."""

from pathlib import Path

import pytest

from simulacra.events import types as event_types
from simulacra.world import loader

event_types.STRICT = True
MECHANIK_WORLD = Path(__file__).parent / "fixtures" / "world_mechanik.json"
START_WORLD = loader.DATA_DIR / "world_default.json"


@pytest.fixture(autouse=True)
def _testwelt(monkeypatch):
    monkeypatch.setattr(loader, "DEFAULT_WORLD", MECHANIK_WORLD)
