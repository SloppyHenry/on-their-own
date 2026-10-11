# Spielstände, Export und Statistik (AP09)

## Spielstand = konsistente Kopie der einen SQLite-Datei
Alles liegt in `data/live.db`; ein Spielstand ist eine Kopie davon (SQLite-Backup-API, über eine Zwischendatei, ohne `-wal`/`-shm`) unter `data/saves/<id>.db` plus eine Zeile in `data/saves/index.db` (Name, Beschreibung, Sim-Zeit, Zeitpunkt, App- und Schema-Version, Größe, Prüfsumme, Modell). Weil es die ganze Datei ist, ist **alles** darin (Welt, Agenten, Gedächtnis, Ziele, Beziehungen, geplante Ereignisse, Nebenfiguren, Parameter, eigene Presets, Protokolle, Seed) und neue Tabellen kommen von selbst mit. Das **Modell** gehört zur Simulation (Frage 10): es steht in `meta.llm_model`, gilt nach Neustart und beim Laden immer das gespeicherte.

| Art | Entsteht durch | Löschen |
|---|---|---|
| `manual` | „Speichern“ | nur ausdrücklich |
| `auto` | Autosave | Ringpuffer der letzten N |
| `backup` | automatisch vor Laden und Zurücksetzen („Vor dem Laden – …“, „Vor dem Zurücksetzen – …“) | nur ausdrücklich |
| `import` | Import einer ZIP-Datei | nur ausdrücklich |

- **Speichern:** läuft die Simulation, wird sie kurz angehalten (zwischen zwei Takten), kopiert und fortgesetzt. Gleicher Name (ohne Rücksicht auf Groß-/Kleinschreibung) bei manuellen Ständen: **abgelehnt**, außer mit ausdrücklichem `overwrite`.
- **Laden:** Bestätigung nötig. Der Stand wird auf Prüfsumme und Integrität geprüft (ein beschädigter wird nicht geladen, der Live-Stand bleibt), der **aktuelle Stand zuerst als „Vor dem Laden“ gesichert**, dann ersetzt die Datei den Live-Stand, Migrationen laufen, und alle Browser bekommen über `simulation.loaded` einen frischen Snapshot. Ein Sicherungsstand lässt sich wie jeder andere laden: man springt zum Stand vor dem Laden zurück.
- **Zurücksetzen:** Bestätigung mit Texteingabe, vorher Sicherung „Vor dem Zurücksetzen“. Wahl: komplett Standard (auch Werte je Agent aus den Einstellungen fallen weg) oder aktuelle Profile und Persönlichkeitswerte behalten. Allgemeine Parameter und eigene Presets bleiben.
- **Autosave** (Parameter `sim.autosave_sim_hours` 6, `sim.autosave_real_minutes` 30, `sim.autosave_keep` 5; Wirkungstest vorhanden): am Ende eines Taktes, wenn eine der beiden Schwellen erreicht ist; der Ringpuffer löscht nur ältere Autosaves.
- **Export:** ZIP mit `state.db` und `manifest.json` (Format, App- und Schema-Version, Name, Sim-Zeit, Modell, Prüfsumme, Inhaltsübersicht).
- **Import:** nur ZIP mit genau diesen zwei Dateien, Größengrenzen, Prüfsumme muss stimmen, Schema-Version ≤ aktuell, SQLite-Integritätsprüfung, **keine Tabellen, Sichten oder Auslöser außerhalb des bekannten Schemas** (sonst könnte eine Datenbank Code mitbringen). Wird immer als **neuer** Stand angelegt, nie über den Live-Stand.
- **Rückspulen** gibt es nicht als Abspielen des Protokolls: ein Autosave zu laden *ist* das echte Zurückspringen.

## Statistik (`backend/simulacra/stats/`)
Reine SQL-Abfragen auf `events`, `action_log`, `decisions`, `conversations`, `relation_log`, `relations`, `memories` und die neue Tabelle `stats_samples` (einmal je Simulationsstunde Bedürfnisse und Stimmung je KI-Agent). Keine zweite Datenhaltung. Je Agent und gesamt, Zeitraum und Agent wählbar: Aktionen nach Art mit Erfolgsquote und den häufigsten Ablehnungsgründen, Gespräche (Anzahl, Länge, angenommene/abgelehnte Vorschläge, häufige Wörter), Zeit je Ort, entdeckte Orte und Objekte, Verläufe von Bedürfnissen, Stimmung und Beziehungen (die Beziehungsreihe wird rückwärts aus den Änderungen bis zum heutigen Wert gerechnet), Erinnerungen und Reflexionen je Tag, Modell (Entscheidungen, gültig/Rückfall, Korrekturen, Ø Antwortzeit, Tokens).

## Ereignisverlauf
`GET /api/events` kennt zusätzlich `from_minute`, `to_minute` und `q` (Volltext); `GET /api/events/export` liefert denselben Filter als CSV oder JSON (bis 200 000 Zeilen).
