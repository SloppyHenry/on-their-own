# Das Gedächtnis (AP05)

Jeder Agent hat ein eigenes, dauerhaftes Gedächtnis in der SQLite-Datei (Tabellen `memories`, `known_objects`, `known_locations`, `retrievals`, `memory_state`, Suchindex `memories_fts`). **Nichts wird gelöscht**; Altes wird archiviert.

## Arten von Erinnerungen
| Art | Bedeutung | Entsteht aus |
|---|---|---|
| `episode` (Erlebnis) | etwas, das ich getan oder erlebt habe | Entscheidungen („Ich habe mir vorgenommen: …“, bei Ablehnung „Es hat nicht geklappt: …“), Beobachtungen (angekommen, Gelungenes, Gescheitertes) |
| `fact` (Wissen) | etwas, das ich erfahren habe | Entdeckungen, Lesen, Untersuchen |
| `relation` (Beziehung) | etwas mit einer anderen Person | Gespräche (**eine Erinnerung je Gespräch und Teilnehmer**, aus der eigenen Sicht), Geschenke, erste Begegnung |
| `intention` (Vorhaben) | was ich vorhabe | `plan_next` des Agenten, aber nur bei Zusage (Person, „später“, „morgen“ …) oder wenn es wiederkehrt; offen, erledigt oder aufgegeben |
| `reflection` (Einsicht) | Schlussfolgerung über mich, andere, das Dorf | Reflexion (siehe unten), mit Verweis auf die Quellerinnerungen |
| `summary` (Rückblick) | Zusammenfassung eines Simulationstages | tägliche Pflege |

Alle Texte stehen in der **Ich-Form** (die Beobachtungen im Du werden umgeschrieben). Der andere Agent sieht nie, was jemand speichert oder abruft: Gedächtnis-Ereignisse haben die Sichtbarkeit `system`.

## Schreiben (`memory/writer.py`, `importance.py`)
- **Kein Modellaufruf je Erinnerung.** Wichtigkeit = Regelwert der Beobachtung (Entdeckung 6, Geschenk 4/6, Gelungenes 5 …), bei eigenen Handlungen gemittelt mit der `importance` aus der Entscheidung des Agenten; erste Begegnung mit einer Person +2.
- **Schwelle** (`SIM_MEM_STORE_THRESHOLD`, Standard 4): darunter bleibt etwas nur im Kurzzeitpuffer (Beobachtungen, letzte 10 im Prompt). Mit `SIM_MEM_DEBUG_SKIPS=true` wird das als `agent.memory_skipped` gemeldet.
- Einzelne Gesprächssätze werden **nicht** gespeichert, sondern je Gespräch zusammengefasst („Ich habe mit Mira gesprochen (4 Beiträge). Mira sagte: «…» Ich sagte: «…»“). Gleicher Text innerhalb von 30 Minuten wird nicht doppelt gespeichert.
- Stichwörter (Orte, Personen, Objekte, Tätigkeiten, Wörter des Textes mit deutscher Grobstammbildung) stehen in `keywords` und im FTS5-Index.

## Abrufen (`memory/retrieval.py`)
Vor jeder Entscheidung wird aus der Lage (Ort, anwesende Personen, sichtbare Objekte, Vorhaben, Ziele, letzte Gesprächszeilen) eine Anfrage gebaut. Kandidaten: Stichwortsuche (FTS5, nur dieser Agent, nur aktive), Erinnerungen mit passender Person oder passendem Ort, offene Vorhaben und jüngste Einsichten, die jüngsten und die wichtigsten Einträge.

```
score = (w_rel·Relevanz + w_rec·Aktualität + w_imp·Wichtigkeit/10 + w_shared·gemeinsam) / Summe der Gewichte    (0–1)
Relevanz = 0,55·Stichwortrang + 0,30·Personenübereinstimmung + 0,15·Ort
Aktualität = 0,5 ^ (Alter / Halbwertszeit)
Einsichten und offene Vorhaben: Zuschlag bis 0,12, so stark wie sie zur Lage passen
```
Aufgefüllt wird nach Punktzahl bis zu **Schwelle** (`min_score`), **Höchstzahl** (6, davon höchstens 2 Einsichten und 1 Vorhaben) und **Token-Budget** (400). Was jünger ist als der älteste Eintrag des Kurzzeitpuffers, wird nicht doppelt gezeigt. Der Abruf steht im Prompt unter „Woran du dich erinnerst:“, wird in `retrievals` protokolliert (mit den Teilpunkten und der Entscheidung, für die er geholt wurde), erhöht `access_count` und `sim_last_access` und meldet `agent.memory_retrieved`.

## Reflexion (`memory/reflection.py`)
- **Auslöser:** Summe der Wichtigkeit neuer Erinnerungen seit der letzten Reflexion ≥ `SIM_MEM_REFLECT_THRESHOLD` (80) **oder** einmal am Abend (ab 21:00); mindestens 60 Simulationsminuten Abstand, mindestens 5 Quellerinnerungen.
- **Ablauf:** die 20 jüngsten wichtigen Erinnerungen werden nummeriert vorgelegt (dazu die letzten Einsichten: „nicht wiederholen“); das Modell antwortet 1–3 Einsichten mit `sources` (Nummern). Geprüft wird: Nummern existieren **und gehören dem Agenten** (die Nummern gelten nur in seinem Prompt), Quellenverweise im Text werden entfernt, Wiederholungen früherer Einsichten (Ähnlichkeit ≥ 0,5) und Einsichten ohne gültige Quelle werden verworfen (`agent.memory_skipped` mit Grund).
- **Priorität:** Reflexionen laufen zwischen den Ticks, und nur, wenn kein Agent auf eine Entscheidung wartet (spätestens nach 20 Schritten trotzdem). Ein Fehler des Modells stört die Simulation nie.
- Beziehungswerte aus Reflexionen kommen mit AP06.

## Pflege (`memory/maintenance.py`)
Einmal je Simulationstag: fehlende **Tageszusammenfassungen** (regelbasiert, ohne Modell; Rückblick mit den wichtigsten Erlebnissen, Orten, Personen), dann **Archivierung** (`status = archived`) von Erlebnissen, Wissen und Beziehungen, die älter als 2 Tage und durch eine Zusammenfassung abgedeckt sind (außer Wichtigkeit ≥ 8 oder ≥ 3 Abrufe), und von erledigten oder aufgegebenen Vorhaben. Bei mehr als 2000 aktiven Erinnerungen je Agent wird stärker archiviert (niedrigste Wichtigkeit und Abrufzahl zuerst). Archivierte Erinnerungen bleiben in der Datenbank, im Inspektor (Filter „archiviert“) und per API, gehen aber nicht mehr in den Prompt. Ereignis: `agent.memory_archived`.

## Wissen
- `known_objects`: zuletzt gesehener Zustand je Gegenstand (kann veraltet sein, das ist gewollt), wird bei jeder Wahrnehmung aktualisiert.
- `known_locations`: entdeckte Orte (Grundlage für Exploration in AP06), Besuche.

## Trennung der Gedächtnisse
Jede Methode von `MemoryStore` und `KnowledgeStore` verlangt `agent_id` und filtert danach. Ein Test führt alle Methoden aus und prüft jede SQL-Anweisung auf den Agentenfilter; weitere Tests belegen, dass ein Agent weder über Speicher, Abruf, Reflexion noch API fremde Erinnerungen sieht.

## Einstellungen
Siehe [konfiguration.md](konfiguration.md) (`SIM_MEM_*`). In AP07 werden sie als Parameter in der Oberfläche einstellbar.

## Abruf: Korrektur in AP07
Der Wirkungstest für `memory.max_in_context` deckte einen Fehler im Abruf auf: nach der ersten gewählten Erinnerung einer Art wurden alle weiteren derselben Art übersprungen, wenn sie nicht Einsicht oder Vorhaben war (nur eine Episode je Abruf). Begrenzt sind jetzt nur Einsichten (`max_reflections`) und Vorhaben (eines); Erlebtes ist nur durch `max_items`, Schwelle und Token-Budget begrenzt.
