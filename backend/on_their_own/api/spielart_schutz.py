"""Schutz der Spielart im Backend (AP18d): In der Spielart Leben verändern nur die Bewohner die Welt. Ereigniseingabe, Gestalten-Entwürfe und Weltpatches lehnen mit 403 ab.
Die Regler (Autonomie, Tempo …) bleiben erlaubt, sie verändern das Verhalten, nicht die Welt (Frage 56)."""

from fastapi import HTTPException

from ..world import spielart


async def nur_gott(sim, was: str) -> None:
    mode = await sim.engine.db.run(lambda: spielart.get(sim.engine.state))
    if mode != "gott":
        raise HTTPException(403, f"In der Spielart Leben ist das nicht möglich ({was}): Nur die Bewohner verändern die Welt. Die Spielart lässt sich unter Menü › Einstellungen wechseln.")
