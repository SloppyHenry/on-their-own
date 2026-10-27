"""Stimmen der Figuren (AP17d): reine Darstellung für das Plappern im Browser, gespeichert in der Welt (`meta.voices`), damit sie mit dem
Spielstand, dem Export und dem Import wandert und alle Browser dieselbe Stimme hören. Die Bewohner erfahren nichts davon: kein Prompt,
keine Beobachtung, nur ein Systemereignis für die Oberfläche."""

from typing import Any

from .engine import WorldEngine

KEY = "voices"


def voices(state) -> dict[str, dict[str, Any]]:
    """Alle eigenen Stimmen (Kennung → Stimme); Figuren ohne Eintrag bekommen im Browser den Vorschlag aus Geschlecht und Alter."""
    return dict(state.get_meta(KEY) or {})


def set_voice(engine: WorldEngine, agent_id: str, voice: dict[str, Any] | None) -> bool:
    """Setzt (oder mit None: entfernt) die Stimme einer Figur und meldet `simulation.voice_changed`. False, wenn es die Figur nicht gibt."""
    st = engine.state
    with engine.db.transaction():
        if st.agent(agent_id) is None:
            return False
        all_ = voices(st)
        if voice is None:
            all_.pop(agent_id, None)
        else:
            all_[agent_id] = voice
        st.set_meta(KEY, all_)
        engine.emit_event("simulation.voice_changed", [], None, {"agent": agent_id, "voice": voice})
    return True
