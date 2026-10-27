"""Profilmaske eines Bewohners (AP17b): Grenzen, Prüfung mit deutschen Fehlermeldungen, Wortprüfung und Kennungen.

Dieselbe Maske gilt für den Assistenten „Neue Simulation“, den Charaktereditor, Export und Import von Vorlagen und später für Mitspieler-Charaktere
(Frage 11): sie enthält kein Feld für eine Steuerungsart, die Engine kennt keinen Sonderstatus. Die Grenzen halten den festen Teil des Prompts
(`agents/prompts.py`) klein: alle Profiltexte zusammen höchstens `LIM["total"]` Zeichen (etwa 600 Token).
"""

import re
import unicodedata

from .model import PERSONALITY_LABELS, AgentProfile, Personality

MAX_RESIDENTS = 8                       # Frage 32: bis 8 Bewohner (jeder kostet Modellzeit, siehe SECONDS_PER_DECISION)
SECONDS_PER_DECISION = 4.5              # gemessen bei einem Slot: so lange dauert eine Entscheidung
LIM = {"name": 24, "text": 600, "style": 160, "item": 40, "items": 8, "goal": 120, "goals": 3, "story": 300, "total": 2000}
GENDERS = ("männlich", "weiblich", "divers")
TEMPLATE_FORMAT, TEMPLATE_VERSION, TEMPLATE_MAX_BYTES = "on-their-own-vorlage", 1, 20_000
TEMPLATE_FORMATS = (TEMPLATE_FORMAT, "simulacra-vorlage")        # alte Exporte aus der Zeit vor der Umbenennung laden weiter

# Begriffe, die auf eine höhere Instanz hindeuten: für Bewohner gibt es keine Spieler, Leitstelle oder Simulation. Treffer sind Warnungen, keine Sperre
# (eine Figur darf „Programmierer“ sein), der Assistent zeigt sie mit Fundstelle.
META_RE = re.compile(r"(?<![^\W\d_])(spieler\w*|nutzer\w*|benutzer\w*|leitstelle\w*|simulation\w*|editor\w*|schöpfer\w*|ki|sprachmodell\w*|prompt\w*|spielart\w*|play_mode)(?![^\W\d_])", re.I)
TEXT_FIELDS = (("description", "Beschreibung"), ("background", "Hintergrund"), ("communication_style", "Kommunikationsstil"))
LIST_FIELDS = (("interests", "Interessen", LIM["items"], LIM["item"]), ("dislikes", "Abneigungen", LIM["items"], LIM["item"]), ("goals", "Ziele", LIM["goals"], LIM["goal"]))


def meta_hits(text: str) -> list[str]:
    return [m.group(0) for m in META_RE.finditer(text)]


def profile_texts(p: AgentProfile) -> list[tuple[str, str]]:
    """Alle Texte des Profils mit ihrer deutschen Feldbezeichnung (Prompt-relevant)."""
    return [("Beschreibung", p.description), ("Hintergrund", p.background), ("Kommunikationsstil", p.communication_style),
            ("Interessen", ", ".join(p.interests)), ("Abneigungen", ", ".join(p.dislikes)), ("Ziele", ", ".join(p.goals))]


def profile_chars(p: AgentProfile) -> int:
    return sum(len(t) for _, t in profile_texts(p))


def profile_warnings(p: AgentProfile) -> list[str]:
    """Hinweise der Wortprüfung („Spieler“ in Hintergrund …) für ein Profil."""
    return [f"„{w}“ in {field}: Bewohner kennen keine Spieler, Leitstelle oder Simulation." for field, text in profile_texts(p) for w in meta_hits(text)]


def check_profile(profile: AgentProfile, personality: Personality | None = None) -> list[str]:
    """Verstöße gegen die Grenzen als deutsche Meldungen (leer = in Ordnung). Die Typen (Zahlen, Auswahl) prüft schon das Modell."""
    e: list[str] = []
    name = profile.name.strip()
    if not name:
        e.append("Name: fehlt.")
    elif len(name) > LIM["name"]:
        e.append(f"Name: höchstens {LIM['name']} Zeichen (hat {len(name)}).")
    elif not re.fullmatch(r"[^\W_](?:[^\W_]|[ .'’()-])*", name):
        e.append("Name: nur Buchstaben, Ziffern, Leerzeichen und . ' ( ) -")
    for key, label in TEXT_FIELDS:
        v = getattr(profile, key)
        lim = LIM["style"] if key == "communication_style" else LIM["text"]
        if len(v) > lim:
            e.append(f"{label}: höchstens {lim} Zeichen (hat {len(v)}).")
    for key, label, count, each in LIST_FIELDS:
        items = getattr(profile, key)
        if len(items) > count:
            e.append(f"{label}: höchstens {count} Einträge (hat {len(items)}).")
        e += [f"{label}, Eintrag {i}: höchstens {each} Zeichen." for i, x in enumerate(items, 1) if len(x) > each]
    if profile_chars(profile) > LIM["total"]:
        e.append(f"Alle Texte zusammen: höchstens {LIM['total']} Zeichen (haben {profile_chars(profile)}), sonst wird der feste Teil des Prompts zu lang.")
    return e


def check_story(text: str) -> list[str]:
    return [f"Vorgeschichte: höchstens {LIM['story']} Zeichen (hat {len(text)})."] if len(text) > LIM["story"] else []


def story_warnings(text: str) -> list[str]:
    return [f"„{w}“ in der Vorgeschichte: Bewohner kennen keine Spieler, Leitstelle oder Simulation." for w in meta_hits(text)]


def slug(name: str) -> str:
    """Kennung aus einem Namen: klein, ohne Umlaute und Sonderzeichen („Jörg-Peter“ → „joerg_peter“)."""
    t = name.strip().lower().replace("ä", "ae").replace("ö", "oe").replace("ü", "ue").replace("ß", "ss")
    t = unicodedata.normalize("NFKD", t).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "_", t).strip("_") or "figur"


def unique_id(name: str, taken: set[str]) -> str:
    base = slug(name)[:20]
    cand, n = base, 2
    while cand in taken:
        cand, n = f"{base}{n}", n + 1
    return cand


# --- Vorlagen als Datei ---------------------------------------------------------------------------------------------------------------

def template_errors(d: object) -> list[str]:
    """Prüft den Inhalt einer Vorlagendatei (Export/Import) und nennt **jeden** Fehler mit Feldnamen. Leer = gültig."""
    if not isinstance(d, dict):
        return ["Die Datei enthält kein JSON-Objekt."]
    e: list[str] = []
    if d.get("format") not in TEMPLATE_FORMATS:
        e.append(f"„format“ muss „{TEMPLATE_FORMAT}“ sein (gefunden: {d.get('format')!r}).")
    v = d.get("version")
    if not _is_int(v):
        e.append("„version“ fehlt.")
    elif v > TEMPLATE_VERSION:
        e.append(f"Die Datei hat Version {v}; diese Fassung versteht höchstens Version {TEMPLATE_VERSION}.")
    p, q = d.get("profile"), d.get("personality")
    if not isinstance(p, dict):
        return e + ["„profile“ fehlt."]
    e += _profile_dict_errors(p)
    if not isinstance(q, dict):
        e.append("„personality“ fehlt.")
    else:
        e += [f"{label}: eine ganze Zahl von 0 bis 100{' (fehlt)' if k not in q else ''}." for k, label in PERSONALITY_LABELS.items() if not (_is_int(q.get(k)) and 0 <= q[k] <= 100)]
    return e


def _is_int(x: object) -> bool:
    return isinstance(x, int) and not isinstance(x, bool)


def _profile_dict_errors(p: dict) -> list[str]:
    e: list[str] = []
    if not isinstance(p.get("name"), str) or not p["name"].strip():
        e.append("Name: fehlt.")
    elif len(p["name"]) > LIM["name"]:
        e.append(f"Name: höchstens {LIM['name']} Zeichen (hat {len(p['name'])}).")
    if p.get("gender") not in GENDERS:
        e.append("Geschlecht: männlich, weiblich oder divers.")
    if not _is_int(p.get("age")) or not 0 <= p["age"] <= 120:
        e.append("Alter: eine ganze Zahl von 0 bis 120.")
    for key, label in TEXT_FIELDS:
        lim = LIM["style"] if key == "communication_style" else LIM["text"]
        v = p.get(key, "")
        if not isinstance(v, str):
            e.append(f"{label}: muss Text sein.")
        elif len(v) > lim:
            e.append(f"{label}: höchstens {lim} Zeichen (hat {len(v)}).")
    for key, label, count, each in LIST_FIELDS:
        items = p.get(key, [])
        if not isinstance(items, list):
            e.append(f"{label}: muss eine Liste sein.")
            continue
        if len(items) > count:
            e.append(f"{label}: höchstens {count} Einträge (hat {len(items)}).")
        e += [f"{label}, Eintrag {i}: höchstens {each} Zeichen." for i, x in enumerate(items, 1) if not isinstance(x, str) or len(x) > each]
    kp = p.get("known_places", [])
    if not isinstance(kp, list) or not all(isinstance(x, str) for x in kp):
        e.append("Bekannte Orte: muss eine Liste von Kennungen sein.")
    return e


def template_data(profile: AgentProfile, personality: Personality) -> dict:
    """Die Datei einer Vorlage (Export). Die Stimme gehört nicht dazu: sie gehört zur Figur in der Welt (AP17d)."""
    return {"format": TEMPLATE_FORMAT, "version": TEMPLATE_VERSION, "profile": profile.model_dump(), "personality": personality.model_dump()}


def parse_template(d: object) -> tuple[AgentProfile, Personality, list[str]]:
    """Aus einer Vorlagendatei Profil und Persönlichkeit; `TemplateInvalid` mit allen Fehlern, wenn sie nicht gültig ist. Dritter Wert: Warnungen der Wortprüfung."""
    errs = template_errors(d)
    if not errs:
        assert isinstance(d, dict)
        profile, personality = AgentProfile(**d["profile"]), Personality(**d["personality"])
        errs = check_profile(profile, personality)
        if not errs:
            return profile, personality, profile_warnings(profile)
    raise TemplateInvalid(errs)


class TemplateInvalid(ValueError):
    def __init__(self, errors: list[str]):
        super().__init__("; ".join(errors))
        self.errors = errors
