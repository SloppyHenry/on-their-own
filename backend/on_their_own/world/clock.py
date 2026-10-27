"""Simulationszeit: 1 Tick = 1 Minute. Zeitpunkte sind ganze Minuten seit Tag 1, 00:00."""

MINUTES_PER_DAY = 1440
WEEKDAYS = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"]
# Dämmerungsfenster in Minuten seit Mitternacht
DAWN = (5 * 60, 7 * 60)
DUSK = (19 * 60, 21 * 60)


def day_of(minute: int) -> int:
    return minute // MINUTES_PER_DAY + 1


def minute_of_day(minute: int) -> int:
    return minute % MINUTES_PER_DAY


def weekday(minute: int) -> str:
    return WEEKDAYS[(day_of(minute) - 1) % 7]


def at(day: int, hour: int, minute: int = 0) -> int:
    return (day - 1) * MINUTES_PER_DAY + hour * 60 + minute


def fmt(minute: int) -> str:
    m = minute_of_day(minute)
    return f"Tag {day_of(minute)}, {m // 60:02d}:{m % 60:02d}"


def _smooth(t: float) -> float:
    t = min(1.0, max(0.0, t))
    return t * t * (3 - 2 * t)


def daylight(minute: int) -> float:
    """Lichtwert 0 (Nacht) bis 1 (Tag) mit weichen Übergängen."""
    m = minute_of_day(minute)
    if m < DAWN[0] or m >= DUSK[1]:
        return 0.0
    if m < DAWN[1]:
        return _smooth((m - DAWN[0]) / (DAWN[1] - DAWN[0]))
    if m < DUSK[0]:
        return 1.0
    return 1.0 - _smooth((m - DUSK[0]) / (DUSK[1] - DUSK[0]))


def phase(minute: int) -> str:
    m = minute_of_day(minute)
    if m < DAWN[0] or m >= DUSK[1]:
        return "night"
    if m < DAWN[1]:
        return "dawn"
    if m < DUSK[0]:
        return "day"
    return "dusk"


def snapshot(minute: int) -> dict:
    return {"minute": minute, "day": day_of(minute), "time": f"{minute_of_day(minute) // 60:02d}:{minute_of_day(minute) % 60:02d}",
            "weekday": weekday(minute), "phase": phase(minute), "daylight": round(daylight(minute), 3)}

