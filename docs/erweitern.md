# Erweitern

Jeder Erweiterungspunkt hat **eine** Registry. Was dort steht, kennen Prüfung, Oberfläche, TypeScript-Typen und Dokumentation automatisch; Tests schlagen fehl, wenn etwas unvollständig ist. Welt-Daten (Kacheln, Orte, Objekte, Quellen, Karte) ändern sich ohne Code: [welt-erweitern.md](welt-erweitern.md).

Nach jeder Änderung: `cd backend && .venv/bin/python -m pytest -q`, bei Modell- oder Typänderungen zusätzlich `scripts/gen_types.sh` und `cd frontend && npm run typecheck && npm test`.

## Neue Aktion

1. **Klasse** in `backend/simulacra/world/actions/` (passende Datei oder neue), abgeleitet von `Action` (`base.py`):
   - `name`: Kennung, wie sie das Modell schreibt (`"fish"`).
   - `validate(ctx, actor, params)`: prüft gegen den Weltzustand und liefert `Accepted(duration=…, data=…)` oder `rej(RejectCode.…, "Grund auf Deutsch")`. Nie etwas verändern, nur prüfen.
   - `start` / `step` / `finish` (nach Bedarf, siehe `building.py`, `resources.py`): verändern den Zustand über `ctx.state` und melden jede Änderung mit `ctx.emit(typ, agenten, ort, daten)`.
2. **Registrieren** in `world/actions/__init__.py` (`REGISTRY`).
3. **Als Option anbieten** in `agents/options.py` (`generate`: `add(kind, label, action, params)`), Formulierung in `agents/phrases.py`, Bewertung über die Faktoren (`agents/factors/`, z. B. welches Bedürfnis die Aktion stillt).
4. **Ereignistyp**, falls die Aktion ein neues Ergebnis meldet (siehe unten).
5. **Tests:** Zustand vorher/nachher und jede Ablehnung (Vorbild: `tests/world/test_items.py`, `test_resources.py`, `test_building.py`; Abnahme K4: `tests/acceptance/test_k04_aktionen.py`).

Das Modell kann jede registrierte Aktion auch frei wählen (`option_id: "other"`); die Engine prüft sie genauso.

## Neue Objektart

1. **Eintrag** in `world/object_kinds.py`: Eigenschaften (tragbar, blockiert, Gewicht …) und Zustandsschema (Pydantic). Die Engine lehnt Objekte mit unbekannter Art oder ungültigem Zustand ab.
2. **Verhalten** beim Benutzen in `world/actions/use_modes.py`: je (Objektart, Modus) Prüfung, Wirkung, Dauer.
3. **Zeichnung** im Frontend in `frontend/src/world/draw/` (`objects.ts`, `furniture.ts`; Pixelgrafik aus Code, siehe [assets.md](assets.md)). Ohne eigene Zeichnung erscheint ein neutrales Symbol.
4. **Platzieren** über die Weltdatei, einen Patch oder `engine.edit.spawn_object` ([welt-erweitern.md](welt-erweitern.md)); für Bauvorlagen `backend/simulacra/data/blueprints.json`.
5. Objektarten nur hinzufügen, nicht entfernen: alte Spielstände laden unbekannte Arten als passive Objekte.

## Neuer Parameter

1. **`ParamSpec`** in der passenden Datei `params/specs_*.py` (Agenten, LLM, Gedächtnis, Simulation, Welt): Schlüssel, Gruppe, Typ, Bereich, Schrittweite, Standard, Wirkungsklasse (`immediate`, `next_decision`, `restart_model`), Hilfetext, `apply` (setzt den Wert im laufenden System), `read`, `consumers` (wer ihn liest) und `effect_test` (Name eines Tests, der die **Wirkung** nachweist, nicht nur die Speicherung).
2. **Wirkungstest** schreiben (Vorbild: `tests/params/test_effects_*.py`). `tests/params/test_registry.py` prüft, dass jeder Parameter einen Abnehmer und einen existierenden Wirkungstest hat.
3. **Dokumentation erzeugen:** `backend/.venv/bin/python scripts/gen_config_doc.py` (schreibt `docs/parameter.md`; `--check` meldet, wenn sie veraltet ist).
4. Die Oberfläche zeigt den Parameter automatisch in seiner Gruppe; Presets können ihn setzen (`params/presets/*.json`).

Werte außerhalb des Bereichs werden abgelehnt, nie stillschweigend gekürzt. Startwerte für den Betrieb (Umgebungsvariablen `SIM_*`) stehen in `config.py` und [konfiguration.md](konfiguration.md).

## Neuer Ereignistyp

1. **Datenmodell** (Pydantic) in `events/models.py` (bzw. `models_move.py`, `models_user.py`).
2. **Registrieren** in `events/types.py`: `_t("typ.name", "kategorie", Modell, "Beschreibung")`. Kategorien: `world`, `dialogue`, `planning`, `memory`, `system`.
3. **Melden** über `ctx.emit` (in Aktionen) bzw. `engine.emit_event` (sonst), mit passender Sichtbarkeit (wer es in der Simulation wahrnimmt).
4. **Typen erzeugen:** `scripts/gen_types.sh`.
5. **Satz im Protokoll** in `frontend/src/timeline/describeEvent.ts` (der Compiler verlangt einen Eintrag je Typ); falls der Zustand im Browser sich ändern soll, ein Fall in `frontend/src/store/reducers/`.
6. Wenn Agenten davon erfahren sollen: Beobachtung in `agents/observations.py`.

`tests/events/test_bus_store.py` und `tests/api/test_types.py` prüfen, dass jeder Typ Modell, Kategorie, Beschreibung und einen TypeScript-Typ hat.

## Dritter Agent (oder weitere)

Ein KI-Agent besteht aus einem **Körper** in der Welt und einem **Profil**:

1. **Profil** als `backend/simulacra/agents/defaults/<id>.json` anlegen (Vorlage `mira.json`): Name, Alter, Beschreibung, Hintergrund, Interessen, Abneigungen, Ziele, Gesprächsstil, bekannte Orte und die zwölf Persönlichkeitswerte (0–100).
2. **Körper** hinzufügen: für neue Simulationen im Abschnitt `agents` der Weltdatei; in einer laufenden Simulation per Patch (`"agents": [{"id": "jonas", "name": "Jonas", "tile": [43, 23]}]`, siehe [welt-erweitern.md](welt-erweitern.md)).
3. Beim nächsten Start (oder Laden) legt `store.ensure_all()` das Profil an; ab dann entscheidet der Agent im Zyklus mit, hat ein eigenes Gedächtnis und sieht die anderen als gleichwertige Bewohner. Ohne Profildatei bleibt der Körper eine Figur ohne eigenes Denken.
4. Die Oberfläche zeigt weitere Agenten automatisch (Karte, Liste, Inspektor) mit einer aus der Kennung abgeleiteten Figur und Farbe.

Zu beachten: Mit einem Modell-Slot entscheiden Agenten nacheinander; jeder weitere Agent verlangsamt den Takt etwa anteilig (Messwerte: [status/langlauf.md](status/langlauf.md)). Getestet ist ein dritter Agent im Zyklus (Mithören nur in Reichweite, getrennte Erinnerungen); ein Langlauf mit drei Agenten steht aus ([grenzen.md](grenzen.md)).

## Anderes Modell oder anderer Rechner

Siehe [llm-anbindung.md](llm-anbindung.md#anderes-modell-oder-andere-maschine) und [betrieb.md](betrieb.md#anderer-rechner-z-b-secondtux).
