# AP03 – Event-Bus, REST-API, WebSocket

**Auftrag:** §12 · **Abhängig von:** AP01 (parallel zu AP02 möglich) · **Umfang:** M · **Meilenstein:** M2

## Ziel
Jede Zustandsänderung wird als eindeutig nummeriertes Ereignis gespeichert und live an verbundene Browser verteilt. Ein Browser, der neu lädt oder die Verbindung verliert, holt den aktuellen Stand verlustfrei nach. Steuerbefehle werden auch bei doppeltem Senden nur einmal ausgeführt.

## Lieferumfang
1. Einheitliches Ereignisschema und Ereignistypen-Registry.
2. Event-Bus mit Speicherung in SQLite und Verteilung an Abonnenten.
3. REST-Endpunkte für Zustand, Steuerung, Ereignisverlauf.
4. WebSocket-Endpunkt mit Snapshot, Deltas und Nachsynchronisierung.
5. Idempotenz für alle verändernden Anfragen.
6. Erzeugte TypeScript-Typen (`frontend/src/types/generated.ts`).

## Ereignisschema
```json
{
  "id": "evt_01J…",            // ULID, weltweit eindeutig
  "seq": 1842,                  // fortlaufend je Simulation, lückenlos
  "ts": "2026-10-11T08:42:13Z", // Echtzeit
  "sim_time": {"day": 1, "minute": 522},
  "type": "agent.moved",
  "category": "world | dialogue | planning | memory | system",
  "agents": ["alex"],
  "location": "garden",
  "data": { … typabhängig … },
  "caused_by": "evt_01J…",       // optional: auslösendes Ereignis
  "visibility": "public | agents:[…] | system"
}
```
- `category` steuert die Unterscheidung im Protokoll (§7.1 C): Weltaktion, Dialog, interne Planung, System.
- `visibility` beschreibt, wer das Ereignis *in der Simulation* wahrnimmt (Grundlage für Wissensgrenzen in AP05/AP08). Der Beobachter im Browser sieht alles.
- Jeder Typ hat ein eigenes Pydantic-Modell für `data`.

## Ereignistypen (erste Fassung)
| Typ | Kategorie | Daten |
|---|---|---|
| `agent.moved` | world | von, nach (Kachel), Pfadrest |
| `agent.arrived` | world | Ort |
| `agent.action_started` / `agent.action_completed` / `agent.action_rejected` | world | Aktion, Parameter, Dauer bzw. Ablehnungscode |
| `agent.dialogue` | dialogue | Gespräch-ID, Sprecher, Empfänger, Text |
| `agent.conversation_started` / `_ended` | dialogue | Teilnehmer, Grund |
| `agent.decision` | planning | Ziel, Optionen mit Punkten, gewählte Option, Faktoren (AP06 erweitert) |
| `agent.decision_failed` | system | Fehlerart, Versuche |
| `agent.status_changed` | planning | alter/neuer Handlungsstatus |
| `agent.memory_created` / `agent.memory_retrieved` | memory | ab AP05 |
| `agent.goal_changed` | planning | ab AP06 |
| `world.object_created` / `_changed` / `_removed` | world | Objekt (vollständig bzw. Änderung) |
| `world.resource_changed` | world | Ressource, Ort, alt, neu |
| `world.weather_changed` | world | Wetter, Dauer |
| `world.time` | system | nur jede Sim-Stunde, nicht jede Minute |
| `simulation.started` / `paused` / `resumed` / `stepped` / `reset` | system | Auslöser |
| `simulation.speed_changed`, `simulation.parameter_changed` | system | ab AP07 |
| `simulation.event_injected` | system | ab AP08 |

Neue Typen werden ausschließlich über die Registry ergänzt; ein Test stellt sicher, dass jeder Typ ein Datenmodell und einen TypeScript-Typ hat.

## Event-Bus (`events/bus.py`, `events/store.py`)
- `publish(event)` schreibt das Ereignis **in derselben Transaktion** wie die Zustandsänderung (die Welt-Engine ruft den Bus innerhalb der Transaktion auf). Erst nach dem Commit wird verteilt; so sieht der Browser nie etwas, das nicht gespeichert ist.
- Verteilung an Abonnenten über `asyncio.Queue` je Verbindung; langsame Verbindungen bekommen nach einer Grenze (z. B. 2000 Ereignisse Rückstand) einen Hinweis „Resync nötig“ statt unbegrenzt Speicher zu belegen.
- Tabelle `events` mit Index auf `seq`, `type`, `agents`, `sim_time`.
- Mengenbegrenzung: Positionsereignisse (`agent.moved`) können zusammengefasst werden (ein Ereignis pro Pfadabschnitt statt pro Kachel), Wert in AP04 abstimmen.

## REST-Endpunkte (`api/`)
| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/api/state` | vollständiger Snapshot: Welt, Agenten (öffentlicher Teil), Uhr, Wetter, Simulationsstatus, `seq` |
| GET | `/api/events?after_seq=&type=&agent=&category=&limit=` | Verlauf mit Filtern |
| GET | `/api/events/{id}` | Einzelereignis mit verknüpften Ereignissen (`caused_by`-Kette) |
| GET | `/api/agents/{id}` | Detail eines Agenten (Ziele, Bedürfnisse, letzte Aktionen) |
| GET | `/api/locations/{id}` | Ort mit Objekten und jüngsten Ereignissen dort |
| POST | `/api/sim/start` · `/pause` · `/resume` · `/step` · `/reset` | Steuerung |
| POST | `/api/sim/speed` | Geschwindigkeitsstufe |
| GET | `/api/health` | aus AP00, erweitert um Simulationsstatus |

Weitere Endpunkte kommen in AP05 (Gedächtnis), AP07 (Parameter, Presets), AP08 (Ereignisse), AP09 (Spielstände).

## Idempotenz
- Alle `POST`/`PATCH`/`DELETE` erwarten einen Header `Idempotency-Key` (vom Frontend als UUID erzeugt).
- Tabelle `idempotency` speichert Schlüssel, Anfrage-Hash und Antwort für 24 h. Gleicher Schlüssel → gespeicherte Antwort, keine zweite Ausführung. Gleicher Schlüssel mit anderem Inhalt → 409.

## WebSocket `/ws`
1. Client verbindet und sendet `{"type":"hello","last_seq":1840}` (oder `null` beim ersten Laden).
2. Server antwortet:
   - `last_seq` fehlt oder liegt zu weit zurück (Grenze z. B. 5000) → `{"type":"snapshot", "state":…, "seq":…}`.
   - sonst → alle Ereignisse nach `last_seq` als `{"type":"events","items":[…]}`.
3. Danach laufend `{"type":"event", …}`.
4. Heartbeat alle 15 s (`ping`/`pong`); bleibt das `pong` aus, schließt der Server.
5. Der Client prüft die Lückenlosigkeit von `seq`; bei einer Lücke fordert er `{"type":"resync","last_seq":…}` an.
- Die Simulation läuft unabhängig von Browser-Verbindungen weiter; ein Verbindungsabbruch hat keinen Einfluss auf den Zustand.

## Sicherheit
- Backend bindet lokal auf 127.0.0.1; im Container hinter dem veröffentlichten Port. Optionaler Zugangsschutz (Token aus Umgebungsvariable) für den Betrieb im Heimnetz – Entscheidung in AP10.
- Eingaben werden alle über Pydantic validiert; Pfad- und Abfrageparameter haben Längen- und Wertgrenzen.

## Typen fürs Frontend
`scripts/gen_types.sh` exportiert JSON-Schema aus den Pydantic-Modellen und erzeugt daraus `generated.ts` (Werkzeug `json-schema-to-typescript` als Entwicklungsabhängigkeit). Ein Test schlägt fehl, wenn die erzeugte Datei veraltet ist.

## Module
`events/schema.py`, `events/types.py`, `events/bus.py`, `events/store.py`, `api/app.py`, `api/routes_state.py`, `api/routes_sim.py`, `api/routes_events.py`, `api/ws.py`, `api/idempotency.py`.

## Tests
- Ereignis wird nur nach Commit verteilt; bei Rollback weder gespeichert noch verteilt.
- `seq` lückenlos auch bei parallelen Veröffentlichungen.
- WebSocket: erster Kontakt → Snapshot; Wiederverbindung mit `last_seq` → genau die fehlenden Ereignisse; zu großer Abstand → Snapshot; Lücke → Resync (§17 Nr. 13).
- Idempotenz: zweimal `POST /api/sim/step` mit gleichem Schlüssel → ein Tick.
- Filter des Verlaufs.
- Jeder registrierte Ereignistyp hat Datenmodell und TS-Typ.

## Abnahme
- [ ] Mit `websocat` oder einem kleinen Testclient lassen sich Live-Ereignisse einer laufenden Simulation mitlesen.
- [ ] Neu verbinden nach Unterbrechung liefert genau die verpassten Ereignisse.
- [ ] Doppelte Steuerbefehle werden einmal ausgeführt.
- [ ] `docs/schnittstellen.md` beschreibt alle Endpunkte und Ereignistypen.
