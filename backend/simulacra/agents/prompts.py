"""Prompt-Aufbau. Der stabile Teil (Rolle, Profil, Regeln) steht vorn und ist je Agent immer gleich (Prompt-Cache);
Veränderliches (Zeit, Wahrnehmung, Erinnerungen, Optionen) folgt in der Benutzernachricht."""

from typing import Any

from .model import PERSONALITY_LABELS, AgentModel
from .perception import Perception
from .scoring import Option

OTHER_ACTIONS = ("move_to(target|tile) · wait(minutes) · inspect(object_id) · take(object_id) · drop(object_id) · give(to, object_id | resource+amount) · "
                 "use(object_id, mode) · gather(resource, amount) · plant(seedbed_id) · water(object_id) · build(blueprint | site_id) · eat · drink · "
                 "rest(minutes) · sleep · speak(to, text)")
ALLOWED_OTHER = ["move_to", "wait", "inspect", "take", "drop", "give", "use", "gather", "plant", "water", "build", "eat", "drink", "rest", "sleep", "speak"]


def system_prompt(a: AgentModel) -> str:
    pr, pe = a.profile, a.personality
    traits = ", ".join(f"{label} {getattr(pe, key)}" for key, label in PERSONALITY_LABELS.items())
    lines = [
        f"Du bist {pr.name}, {pr.age} Jahre alt ({pr.gender}). Du lebst mit anderen in einem kleinen Dorf am See, mit Wohnhaus, Garten, Wald und einem zentralen Platz, "
        "und entscheidest selbst, was du als Nächstes tust.",
        f"So bist du: {pr.description}", f"Dein Hintergrund: {pr.background}",
        f"Deine Interessen: {', '.join(pr.interests) or '–'}. Das magst du nicht: {', '.join(pr.dislikes) or '–'}. Deine Ziele: {', '.join(pr.goals) or '–'}.",
        f"So sprichst du: {pr.communication_style or 'natürlich'}.",
        f"Deine Eigenart (0 = gar nicht, 100 = sehr): {traits}.",
        "",
        "Regeln:",
        "- Wähle genau eine der angebotenen Optionen (o1, o2, …). Nur wenn keine passt, wähle \"other\" und gib eigene Handlung und Parameter an.",
        "- Ob etwas gelingt, entscheidet die Welt, nicht du. Behaupte nie, dass etwas gelungen ist.",
        "- Bei Optionen mit Sprechen oder Schreiben steht in \"utterance\" wörtlich, was du sagst oder schreibst: ein bis zwei kurze Sätze in deiner Sprechweise, "
        "auf Deutsch, ohne Anführungszeichen. Bei allen anderen Optionen bleibt \"utterance\" leer.",
        "- \"intent\": warum du das tust, höchstens zwölf Wörter. \"importance\": 1 bis 10, wie bedeutsam das Erlebnis für dich ist.",
        "- Optional \"plan_next\": was du danach vorhast. Optional \"proposal\": ein Vorschlag an dein Gegenüber im Gespräch (etwas gemeinsam tun).",
        "- Antworte ausschließlich mit dem JSON-Objekt.",
    ]
    return "\n".join(lines)


def _objects_line(p: Perception) -> str:
    if not p.objects:
        return "–"
    return "; ".join(f"{o['name']} [{o['id']}]" + (f" ({o['note']})" if o["note"] else "") for o in p.objects)


def user_prompt(p: Perception, options: list[Option]) -> str:
    w = p.words
    out = [f"Jetzt: {p.time_text}. Wetter: {p.weather}.",
           f"Ort: {p.location_name}. Du fühlst dich {w['energy']}, {w['hunger']}, {w['thirst']}, {w['mood']}.",
           "Du trägst: " + (", ".join(p.inventory) if p.inventory else "nichts") + ".",
           "Hier siehst du: " + _objects_line(p) + ".",
           "Quellen hier: " + ("; ".join(f"{s['resource']} [{s['id']}] ({'vorhanden' if s['available'] else 'erschöpft'}"
                                          + (f", braucht {s['tool']}" if s['tool'] else "") + ")" for s in p.sources) or "–") + ".",
           "In deiner Nähe: " + ("; ".join(f"{x.name} ({x.where}, {x.activity})" for x in p.people) or "niemand") + "."]
    if p.plan_next:
        out.append(f"Dein Vorhaben: {p.plan_next}")
    c = p.conversation
    if c:
        out.append(f"Gespräch mit {c['partner_name']}:" + ("" if c["lines"] else " (noch nichts gesagt)"))
        out += [f"  {l}" for l in c["lines"]]
        if c["awaiting_reply"]:
            out.append(f"  ({c['partner_name']} wartet auf deine Antwort.)")
        if c["open_proposal"]:
            out.append(f"  Vorschlag von {c['open_proposal']['by_name']}: «{c['open_proposal']['text']}»")
    out.append("Zuletzt erlebt:" + ("" if p.memory else " –"))
    out += [f"- {m}" for m in p.memory]
    out.append("")
    out.append("Optionen:")
    out += [f"{o.id}: {o.label}" + (" [du sagst/schreibst etwas]" if o.utterance_key else "") for o in options]
    out.append(f"other: Etwas anderes tun (nur wenn keine Option passt). Dann other_action und other_params angeben. Möglich: {OTHER_ACTIONS}")
    out.append("")
    out.append("Was tust du jetzt?")
    return "\n".join(out)


def decision_schema(option_ids: list[str]) -> dict[str, Any]:
    return {"type": "object", "additionalProperties": False, "required": ["option_id", "intent", "utterance", "importance"],
            "properties": {"option_id": {"type": "string", "enum": [*option_ids, "other"]},
                           "intent": {"type": "string"}, "utterance": {"type": "string"},
                           "importance": {"type": "integer", "minimum": 1, "maximum": 10},
                           "plan_next": {"type": "string"}, "proposal": {"type": "string"},
                           "other_action": {"type": "string", "enum": ALLOWED_OTHER}, "other_params": {"type": "object"}}}


def correction_message(error: str) -> str:
    return f"Deine Antwort war nicht verwendbar: {error} Antworte noch einmal, nur mit dem JSON-Objekt."
