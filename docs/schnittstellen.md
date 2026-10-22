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
| `simulation.voice_changed` | Stimme einer Figur eingestellt oder zurückgesetzt (`agent`, `voice` oder `null`); Kategorie `system`, ohne Agenten in `agents`, damit kein Bewohner davon erfährt |
| `world.tile_type_added`, `world.tiles_changed`, `world.map_extended`, `world.location_added`, `world.location_updated`, `world.agent_added`, `world.resource_added`, `world.links_added`, `world.look_changed`, `world.patch_applied`, `world.look_edited`, `world.location_removed`, `world.resource_removed`, `world.links_removed` | Erweiterungen und Änderungen der Welt (siehe `welt-erweitern.md`; die letzten vier AP16a: Gestalten). `world.edited` (Kategorie system) meldet einen übernommenen Entwurf nur im Protokoll (siehe `welt-erweitern.md`) |

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
| GET | `/api/state` | Snapshot: Karte (Zeichenzeilen + Legende), Kachelarten, Orte, Objekte, Quellen, Agenten (Körper, Bedürfnisse in Zahlen und Worten, Aktion, Status, Inventar), Uhr, Wetter, Simulationsstatus mit Messwerten, Regeln, `seq`, Übergänge `links` (Kachelpaare, z. B. Haustür ↔ Innenbereich), Darstellung `look` (Mockup A, sonst `null`) und eigene Stimmen der Figuren `voices` (Kennung → Stimme; fehlt eine, nimmt der Browser den Vorschlag aus Geschlecht und Alter) |
| GET | `/api/events?after_seq=&before_seq=&type=&type_prefix=&agent=&category=&location=&limit=&order=` | Verlauf mit Filtern (Standard 200, höchstens 1000) |
| GET | `/api/events/{id}` | Einzelereignis per `evt_…` oder Sequenznummer mit `chain` (Ursachen) und `consequences` |
| GET | `/api/agents/{id}` | Detail: Profil, Persönlichkeit, Stimmung, letzte Entscheidungen mit Optionen, Beobachtungen, Gespräch |
| PUT | `/api/agents/{id}/voice` (`{"voice": {base, timbre, speed, size, lively, breath, vib, style} \| null}`) | Stimme einer Figur fürs Plappern (AP17d): Grundton 60–400 Hz, Klangfarbe `weich\|klar\|rau\|hohl\|piepsig`, Art `plappern\|summen\|piepsen`; `null` setzt auf den Vorschlag zurück. Gespeichert in der Welt (`meta.voices`), wandert mit Spielstand, Export und Import, bleibt beim Zurücksetzen nur mit „Bewohner behalten“. Meldet `simulation.voice_changed`. Reine Darstellung: kein Prompt, keine Beobachtung. 404 bei unbekannter Figur, 422 bei Werten außerhalb der Grenzen |
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

## Weltgenerator in der Leitstelle (AP12c)
Beschreibung des Generators: [generator.md](generator.md). Die Vorschau ändert nichts und braucht keinen `Idempotency-Key`; Anwenden braucht ihn.

| Methode und Pfad | Zweck |
|---|---|
| `POST /api/world/generate` | Wunsch `{kind: "extend"\|"new", seed, lake: "auto"\|"east"\|"south", mix?: {house, shop, workshop, barn, stable}}` (1 bis 10 Gebäude, höchstens 6 je Art; sonst 422). **Trockenlauf:** erzeugt das Dorf, prüft es und wendet es in einer Transaktion an, die zurückgerollt wird. Antwort `GeneratePreview`: `ok`, `error`, `report` (Prüfbericht des Generators mit allen Einzelprüfungen), `digest` (Prüfsumme des Patches beziehungsweise der Weltdatei), `village`, `seed` (der Seed, der die Prüfung bestand), `focus` (Dorfplatz als Kachel), `region` (neues Gebiet in `look`), `counts`, `snapshot` (die Welt, wie sie danach aussähe, im Format von `GET /api/state`; bei `new` die Welt einer Wegwerf-Simulation im Speicher). |
| `POST /api/world/generate/apply` | derselbe Wunsch plus `digest` aus der Vorschau, `confirm: true`, bei `new` `keep_profiles?`. Erzeugt neu, vergleicht die Prüfsumme (andere Welt seit der Vorschau: 409), sichert („Vor dem Erweitern“ beziehungsweise „Vor der neuen Simulation“), wendet an und emittiert `world.generated`. Ohne `confirm` 400. Antwort `GenerateApplied`: `village`, `seed`, `patch`, `backup`, `counts`, `focus`. Eine laufende Simulation wird kurz angehalten und läuft danach weiter; nach `new` bleibt die neue Simulation angehalten. |
| `POST /api/world/patch/preview` | `{patch}`: Trockenlauf für **jeden** Welt-Patch (Format: [welt-erweitern.md](welt-erweitern.md)), z. B. eine Einzeländerung. Antwort `ok`, `error` (Code und Text der Engine), `counts`, `snapshot`. Die Welt bleibt unverändert, auch Ereignisnummern und Patch-Liste. |
| `POST /api/world/draft/preview` | Gestalten im Spiel (nur Gott, sonst 403): `{actions: [{art: weg\|see\|garten\|haus\|deko\|loeschen\|karte, …}]}`. Rechnet den Entwurf auf dem Zustand und wendet den Patch im Trockenlauf an: `{ok, error, digest, stati: [{ok, grund, ort}], meldungen: [{stufe: ok\|hinweis\|fehler, text, ort}], fehler, hinweise, counts, snapshot}`. Ändert nichts. Aktionen siehe [generator.md](generator.md#gestalten-aktionen-auf-einer-weltdatei-ap16a) |
| `POST /api/world/draft/apply` | derselbe Entwurf plus `digest` aus der Vorschau, `confirm: true`; braucht `Idempotency-Key`. Rechnet neu, vergleicht die Prüfsumme (409 bei Abweichung), lehnt abgelehnte Aktionen und ✗ ab (422), sichert („Vor dem Gestalten“), pausiert die Simulation kurz und wendet den Patch an (`world.edited`): `{patch, backup, counts, actions}` |
| `POST /api/worlds/draft` | Werkstatt, zustandslos: `{world, actions, snapshot?}` → `{ok, spielbar, digest, stati, meldungen, fehler, hinweise, world, snapshot}`. `spielbar` = kein ✗ („Damit spielen“); Speichern geht immer. `snapshot: true` liefert den Zustandsabzug der neuen Datei (Wegwerf-Simulation, zwischengespeichert) |
| `GET /api/gestalten/katalog` | Was sich setzen lässt: Deko und Dinge, Gebäudearten, Dach- und Wandfarben, Grenzen für „Karte erweitern“ |

Neuer Ereignistyp: `world.generated` (Kategorie Welt): `kind`, `seed`, `requested_seed`, `village`, `patch`, `summary` (Zähler). Fehler: 422 (Wunsch ungültig oder kein gültiges Dorf nach 8 Versuchen, mit Prüfbericht in der Vorschau), 409 (Welt hat sich geändert, Patch von der Engine abgelehnt).

## Neue Simulation nach Maß und Vorlagen (AP17b)
Router `api/routes_newsim.py`, Modelle `api/models_newsim.py`, Logik `simulation/newsim.py`, Profilmaske und Grenzen `agents/schema.py`, Vorlagenspeicher `agents/templates.py`.

| Route | Wirkung |
|---|---|
| `GET /api/templates`, `GET /api/templates/{id}` | Vorlagen: die sechs mitgelieferten (`alex`, `mira`, `hanne`, `jonas`, `rosa`, `kim`, schreibgeschützt) und eigene (`eigene-<name>`, Dateien in `data/vorlagen/`). |
| `POST /api/templates`, `PUT /api/templates/{id}`, `DELETE`, `POST /{id}/duplicate` | Eigene Vorlagen anlegen, ändern, löschen, duplizieren. Mitgelieferte: 403. Jeder Verstoß gegen die Grenzen: 422, alle Meldungen im Text (je Zeile eine). |
| `GET /api/templates/{id}/export` | Datei `{format: "simulacra-vorlage", version: 1, profile, personality}` zum Herunterladen. Die Stimme gehört nicht dazu. |
| `POST /api/templates/import` | Anfragekörper ist die Datei. Legt **immer eine neue** Vorlage an, nie über eine bestehende. Prüft Größe (413 über 20 KB), JSON, Format, Version (höchstens 1), alle Felder und Grenzen; **alle** Fehler kommen auf einmal (422). Antwort `{template, warnings}`, die Warnungen der Wortprüfung. |
| `GET /api/sim/new/limits` | `max_residents` (8), `seconds_per_decision` (4,5), `max_per_house` (2). |
| `POST /api/sim/new/preview` | Entwurf `{world: {kind: "start"\|"generated", seed, lake, houses?, mix?}, residents: [{template?, profile, personality, home?, known?, voice?}], relations: [{a, b, trust, sympathy, tension, familiarity}], stories: [{a, b, text}], run}`. Prüft alles (Fehler in `errors`, Hinweise in `warnings`), erzeugt die Welt und zeigt sie wie `/api/world/generate` im Trockenlauf (`snapshot`, `digest`, `report`); dazu `residents` (vergebene Kennungen) und `houses` (Name und Zahl der Betten). Ändert nichts. |
| `POST /api/sim/new` | derselbe Entwurf plus `digest`, `confirm: true`, Idempotency-Key. Sichert die alte Welt („Vor der neuen Simulation“), legt Welt, Profile (mit bekannten Orten), Beziehungsstartwerte, Vorgeschichten (Erinnerung Art Fakt bei beiden) und Stimmen an. Die Simulation bleibt angehalten (`state: "stopped"`) oder läuft (`run: "running"`). |

Bewohner-Kennung: Name klein ohne Umlaute (`jörg` → `joerg`), eindeutig mit Zahl; in der Startwelt nur `alex` und `mira` (Zimmer fest). Beziehungs- und Vorgeschichtenindizes zählen ab 0 in `residents`.
Neues Weltereignis: `world.object_changed` mit `change: "claimed"` (ein Bett gehört nun dem, der sich hineinlegte, siehe [agenten.md](agenten.md)).

## Zugangsschutz und Oberfläche (AP10)

Nur mit gesetztem `SIM_ACCESS_TOKEN`. Ohne Token verhalten sich alle Pfade wie bisher.

| Pfad | Zweck |
|---|---|
| `GET /api/auth/status` | `{required, authenticated}` (immer frei); die Oberfläche fragt das beim Start |
| `POST /api/auth/login` | `{token}` → Cookie `sim_access` (HttpOnly, SameSite=Strict, 30 Tage; enthält nur den SHA-256 des Tokens). Falsches Token: 401, nach 10 Fehlversuchen in einer Minute 429 |
| `POST /api/auth/logout` | löscht das Cookie |

Mit Schutz antworten `/api/*` (außer `/api/health` und `/api/auth/*`) ohne Cookie mit **401** `{"detail": "Anmeldung erforderlich."}`, `/ws` schließt mit Code **4401**. Skripte können stattdessen `Authorization: Bearer <token>` senden. Ist `SIM_STATIC_DIR` gesetzt, liefert das Backend alle übrigen Pfade als Oberfläche aus (unbekannte Pfade fallen auf `index.html` zurück, `/api/*` bleibt 404).


## Hardware und Modellkatalog (AP17c-2)
Nur lesend; Download, Laufzeit und Probelauf stehen im nächsten Abschnitt. Code: `backend/simulacra/models/` (Kern ohne Zusatzpakete), Antwortmodelle `api/models_llm.py`, Routen `api/routes_models.py`. Typen: `HardwareOut`, `CatalogOut` in `frontend/src/types/`.

| Aufruf | Zweck |
|---|---|
| `GET /api/hardware` | erkannter Rechner: `kind` (`nvidia`, `metal`, `amd`, `vulkan`, `cpu`), `name`, `vram_mb`, `vram_free_mb` (**frei**, nicht gesamt), `ram_mb`, `free_disk_mb` (im Datenordner), `os`, `arch`, `cuda_version`, `gpu_count`, `gpu_names`, `usable_mb` (Speicher für ein Modell), `bandwidth_gbs` und `bandwidth_known`, `summary` (eine Zeile für den Kopf) |
| `GET /api/models/catalog?q=&only_fit=&publishers=&refresh=&limit=` | Modelle für diesen Rechner. `q` Suche (auch live bei Hugging Face), `only_fit=true` ohne „zu groß“, `publishers=trusted` (Standard: Positivliste in `models.json`) oder `all`, `refresh=true` umgeht den 6-Stunden-Zwischenspeicher, `limit` 1–200 (Standard 50). Falsche Werte: 422 |

Antwort von `/api/models/catalog`: `hardware`, `source` (`live`, `cache`, `stale` = Hugging Face nicht erreichbar, älterer Zwischenspeicher, `curated` = nur die kuratierte Liste), `fetched_at` (UTC, älteste verwendete Antwort), `note` (Hinweis bei `stale`/`curated`), `hidden` (ausgeblendete Treffer nach Grund), `total`, `recommended` (bis zu 3), `items`. Netzfehler sind **kein** Serverfehler: die Antwort ist 200 mit `source: "curated"`.

Ein Eintrag (`CatalogItemOut`): `repo`, `name`, `publisher`, `license` (oder `null`), `source` (`curated`/`live`), `curated_key`, `moe`, `multimodal`, `uncensored` (nur Hinweis), `gated` und `downloadable` (gesperrte Modelle sind gekennzeichnet, nicht angeboten), `params_b`, `active_b`, `downloads`, `likes`, `updated`, `url`, `file` (Standarddatei) und `variants` (alle Dateien Q4–Q8). Eine Datei (`VariantOut`): `file`, `quant`, `size_mb`, `sha256` (aus `lfs.oid`, bei gesperrten Modellen `null`), `fit` (`level` `good`/`ok`/`tight`/`no`, `label`, `need_mb`, `ratio`), `estimate` (`tokens_per_s`, `seconds_per_decision`, `is_estimate` immer `true`).

**Passung** (`models/fit.py`, dieselbe Rechnung wie `install.sh` über `python -m simulacra.models`): nötig = Dateigröße + KV-Cache für Kontext 8192 + 300 MB Puffer; KV-Cache ≈ 120 KB + 4,5 KB je Milliarde Parameter je Token. Verhältnis zum nutzbaren Speicher: ≤ 70 % **passt gut**, ≤ 90 % **passt**, ≤ 100 % **knapp**, darüber **zu groß**. Nutzbar: NVIDIA/AMD 95 % des **freien** Grafikspeichers, Apple Silicon zwei Drittel des gemeinsamen Speichers, sonst 60 % des Arbeitsspeichers. **Zeit je Entscheidung** = 90 Token ÷ (Speicherbandbreite ÷ aktive Dateigröße × 0,7) + 1,2 s; bei MoE zählt der aktive Anteil (`A3B` im Namen). Immer eine Schätzung; die Messung kommt mit 17c-3.

**Filter** (`models/filters.py`): Textmodelle (`pipeline_tag` `text-generation`, fehlend, `image-text-to-text` oder `any-to-any`; Vision-Modelle erkennt der Name oder die Architektur, Bild-, Embedding-, OCR-Modelle fallen raus), keine Merges und Adapter, Herausgeber der Positivliste (Standard), nur Einzeldateien Q4 bis Q8 (kein mmproj, imatrix, keine geteilten Dateien). Kommandozeile: `python -m simulacra.models hardware|recommend|catalog` (`--help`).


## Modellverwaltung (AP17c-3, -4)
Code: `backend/simulacra/models/` (`service.py` verbindet alles; `transfer.py` Download-Kern, `download.py`, `llamacpp.py`, `runtime.py`, `probe.py`, `store.py`, `llmconf.py`, `hub.py`), Antwortmodelle `api/models_runtime.py`, Routen `api/routes_llm.py`. Oberfläche: Menü → Einstellungen → **Modelle** (`frontend/src/models/`). Jeder verändernde Aufruf braucht einen `Idempotency-Key` und liefert den neuen **Gesamtzustand** (`LlmStatusOut`).

| Aufruf | Zweck |
|---|---|
| `GET /api/llm` | Gesamtzustand: `mode` (`builtin`/`external`), `locked` (Adresse per `SIM_LLM_BASE_URL` festgelegt), `external_url`, `external_key_set` (der Schlüssel selbst nie), `base_url`, `sim_model`, `sim_running`, `default_model`, `runtime` (`installed`, `version`, `kind`, `state` = `stopped`/`starting`/`running`/`failed`, `model_id`, `error`, `log_tail`), `installed` (Modelle mit `running`, `is_default`, `is_sim_model`, `probe`), `transfer`, `probe` |
| `PUT /api/llm` | Betriebsart `{mode, external_url?, external_key?}`. 409 bei laufender Simulation oder fester Adresse in der Umgebung; beim Wechsel auf „external“ wird das eingebaute Modell beendet |
| `POST /api/llm/test` | Verbindungstest `{url?, key?}` → `{reachable, models, error, url}` |
| `POST /api/llm/runtime/install` | `{confirm: true}`: llama.cpp aus den GitHub-Releases (`ggml-org/llama.cpp`), Prüfsumme gegen `digest`, Probelauf `--version`, `data/runtime/llama.cpp/<Version>-<Art>/` und Verweis `current` |
| `POST /api/llm/start`, `POST /api/llm/stop` | Modell `{model_id}` im eingebauten Server starten (kehrt sofort zurück; Zustand per WebSocket) bzw. beenden. Nur bei angehaltener Simulation (409) |
| `PUT /api/llm/default` | `{model_id}`: Modell für neue Simulationen (vorgewählt in Zurücksetzen-Fenster und Assistent) |
| `POST /api/models/downloads` | `{repo, file, confirm: true}` (ohne `confirm` 400): lädt eine `.gguf`-Datei von Hugging Face. Dateiname, Größe und SHA-256 holt **das Backend** aus der Dateiliste, nie aus der Anfrage. Ein Auftrag zugleich (409). Gesperrte Modelle, fehlende Prüfsumme, Platz < Größe + 10 % (507) werden abgelehnt |
| `DELETE /api/models/downloads/current` | bricht die laufende Übertragung ab (Teildatei wird entfernt); eine beendete Meldung wird ausgeblendet |
| `DELETE /api/models/installed/{id}?confirm=true` | löscht Datei und Messergebnis (ohne `confirm` 400) |
| `POST /api/models/installed/{id}/probe`, `DELETE /api/models/probe` | Probelauf starten (startet das Modell bei Bedarf, kehrt danach zum Modell der Simulation zurück) bzw. abbrechen |

**Dateien:** `data/models/*.gguf` (Kennung = Dateiname ohne `.gguf`, zugleich der `--alias`, den der Server meldet), `installed.json` (Herkunft, SHA-256, Lizenz), `probes.json` (Messergebnisse), `data/llm.json` (Betriebsart, Adresse und Schlüssel des externen Servers mit Rechten 600, Standardmodell, zuletzt gestartetes Modell), `data/logs/llm.log` (Protokoll von `llama-server`). Dateien, die jemand anders in `data/models/` legt (z. B. `install.sh`), erscheinen als `source: "extern"` ohne Herkunft.

**Download:** nur HTTPS, nur Hosts `huggingface.co` und `hf.co` samt Unterdomänen (CDN), für die Laufzeit `github.com` und `githubusercontent.com`; Weiterleitungen folgt der Code von Hand und prüft jeden Schritt gegen die Liste. Fortsetzbar über `Range` (`.part`-Datei), bei Verbindungsabbruch bis zu dreimal weiter; erst nach bestandener SHA-256-Prüfung wird umbenannt und eingetragen. Abbruch durch den Menschen räumt die Teildatei weg, ein Verbindungsfehler lässt sie zum Fortsetzen liegen.

**Laufzeit:** `llama-server` als Kindprozess: `-m <Datei> --alias <Kennung> --host 127.0.0.1 --port <freier Port> -c 8192 -ngl 99 --parallel 1 --jinja`. Bereit, sobald `/health` 200 liefert (bis 10 Minuten); ein Absturz wird als `state: "failed"` mit den letzten Zeilen des Protokolls gemeldet. Im Betrieb „Eingebaut“ zeigt `llm_base_url` auf diesen Server und es wird kein Schlüssel gesendet; **`SIM_LLM_BASE_URL` in der Umgebung oder in `backend/.env` gewinnt immer** (dann `locked: true`, die Betriebsart ist fest „external“). Die Laufzeit **folgt der Simulation**: beim Start des Servers, beim Zurücksetzen, bei einer neuen Simulation und beim Laden eines Spielstands läuft das Modell, das die Simulation hat (`POST /api/sim/reset` und `POST /api/sim/new` mit einem nicht installierten Modell: 422, nichts ändert sich; ein Spielstand mit einem hier nicht installierten Modell lädt trotzdem).

**Probelauf** (Frage 42): zehn Entscheidungen mit dem Messprompt aus AP00 (`models/probe_data.py`, dieselben Daten wie `scripts/probe_llm.py`), `json_schema`, ohne Denken. Gemessen: **gültig in %**, **Ø Sekunden je Entscheidung**, **Token/s**. Siegel: unter 90 % gültig **ungeeignet** (Fehlschläge zählen als ungültig), ab 90 % **geprüft**, bei Ø über 20 s **mit Einschränkung** (die Grenze 20 s ist eine Annahme, siehe Frage 50).

**WebSocket:** Nachricht `{"type": "models", "status": LlmStatusOut}` bei jeder Änderung (Fortschritt höchstens fünfmal je Sekunde). Sie hat keine Nummer und geht nicht in die Lückenprüfung ein; beim Verbinden kommt sie nicht von selbst, die Oberfläche holt `GET /api/llm`.
