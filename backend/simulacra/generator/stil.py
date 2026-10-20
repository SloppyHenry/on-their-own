"""Stellgrößen des Generators (AP18f): Dorfform, Kartengröße, Seen, Wasserlauf, Wald, Bäume, Gärten, Felder und Wege.

Die Vorgaben (`Stil()`) ergeben genau das Dorf, das der Generator vorher erzeugt hat; nur abweichende Werte ändern etwas. Gleicher Seed und gleiche Stellgrößen ergeben
dasselbe Dorf. Was nicht passt (zu viele Gebäude für die Fläche), lässt der Generator weg und nennt es im Prüfbericht („2 passten nicht“).
"""

from dataclasses import dataclass, fields

FORMEN = ("strasse", "beidseitig", "haufen", "zufall")
GROESSEN = ("klein", "mittel", "gross")
WASSER = ("keiner", "bach", "fluss")
WALD = ("licht", "mittel", "dicht")
WEGE = ("gerade", "geschwungen")
RANGES = {"seen": (0, 4), "baeume": (0, 40), "gaerten": (0, 5), "felder": (0, 4)}
CHOICES = {"form": FORMEN, "groesse": GROESSEN, "wasser": WASSER, "wald": WALD, "wege": WEGE}
LABELS = {"form": "Dorfform", "groesse": "Kartengröße", "seen": "Seen", "wasser": "Wasserlauf", "wald": "Wald", "baeume": "Bäume im Dorf", "gaerten": "Gärten", "felder": "Felder", "wege": "Wege"}


class StilError(ValueError):
    pass


@dataclass(frozen=True)
class Stil:
    form: str = "strasse"            # Straßendorf (Häuser auf einer Seite, wie bisher), beidseitig, Haufendorf oder nach Seed
    groesse: str = "klein"           # Länge der Hauptstraße: klein wie bisher, mittel und groß verlängern sie nach Westen
    seen: int = 1                    # Zahl der Seen (0 bis 4); der erste ist der große See mit Steg und Boot, die weiteren sind Teiche
    wasser: str = "bach"             # keiner, Bach (wie bisher) oder breiter Fluss
    wald: str = "mittel"             # licht, mittel (wie bisher) oder dicht
    baeume: int = 10                 # einzelne Bäume im Dorf (0 bis 40)
    gaerten: int = 1                 # Gärten mit Zaun (0 bis 5); der erste ist der Gemeinschaftsgarten am Weg zum Platz
    felder: int = 0                  # Felder ohne Zaun (0 bis 4)
    wege: str = "geschwungen"        # geschwungen (wie bisher) oder gerade

    @classmethod
    def of(cls, d: dict | None) -> "Stil":
        """Aus einem Wörterbuch (z. B. aus der API); unbekannte Namen und ungültige Werte sind Fehler mit klarem Text."""
        d = dict(d or {})
        names = {f.name for f in fields(cls)}
        for k in d:
            if k not in names:
                raise StilError(f"Unbekannte Stellgröße „{k}“ (erlaubt: {', '.join(sorted(names))}).")
        for k, opts in CHOICES.items():
            if k in d and d[k] not in opts:
                raise StilError(f"{LABELS[k]}: „{d[k]}“ gibt es nicht (erlaubt: {', '.join(opts)}).")
        for k, (lo, hi) in RANGES.items():
            if k in d and (isinstance(d[k], bool) or not isinstance(d[k], int) or not lo <= d[k] <= hi):
                raise StilError(f"{LABELS[k]}: erlaubt sind ganze Zahlen von {lo} bis {hi}.")
        return cls(**d)

    def to_dict(self) -> dict:
        return {f.name: getattr(self, f.name) for f in fields(self)}

    def changed(self) -> dict:
        """Nur die Werte, die von der Vorgabe abweichen."""
        base = Stil()
        return {k: v for k, v in self.to_dict().items() if v != getattr(base, k)}

    def key(self) -> tuple:
        return tuple(sorted(self.changed().items()))
