# AP07 – Parameter, Slider, Presets, Beobachtungsmodi

**Auftrag:** §8, §9, §11 · **Abhängig von:** AP04, AP06 · **Umfang:** L · **Meilenstein:** M4

## Ziel
Alle in §8 geforderten Parameter sind im laufenden Betrieb über eine Seitenleiste einstellbar, werden im Backend validiert und wirken nachweisbar. Es gibt keinen Regler ohne Wirkung. Presets lassen sich verwalten. Die drei Beobachtungsmodi steuern, was die Agenten über den Benutzer wissen.

## Kernidee: Parameter-Registry
Eine zentrale Liste `params/registry.py` beschreibt jeden Parameter genau einmal:

```python
ParamSpec(
  key="agent.sociability", group="personality", scope="agent",
  type="int", min=0, max=100, step=1, default=50, unit="%",
  effect="next_decision",          # immediate | next_decision | restart_model
  label="Geselligkeit", help="Wie gern der Agent Gesellschaft sucht.",
  consumers=["agents.factors.social"],  # wo der Wert gelesen wird
)
```
- Das Frontend baut die Seitenleiste **aus dieser Registry** (`GET /api/params/schema`). Ein neuer Parameter erscheint automatisch, ein entfernter verschwindet.
- Ein Test prüft für jeden Eintrag, dass der Wert in den genannten `consumers` gelesen wird und einen dokumentierten Wirkungstest hat. Damit ist ausgeschlossen, dass ein Regler nur dekorativ ist.
- `docs/konfiguration.md` wird aus der Registry erzeugt (`scripts/gen_config_doc.py`).

## Parameterliste
Standardwerte sind Vorschläge und werden mit den Messwerten aus AP00/AP02 abgestimmt.

### Autonomie und Entscheidungsverhalten (§8.1, global)
| Schlüssel | Bereich | Standard | Wirkung | Greift |
|---|---|---|---|---|
| `autonomy` | 0–100 % | 60 | Gewicht `autonomy`, Häufigkeit eigener neuer Ziele | nächste Entscheidung |
| `planning_horizon` | 1–8 Schritte | 3 | Länge erzeugter Pläne | nächste Planung |
| `initiative` | 0–100 % | 50 | Gewicht `social` für selbst begonnene Gespräche/Aktivitäten | nächste Entscheidung |
| `spontaneity` | 0–100 % | 25 | Zufallsanteil, Abweichung vom Plan | nächste Entscheidung |
| `decision_interval` | 1–120 Sim-min | 5 | Mindestabstand zwischen Entscheidungen eines Agenten | sofort |
| `goal_persistence` | 0–100 % | 60 | Schwelle für Zielwechsel | nächste Entscheidung |
| `exploration` | 0–100 % | 50 | Gewicht `exploration` | nächste Entscheidung |
| `top_k_options` | 3–10 | 6 | Optionen im Prompt | nächste Entscheidung |

### Persönlichkeit (§8.2, je Agent)
Geselligkeit, Neugier, Hilfsbereitschaft, Risikobereitschaft, Konfliktbereitschaft, Kooperationsneigung, Ruhebedürfnis, Gesprächsinitiative, Annahmebereitschaft – je 0–100 %, wirken über die Faktoren aus AP06. Dazu die Textfelder Charakterbeschreibung, Hintergrund, Interessen, Abneigungen, persönliche Ziele, Kommunikationsstil (je max. 600 Zeichen) – wirken auf den Systemprompt ab der nächsten Entscheidung; Interessen und Abneigungen zusätzlich als Stichwörter auf die Bewertung von Orten/Objekten.

### Gedächtnis und Reflexion (§8.3, global)
| Schlüssel | Bereich | Standard |
|---|---|---|
| `memory.max_in_context` | 3–40 | 12 |
| `memory.retrieval_threshold` | 0–1 | 0,25 |
| `memory.w_importance` / `w_recency` / `w_relevance` | 0–1 | 0,3 / 0,3 / 0,4 |
| `memory.recency_half_life` | 1–168 Sim-h | 24 |
| `memory.reflection_threshold` | 10–300 Wichtigkeitspunkte | 80 |
| `memory.summary_interval` | 6–72 Sim-h | 24 |
| `memory.w_shared` | 0–1 | 0,5 |
| `memory.archive_after_days` | 1–60 Sim-Tage, 0 = nie | 7 |
| `memory.context_token_budget` | 300–4000 | 1200 |

### Weltregeln und Bedürfnisse (§8.4, global)
| Schlüssel | Bereich | Standard | Wirkung |
|---|---|---|---|
| `world.scarcity` | 0–100 % | 30 | skaliert aktuellen Bestand **und** Nachwachsrate sofort |
| `world.resource_availability` | 0–200 % | 100 | Obergrenzen je Ort |
| `needs.energy.enabled` / `rate` | an/aus, 0–300 % | an, 100 | |
| `needs.hunger.enabled` / `rate` | an/aus, 0–300 % | an, 100 | |
| `needs.social.enabled`, `needs.calm.enabled`, `needs.warmth.enabled` | an/aus | an, an, aus | |
| `world.minutes_per_tick` | 1–15 Sim-min | 1 | Geschwindigkeit des Tageszyklus: wie viel Sim-Zeit ein Tick vorrückt |
| `world.build_cost` / `build_duration` | 25–300 % | 100 / 100 | Bauvorlagen |
| `world.max_objects` | 20–500 | 150 | Grenze für erzeugte Objekte |
| `world.movement` | „frei“, „Haus und Garten“, „ohne Wald“, eigene Liste | frei | gesperrte Orte in der Wegfindung |
| `world.failure_consequence` | „keine“, „Zeitverlust“, „Zeit + Energie“ | Zeitverlust | Ablehnungsfolgen |

### Modell und Inferenz (§8.5)
| Schlüssel | Bereich | Standard | Greift |
|---|---|---|---|
| `llm.base_url` | URL | `http://maintux:8080/v1` | sofort, nach Verbindungstest |
| `llm.model` | Auswahl aus `/v1/models` | `qwen3.8-9b-uncensored` | **Modellwechsel** (Router lädt neu, Hinweis auf Ladezeit) |
| `llm.temperature` | 0–1,5 | 0,7 | nächste Anfrage |
| `llm.top_p` | 0,1–1 | 0,9 | nächste Anfrage |
| `llm.max_tokens` | 64–2048 | 400 | nächste Anfrage |
| `llm.context_budget` | 1000–16000 | 6000 | nächste Anfrage; Obergrenze = Kontext des Modells |
| `llm.max_concurrent` | 1–4 | 1 | sofort; Werte > 1 nur sinnvoll, wenn der Router mehr Slots hat (**Neustart des Routers nötig**, gekennzeichnet) |
| `llm.timeout_s` | 5–300 | 90 | nächste Anfrage |
| `llm.retries` | 0–5 | 2 | nächste Anfrage |
| `llm.thinking` | aus / kurz / normal | nach AP00 | nächste Anfrage |

### Geschwindigkeit und Systemlast (§8.6)
| Schlüssel | Bereich | Standard |
|---|---|---|
| `sim.speed` | Stufen 0,5× / 1× / 2× / 4× / max. | 1× |
| `sim.tick_pause_ms` | 0–5000 | aus Stufe abgeleitet, einzeln überschreibbar |
| `sim.max_decisions_per_min` | 1–60 | 12 |
| `sim.time_waits_for_decisions` | an/aus | an |
| `sim.power_save` | an/aus | aus – wenn an: max. 4 Entscheidungen/min, keine Reflexion tagsüber, Pause wenn kein Browser verbunden |

## Übernahme im Betrieb (§9)
- `PATCH /api/params` mit Liste von Änderungen und Idempotenz-Schlüssel → Validierung gegen die Registry → Antwort je Parameter: `applied`, `pending_next_decision`, `requires_model_restart`, `rejected` (mit Grund).
- Ereignis `simulation.parameter_changed` mit alt/neu/Status; die Seitenleiste zeigt den Status am Regler (Haken, Uhr-Symbol, Neustart-Hinweis, Fehler).
- Werte werden in der Datenbank gespeichert und überleben Neustarts.
- Sichere Grenzen: Werte außerhalb des Bereichs werden abgelehnt, nicht stillschweigend begrenzt.

## Presets (`PresetManager`)
- Mitgeliefert (schreibgeschützt): Freie Exploration, Soziale Entwicklung, Kooperative Gemeinschaft, Ressourcenknappheit, Hohe Autonomie, Experimentelle Konfiguration. Jedes als JSON in `params/presets/` mit kurzer Beschreibung.
- Eigene Presets: speichern (aktueller Stand oder Auswahl von Gruppen), laden (mit Vorschau der Änderungen), duplizieren, umbenennen, löschen (mit Bestätigung). Speicherung in SQLite.
- Laden eines Presets nutzt denselben Pfad wie einzelne Änderungen (gleiche Validierung, gleiche Ereignisse).

## Beobachtungsmodi (§11)
| Modus | Was die Agenten erfahren |
|---|---|
| Beobachter (Standard) | Nichts über einen Beobachter. Vom Benutzer eingespielte Ereignisse erscheinen als natürliche Vorkommnisse in der Welt. |
| Schöpfer | Systemprompt enthält einen konfigurierbaren Abschnitt über eine externe Instanz, die die Welt geschaffen hat (Text editierbar, Standardtext mitgeliefert). |
| Eingriff | Wie Beobachter, zusätzlich darf der Benutzer direkte Anweisungen und Informationen an einzelne Agenten senden (AP08); diese werden als „eine Stimme / Nachricht“ gekennzeichnet zugestellt, je nach Einstellung. |
- Ein Moduswechsel gilt ab der nächsten Entscheidung und ändert keine bestehenden Erinnerungen. Der Wechsel selbst wird als Systemereignis protokolliert, aber nicht in die Gedächtnisse geschrieben.

## Frontend
- `ParameterSidebar`: aufklappbar von rechts, Gruppen als Abschnitte (Autonomie, Persönlichkeit Alex, Persönlichkeit Mira, Gedächtnis, Welt, Modell, Leistung, Modus), Suche, Zurück-auf-Standard je Parameter und Gruppe.
- `AgentSettings`: Textfelder und Persönlichkeitsslider je Agent nebeneinander vergleichbar.
- `ModelStatus`: Verbindung, geladenes Modell, mittlere Antwortzeit, Tokens/s, Fehler der letzten 15 min, Warteschlange.
- `SystemLoad`: Entscheidungen/min, ausgeführte und fehlgeschlagene Aktionen, Sim-Fortschritt (Sim-Zeit je Echtzeitminute).
- Änderungen an Schiebereglern werden gedrosselt (z. B. 250 ms) gesendet.

## Module
`params/registry.py`, `params/specs_*.py` (je Gruppe eine Datei), `params/store.py`, `params/apply.py`, `params/presets.py`, `api/routes_params.py`, `api/routes_presets.py`, `agents/modes.py`; Frontend `src/settings/ParameterSidebar.tsx`, `ParamControl.tsx`, `AgentSettings.tsx`, `WorldSettings.tsx`, `ModelSettings.tsx`, `PresetManager.tsx`, `src/status/ModelStatus.tsx`, `SystemLoad.tsx`.

## Tests
- Registry-Test: jeder Parameter hat Grenzen, Standard, Wirkungsklasse, Konsument und Wirkungstest.
- Wirkungstests (Auswahl, §9-Beispiele): höhere Autonomie → mehr eigeninitiierte Ziele über N Entscheidungen (Fake-LLM wählt immer bestbewertet); höhere Neugier → unbekannter Ort steigt im Ranking; höhere Geselligkeit → Gesprächsoption steigt; Reflexionsschwelle niedriger → mehr Reflexionen; Geschwindigkeit höher → kürzere Tick-Pausen (gemessen); Knappheit höher → tatsächlicher Bestand sinkt sofort.
- Übernahme im Betrieb: Parameter ändern, während die Simulation läuft; nächste Entscheidung nutzt den neuen Wert (§17 Nr. 9).
- Playwright: Slider bewegen → Status „übernommen“ → Wert über API bestätigt (§17 Nr. 8).
- Presets: speichern, laden, duplizieren, löschen; mitgelieferte nicht löschbar.
- Modi: Prompt-Inhalt je Modus; Wechsel ändert keine Erinnerungen.

## Abnahme
- [ ] Jeder Regler in der Seitenleiste ist mit einem Wirkungstest verknüpft (Liste im Statusbericht).
- [ ] Live-Vorführung: Neugier hoch → Agent erkundet erkennbar mehr; Knappheit hoch → Holzstapel schrumpfen sichtbar.
- [ ] Modellwechsel 9B ↔ Bonsai im Betrieb funktioniert, Ladezeit wird angezeigt.
- [ ] Alle sechs Presets laden ohne Fehler.
