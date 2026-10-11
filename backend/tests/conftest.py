"""Gemeinsame Testeinstellung: Jedes erzeugte Ereignis wird gegen sein Datenmodell geprüft."""

from simulacra.events import types as event_types

event_types.STRICT = True
