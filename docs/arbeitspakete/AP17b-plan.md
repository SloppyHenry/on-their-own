# AP17b – Simulation selbst definieren (Plan, 19.10.2026)

**Auftrag:** Henry, AP17-Plan (Rückmeldung 8) und Fragen 32, 36. **Status:** Schritt 0 (Plan, Fragen, Mockup). Gebaut wird erst nach deiner Abnahme von [assistent.html](../mockups/assistent.html). Bericht: [AP17b-schritt0.md](../status/AP17b-schritt0.md).

## Entscheidungen (Henry)
| Wann | Entscheidung |
|---|---|
| 17.10. | **Bis 8 Bewohner**, sichtbarer Hinweis auf das Tempo (Frage 32). Weltregeln als Text werden über die Ereigniseingabe zu **Startereignissen**. |
| 17.10. | Neues Dorf ist für die Agenten **„schon immer da“**. Schöpfermodus beim Anlegen wählbar, Standard Beobachter, im Spiel nur im Editor-Modus änderbar (Frage 36). |
| 19.10. | **Höchstens 2 Personen je Haus.** Der Assistent schlägt aufgerundet halb so viele Wohnhäuser vor. **Wer wo wohnt, entscheidet jeder Agent selbst**; der Assistent weist keine Betten zu. |
| 19.10. | Die handgemachte Startwelt bleibt bei Alex und Mira mit festen Zimmern (Goldbild-Tests). Der Generator liefert Dörfer ab 3 Bewohnern. |
| 19.10. | **Größeres Haus mit mehr Zimmern:** eigener Baustein **nach** dem Assistenten, nicht in AP17b. |
| 19.10. | **Karte wächst mit der Bewohnerzahl.** Die Vorschau zeigt je Haus die Zahl der Betten statt Namen. |
| 19.10. | **4 weitere Vorlagen** neben Alex und Mira, sehr verschieden. |
| 19.10. | **Vorgeschichte** = Startwerte der Beziehung **plus** eine gewöhnliche Erinnerung bei beiden (Art Fakt, wie gelebtes Wissen formuliert). |

## Befunde im Code (Ist-Stand)
- **Profile** (`agents/model.py`): `AgentProfile` mit 10 Feldern und `Personality` mit 12 Werten (0–100) sind schon Pydantic-Modelle. Es fehlen Längengrenzen (nur die Parameter in `params/specs_agents.py` haben 600 Zeichen) und eine Schemaversion. `AgentStore.ensure` legt ein Profil nur aus `agents/defaults/<id>.json` an: Bewohner ohne Datei sind „keine KI“. Das muss für beliebige Bewohner gehen.
- **Beziehungen** (`agents/relations.py`): Tabelle `relations` je Richtung, Standard 50/50/10/30. Startwerte lassen sich direkt schreiben; Änderungen im Spiel laufen mit Grund über `relation_log`.
- **Neue Simulation** (`api/routes_world.py`, `generator/service.py`): `Wish` (Art, Seed, Ufer, Mix), Vorschau in einer Wegwerf-Simulation im Speicher, Anwenden über `Simulation.reset(world=…, backup_label="Vor der neuen Simulation")`. `new_world` nimmt die Agenten fest aus `world_default.json` (`alex`, `mira`), das Heimhaus (`heim.json`) hat die festen IDs `house.bedroom_a/b`, und `kits.py` setzt genau zwei Startplätze.
- **Betten:** Jedes Schlafzimmer in `haus`, `haus_klein` und `langhaus` hat **genau ein Bett** (`interiors.py`, Art `bedroom`), ohne Besitzer. „Zwei Betten je Haus“ gibt es also noch nicht. Der Generator muss die Bewohnerzahl als Eingabe bekommen. **Ohne sie bleibt jede Ausgabe Byte für Byte gleich**, damit Seeds und Fixtures nicht kippen.
- **Schlafen** (`world/actions/needs.py`, `agents/options.py`): Betten mit `owner=None` darf jeder benutzen, und `validate_sleep` lehnt fremde Betten ab. Die Option „Zum Schlafen gehen“ kennt aber nur **ein** Bett (`beds[0]`) und setzt nie einen Besitzer. Damit können sich Agenten keine Bleibe aussuchen. Das muss nachgebessert werden (siehe „Wohnen“).
- **Schöpfermodus:** Parameter `mode` (Beobachter, Schöpfer, Eingriff) und `mode.creator_text` existieren (`agents/modes.py`) und sind jederzeit änderbar. Es fehlt: beim Anlegen wählbar, im Spiel nur im Editor-Modus.
- **Alex und Mira im Code:** Stellen, die nur für diese zwei gelten: `generator/generate.py` (Agenten aus der Vorlage), `generator/kits.py` (zwei Startplätze), `generator/interiors.py` (Heimhaus), `events_user/lexicon.py` (Alias „Zimmer von Alex/Mira“), `frontend/src/world/art/things.ts` (Besitzer nur über `["alex","mira"]`), `frontend/src/world/art/people.ts` (`LOOKS` je Kennung; unbekannte Kennungen bekommen schon ein Aussehen aus der Kennung), `StartMenu.tsx` (Texte), Presets (Texte „Beide …“). Der Rest in `grep` sind Beispiele und Tests.
- **Beziehungen im Prompt:** Die Werte wirken über die Bewertung (Faktoren „Beziehung“, „Spannung“, „Vertrauen“). Eine Vorgeschichte als Text kommt nur über das Gedächtnis (`memory/store.py: add`) in den Prompt.

## Aufbau

### Eine Beschreibung, drei Verwendungen
Alles, was der Assistent erfasst, ist ein **Entwurf** (`SimSpec`, JSON mit Schemaversion):
```
SimSpec { version, world{kind: start|generated, seed, lake, mix, residents},
          residents[ResidentSpec], relations[RelationSpec], rules{preset, autonomy, scarcity, texts[]},
          model, observer_mode{mode, creator_text} }
ResidentSpec { id, template?, profile{AgentProfile}, personality{12 Werte}, home?: Haus-Nr., voice?, look?: auto }
RelationSpec { from, to, trust, sympathy, tension, familiarity, backstory? }
```
Dieselbe `ResidentSpec` ist die **Profilmaske**: der Assistent, der Charaktereditor, der Export/Import und später ein Mitspieler-Charakter (Frage 11) nutzen sie unverändert. Sie enthält **kein** Feld, das eine Steuerungsart oder einen Sonderstatus ausdrückt; die Engine kennt keinen.

### Profilschema mit Grenzen (neu, `agents/schema.py`)
`AgentProfile` und `Personality` bleiben, bekommen `Field(max_length=…)` und eine Prüfung mit deutschen Fehlermeldungen. Grenzen (Token-Budget: alle Texte zusammen höchstens etwa 2 000 Zeichen ≈ 600 Token im festen Systemteil, siehe `agents/prompts.py`):

| Feld | Grenze |
|---|---|
| Name | 1–24 Zeichen, Buchstaben, Leerzeichen, Bindestrich |
| Alter | 0–120; Geschlecht: männlich, weiblich, divers |
| Beschreibung, Hintergrund | je höchstens 600 Zeichen (wie die Parameter) |
| Interessen, Abneigungen | je höchstens 8 Einträge zu höchstens 40 Zeichen |
| Ziele | höchstens 3 Einträge zu höchstens 120 Zeichen |
| Kommunikationsstil | höchstens 160 Zeichen |
| Persönlichkeit | 12 Werte, 0–100 |
| Vorgeschichte je Beziehung | höchstens 300 Zeichen |

Die **Kennung** (`id`) entsteht aus dem Namen (klein, ohne Umlaute) und ist in der Welt eindeutig; sie darf mit keiner Orts-, Objekt- oder Quellen-ID kollidieren (Prüfung wie `WorldInfo.ids`).

### Keine höhere Instanz (Prüfung beim Anlegen)
Jeder Text eines Bewohners (Beschreibung, Hintergrund, Ziele, Vorgeschichte, Stil, Weltregeln) läuft durch eine **Wortprüfung** (`agents/schema.py: check_no_meta`): Spieler, Nutzer, Benutzer, Leitstelle, Simulation, Editor, Schöpfer, KI, Sprachmodell, Programm, Prompt. Treffer sind **Warnungen mit Fundstelle**, keine harten Fehler (ein Bewohner darf „Programmierer“ sein); der Assistent zeigt sie an, und der Start ist trotzdem möglich. Ein Test spielt Bewohner mit allen Feldern durch den Assistenten und prüft, dass weder System- noch Benutzer-Prompt, Erinnerungen noch Ereignisse für Agenten einen Hinweis enthalten.

### Wohnen
- **Generator mit Bewohnerzahl:** `new_world(seed, residents=N)` (neu). Ab N ≥ 3: **aufgerundet N/2 Wohnhäuser** (änderbar im Assistenten), jedes Schlafzimmer mit **zwei Betten ohne Besitzer** (bei `langhaus` verteilt auf die zwei Schlafräume), dazu die Gemeinschaftsbauten (Werkstatt, Küche/Laden, Platz, Garten); ab etwa 5 Bewohnern Laden oder Stall. Das Dorf hat kein Heimhaus; Orts-IDs und Namen kommen aus `Naming`. Startplatz aller Bewohner ist der Dorfplatz (versetzt, damit sie nicht aufeinander stehen).
- **Startwelt:** nur mit Alex und Mira (1 oder 2 Bewohner aus diesen Vorlagen). Andere Vorlagen verlangen das erzeugte Dorf; der Assistent sagt das.
- **Optionales Vorwort „wohnt schon in Haus X“:** setzt bei **einem** Bett dieses Hauses `owner` (so, als wäre es schon immer seins) und legt den Start in dieses Haus. Ohne Vorwort bleibt alles offen. Ein Haus fasst höchstens 2 Namen; die Maske sperrt das dritte.
- **Bleibe selbst suchen (zu bauen in 17b-a):**
  1. `options.py`: „Zum Schlafen gehen“ bietet das eigene Bett an, sonst die **nächsten freien Betten mehrerer Häuser** (höchstens drei), nicht nur `beds[0]`.
  2. Schläft ein Agent in einem Bett mit `owner=None`, wird es **sein** Bett: `owner` wird gesetzt und ein gewöhnliches Weltereignis „Bett gehört X“ geschrieben (sichtbar für X und Anwesende, wie jede Handlung im Raum). Danach ist es für andere gesperrt (die Regel `validate_sleep` gibt es schon).
  3. Hat der Agent ein Bett, bietet er keine anderen Betten mehr an. Ein Umzug (Bett freigeben) ist später möglich.
  4. Prüfung mit Fake-Modell: 4 Bewohner, 2 Häuser, über mehrere Nächte schläft niemand in einem fremden Bett, jeder bekommt höchstens eines, und niemand bleibt ohne Bett, solange es freie gibt.
  Es gibt **keinen Hinweis auf eine Zuteilung von außen**: die Agenten erleben nur freie und belegte Betten.
- **Bekannte Orte:** wie in der Startwelt Platz, Garten und die Gemeinschaftsräume (Werkstatt, Küche); See und Wald bleiben zum Erkunden. Ein vorgegebenes Haus kennt der Bewohner auch.

### Beziehungen
- **Startwerte** je Richtung (Vertrauen, Sympathie, Spannung, Vertrautheit, 0–100) werden beim Start in `relations` geschrieben, **ohne** `relation_log`-Eintrag und ohne Ereignis. Standard bleibt 50/50/10/30.
- **Vorgeschichte:** höchstens 300 Zeichen je Paar. Beim Start entsteht bei **beiden** Bewohnern eine Erinnerung der Art Fakt (Wichtigkeit 5, Person verknüpft, Zeit: vor dem Start). Der Assistent schlägt eine Formulierung vor („Wir kennen uns seit …“), schreibt sie aber nie selbst; er warnt bei Wörtern der Wortprüfung.
- **Würfeln:** je Feld ein Knopf (Name aus Liste, Alter, 12 Werte um einen Mittelwert, Beziehung innerhalb von ±20 um den Standard), mit sichtbarem Seed; derselbe Seed ergibt dasselbe.

### Weltregeln als Startereignisse
Ein freies Textfeld „Was in dieser Welt gilt“ geht an die vorhandene **Ereigniseingabe** (`events_user/`, AP08). Der Assistent zeigt wie im Spiel die **Vorschau** und die **Klärfragen**; erst nach Bestätigung werden die Operationen mit dem Start ausgeführt (nach dem Anlegen der Welt, in derselben Transaktion wie die neue Simulation). Sie erscheinen den Agenten als natürliche Vorgänge (Wetter, Knappheit, ein Fremder), nicht als „Regel“.

### Schöpfermodus
Auswahl beim Anlegen (Beobachter, Schöpfer, Eingriff; Standard Beobachter), der Text für den Schöpfermodus ist änderbar. Der Wert wird als `mode` und `mode.creator_text` gesetzt, also über die vorhandenen Parameter. Neu: **Im Spiel ist die Änderung nur im Editor-Modus erlaubt** (die Zeit steht dann still); sie gilt ab der nächsten Entscheidung und hinterlässt keine Spur für Agenten (Test vorhanden: `test_modes_change_the_prompt_but_not_the_memories`).

### Speicher für Vorlagen und Export/Import
- **Ablage:** Dateien in `data/vorlagen/<id>.json` neben `data/saves/` (nicht im Spielstand, damit Vorlagen über Simulationen hinweg bleiben). Mitgeliefert: `backend/simulacra/agents/defaults/*.json` (Alex, Mira und die 4 neuen), schreibgeschützt; eigene Vorlagen daneben.
- **Format:** eine JSON-Datei je Vorlage mit `{"format": "simulacra-vorlage", "version": 1, "profile": …, "personality": …}`. Der Import prüft Format, Version (nur ≤ aktuelle), Größe (≤ 20 KB), Felder und Grenzen und meldet **jeden** Fehler mit Feldnamen auf Deutsch; es wird nie über eine bestehende Vorlage geschrieben (neuer Name mit Nummer). Die Stimme gehört nicht in die Vorlage (sie gehört zur Figur in der Welt, siehe AP17d).
- **API (neu):** `GET /api/templates`, `GET/PUT/DELETE /api/templates/{id}`, `POST /api/templates/import` (Datei), `GET /api/templates/{id}/export`, `POST /api/sim/new` (Entwurf prüfen und anlegen, mit `dry_run`), `POST /api/sim/new/preview` (Prüfung, Warnungen, Dorfvorschau).

### Oberfläche
- **Assistent** im Startmenü → Neue Simulation → „Selbst definieren“ (neue Kachel neben den bisherigen). Fünf Schritte mit Stufenanzeige: **Welt · Bewohner · Regeln · Modell · Start** (der Schöpfermodus steht im Schritt Regeln). Zurück ist immer möglich; der Entwurf bleibt im Browser (`localStorage`, je Gerät), bis die Simulation angelegt oder der Entwurf verworfen wird.
- **Welt:** Startwelt oder erzeugtes Dorf (Seed, Würfeln, Ufer, Gebäudemix wie AP12c, Vorschau unter dem Schleier, Häuser mit Zahl der Betten). „Selbst gestalten“ bleibt „später“ (AP16).
- **Bewohner:** Zahl 1–8 mit Tempohinweis, Karten je Bewohner, Vorlage wählen und anpassen (alle Felder, 12 Regler mit `PERSONALITY_LABELS`), Würfeln, Stimme (der vorhandene Editor aus AP17d), Aussehen automatisch, **Beziehungsmatrix** (N × N, Zelle öffnet die vier Werte und die Vorgeschichte), „wohnt schon in Haus …“.
- **Regeln:** Preset (die sechs vorhandenen), Autonomie und Knappheit als Regler, Weltregeln als Text mit Vorschau, Beobachtungsmodus.
- **Modell:** Auswahl wie heute; die Stelle bleibt austauschbar (AP17c-4 folgt).
- **Start:** Übersicht aller Angaben, Warnungen, Hinweis auf die Sicherung der alten Welt („Vor der neuen Simulation“), Wahl „angehalten starten“ (Standard) oder „laufen lassen“.
- **Charaktereditor** (Startmenü → Editoren → Figuren; heute „später“): Liste der Vorlagen (mitgelieferte schreibgeschützt, eigene bearbeitbar), dieselbe Profilmaske, Speichern, Duplizieren, Löschen, Export und Import als Datei mit klaren Fehlermeldungen.
- **Tempohinweis:** Bei N Bewohnern und einem Modell-Slot dauert eine Runde (jeder entscheidet einmal) etwa N × 4,5 s. Die Zahl steht im Assistenten neben der Bewohnerzahl; die Grenze `MAX_RESIDENTS = 8` ist eine Konstante (`agents/schema.py`, zusätzlich in den generierten Typen fürs Frontend).

## Teilpakete (je eigene Tests und Commit)
| | Inhalt | Prüfung |
|---|---|---|
| **a** | Backend: Profilschema mit Grenzen und Wortprüfung, Vorlagenspeicher, Export/Import, API, Generator für N Bewohner (Betten, Häuser, Startplätze), Beziehungsstartwerte und Vorgeschichte, Bleibe selbst suchen (Optionen, Besitzer, Ereignis) | pytest: Grenzen, Importfehler, gleicher Seed = gleiche Welt, bisherige Seeds unverändert, Wohnen über Nächte, Test „Prompts ohne Hinweis“ |
| **b** | Assistent im Frontend (Welt, Bewohner, Beziehungen, Start) | Vitest, Playwright mit 1, 3 und 8 Bewohnern |
| **c** | Charaktereditor und Vorlagen im Startmenü (Editoren), Export/Import | Vitest, Playwright: Datei hoch- und runterladen, Fehlermeldungen |
| **d** | Regeln: Preset, Autonomie, Knappheit, Weltregeln als Startereignisse, Schöpfermodus (nur im Editor-Modus änderbar) | pytest, Playwright |
| **e** | Abnahmeprobe: Fake-Modell (alle Größen), wenn erreichbar ein echtes Modell; Neuladen, anderer Browser | Langlauf mit 4 und 8 Bewohnern |

## Annahmen (ohne Rückfrage übernommen; sag, wenn du etwas anders willst)
- **Nebenfiguren** sind im AP17-Plan genannt. Ich lese das als „Figuren ohne KI“ (AP08 hat sie als Ereignis `spawn_npc`). Sie werden **nicht** in AP17b gebaut; sie bleiben bei der Ereigniseingabe im Spiel.
- **Würfeln** gibt es als Knopf je Feld mit sichtbarem Seed (Empfehlung).
- **Vorlagen** liegen als Dateien neben den Spielständen (Empfehlung).
- **Modelle mit Bildteil** und die Modellverwaltung bleiben AP17c.
- **Nicht in AP17b:** Avatar-Editor, Gestalten (AP16), Szenen (Frage 38), Musik-Editor, Epochen, das größere Haus.
- **Presets** sprechen heute von „Beide“; die Beschreibungen werden auf „alle“ umformuliert (Text, keine Wirkung).

## Risiken
- **Goldbilder:** Startwelt, zwei Dörfer und Flach dürfen sich nicht ändern. Der Generator bekommt `residents` nur als neue Eingabe; ohne sie bleibt die Ausgabe gleich (Test über die bisherigen Seeds).
- **Tempo:** Mit 8 Bewohnern und einem Slot dauert eine Runde über 30 s. Der Hinweis steht sichtbar; die Grenze ist leicht änderbar.
- **Bett als Besitz:** Ein dritter Bewohner in einem vollen Haus hat kein freies Bett. Der Assistent rechnet aufgerundet N/2 Häuser, die Prüfung verlangt mindestens so viele Betten wie Bewohner.
