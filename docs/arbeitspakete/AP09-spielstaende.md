# AP09 – Speichern, Laden, Export, Statistik

**Auftrag:** §14, §7.1 D · **Abhängig von:** AP07 (parallel zu AP08 möglich) · **Umfang:** M · **Meilenstein:** M6

## Ziel
Der vollständige Simulationsstand lässt sich automatisch und manuell sichern, unter Namen speichern, laden, exportieren und importieren. Kein Vorgang überschreibt oder verliert stillschweigend einen Stand. Ereignisverlauf und Statistiken helfen beim Auswerten.

## Was ein Spielstand enthält (§14)
Positionen, Objekte, Ressourcen, Zeit und Kalender, Wetter, Agentenprofile, Persönlichkeitswerte, Ziele, Pläne, Bedürfnisse, Stimmung, Beziehungen, Erinnerungen (aktiv und archiviert), Wissen, laufende Aktionen und Gespräche, geplante und befristete Ereignisse, Nebenfiguren, Parameter, eigene Presets, Ereignisprotokoll, Entscheidungs- und Fehlschlagprotokoll, Zufalls-Seed.

Da alles in **einer SQLite-Datei** liegt, ist ein Spielstand eine konsistente Kopie dieser Datei plus Metadaten. So kann nichts vergessen werden, wenn später neue Tabellen hinzukommen.

## Umsetzung
- **Live-Stand:** `data/live.db`.
- **Speichern:** Simulation kurz anhalten (zwischen zwei Ticks), SQLite-Backup-API → `data/saves/<id>.db`, Metadaten in `data/saves/index.db` (Name, Beschreibung, Sim-Zeit, Echtzeit, App- und Schema-Version, Größe, Vorschaubild optional). Danach weiterlaufen lassen, falls sie lief.
- **Laden:** Bestätigung nötig. Vor dem Laden wird der aktuelle Stand **automatisch** als „Vor dem Laden – <Zeit>“ gesichert. Dann Simulation stoppen, Datei kopieren, Migrationen anwenden, Engine neu initialisieren, alle Browser bekommen einen Snapshot (`simulation.loaded`).
- **Benannte Stände:** Name eindeutig; gleicher Name → Rückfrage „überschreiben?“ mit ausdrücklicher Bestätigung, Standard ist „als neuen Stand speichern“.
- **Autosave:** alle N Sim-Stunden und alle M Echtzeitminuten (Parameter), Ringpuffer der letzten 5 (Parameter), getrennt von manuellen Ständen; Autosaves überschreiben nie manuelle.
- **Zurücksetzen:** Bestätigungsdialog mit Texteingabe; vorher automatische Sicherung „Vor dem Zurücksetzen – <Zeit>“. Wahl: Startwelt mit aktuellen Profilen oder komplett Standard.
- **Export:** ZIP mit `state.db`, `manifest.json` (Versionen, Prüfsummen, Inhaltsübersicht), Download im Browser.
- **Import:** Upload, Prüfung (ZIP-Struktur, Prüfsumme, Schema-Version ≤ aktuell, SQLite-Integritätscheck, keine fremden Dateien), Import als neuer Spielstand – nie direkt über den Live-Stand.
- **Rückspulen (optional):** Nur falls Zeit bleibt: Laden eines Autosaves *ist* bereits ein echtes Zurückspringen. Eine feinere Rückspulfunktion wird nicht als Protokoll-Abspielen vorgetäuscht.

## Ereignisverlauf und Statistik
- Verlaufsansicht (`EventHistory`): Filter nach Zeitraum (Sim-Zeit), Typ, Kategorie, Agent, Ort, Freitext; Export als CSV/JSON.
- Statistiken (`StatsView`) je Agent und gesamt:
  - Aktionen nach Art, Erfolgsquote, häufigste Ablehnungsgründe,
  - Gespräche (Anzahl, Länge, Themen-Stichwörter), angenommene/abgelehnte Vorschläge,
  - Zeit je Ort, entdeckte Orte und Objekte,
  - Verlauf von Beziehungswerten, Stimmung, Bedürfnissen über die Zeit (Linien),
  - Erinnerungen und Reflexionen je Tag,
  - LLM: Anfragen, mittlere Antwortzeit, Fehler, Tokens.
- Berechnung per SQL-Abfragen auf `events` und den Protokolltabellen; keine zweite Datenhaltung.

## API
| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/api/saves` | Liste (manuell, auto, Sicherungen) |
| POST | `/api/saves` | speichern (Name, Beschreibung, überschreiben ja/nein) |
| POST | `/api/saves/{id}/load` | laden (Bestätigungstoken aus vorherigem Dialog) |
| DELETE | `/api/saves/{id}` | löschen mit Bestätigung |
| GET | `/api/saves/{id}/export` | ZIP herunterladen |
| POST | `/api/saves/import` | ZIP hochladen |
| POST | `/api/sim/reset` | aus AP03, jetzt mit Vorab-Sicherung |
| GET | `/api/stats?agent=&from=&to=` | Statistiken |
| GET | `/api/events/export?…` | Verlauf exportieren |

## Frontend
`SaveLoadDialog` (Liste mit Sim-Zeit, Datum, Typ; Speichern, Laden, Löschen, Exportieren, Importieren), Kopfleisten-Knöpfe Speichern/Laden, `EventHistory`, `StatsView` (Diagramme mit einer kleinen Bibliothek oder eigenem SVG, Entscheidung beim Paketstart).

## Module
`saves/store.py`, `saves/snapshot.py`, `saves/autosave.py`, `saves/export.py`, `saves/importer.py`, `stats/queries.py`, `api/routes_saves.py`, `api/routes_stats.py`; Frontend `src/saves/SaveLoadDialog.tsx`, `src/history/EventHistory.tsx`, `src/stats/StatsView.tsx`, `src/stats/charts/*.tsx`.

## Tests
- Roundtrip: Zustand → speichern → weitersimulieren → laden → Zustand identisch zum gespeicherten (Vergleich aller Tabellen).
- Export → Import → identischer Stand; manipulierte Datei (Prüfsumme, fremde Tabelle, neuere Schema-Version) → abgelehnt.
- Laden und Zurücksetzen legen vorher eine Sicherung an.
- Gleicher Name ohne Bestätigung überschreibt nicht.
- Autosave-Ringpuffer hält genau N, berührt keine manuellen Stände.
- Neustart der App: alle Stände in der Liste (§14 „nicht stillschweigend verloren“).
- Playwright: Speichern, Laden, Browser zeigt den geladenen Stand.

## Abnahme
- [ ] Speichern, Laden, Export, Import, Zurücksetzen funktionieren live; jeder destruktive Schritt fragt nach und sichert vorher.
- [ ] Statistiken zeigen echte Zahlen aus einer Simulation über mindestens einen Sim-Tag.
