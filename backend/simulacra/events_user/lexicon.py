"""Wörterbuch aus dem Weltzustand: Namen von Agenten, Orten und Objektarten sowie Zahl- und Zeitwörter für den Regelparser (Deutsch, mit Beugungsformen)."""

import re
from dataclasses import dataclass, field

from ..world import object_kinds
from ..world.state import WorldState

NUMBERS = {"ein": 1, "eine": 1, "einen": 1, "einer": 1, "zwei": 2, "drei": 3, "vier": 4, "fünf": 5, "sechs": 6, "sieben": 7, "acht": 8, "neun": 9, "zehn": 10, "zwölf": 12}
WEATHER_WORDS = {"rain": ("regen", "regnet", "regnen", "regnerisch"), "storm": ("sturm", "stürmt", "gewitter", "unwetter", "stürmisch"), "fog": ("nebel", "neblig"),
                 "snow": ("schnee", "schneit", "schneien"), "clear": ("sonne", "sonnig", "klar", "wolkenlos", "aufklaren", "aufklart"), "cloudy": ("wolken", "bewölkt", "wolkig")}
RESOURCES = {"wood": ("holz",), "food": ("nahrung", "essen", "lebensmittel", "pilze"), "stone": ("stein", "steine", "felsen"), "seeds": ("samen", "saatgut")}
# Objektarten mit Synonymen (deutsche Wörter); alles andere wird zu „item“
KIND_WORDS = {"map": ("karte", "landkarte"), "note": ("notiz", "zettel", "brief"), "key": ("schlüssel",), "door": ("tür", "pforte"), "axe": ("axt",), "pickaxe": ("spitzhacke",),
              "chest": ("truhe", "kiste"), "bench": ("bank",), "table": ("tisch",), "board": ("tafel", "anschlagtafel")}
ANIMALS = ("tier", "hund", "katze", "fuchs", "vogel", "reh", "hase", "igel", "wolf", "eule", "kaninchen")
PLACE_WORDS = ("höhle", "hütte", "lichtung", "hügel", "bucht", "teich", "bach", "ruine", "turm", "brücke", "insel", "wiese", "strand", "felsen", "quelle", "dorf")
STOP = {"der", "die", "das", "den", "dem", "des", "ein", "eine", "einen", "einem", "einer", "eines"}
ALIASES = {"square": ("zentraler platz", "zentralen platz", "zentralen platzes", "platz", "dorfplatz", "marktplatz"), "forest": ("wald",), "lake": ("see", "ufer"),
           "garden": ("garten",), "house.living": ("wohnzimmer",), "house.kitchen": ("küche",), "house.workshop": ("werkstatt",),
           "house.bedroom_a": ("zimmer von alex", "alex zimmer", "alex' zimmer", "alex zimmer", "zimmer alex"), "house.bedroom_b": ("zimmer von mira", "miras zimmer", "mira zimmer", "zimmer mira")}


def norm(text: str) -> str:
    return re.sub(r"\s+", " ", text.lower().replace("’", "'")).strip()


def pat(word: str) -> re.Pattern[str]:
    return re.compile(rf"(?<![\wäöüß]){re.escape(word)}(?:e|es|en|n|s)?(?![\wäöüß])")


@dataclass
class LocationHit:
    ids: list[str]                    # mehrere Kennungen: mehrdeutig („im Haus“)
    label: str
    start: int = 0
    end: int = 0


@dataclass
class Lexicon:
    agents: dict[str, str] = field(default_factory=dict)             # Name (klein) -> Kennung
    ai: list[str] = field(default_factory=list)
    locations: dict[str, str] = field(default_factory=dict)          # Kennung -> Anzeigename
    aliases: list[tuple[re.Pattern[str], list[str], str]] = field(default_factory=list)

    @classmethod
    def build(cls, st: WorldState, ai_ids: list[str]) -> "Lexicon":
        lex = cls(ai=list(ai_ids))
        for a in st.agents():
            lex.agents[norm(a.name)] = a.id
        locs = {l.id: l.name for l in st.locations.values() if not l.props.get("fallback")}
        lex.locations = locs
        out: list[tuple[str, list[str], str]] = []
        for lid, name in locs.items():
            out.append((norm(name), [lid], name))
            for al in ALIASES.get(lid, ()):
                out.append((al, [lid], name))
        houses = [i for i in locs if i.startswith("house.")]
        if houses:
            out += [("haus", houses, "Haus"), ("wohnhaus", houses, "Haus")]
        out.sort(key=lambda t: -len(t[0]))                                  # längere Namen zuerst („zentraler Platz“ vor „Platz“)
        lex.aliases = [(pat(w), ids, label) for w, ids, label in out]
        return lex

    # --- Suche ---------------------------------------------------------------------------------
    def agent_ids(self, text: str) -> list[str]:
        """Genannte Agenten in der Reihenfolge des Auftretens; „beide“ und „alle“ meinen alle KI-Agenten."""
        t = norm(text)
        hits = [(m.start(), i) for name, i in self.agents.items() if i in self.ai or True for m in [pat(name).search(t)] if m]
        if re.search(r"(?<![\wäöüß])(beide|beiden|alle|alles)(?![\wäöüß])", t) and not hits:
            return list(self.ai)
        out: list[str] = []
        for _, i in sorted(hits):
            if i not in out:
                out.append(i)
        return out

    def location(self, text: str) -> LocationHit | None:
        t = norm(text)
        for rx, ids, label in self.aliases:
            m = rx.search(t)
            if m:
                return LocationHit(ids, label, m.start(), m.end())
        return None

    def name_of(self, agent_id: str) -> str:
        return next((n.title() for n, i in self.agents.items() if i == agent_id), agent_id)


def kind_of(word_phrase: str) -> str:
    t = norm(word_phrase)
    for kind, words in KIND_WORDS.items():
        if any(pat(w).search(t) for w in words):
            return kind
    return "item"


def known_kind(kind: str) -> bool:
    try:
        object_kinds.get(kind)
        return True
    except ValueError:
        return False


def clean_phrase(p: str) -> str:
    """„eine alte Karte“ -> „Alte Karte“: Artikel weg, erster Buchstabe groß."""
    words = [w for w in p.strip(" .,!;").split() if norm(w) not in STOP]
    s = " ".join(words)
    return s[:1].upper() + s[1:] if s else s


def number(word: str) -> int | None:
    w = norm(word)
    return int(w) if w.isdigit() else NUMBERS.get(w)
