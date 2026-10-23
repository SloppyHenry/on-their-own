"""Was sich setzen lässt (AP16a): die vorhandenen Bausteine als Datenliste, damit spätere Pakete (AP21, AP23) sie ersetzen oder ergänzen können."""

DEKO = [
    {"sorte": "baum", "name": "Laubbaum", "decor": ["tree"], "blockiert": True},
    {"sorte": "kiefer", "name": "Kiefer", "decor": ["pine"], "blockiert": True},
    {"sorte": "busch", "name": "Busch", "decor": ["bushP", "bushY", "bushW", "bush"], "blockiert": False},
    {"sorte": "stein", "name": "Stein", "decor": ["rock"], "blockiert": False},
    {"sorte": "bank", "name": "Bank", "ding": "bench", "sprite": "bench", "blockiert": False},
    {"sorte": "laterne", "name": "Laterne", "ding": "lantern", "sprite": "lamp", "blockiert": False},
    {"sorte": "brunnen", "name": "Brunnen", "ding": "well", "sprite": "well", "blockiert": True},
    {"sorte": "briefkasten", "name": "Briefkasten", "ding": "mailbox", "sprite": "mailbox", "blockiert": False},
    {"sorte": "wegweiser", "name": "Wegweiser", "ding": "signpost", "sprite": "sign", "blockiert": False},
]
DEKO_NACH_SORTE = {d["sorte"]: d for d in DEKO}

# Gebäudearten: Rolle, Bauplan-Abstufung und Sprite; „haus“ gibt es in drei Breiten
HAEUSER = [
    {"gebaeude": "house", "name": "Wohnhaus", "breiten": [58, 66, 90]},
    {"gebaeude": "shop", "name": "Laden", "sprite": "bs"},
    {"gebaeude": "workshop", "name": "Werkstatt", "sprite": "bw"},
    {"gebaeude": "barn", "name": "Scheune", "sprite": "bb"},
    {"gebaeude": "stable", "name": "Stall", "sprite": "bt"},
]
DAECHER = ["rot", "blau", "stroh", "moos", "schiefer", "holz"]
WAENDE = ["creme", "rosa", "gelb", "blau", "holz"]


def katalog() -> dict:
    from . import innen
    return {"deko": DEKO, "haeuser": HAEUSER, "daecher": DAECHER, "waende": WAENDE, "karte": {"richtungen": ["ost", "sued"], "kacheln": [8, 16, 32], "max": 256}, "innen": innen.katalog()}
