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

Modi von `use`: Bett `sleep`, Sofa/Bank `sit`, Herd `cook`, Regal/Schreibtisch/Tafel `read`, Schreibtisch/Tafel `write`, Kamin/Feuerstelle `light`/`extinguish`, Tür `lock`/`unlock`, Angelplatz `fish`, Pflanze `harvest`.

Ablehnungscodes (`RejectCode`): `not_reachable`, `not_here`, `missing_resource`, `locked`, `capacity`, `forbidden_by_rules`, `invalid_target`, `busy`. Jede Ablehnung erzeugt `agent.action_rejected`, einen Eintrag in `action_log` und (außer bei `busy`) die Folge laut Regel `failure_penalty`.

### Ereignistypen (AP01)

Schema (`Event`): `seq` (fortlaufende ID), `ts` (UTC), `sim_minute`, `type`, `agents`, `location_id`, `data`, `parent_seq`.

| Typ | Wann |
|---|---|
| `agent.action_started` / `action_completed` / `action_failed` / `action_rejected` / `action_interrupted` | Lebenslauf einer Aktion |
| `agent.moved` (je Kachel), `agent.location_changed`, `agent.location_discovered`, `agent.arrived` | Bewegung |
| `agent.dialogue` | `speak` ist angekommen (`speaker`, `to`, `text`) |
| `agent.inspected`, `agent.read`, `agent.fished`, `agent.ate`, `agent.drank`, `agent.slept`, `agent.rested` | Ergebnisse der Aktionen |
| `agent.item_taken` / `item_dropped` / `item_given`, `agent.inventory_changed` | Gegenstände und Inventar |
| `world.object_created` / `object_changed` / `object_removed` / `object_discovered`, `world.tile_changed` | Weltänderungen |
| `world.resource_changed` | Quelle gesammelt, verbraucht oder nachgewachsen |
| `world.weather_changed`, `world.phase_changed`, `world.day_started` | Zeit und Wetter |
| `simulation.parameter_changed` | Weltregeln geändert |
| `world.tile_type_added`, `world.tiles_changed`, `world.map_extended`, `world.location_added`, `world.location_updated`, `world.agent_added`, `world.resource_added`, `world.patch_applied` | Erweiterungen der Welt (siehe `welt-erweitern.md`) |

### Wissen und Sichtbarkeit
`WorldObject.hidden` + `known_by`: Verborgene Objekte sind nur für die Agenten in `known_by` sichtbar (`visible_to(agent_id)`). Aktionen lehnen unbekannte Objekte mit `invalid_target` ab. **Die Wahrnehmung für Prompts (AP02) muss `objects_at()` immer über `visible_to` filtern.** Entdeckt wird beim `inspect` eines Objekts am selben Ort im Umkreis von 3 Kacheln.

### Datenbank (`backend/simulacra/db/migrations/001_init.sql`)
Tabellen: `meta`, `tile_types`, `tiles`, `locations`, `objects`, `resources`, `agents_body`, `inventory`, `clock`, `weather`, `events`, `action_log`. SQLite im WAL-Modus, Schema-Version in `PRAGMA user_version`, Migrationen als nummerierte Dateien, die beim Öffnen automatisch angewendet werden. Eine Schreibverbindung (Sperre plus Ein-Thread-Warteschlange `Database.write/run`), Leser über `Database.reader()`.

### Startwelt-Datei (`backend/simulacra/data/world_default.json`, Schema 1)
`size` `[64,40]`, `home`, `tile_types` (Kachelart → `char`, `walkable`, `cost`, `color`, `label`), `tiles` (40 Zeilen à 64 Zeichen), `locations` (`id`, `name`, `rect` `[x,y,b,h]`, `entrances`, `extra_tiles`, `props`; der erste passende Eintrag gewinnt, `props.fallback` gilt für alle übrigen Kacheln), `objects` (`id`, `kind`, `name`, `tile`, `state`, `portable`, `owner`, `hidden`), `resource_nodes`, `agents`, `start`. Bauvorlagen: `blueprints.json`. Neue Objektarten nur in `world/object_kinds.py` ergänzen. Ausführlich: [welt-erweitern.md](welt-erweitern.md).

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
sim.runner.event_listeners.append(lambda events: ...)      # alle Ereignisse (Welt, Agenten, Gespräche, Steuerung) für Bus/WebSocket (AP03)
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
| `conversation.started` / `conversation.ended` | Gespräch beginnt mit dem ersten Beitrag / endet (`reason`: max_turns, timeout, left, repetition, farewell) |
| `conversation.proposal_accepted` / `conversation.proposal_declined` | Antwort auf einen Vorschlag |
| `simulation.started` / `paused` / `resumed` / `stopped` | Steuerbefehle |

### Neue Tabellen (`003_agents.sql`)
`agent_profiles` (Profil und Persönlichkeit als JSON), `agent_runtime` (Status, Vorhaben, zuletzt gesehen), `observations` (Beobachtungen je Agent, nie gelöscht), `conversations` (Beiträge, Vorschlag, Beendigung), `decisions` (angebotene Optionen mit Punkten und Faktoren, Wahl, Ergebnis, Latenz, Tokens, Fehler).

### Entscheidungsschema (Modellantwort)
`{"option_id": "o3" | "other", "intent": "…", "utterance": "…", "importance": 1-10, "plan_next": "…", "proposal": "…", "other_action": "move_to|wait|…", "other_params": {…}}`. Pflicht sind `option_id`, `intent`, `utterance`, `importance`; die Engine prüft jede Handlung.
