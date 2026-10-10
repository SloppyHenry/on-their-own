# AP05 – Persistentes Gedächtnis, Abruf, Reflexion

**Auftrag:** §6, §8.3, §10.3 (Grundlage) · **Abhängig von:** AP02 · **Umfang:** L · **Meilenstein:** M3

## Ziel
Jeder Agent hat ein eigenes, dauerhaftes Gedächtnis in SQLite mit fünf Kategorien. Vor jeder Entscheidung werden nur die relevantesten Erinnerungen in den Prompt geholt, begrenzt durch ein Token-Budget. Reflexionen verdichten Erlebtes. Nichts wird gelöscht, alte Einträge werden archiviert. Im Browser ist sichtbar, wann ein Agent etwas speichert oder abruft, und alle Erinnerungen lassen sich untersuchen.

## Lieferumfang
1. Datenmodell und Tabellen für Erinnerungen, Wissen und Beziehungsnotizen.
2. Schreibpfad: Beobachtungen → Erinnerungen mit Wichtigkeit.
3. Abrufpfad: Relevanzsuche mit einstellbaren Gewichten und Schwelle.
4. Reflexion und Zusammenfassung.
5. Archivierung.
6. API und Ereignisse; `MemoryInspector` im Frontend; Anzeige im Agenten-Detail.

## Datenmodell
Tabelle `memories`:

| Feld | Bedeutung |
|---|---|
| `id` | ULID |
| `agent_id` | Besitzer; **jede Abfrage filtert zwingend danach** |
| `kind` | `episode`, `fact`, `relation`, `intention`, `reflection`, `summary` |
| `text` | kurzer Satz in der Sicht des Agenten („Ich habe Mira am See getroffen.“) |
| `keywords` | normalisierte Stichwörter (Orte, Objekte, Personen, Tätigkeiten) |
| `persons` | beteiligte Personen |
| `location_id` | Ort |
| `importance` | 1–10 |
| `shared` | gemeinsames Erlebnis ja/nein (für die Gewichtung persönlich vs. gemeinsam) |
| `sim_created`, `sim_last_access`, `access_count` | Zeitbezug |
| `source_event_id`, `source_memory_ids` | Herkunft (Ereignis bzw. Reflexionsquellen) |
| `status` | `active`, `archived` |
| `intention_state` | für `intention`: `open`, `done`, `dropped`, mit Frist |

Zusätzlich:
- FTS5-Index über `text` und `keywords` für die Stichwortsuche.
- `known_objects` (Agent, Objekt, zuletzt gesehener Zustand und Ort, Zeitpunkt): Was der Agent über Gegenstände weiß; kann veraltet sein, das ist gewollt.
- `known_locations` (Agent, Ort, entdeckt am, Anzahl Besuche): Grundlage für Exploration in AP06.

## Schreibpfad (`memory/writer.py`)
- Quellen: eigene Aktionen und Ergebnisse, Wahrnehmungen (Personen, Objekte, Wetter), Gespräche (zusammengefasst je Gespräch, nicht jeder Satz), Informationen aus Ereignissen (AP08).
- **Wichtigkeit:** Regelwert (z. B. erste Begegnung, Konflikt, neuer Ort, Geschenk = hoch; Routine = niedrig) kombiniert mit dem `importance`-Wert aus der Agentenentscheidung. Kein eigener LLM-Aufruf pro Erinnerung, um Last zu sparen.
- Entscheidung „erinnerungswürdig?“: Schwelle (Parameter). Unterhalb wird nur im Kurzzeitpuffer gehalten, nicht dauerhaft gespeichert – das wird im Protokoll als „nicht gemerkt“ sichtbar (Ereignis `agent.memory_skipped` nur im Debug-Filter).
- Jede gespeicherte Erinnerung erzeugt `agent.memory_created` (Sichtbarkeit `system`, damit der andere Agent sie nicht „sieht“).

## Abrufpfad (`memory/retrieval.py`)
Anfrage aus aktueller Situation: Ort, anwesende Personen, Objekte, aktives Ziel, letzter Gesprächsinhalt.

Punktzahl je Kandidat:
```
score = w_rel · relevanz(FTS5-Rang, Personen-/Ortsübereinstimmung)
      + w_rec · aktualität(exp(-Δt / Halbwertszeit))
      + w_imp · importance/10
      + w_shared · (shared ? 1 : 0)   bzw. persönlich-Gewichtung
```
- Gewichte, Halbwertszeit, Schwelle und Höchstzahl sind Parameter (AP07, §8.3).
- Ergebnis wird bis zum **Token-Budget** (z. B. 1200 Tokens) aufgefüllt, Reflexionen und offene Vorhaben bevorzugt.
- Jeder Abruf erzeugt `agent.memory_retrieved` mit den IDs und Punkten – das Frontend zeigt das als kurzes Aufleuchten am Agenten und im Protokoll (Kategorie *memory*).
- `sim_last_access` und `access_count` werden aktualisiert.

## Reflexion (`memory/reflection.py`)
- Auslöser: Summe der Wichtigkeit neuer Episoden seit der letzten Reflexion überschreitet einen Schwellwert **oder** feste Zeit (z. B. abends vor dem Schlafen). Beides Parameter.
- Ablauf: 15–30 jüngste wichtige Erinnerungen → LLM erzeugt 1–3 Schlussfolgerungen im JSON-Schema mit Verweisen auf Quell-IDs → Prüfung, dass die IDs existieren und dem Agenten gehören → Speichern als `reflection`.
- Beziehungsreflexion: Schlussfolgerungen über die andere Person aktualisieren die Beziehungswerte (AP06) nur in kleinen Schritten und mit Quellen.
- Reflexionen laufen mit niedriger Priorität: nur wenn kein Agent auf eine Entscheidung wartet.

## Zusammenfassung und Archivierung (`memory/maintenance.py`)
- Zusammenfassung: Episoden eines Sim-Tages werden zu einem `summary` verdichtet (Häufigkeit als Parameter).
- Archivierung: Erinnerungen unter einer Punktzahl, älter als X Sim-Tage und mit Zusammenfassung → `archived`. Archivierte Einträge bleiben in der Datenbank, im Inspektor sichtbar und per Filter abrufbar; sie gehen nur nicht mehr in den aktiven Kontext (§8.3).
- Obergrenze aktiver Erinnerungen je Agent (z. B. 2000) gegen explodierende Größen (§15); bei Überschreitung wird stärker archiviert, nie gelöscht.

## Getrennte Gedächtnisse und Wissensgrenzen
- Alle Lese- und Schreibfunktionen verlangen `agent_id`; ein Test durchsucht den Code nach Abfragen ohne diesen Filter.
- Wahrnehmung (AP02) schreibt nur, was der Agent wahrnehmen konnte: Ereignisse mit passender `visibility` und am selben Ort/in Sichtweite.
- Gespräche erzeugen bei beiden Teilnehmern eigene Erinnerungen aus der jeweils eigenen Sicht.

## API und Frontend
| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/api/agents/{id}/memories?kind=&status=&q=&person=&location=&limit=&cursor=` | Liste mit Filtern |
| GET | `/api/agents/{id}/memories/{mid}` | Einzelerinnerung mit Quellen und Abrufhistorie |
| GET | `/api/agents/{id}/knowledge` | bekannte Orte und Objekte |
| GET | `/api/agents/{id}/retrievals?limit=` | jüngste Abrufe mit Punktzahlen |

**`MemoryInspector`** (eigene Ansicht, aus Kopfleiste und Agenten-Detail erreichbar):
- Zwei Spalten Alex | Mira oder Umschalter; Filter nach Kategorie, Status, Person, Ort, Freitext; Sortierung nach Zeit, Wichtigkeit, Abrufhäufigkeit.
- Detail: Text, Metadaten, Quellereignis (Sprung ins Protokoll), Quellerinnerungen bei Reflexionen, wann zuletzt abgerufen und in welcher Entscheidung.
- Ansicht „Was weiß Alex über …“ (Personen, Orte, Gegenstände) aus `known_*`.
- Live-Markierung neuer Einträge.

## Module
`memory/models.py`, `memory/store.py`, `memory/writer.py`, `memory/importance.py`, `memory/retrieval.py`, `memory/reflection.py`, `memory/maintenance.py`, `api/routes_memory.py`; Frontend `src/memory/MemoryInspector.tsx`, `MemoryList.tsx`, `MemoryDetail.tsx`, `KnowledgeView.tsx`.

## Tests
- Getrennte Gedächtnisse: gleiche Situation, unterschiedliche Erinnerungen; Abruf von Alex liefert nie Miras Einträge (§17 Nr. 2).
- Neustart: Erinnerungen, Wissen, Reflexionen bleiben (§17 Nr. 7).
- Abruf: feste Szenarien (z. B. „am See, Mira anwesend“ bringt das frühere Treffen am See vor einer Routine-Erinnerung); Gewichte verschieben die Reihenfolge messbar.
- Token-Budget wird eingehalten.
- Reflexion mit Fake-LLM: gültige Quellen → gespeichert; fremde oder erfundene IDs → verworfen.
- Archivierung: Einträge bleiben vorhanden, verschwinden aber aus dem aktiven Abruf.
- Wissensgrenze: Ereignis mit `visibility: agents:[mira]` erzeugt nur bei Mira eine Erinnerung.

## Abnahme
- [ ] Nach einem Sim-Tag haben beide Agenten unterschiedliche, sinnvolle Erinnerungen und mindestens eine Reflexion.
- [ ] Im Browser leuchtet Speichern und Abrufen sichtbar auf; der Inspektor zeigt alle Einträge mit Herkunft.
- [ ] Neustart von Backend und Browser: Gedächtnis vollständig da.
- [ ] Tests grün.

## Risiken
| Risiko | Gegenmaßnahme |
|---|---|
| Stichwortsuche findet Zusammenhänge nicht | Stichwörter aus Orten/Objekten/Personen strukturiert speichern; semantische Suche als spätere Option (Embedding-Modell auf maintux) vormerken |
| Reflexionen erzeugen Unsinn | Quellenpflicht, kleine Schritte bei Beziehungswerten, Anzeige im Inspektor |
| Prompt wird zu lang | festes Token-Budget, Zähler je Prompt-Teil im Entscheidungsprotokoll |
