"""Zeit- und Dauerangaben aus deutschem Text: „morgen“, „um 18 Uhr“, „heute Abend“, „für drei Tage“."""

import re

from ..world import clock
from .lexicon import NUMBERS, norm

TOD = {"abend": (18, 0), "abends": (18, 0), "mittag": (12, 0), "mittags": (12, 0), "morgen früh": (8, 0), "morgens": (8, 0), "früh": (8, 0), "vormittag": (10, 0),
       "nachmittag": (15, 0), "nacht": (22, 0), "nachts": (22, 0)}
UNITS = {"minute": 1, "minuten": 1, "stunde": 60, "stunden": 60, "tag": 1440, "tage": 1440, "tagen": 1440, "woche": 7 * 1440, "wochen": 7 * 1440}


def duration(text: str) -> int | None:
    """Dauer in Minuten: „für die nächsten drei Tage“, „zwei Stunden lang“, „30 Minuten“."""
    t = norm(text)
    m = re.search(r"(?:für|über|während|innerhalb)?\s*(?:die\s+)?(?:nächsten?\s+)?(\d+|ein|eine|einen|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn|zwölf)\s+"
                  r"(minuten?|stunden?|tage[n]?|wochen?)\b", t)
    if not m:
        return None
    n = int(m.group(1)) if m.group(1).isdigit() else NUMBERS[m.group(1)]
    return n * UNITS[m.group(2)]


def time_of_day(t: str) -> tuple[int, int] | None:
    m = re.search(r"\bum\s+(\d{1,2})(?:[:.](\d{2}))?\s*(?:uhr)?(?!\s*(?:minuten|stunden|tage))", t)
    if m and int(m.group(1)) < 24:
        return int(m.group(1)), int(m.group(2) or 0)
    for word in ("morgen früh", "vormittag", "nachmittag", "mittags", "mittag", "abends", "abend", "morgens", "früh", "nachts", "nacht"):
        if re.search(rf"\b{word}\b", t):
            return TOD[word]
    return None


def moment(text: str, now: int, default_tod: tuple[int, int] | None = None) -> int | None:
    """Zeitpunkt (Simulationsminute) aus „heute Abend“, „morgen“, „übermorgen um 14 Uhr“; `None`, wenn der Text keinen künftigen Zeitpunkt nennt.
    Ohne Tageszeit gilt `default_tod` (z. B. 10:00 für einen Markt)."""
    t = norm(text)
    day = clock.day_of(now)
    offset = 2 if "übermorgen" in t else 1 if re.search(r"\bmorgen\b(?!\s+früh\b)", t) or "morgen früh" in t else 0 if re.search(r"\bheute\b", t) else None
    tod = time_of_day(re.sub(r"\bmorgen früh\b", "morgen früh", t))
    if offset is None and tod is None:
        return None
    if tod is None:
        if offset == 0:
            return None                                  # „heute“ ohne Uhrzeit heißt: jetzt
        tod = default_tod or (10, 0)
    target = clock.at(day + (offset or 0), *tod)
    if offset is None and target <= now:
        target = clock.at(day + 1, *tod)                  # „um 18 Uhr“ nach 18 Uhr: am nächsten Tag
    return target if target > now else None


def label(minute: int) -> str:
    return clock.fmt(minute).replace("Tag ", "Tag ")
