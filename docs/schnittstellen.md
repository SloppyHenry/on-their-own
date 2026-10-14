# Schnittstellen

Pydantic-Modelle im Backend sind die Quelle der Wahrheit; TypeScript-Typen werden daraus erzeugt (ab AP03).

## REST

### `GET /api/health` (AP00)
Liefert den Zustand des Backends und prüft das LLM (`GET <base_url>/models`, Timeout 3 s). Fehler des LLM führen nie zu einem Fehlerstatus der Route; sie stehen in `llm.error`.

```json
{
  "status": "ok",
  "version": "0.1.0",
  "data_dir": "/…/simulacra/data",
  "llm": {
    "reachable": true,
    "error": null,
    "models": ["bonsai2-27b", "qwen3.8-9b-uncensored"],
    "base_url": "http://maintux:8080/v1",
    "configured_model": "qwen3.8-9b-uncensored",
    "model_available": true
  }
}
```

## Welt-Engine (AP01)

Python-Schnittstelle in `backend/simulacra/world/engine.py`. Die Engine ist die **einzige** Stelle, die den Weltzustand ändert. Sie kennt weder LLM noch HTTP (per Test abgesichert).

```python
eng = WorldEngine.create(Database(path))      # leere DB: Startwelt anlegen; sonst vorhandenen Zustand laden
res = eng.propose("alex", "move_to", {"target": "lake"})   # ProposeResult(ok, rejected, events, ends_at)
events = eng.tick()                           # eine Simulationsminute; advance(n) für mehrere
eng.interrupt("alex", "Hunger")               # laufende Aktion abbrechen (Baustelle bleibt bestehen)
eng.set_rules(WorldRules(...))                # Weltregeln, sofort wirksam
eng.set_weather("rain", 120)                  # Eingriff (AP08)
eng.edit.spawn_object(...) / add_location / add_agent / extend_map / apply_patch   # Erweiterungen, siehe welt-erweitern.md
eng.state.snapshot()                          # kompletter Zustand als Dict (Grundlage für den Frontend-Snapshot in AP03)
eng.events_since(seq) / eng.action_history(agent)
await eng.propose_async(...) / await eng.tick_async()   # gleiche Operationen auf dem einzigen Schreib-Thread
```

Jede Operation ist **eine Transaktion**: Zustandsänderung, Ereignisse und Protokolleintrag werden zusammen geschrieben oder gar nicht; nach einem Fehler werden auch die Caches (Raster, Sperren) neu aufgebaut. Eine Aktion wird beim Vorschlag **geprüft und gestartet** (`agent.action_started`), ihre Wirkung tritt nach der Dauer ein (`agent.action_completed`). Wird beim Abschluss festgestellt, dass die Welt sich inzwischen geändert hat, endet sie mit `agent.action_failed` und ohne Wirkung.

### Aktionskatalog

| Aktion | Parameter | Dauer | Ablehnungscodes (Auszug) |
|---|---|---|---|
| `move_to` | `target` (Ort-ID, Objekt-ID, Quellen-ID, Agent-ID) oder `tile` `[x,y]` | je Kachel 1–2 min × Wetterfaktor | `invalid_target`, `not_reachable`, `forbidden_by_rules` |
| `wait` | `minutes` 1–60 | wie angegeben | `invalid_target` |
| `inspect` | `object_id` (Objekt oder Quelle) | 1 | `invalid_target`, `not_here` |
| `take` / `drop` | `object_id` | 1 | `not_here`, `capacity`, `forbidden_by_rules`, `invalid_target` |
| `give` | `to` und `object_id` **oder** `resource`+`amount` | 1 | `not_here`, `capacity`, `missing_resource` |
| `use` | `object_id`, `mode`, ggf. `text` | je Modus | `invalid_target`, `locked`, `missing_resource`, `capacity` |
| `gather` | `resource`, `amount` 1–5, optional `node` | Quelle × Menge × `gather_time_mult` | `not_here`, `missing_resource`, `capacity` |
| `plant` | `seedbed_id` | 10 | `missing_resource`, `invalid_target`, `forbidden_by_rules` |
| `water` | `object_id` (Pflanze oder Beet) | 5 | `missing_resource`, `invalid_target`, `not_here` |
| `build` | `blueprint` (+ `at` `[x,y]`) **oder** `site_id` | Vorlage × `build_duration_mult` | `missing_resource`, `not_here`, `forbidden_by_rules`, `invalid_target` |
| `eat` / `drink` | optional `item` (Mahlzeit) | 5 / 2 | `missing_resource` |
| `rest` / `sleep` | `minutes` (5–120 / 10–600), optional `object_id` | wie angegeben | `not_here`, `forbidden_by_rules`, `invalid_target` |
| `speak` | `to`, `text` (≤ 500 Zeichen) | 1 + Länge/80 | `not_here`, `invalid_target` |

Modi von `use`: Bett `sleep`, Sofa/Bank/Sessel `sit`, Herd `cook`, Regal/Schreibtisch/Tafel/Wegweiser `read`, Schreibtisch/Tafel `write`, Kamin/Feuerstelle `light`/`extinguish` (1 Holz), Laterne/Kerze/Stehlampe `light`/`extinguish` (ohne Holz), Tür `lock`/`unlock`, Angelplatz `fish`, Pflanze `harvest`. Dinge im Dorf (AP15, `world/actions/use_dinge.py`): Boot `row` (`minutes` 10–90) und `fish` (85 %; immer nur eine Person, sonst `busy`), Briefkasten `post` (`to`, `text`) und `collect` (eigene ungelesene Briefe, als `agent.read`), Wegweiser `read` (nennt die Orte mit Richtung und macht sie bekannt), Vogelscheuche `fix`, Katze `pet`, Truhe/Schrank/Kiste `store` und `retrieve` (`item` oder `resource` + `amount` 1–5, höchstens 20 Plätze). Der Korb (Bauplan `basket`, 2 Schilf an der Werkbank) gibt beim Tragen 3 Plätze mehr. Von selbst: Sturm wirft die Vogelscheuche um (je Sturmstunde 30 %), dann wachsen Pflanzen an ihrem Ort halb so schnell; die Katze wechselt alle drei Stunden ihren Platz (`state.spots`, nachts der erste).

Ablehnungscodes (`RejectCode`): `not_reachable`, `not_here`, `missing_resource`, `locked`, `capacity`, `forbidden_by_rules`, `invalid_target`, `busy`. Jede Ablehnung erzeugt `agent.action_rejected`, einen Eintrag in `action_log` und (außer bei `busy`) die Folge laut Regel `failure_penalty`.

### Ereignistypen (AP01)

Schema (`Event`): `seq` (fortlaufende ID), `ts` (UTC), `sim_minute`, `type`, `agents`, `location_id`, `data`, `parent_seq`.

| Typ | Wann |
|---|---|
| `agent.action_started` / `action_completed` / `action_failed` / `action_rejected` / `action_interrupted` | Lebenslauf einer Aktion |
| `agent.walking` (je Weg ein Fahrplan), `agent.location_changed` (mit `at`), `agent.location_discovered`, `agent.arrived`; veraltet: `agent.moved` (je Kachel, nur in Protokollen vor AP11) | Bewegung |
| `agent.dialogue` | `speak` ist angekommen (`speaker`, `to`, `text`) |
| `agent.inspected`, `agent.read`, `agent.fished`, `agent.ate`, `agent.drank`, `agent.slept`, `agent.rested`, `agent.rowed`, `agent.petted`, `agent.stored` | Ergebnisse der Aktionen (`agent.stored`: hineingelegt oder herausgenommen, `into`) |
| `agent.item_taken` / `item_dropped` / `item_given`, `agent.inventory_changed` | Gegenstände und Inventar |
| `world.object_created` / `object_changed` / `object_removed` / `object_discovered`, `world.tile_changed` | Weltänderungen |
| `world.resource_changed` | Quelle gesammelt, verbraucht oder nachgewachsen |
| `world.weather_changed`, `world.phase_changed`, `world.day_started` | Zeit und Wetter |
| `simulation.parameter_changed` | Weltregeln geändert |
| `world.tile_type_added`, `world.tiles_changed`, `world.map_extended`, `world.location_added`, `world.location_updated`, `world.agent_added`, `world.resource_added`, `world.links_added`, `world.look_changed`, `world.patch_applied` | Erweiterungen der Welt (siehe `welt-erweitern.md`) |

### Wissen und Sichtbarkeit
`WorldObject.hidden` + `known_by`: Verborgene Objekte sind nur für die Agenten in `known_by` sichtbar (`visible_to(agent_id)`). Aktionen lehnen unbekannte Objekte mit `invalid_target` ab. **Die Wahrnehmung für Prompts (AP02) muss `objects_at()` immer über `visible_to` filtern.** Entdeckt wird beim `inspect` eines Objekts am selben Ort im Umkreis von 3 Kacheln.

### Datenbank (`backend/simulacra/db/migrations/001_init.sql`)
Tabellen: `meta`, `tile_types`, `tiles`, `locations`, `objects`, `resources`, `agents_body`, `inventory`, `clock`, `weather`, `events`, `action_log`. SQLite im WAL-Modus, Schema-Version in `PRAGMA user_version`, Migrationen als nummerierte Dateien, die beim Öffnen automatisch angewendet werden. Eine Schreibverbindung (Sperre plus Ein-Thread-Warteschlange `Database.write/run`), Leser über `Database.reader()`.

### Startwelt-Datei (`backend/simulacra/data/world_default.json`, Schema 1)
`size` `[64,40]`, `home`, `tile_types` (Kachelart → `char`, `walkable`, `cost`, `color`, `label`), `tiles` (40 Zeilen à 64 Zeichen), `locations` (`id`, `name`, `rect` `[x,y,b,h]`, `entrances`, `extra_tiles`, `props`; der erste passende Eintrag gewinnt, `props.fallback` gilt für alle übrigen Kacheln), `objects` (`id`, `kind`, `name`, `tile`, `state`, `portable`, `owner`, `hidden`), `resource_nodes` (dazu optional `label`, Name im Bild und in den Optionen, und `regen_weather`, z. B. `"rain,storm"`: wächst nur bei diesem Wetter nach; Migration `010_dinge.sql`), `agents`, `start`. Bauvorlagen: `blueprints.json`. Neue Objektarten nur in `world/object_kinds.py` ergänzen. Ausführlich: [welt-erweitern.md](welt-erweitern.md).

### Entwicklungswerkzeug
```bash
cd backend
.venv/bin/python -m simulacra.cli world init                 # data/live.db anlegen (überschreibt nie)
.venv/bin/python -m simulacra.cli world act alex move_to target=lake
.venv/bin/python -m simulacra.cli world show | map | events --type agent.dialogue | log alex | tick 30
```

## Agenten und Simulation (AP02)

Ausführlich: [agenten.md](agenten.md). Python-Schnittstelle:

```python
sim = Simulation.create(settings, "data/live.db")          # Engine, Agenten, Modell, Schleife; Datenbank wird angelegt oder geladen
sim.engine.bus.listeners.append(lambda events: ...)        # alle Ereignisse, erst nach dem Commit (siehe Event-Bus unten)
sim.runner.decision_listeners.append(lambda decision, result: ...)
await sim.runner.start(ticks=None) / pause() / resume() / step(n) / stop() / wait_finished()
sim.runner.set_speed(tick_delay_s);  sim.runner.limiter.configure(min_gap_s=..., max_per_minute=...)
await sim.reset()                                          # alte Datenbank wird unter data/backups/ gesichert, nie gelöscht
sim.runner.stats.summary();  sim.client.metrics.summary()  # Entscheidungen/min, Gültigkeitsquote; Antwortzeit, Tokens/s, Fehler
sim.store.decisions("alex");  sim.store.recent_observations("alex", 10)
```

Zustände der Schleife: `stopped`, `running`, `paused`, `stepping`. Agenten mit einem Profil in `agent_profiles` werden von der KI gesteuert; alle anderen Körper bleiben unberührt (Grundlage für Mitspieler).

### Neue Ereignistypen
| Typ | Wann |
|---|---|
| `agent.decision_failed` | Antwort des Modells unbrauchbar oder Modell nicht erreichbar: Rückfall auf `wait 10` (`reason`, `attempts`) |
| `agent.conversation_started` / `agent.conversation_ended` | Gespräch beginnt mit dem ersten Beitrag / endet (`reason`: max_turns, timeout, left, repetition, farewell) |
| `agent.proposal_accepted` / `agent.proposal_declined` | Antwort auf einen Vorschlag |
| `simulation.started` / `paused` / `resumed` / `stopped` | Steuerbefehle |

### Neue Tabellen (`003_agents.sql`)
`agent_profiles` (Profil und Persönlichkeit als JSON), `agent_runtime` (Status, Vorhaben, zuletzt gesehen), `observations` (Beobachtungen je Agent, nie gelöscht), `conversations` (Beiträge, Vorschlag, Beendigung), `decisions` (angebotene Optionen mit Punkten und Faktoren, Wahl, Ergebnis, Latenz, Tokens, Fehler).

### Entscheidungsschema (Modellantwort)
`{"option_id": "o3" | "other", "intent": "…", "utterance": "…", "importance": 1-10, "plan_next": "…", "proposal": "…", "other_action": "move_to|wait|…", "other_params": {…}}`. Pflicht sind `option_id`, `intent`, `utterance`, `importance`; die Engine prüft jede Handlung.

## Ereignisse, REST und WebSocket (AP03)

### Ereignisschema (`events/schema.py`, `GET /api/events`)
```json
{"id": "evt_01M4MR58SE0ZX51JD1XHJ9E51X", "seq": 1842, "ts": "2026-10-11T05:49:49.741+00:00",
 "sim_time": {"day": 1, "minute": 522, "total": 522}, "type": "agent.walking", "category": "world",
 "agents": ["alex"], "location": "garden", "data": {"from": [30, 7], "path": [[31, 7], [32, 7], [32, 8]], "arrive": [522, 523, 525], "label": "Teich", "reason": "start"},
 "caused_by": "evt_01M4…", "visibility": "public"}
```
- `id`: ULID mit Präfix, weltweit eindeutig. `seq`: fortlaufend und **lückenlos** je Datenbank (ein Zurückrollen vergibt keine Nummer).
- `sim_time.minute` ist die Minute des Tages, `total` die Zeit seit Beginn.
- `category`: `world` (Weltaktionen), `dialogue`, `planning` (interne Entscheidungen), `memory` (ab AP05), `system`.
- `visibility`: `public`, `agents:alex,mira` oder `system`. Beschreibt, wer es *in der Simulation* wahrnimmt (Grundlage für Wissensgrenzen); der Beobachter im Browser sieht alles.
- `caused_by`: auslösendes Ereignis. Kette: `agent.decision` → `agent.action_started` → alle Folgeereignisse (Schritte, Ergebnisse, `agent.action_completed`).
- Jeder Typ hat ein Pydantic-Datenmodell (`events/models.py`) und einen Eintrag in der Registry (`events/types.py`); in den Tests wird **jedes** erzeugte Ereignis gegen sein Modell geprüft. Typen in `PLANNED_EVENT_TYPES` werden noch nicht erzeugt.

Abweichungen von der ersten Fassung im Arbeitspaket: `agent.dialogue` trägt (noch) keine Gespräch-ID, die steht in `agent.conversation_started/_ended`; `simulation.stepped` entsteht je `step`-Aufruf (nicht je Tick).

**Bewegung als Fahrplan (AP11, offene Frage 13):** Ein Weg erzeugt ein `agent.walking` mit dem restlichen Pfad und der Sim-Minute, zu der jede Kachel erreicht wird (`arrive`). Die Engine bewegt den Körper weiter Kachel für Kachel und hält sich exakt an diesen Fahrplan (Test `tests/world/test_walking.py` prüft jede Minute). Ein neuer Fahrplan kommt nur, wenn sich etwas ändert: `reason` = `replan` (Weg versperrt, neue Route) oder `tempo` (Wetter oder Kachelkosten anders). Ende: `agent.arrived` (`at`), `agent.action_interrupted` oder `agent.action_failed` (beide mit `at`, der genauen Kachel). Der Snapshot enthält für laufende Wege `walk` (`path`, `arrive` ab der aktuellen Kachel). Die Ereignismenge wächst so mit der Zahl der Wege, nicht der Schritte (vorher je Kachel ein `agent.moved`, rund die Hälfte aller Ereignisse).

### Event-Bus (`events/bus.py`)
Ein Ereignis wird in derselben Transaktion gespeichert wie die Änderung. Verteilt wird erst **nach dem Commit** (`Database.on_commit`); bei Rollback weder gespeichert noch verteilt. Synchrone Rückrufe über `engine.bus.listeners`; Verbindungen über `engine.bus.subscribe(max_backlog)` (eine Warteschlange je Verbindung; läuft sie über, wird sie geleert und meldet `OVERFLOW` statt unbegrenzt Speicher zu belegen).

### REST (`/api`)
| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/api/state` | Snapshot: Karte (Zeichenzeilen + Legende), Kachelarten, Orte, Objekte, Quellen, Agenten (Körper, Bedürfnisse in Zahlen und Worten, Aktion, Status, Inventar), Uhr, Wetter, Simulationsstatus mit Messwerten, Regeln, `seq`, Übergänge `links` (Kachelpaare, z. B. Haustür ↔ Innenbereich) und Darstellung `look` (Mockup A, sonst `null`) |
| GET | `/api/events?after_seq=&before_seq=&type=&type_prefix=&agent=&category=&location=&limit=&order=` | Verlauf mit Filtern (Standard 200, höchstens 1000) |
| GET | `/api/events/{id}` | Einzelereignis per `evt_…` oder Sequenznummer mit `chain` (Ursachen) und `consequences` |
| GET | `/api/agents/{id}` | Detail: Profil, Persönlichkeit, Stimmung, letzte Entscheidungen mit Optionen, Beobachtungen, Gespräch |
| GET | `/api/locations/{id}` | Ort mit Objekten, Quellen, Anwesenden und jüngsten Ereignissen |
| POST | `/api/sim/start` (`{"ticks"?}`) · `/pause` · `/resume` · `/step` (`{"n": 1-50}`) | Steuerung; `step` nur pausiert oder gestoppt (sonst 409) |
| POST | `/api/sim/reset` (`{"confirm": true}`) | Zurücksetzen; ohne Bestätigung 400; die alte Welt wird unter `data/backups/` gesichert |
| POST | `/api/sim/speed` (`{"level": "slow|normal|fast|max"}` oder `{"tick_delay_s"}`) | Geschwindigkeit: 3 s / 1 s / 0,2 s / 0 pro Tick |
| GET | `/api/health` | wie AP00, zusätzlich Simulationsstatus |

Eingaben sind durch Pydantic und Längen-/Wertgrenzen geprüft (422 bei Verstoß).

### Idempotenz
Alle verändernden Anfragen brauchen den Header `Idempotency-Key` (8–128 Zeichen, z. B. UUID); sonst 400. Derselbe Schlüssel mit demselben Inhalt liefert die gespeicherte Antwort (Header `Idempotent-Replay: true`) ohne zweite Ausführung, auch bei gleichzeitigem Eintreffen. Anderer Inhalt oder Pfad: 409. Antworten werden 24 Stunden gehalten (Tabelle `idempotency`). Fehler werden nicht gespeichert, ein Wiederholen mit demselben Schlüssel ist dann möglich.

### WebSocket `/ws`
1. Client → `{"type":"hello","last_seq": 1840 | null}`.
2. Server → `{"type":"snapshot","seq":…,"state":…}`, wenn `last_seq` fehlt, größer als der Stand ist (andere Welt) oder mehr als `SIM_WS_MAX_GAP` (5000) zurückliegt; sonst `{"type":"events","items":[…]}` mit genau den verpassten Ereignissen.
3. Danach `{"type":"event","event":{…}}` je Ereignis. Der Server abonniert **vor** dem Lesen des Rückstands und verwirft Doppeltes, daher geht nichts verloren und nichts kommt zweimal.
4. Uhrtakt: `{"type":"clock","minute":…}` nach jedem Simulationsschritt, höchstens zehnmal je Sekunde und Verbindung (ältere, noch nicht gesendete Takte entfallen). Nicht gespeichert, ohne `seq`, nicht Teil der Lückenprüfung. Die Oberfläche stellt damit Uhr und laufende Wege vor. Nach einem Snapshot wird ein noch ausstehender Takt verworfen.
5. Heartbeat: alle `SIM_WS_PING_S` (15 s) `{"type":"ping"}`, im festen Takt auch bei Dauerverkehr; der Client antwortet `{"type":"pong"}`; bleibt eine Antwort länger als zwei Takte aus, schließt der Server mit Code 4008.
6. Lücke bemerkt oder `{"type":"resync_required"}` empfangen → Client sendet `{"type":"resync","last_seq":…}` und bekommt Nachlieferung oder Snapshot.
7. Nach `simulation.reset` bekommen alle Verbindungen automatisch einen frischen Snapshot.
Erste Nachricht ungleich `hello` oder ungültiges JSON: Schließen mit Code 4400. Die Simulation läuft unabhängig von Verbindungen weiter.

Testclient: `backend/.venv/bin/python scripts/ws_tail.py --reconnect` (liest mit, prüft die Lückenlosigkeit, verbindet nach Abbruch mit der letzten `seq` neu).

### Typen für das Frontend
`scripts/gen_types.sh` erzeugt `frontend/src/types/schema.json` und `generated.ts` aus den Pydantic-Modellen (`api/schema_export.py`, `json-schema-to-typescript`); `--check` schlägt bei veralteten Dateien fehl. `generated.ts` enthält auch `EventDataMap` (Ereignistyp → Datentyp) und `EVENT_CATEGORY`. Ein Test prüft Aktualität und dass jeder Ereignistyp ein Datenmodell und einen TypeScript-Typ hat.


## Gedächtnis (AP05)

### REST
| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/api/agents/{id}/memories?kind=&status=&q=&person=&location=&sort=&limit=&cursor=` | Liste (`sort`: `time`, `importance`, `access`; `limit` ≤ 200; `cursor` = Versatz, aus `next_cursor`) |
| GET | `/api/agents/{id}/memories/{mid}` | Einzelerinnerung mit Quellerinnerungen, davon abgeleiteten Einsichten/Rückblicken, Quellereignis und Abrufhistorie |
| GET | `/api/agents/{id}/knowledge` | Orte (Besuche), Gegenstände (zuletzt gesehener Zustand), Personen (zuletzt gesehen, Zahl der Erinnerungen) |
| GET | `/api/agents/{id}/retrievals?limit=` | jüngste Abrufe mit Teilpunkten und Entscheidung |
| GET | `/api/agents/{id}/memory-stats` | aktive und archivierte Zahlen, Wichtigkeitssumme seit der letzten Reflexion |

Alle nur lesend; unbekannter Agent 404, ungültige Filter 422. Ein Agent kann nie die Erinnerungen eines anderen lesen (`GET …/mira/memories/{id-von-alex}` → 404).

### Ereignisse (Kategorie `memory`, Sichtbarkeit `system`)
`agent.memory_created` (Erinnerung, Art, Wichtigkeit, Quellen), `agent.memory_retrieved` (Abruf-ID, Erinnerungen mit Punkten und Text, Tokens, Suchbegriffe), `agent.memory_skipped` (nur Debug und verworfene Reflexionen), `agent.memory_archived`. Siehe [gedaechtnis.md](gedaechtnis.md).


## Autonomie (AP06)

### REST (nur lesend)
| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/api/overview` | je Agent aktives Ziel, langfristige Ziele, Stimmung (Wert, Wort, Beiträge), Bedürfnisse (Dringlichkeit 0–100, kritisch), Ruhemodus |
| GET | `/api/agents/{id}/goals?state=&limit=` | Ziele mit Bedingung, Plan, Planschritt, Fortschritt, Fehlschlägen, Grund |
| GET | `/api/agents/{id}/needs` | Bedürfnisse und Stimmung |
| GET | `/api/agents/{id}/relations` | je anderem Agenten Werte, gemeinsame Erlebnisse, offene Konflikte, jüngste Änderungen mit Grund |
| GET | `/api/agents/{id}/failures?limit=` | Historie fehlgeschlagener Aktionen |
| GET | `/api/agents/{id}/decisions?limit=` | Entscheidungen mit Optionen, Faktoren, Erklärung, Platz, Ziel, Ergebnis |
| GET | `/api/decisions/{id}` | eine Entscheidung |
| GET | `/api/factors` | Faktorname → Gruppe, Gruppen mit Klartext |

### Ereignisse
`agent.goal_changed` (Ziel-ID, Art, Text, alt/neu, Grund, Fortschritt, ersetztes Ziel; Kategorie *planning*), `agent.relation_changed` (Gegenüber, Änderungen, neue Werte, Grund, Quelle `rule`/`reflection`; Sichtbarkeit `system`), `agent.guard_triggered` (Schutz, Einzelheit, gesperrter Schlüssel, bis). `agent.decision` trägt zusätzlich `why`, `rank`, `goal`, `retrieval_id`. Siehe [autonomie.md](autonomie.md).

## Parameter, Presets und Status (AP07)

Alle Regler stehen in der **Parameter-Registry** (`backend/simulacra/params/`, 73 Einträge, beschrieben in [parameter.md](parameter.md)). Jeder Eintrag kennt Bereich, Schritt, Standard, Wirkungsart (`immediate` | `next_decision` | `restart_model`), den **Verbraucher** (`read` liest den Wert dort, wo er wirkt) und seinen **Wirkungstest**. Werte außerhalb des Bereichs werden mit Grund **abgelehnt**, nie begrenzt. Abweichungen vom Standard liegen in SQLite (Tabelle `params`), werden beim Start wieder angewendet und überstehen das Zurücksetzen der Welt.

### REST
| Methode und Pfad | Zweck |
|---|---|
| `GET /api/params/schema` | Gruppen und alle Reglerbeschreibungen (die Oberfläche baut sich daraus) |
| `GET /api/params` | aktuelle Werte **vom Verbraucher gelesen** (global: Wert, je Agent: `{agent: Wert}`), Standardwerte, abweichende Schlüssel |
| `PATCH /api/params` | `{changes: [{key, value, agent?}]}`; Antwort je Änderung `status` (`applied` / `pending_next_decision` / `requires_model_restart` / `rejected` + `reason`), alter und neuer Wert; abgelehnte stören die übrigen nicht |
| `POST /api/params/reset` | `{keys?, group?, agent?}` zurück auf Standard (einzeln, je Gruppe, alles) |
| `GET /api/presets`, `GET /api/presets/{id}` | mitgelieferte (6, schreibgeschützt) und eigene Presets |
| `GET /api/presets/{id}/preview` | was sich beim Laden ändern würde: Einstellung, alter und neuer Wert |
| `POST /api/presets/{id}/load` | `{confirm: true}` lädt über denselben Weg wie `PATCH` |
| `POST /api/presets` | `{name, description, groups?}` speichert den aktuellen Stand (Adresse und Modell nie) |
| `POST /api/presets/{id}/duplicate`, `PATCH /api/presets/{id}`, `DELETE /api/presets/{id}?confirm=true` | duplizieren, umbenennen, löschen (Namen eindeutig, mitgelieferte unveränderlich) |
| `GET /api/status` | Modell (erreichbar, Ø Antwortzeit, Token/s, Fehler 15 Min., Warteschlange) und Last (Entscheidungen/Min., Simulationsminuten/Min., Aktionen gelungen/gescheitert) |
| `POST /api/sim/speed` | Stufen `0.5x`, `1x`, `2x`, `4x`, `max` (Pause 2,0 / 1,0 / 0,5 / 0,25 / 0 s) oder `tick_delay_s` |
| `POST /api/sim/reset` | zusätzlich `model` für die neue Simulation (das Modell ist je Lauf fest) |

Verändernde Aufrufe brauchen den `Idempotency-Key`. Ereignis `simulation.parameter_changed` mit `key`, `agent`, `old`, `new`, `status` (und `group`); beim Tempo zusätzlich `simulation.speed_changed`.

### Tabellen (`007_params.sql`)
`params(key, agent_id, value JSON, updated)` und `presets(id, name UNIQUE, description, data JSON, created, updated)`.

### Beobachtungsmodi (`agents/modes.py`)
`observer` (Standard: die Agenten erfahren nichts), `creator` (editierbarer Abschnitt über eine äußere Instanz am Ende des Systemprompts), `intervention` (vorerst wie Beobachter; direkte Nachrichten kommen mit AP08). Ein Wechsel gilt ab der nächsten Entscheidung und ändert keine Erinnerungen.

## Freie Ereigniseingabe (AP08)
Ausführlich in [ereignisse.md](ereignisse.md). Verändernde Aufrufe brauchen den `Idempotency-Key`.

| Methode und Pfad | Zweck |
|---|---|
| `POST /api/inject/parse` | `{text, agents?, at?}` → Vorschlag; `{answer_to, answer}` beantwortet eine Rückfrage. Ändert die Welt nicht. Antwort: `status` (`needs_clarification` / `ready` / `needs_confirmation` / `rejected`), `ops`, `preview` (Klartext), `clarification` {question, options, free_text}, `reason`, `source` (`rule`/`llm`) |
| `POST /api/inject/confirm` | `{proposal_id}` führt aus (noch einmal gegen die aktuelle Welt geprüft) → `executed` mit `event_seqs` oder `rejected` mit Grund |
| `GET /api/inject/history` | eigene Eingaben mit Status |
| `GET /api/scheduled`, `DELETE /api/scheduled/{id}` | geplante Ereignisse ansehen und absagen |

Fehler: 422 (leer, zu lang), 429 (mehr als 10 je Minute), 404/409 (unbekannte oder schon ausgeführte Eingabe).
Neue Ereignistypen: `simulation.event_injected` (Text, Quelle, Modus, `directive`, Zusammenfassung), `simulation.event_scheduled`, `simulation.event_fired`, `simulation.effect_ended`, `agent.informed` (nur für den Empfänger sichtbar), `world.npc_acted`. Tabellen (`008_user_events.sql`): `inject_log`, `scheduled_events`, `npcs`.

## Spielstände, Statistik und Verlauf (AP09)
Ausführlich in [spielstaende.md](spielstaende.md). Verändernde Aufrufe brauchen den `Idempotency-Key`.

| Methode und Pfad | Zweck |
|---|---|
| `GET /api/saves` | alle Stände (manuell, auto, Sicherung, Import) mit Sim-Zeit, Größe, Modell |
| `POST /api/saves` | `{name, description, overwrite}` speichern; gleicher Name ohne `overwrite`: 409 |
| `POST /api/saves/{id}/load` | `{confirm: true}`; sichert vorher „Vor dem Laden“, alle Browser bekommen einen Snapshot |
| `DELETE /api/saves/{id}?confirm=true` | löschen |
| `GET /api/saves/{id}/export` | ZIP (`state.db`, `manifest.json`) |
| `POST /api/saves/import` | ZIP als Anfragekörper (`Content-Type: application/zip`), legt einen neuen Stand an; Fehler 422 mit Grund |
| `POST /api/sim/reset` | `{confirm, model?, keep_profiles?}`; sichert vorher „Vor dem Zurücksetzen“ |
| `GET /api/stats?agent=&from_minute=&to_minute=` | Statistiken je Agent und gesamt |
| `GET /api/events/export?format=csv\|json&…` | Verlauf mit den Filtern der Liste (`type_prefix`, `agent`, `category`, `location`, `from_minute`, `to_minute`, `q`) |

Neue Ereignistypen: `simulation.saved`, `simulation.loaded`. Tabellen: `stats_samples` (`009_stats.sql`); die Stände selbst liegen in `data/saves/`.

## Zugangsschutz und Oberfläche (AP10)

Nur mit gesetztem `SIM_ACCESS_TOKEN`. Ohne Token verhalten sich alle Pfade wie bisher.

| Pfad | Zweck |
|---|---|
| `GET /api/auth/status` | `{required, authenticated}` (immer frei); die Oberfläche fragt das beim Start |
| `POST /api/auth/login` | `{token}` → Cookie `sim_access` (HttpOnly, SameSite=Strict, 30 Tage; enthält nur den SHA-256 des Tokens). Falsches Token: 401, nach 10 Fehlversuchen in einer Minute 429 |
| `POST /api/auth/logout` | löscht das Cookie |

Mit Schutz antworten `/api/*` (außer `/api/health` und `/api/auth/*`) ohne Cookie mit **401** `{"detail": "Anmeldung erforderlich."}`, `/ws` schließt mit Code **4401**. Skripte können stattdessen `Authorization: Bearer <token>` senden. Ist `SIM_STATIC_DIR` gesetzt, liefert das Backend alle übrigen Pfade als Oberfläche aus (unbekannte Pfade fallen auf `index.html` zurück, `/api/*` bleibt 404).

