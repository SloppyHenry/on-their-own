"""Messprompt für den Probelauf (AP17c-3): die fünf Szenen und zwei Personen aus der Sondierung von AP00 (`scripts/probe_llm.py`), unverändert.
Beide Programme lesen sie von hier, damit eine Messung im Tool mit den Messungen von AP00 vergleichbar bleibt."""

RULES = """Du bist eine Figur in einer kleinen, ruhigen Dorfwelt und entscheidest selbst, was du als Nächstes tust.
Regeln: Wähle genau eine der angebotenen Optionen. Erfinde keine Optionen. Du sprichst Deutsch.
Antworte ausschließlich mit einem JSON-Objekt der Form:
{"option_id": "<id aus der Liste>", "reason": "<ein Satz, warum>", "utterance": "<was du laut sagst, oder leer>", "importance": <ganze Zahl 1-10, wie erinnerungswürdig>}"""

PERSONAS = {
    "Alex": """Du bist Alex, 34, ehemaliger Tischler, ruhig und bedacht. Du erkundest gern und bastelst an Dingen.
Persönlichkeit (0-100): Geselligkeit 40, Neugier 75, Hilfsbereitschaft 60, Risikobereitschaft 35, Konfliktbereitschaft 25, Bedürfnis nach Ruhe 65.
Kommunikationsstil: knapp, trocken, gelegentlich ein leiser Scherz.""",
    "Mira": """Du bist Mira, 31, Gärtnerin und Geschichtenerzählerin, warmherzig und lebhaft. Du suchst Gespräche und Gemeinschaft.
Persönlichkeit (0-100): Geselligkeit 80, Neugier 60, Hilfsbereitschaft 75, Risikobereitschaft 50, Konfliktbereitschaft 30, Bedürfnis nach Ruhe 35.
Kommunikationsstil: erzählend, herzlich, stellt Fragen.""",
}

SCENARIOS = [
    {"zeit": "Tag 2, 07:40 (Morgen)", "ort": "Küche im Wohnhaus", "naehe": "{other} (steht am Herd)",
     "bed": "Energie 72, Hunger 61, Geselligkeit 40", "ziel": "Den Garten für den Winter vorbereiten",
     "mem": ["Gestern am See: seltsame Spuren im Schlamm gesehen.", "{other} hat gestern Brot gebacken und es geteilt.",
             "Im Schuppen liegt noch Werkzeug unsortiert.", "Die Tür zum Keller klemmt.", "Vor drei Tagen: Streit um die Küchenordnung, ruhig beigelegt."],
     "opt": [("essen", "Am Tisch frühstücken (Vorrat: 4 Brote)"), ("sprechen", "Mit {other} ein Gespräch beginnen"),
             ("garten", "In den Garten gehen und arbeiten"), ("see", "Zum See wandern (unbekannte Spuren prüfen)"),
             ("schuppen", "Im Schuppen Werkzeug sortieren"), ("ruhen", "Sich im Wohnzimmer ausruhen")]},
    {"zeit": "Tag 2, 13:15 (Mittag)", "ort": "Zentraler Platz", "naehe": "niemand",
     "bed": "Energie 55, Hunger 30, Geselligkeit 70", "ziel": "Neue Orte im Wald entdecken",
     "mem": ["Heute früh mit {other} gefrühstückt, gutes Gespräch.", "Am Waldrand steht ein umgestürzter Baum, dahinter ein Pfad.",
             "Der Brunnen auf dem Platz gibt klares Wasser.", "{other} wollte nachmittags Pilze suchen."],
     "opt": [("wald_pfad", "Dem Pfad hinter dem umgestürzten Baum folgen"), ("brunnen", "Wasser am Brunnen holen"),
             ("haus", "Zurück zum Wohnhaus gehen"), ("bank", "Auf der Bank sitzen und beobachten"),
             ("see", "Zum See gehen"), ("rufen", "Nach {other} rufen und fragen, wo sie/er ist")]},
    {"zeit": "Tag 3, 19:50 (Abend)", "ort": "Wohnzimmer", "naehe": "{other} (liest)",
     "bed": "Energie 28, Hunger 55, Geselligkeit 50", "ziel": "Eine kleine Bank für den Garten bauen",
     "mem": ["{other} wirkte beim Abendessen bedrückt und sagte wenig.", "Holzvorrat im Schuppen: 6 Bretter, genügt für die Bank.",
             "Am Nachmittag ist beim Holzsägen ein Brett gesplittert.", "Draußen zieht Regen auf."],
     "opt": [("fragen", "{other} fragen, was los ist"), ("schlafen", "Ins Bett gehen"), ("lesen", "Selbst ein Buch nehmen und lesen"),
             ("kochen", "Eine Suppe kochen (Vorrat: 2 Rüben, 1 Brot)"), ("bauen", "Im Schuppen mit der Bank beginnen"),
             ("feuer", "Den Kamin anzünden")]},
    {"zeit": "Tag 4, 10:05 (Vormittag)", "ort": "See", "naehe": "niemand",
     "bed": "Energie 80, Hunger 20, Geselligkeit 25", "ziel": "Herausfinden, wer die Spuren am See hinterlässt",
     "mem": ["Die Spuren führen vom Ufer zum Wald.", "{other} hat gestern gefragt, ob wir zusammen angeln gehen.", "Am Steg liegt ein altes Seil.",
             "Der See ist ruhig, Nebel steigt auf."],
     "opt": [("spuren", "Den Spuren in den Wald folgen"), ("angeln", "Mit der Angel am Steg fischen"), ("seil", "Das alte Seil untersuchen"),
             ("heim", "Zum Haus zurückkehren und {other} abholen"), ("baden", "Im See schwimmen"), ("warten", "Am Ufer warten und beobachten")]},
    {"zeit": "Tag 5, 16:30 (Nachmittag)", "ort": "Garten", "naehe": "{other} (gräbt Beet um)",
     "bed": "Energie 45, Hunger 48, Geselligkeit 62", "ziel": "Eine gemeinsame Ernte für das Fest planen",
     "mem": ["{other} hat vorgeschlagen, am Samstag ein kleines Fest zu feiern.", "Die Kürbisse sind fast reif.",
             "Gestern Missverständnis: {other} dachte, ich wolle das Beet nicht teilen.", "Die Hecke am Nordrand ist ungeschnitten."],
     "opt": [("helfen", "{other} beim Umgraben helfen"), ("ernten", "Kürbisse ernten"), ("klaeren", "Das gestrige Missverständnis ansprechen"),
             ("hecke", "Die Hecke schneiden"), ("pause", "Kurz Pause machen und Wasser trinken"), ("planen", "Mit {other} das Fest planen")]},
]


def build_messages(persona: str, scenario: dict, persona_first: bool = False) -> list[dict]:
    other = "Mira" if persona == "Alex" else "Alex"
    sys_prompt = f"{PERSONAS[persona]}\n\n{RULES}" if persona_first else f"{RULES}\n\n{PERSONAS[persona]}"
    sub = lambda s: s.format(other=other)  # noqa: E731
    opts = "\n".join(f"- {oid}: {sub(text)}" for oid, text in scenario["opt"])
    mems = "\n".join(f"- {sub(m)}" for m in scenario["mem"])
    user = (f"Zeit: {scenario['zeit']}\nOrt: {scenario['ort']}\nIn der Nähe: {sub(scenario['naehe'])}\n"
            f"Bedürfnisse: {scenario['bed']}\nAktuelles Ziel: {scenario['ziel']}\n\nRelevante Erinnerungen:\n{mems}\n\n"
            f"Mögliche Optionen:\n{opts}\n\nWas tust du jetzt? Antworte nur mit dem JSON-Objekt.")
    return [{"role": "system", "content": sys_prompt}, {"role": "user", "content": user}]
