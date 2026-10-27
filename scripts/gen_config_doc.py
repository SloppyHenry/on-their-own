"""Erzeugt docs/parameter.md aus der Parameter-Registry (eine Quelle für Oberfläche, Validierung und Dokumentation).

    backend/.venv/bin/python scripts/gen_config_doc.py           schreibt die Datei
    backend/.venv/bin/python scripts/gen_config_doc.py --check   Exit 1, wenn sie veraltet ist
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from on_their_own.params.presets import DIR
from on_their_own.params.registry import SPEC_LIST
from on_their_own.params.spec import EFFECTS, GROUPS

OUT = Path(__file__).resolve().parents[1] / "docs" / "parameter.md"


def shown(v):
    return "–" if v in (None, "") else ("an" if v is True else "aus" if v is False else str(v))


def row(s):
    if s.type in ("int", "float"):
        rng = f"{s.min:g} bis {s.max:g}, Schritt {s.step:g}" + (f" {s.unit}" if s.unit else "")
    elif s.type == "enum":
        rng = ", ".join(f"`{o}`" for o, _ in s.options)
    elif s.type == "bool":
        rng = "an / aus"
    else:
        rng = f"Text, höchstens {s.max_len} Zeichen"
    default = "je Agent (Startprofil)" if s.scope == "agent" and s.default_for else shown(s.default)
    if len(default) > 40:
        default = default[:37] + " …"
    help_ = s.help + (f" **Gesperrt:** {s.locked}" if s.locked else "") + (f" *Hinweis: {s.warn}*" if s.warn else "")
    return f"| `{s.key}` | {s.label}{' (je Agent)' if s.scope == 'agent' else ''} | {help_} | {rng} | {default} | {EFFECTS[s.effect]} | `{s.effect_test.split('/')[-1]}` |"


def build() -> str:
    out = ["# Parameter", "",
           "*Erzeugt von `scripts/gen_config_doc.py` aus `backend/on_their_own/params/` – nicht von Hand ändern.*", "",
           "Jeder Parameter steht genau einmal in der Registry. Die Oberfläche (`GET /api/params/schema`), die Prüfung (`PATCH /api/params`) und diese Seite entstehen daraus. "
           "Jeder Parameter nennt den **Wirkungstest**, der nachweist, dass der Wert beim Verbraucher ankommt und das Verhalten ändert. Werte außerhalb des Bereichs werden abgelehnt, nie stillschweigend begrenzt.", "",
           "Wirkung: *sofort* = gilt in der laufenden Welt; *ab der nächsten Entscheidung* = der nächste Prompt oder Abruf nutzt den Wert; *nur mit Neustart des Modells* = nicht im Lauf änderbar.", ""]
    for gid, label in GROUPS.items():
        specs = [s for s in SPEC_LIST if s.group == gid]
        if not specs:
            continue
        out += [f"## {label}", "", "| Schlüssel | Name | Bedeutung | Bereich | Standard | Wirkung | Wirkungstest |", "|---|---|---|---|---|---|---|", *[row(s) for s in specs], ""]
    out += ["## Presets", "", "Sechs mitgelieferte Presets (`backend/on_their_own/params/presets/*.json`, schreibgeschützt). Eigene Presets liegen in SQLite (Tabelle `presets`). "
            "Beim Laden zeigt die Vorschau jede Änderung mit altem und neuem Wert; Adresse und Modell sind nie Teil eines Presets.", ""]
    for f in sorted(DIR.glob("*.json")):
        d = json.loads(f.read_text())
        out.append(f"- **{d['name']}** (`{d['id']}`, {len(d['values'])} Werte): {d['description']}")
    return "\n".join(out) + "\n"


if __name__ == "__main__":
    text = build()
    if "--check" in sys.argv:
        if not OUT.exists():                                   # docs/ gehört nicht ins Repository: ohne die Datei gibt es nichts zu prüfen
            print("docs/parameter.md fehlt, nichts zu prüfen.")
            sys.exit(0)
        if OUT.read_text() != text:
            print("docs/parameter.md ist veraltet: scripts/gen_config_doc.py ausführen.", file=sys.stderr)
            sys.exit(1)
        print("docs/parameter.md aktuell.")
    else:
        OUT.parent.mkdir(parents=True, exist_ok=True)
        OUT.write_text(text)
        print(f"Geschrieben: {OUT} ({len(text.splitlines())} Zeilen)")
