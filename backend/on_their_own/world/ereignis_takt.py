"""Häufigkeit der Ereignisse von allein (AP18i): bewusst ohne Abhängigkeiten, damit die Parameter-Registry sie lesen kann, ohne die Ereigniseingabe zu laden."""

# Wahrscheinlichkeit je vollem Spielstunden-Takt (nur wenn ein Ereignis passt): selten etwa alle drei Tage, manchmal etwa täglich, oft mehrmals am Tag.
FREQUENCIES = {"aus": 0.0, "selten": 1 / 72, "manchmal": 1 / 24, "oft": 1 / 8}
FREQUENCY_LABELS = (("aus", "aus"), ("selten", "selten"), ("manchmal", "manchmal"), ("oft", "oft"))
