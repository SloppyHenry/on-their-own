"""Wissensverteilung (§10.3): Informationen, Nachrichten, Einladungen und Situationen erreichen **nur** die genannten Empfänger.

Jede Auslieferung ist ein Ereignis `agent.informed` für genau einen Empfänger. Daraus entsteht über die normale Beobachtungskette (`agents/observations.py`)
eine Erinnerung nur bei ihm; niemand sonst bekommt eine Beobachtung, und es gibt keinen Weg zu den Gedächtnissen der anderen.
"""

from typing import Any

from ..world import clock

SENDER_WORDS = {"Brief": "in einem Brief"}


def source_phrase(mode: str, sender: str, names: dict[str, str]) -> str:
    """Wie die Quelle für den Empfänger erscheint: je Modus natürlich, als Schöpferinstanz oder als Stimme von außen."""
    if sender in names:
        return f"von {names[sender]}"
    if sender in SENDER_WORDS:
        return SENDER_WORDS[sender]
    if sender:
        return f"von {sender}"
    return {"creator": "von der Schöpferinstanz", "intervention": "als Stimme von außen"}.get(mode, "")


def deliver(ctx, recipients: list[str], kind: str, content: str, *, sender: str = "", truth: str = "true", when: int | None = None, where: str | None = None,
            about: list[str] | None = None, inject_id: str | None = None) -> None:
    for r in recipients:
        ctx.emit("agent.informed", [r], None, {"kind": kind, "content": content, "sender": sender, "truth": truth, "when": when, "where": where,
                                              "about": [a for a in (about or []) if a != r], "inject_id": inject_id})


def informed_text(d: dict[str, Any], location_name: str = "") -> str:
    """Satz für die Beobachtung des Empfängers (Du-Form wie alle Beobachtungen)."""
    kind, content, sender = d["kind"], d["content"].rstrip(" ."), d.get("sender") or ""
    src = f" {sender}" if sender else ""
    if kind == "inform":
        head = "Du hörst ein Gerücht" if d.get("truth") == "rumor" else "Du hörst"
        return f"{head}{src}, dass {content}."
    if kind == "invite":
        when = f" Termin: {clock.fmt(d['when'])}." if d.get("when") is not None else ""
        where = f" Ort: {location_name}." if location_name else ""
        return f"Du bekommst{src} eine Einladung: {content}.{when}{where}"
    if kind == "message":
        return f"Du erhältst{src} eine Nachricht: «{content}»."
    if kind == "suggestion":
        return f"Dir kommt{src} der Gedanke: {content}."
    return f"Du erlebst: {content}."
