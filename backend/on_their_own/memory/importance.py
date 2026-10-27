"""Wichtigkeit und Form von Erinnerungen: Regeln statt Modellaufruf. Der Regelwert steckt schon in der Beobachtung; hier wird er mit der Einschätzung
des Agenten verbunden und der Text in die Ich-Form gebracht."""

import re

from .models import Observed

OWN_KINDS = {"result", "failure", "discovery", "inspect", "read", "arrived", "gift"}     # Beobachtungen eigener Handlungen
KIND_OF = {"discovery": "fact", "read": "fact", "inspect": "fact", "gift": "relation", "talk": "relation", "result": "episode", "failure": "episode",
           "arrived": "episode", "seen": "episode", "world": "episode", "told": "fact"}
SKIP_KINDS = {"said", "heard", "overheard", "body", "inventory"}       # Gespräche werden je Gespräch zusammengefasst, Körper und Vorrat sind Routine
SHARED_KINDS = {"gift", "talk", "seen"}

_FIRST = [(r"\bDu\b", "Ich"), (r"\bdu\b", "ich"), (r"\bdir\b", "mir"), (r"\bDir\b", "Mir"), (r"\bdich\b", "mich"), (r"\bDich\b", "Mich"),
          (r"\bdein(e[mnrs]?)?\b", lambda m: "mein" + (m.group(1) or "")), (r"\bDein(e[mnrs]?)?\b", lambda m: "Mein" + (m.group(1) or ""))]


def first_person(text: str) -> str:
    """„Du bist angekommen“ -> „Ich bin angekommen“ (die Beobachtungen sind in der Du-Form geschrieben)."""
    text = re.sub(r"\bDu (bist|hast|wurdest|lernst|siehst|prüfst|liest|nimmst|legst|gibst|sagst|entdeckst|fühlst|hörst|erhältst|bekommst|erlebst)\b",
                  lambda m: {"bist": "Ich bin", "hast": "Ich habe", "wurdest": "Ich wurde", "lernst": "Ich lerne", "siehst": "Ich sehe", "prüfst": "Ich prüfe",
                             "liest": "Ich lese", "nimmst": "Ich nehme", "legst": "Ich lege", "gibst": "Ich gebe", "sagst": "Ich sage",
                             "entdeckst": "Ich entdecke", "fühlst": "Ich fühle", "hörst": "Ich höre", "erhältst": "Ich erhalte",
                             "bekommst": "Ich bekomme", "erlebst": "Ich erlebe"}[m.group(1)], text)
    for pat, rep in _FIRST:
        text = re.sub(pat, rep, text)
    return text


def blend(obs: Observed, decision_importance: int | None) -> int:
    """Regelwert, bei eigenen Handlungen gemittelt mit der Einschätzung des Agenten aus seiner Entscheidung."""
    if decision_importance is None or obs.kind not in OWN_KINDS:
        return obs.importance
    return max(1, min(10, round((obs.importance + decision_importance) / 2)))


def memory_kind(obs_kind: str) -> str:
    return KIND_OF.get(obs_kind, "episode")
