# Parameter

*Erzeugt von `scripts/gen_config_doc.py` aus `backend/simulacra/params/` – nicht von Hand ändern.*

Jeder Parameter steht genau einmal in der Registry. Die Oberfläche (`GET /api/params/schema`), die Prüfung (`PATCH /api/params`) und diese Seite entstehen daraus. Jeder Parameter nennt den **Wirkungstest**, der nachweist, dass der Wert beim Verbraucher ankommt und das Verhalten ändert. Werte außerhalb des Bereichs werden abgelehnt, nie stillschweigend begrenzt.

Wirkung: *sofort* = gilt in der laufenden Welt; *ab der nächsten Entscheidung* = der nächste Prompt oder Abruf nutzt den Wert; *nur mit Neustart des Modells* = nicht im Lauf änderbar.

## Autonomie und Entscheidungen

| Schlüssel | Name | Bedeutung | Bereich | Standard | Wirkung | Wirkungstest |
|---|---|---|---|---|---|---|
| `autonomy` | Autonomie | Eigene Vorhaben statt Reaktion auf Ereignisse. 50 = unverändert; wirkt als Aufschlag auf den jeweiligen Wert jedes Agenten. | 0 bis 100, Schritt 1 % | 50 | ab der nächsten Entscheidung | `test_effects_agents.py::test_global_shifts_move_scores` |
| `planning_horizon` | Planungshorizont | Höchstzahl der Schritte eines erzeugten Plans. | 1 bis 8, Schritt 1 Schritte | 5 | ab der nächsten Entscheidung | `test_effects_agents.py::test_planning_horizon_limits_plan_length` |
| `initiative` | Initiative | Wie gern Agenten von sich aus ein Gespräch oder eine Aktivität beginnen. 50 = unverändert; wirkt als Aufschlag auf den jeweiligen Wert jedes Agenten. | 0 bis 100, Schritt 1 % | 50 | ab der nächsten Entscheidung | `test_effects_agents.py::test_global_shifts_move_scores` |
| `spontaneity` | Spontaneität | Zufallsanteil und Abweichen vom Plan. 50 = unverändert; wirkt als Aufschlag auf den jeweiligen Wert jedes Agenten. | 0 bis 100, Schritt 1 % | 50 | ab der nächsten Entscheidung | `test_effects_agents.py::test_global_shifts_move_scores` |
| `decision_interval` | Entscheidungsabstand | Mindestabstand zwischen zwei Entscheidungen eines Agenten in Simulationsminuten (1 = sobald er frei ist). | 1 bis 120, Schritt 1 Min. | 1 | sofort | `test_effects_agents.py::test_decision_interval_spaces_decisions` |
| `goal_persistence` | Zielpersistenz | Wie lange und wie stark ein Agent bei einem Ziel bleibt. 50 = unverändert; wirkt als Aufschlag auf den jeweiligen Wert jedes Agenten. | 0 bis 100, Schritt 1 % | 50 | ab der nächsten Entscheidung | `test_effects_agents.py::test_global_shifts_move_scores` |
| `exploration` | Erkunden | Neugier auf Unbekanntes. 50 = unverändert; wirkt als Aufschlag auf den jeweiligen Wert jedes Agenten. | 0 bis 100, Schritt 1 % | 50 | ab der nächsten Entscheidung | `test_effects_agents.py::test_global_shifts_move_scores` |
| `top_k_options` | Optionen je Entscheidung | So viele bewertete Optionen sieht das Modell. | 3 bis 10, Schritt 1 | 6 | ab der nächsten Entscheidung | `test_effects_agents.py::test_top_k_limits_the_offered_options` |
| `rank_hint` | Rangfolge nennen | An: der Prompt sagt dem Modell, dass die Optionen nach Passung zu Neigungen, Zielen und Bedürfnissen geordnet sind (o1 am besten). Aus: das Modell sieht dieselbe Reihenfolge ohne Hinweis und folgt ihr deutlich weniger. Macht die Persönlichkeitsregler im Verhalten deutlicher. | an / aus | an | ab der nächsten Entscheidung | `test_effects_agents.py::test_rank_hint_reaches_the_prompt` |

## Persönlichkeit

| Schlüssel | Name | Bedeutung | Bereich | Standard | Wirkung | Wirkungstest |
|---|---|---|---|---|---|---|
| `personality.sociability` | Geselligkeit (je Agent) | Wie gern der Agent Gesellschaft sucht. | 0 bis 100, Schritt 1 % | je Agent (Startprofil) | ab der nächsten Entscheidung | `test_effects_agents.py::test_personality_value_moves_the_scores` |
| `personality.curiosity` | Neugier (je Agent) | Lust auf Neues und Unbekanntes. | 0 bis 100, Schritt 1 % | je Agent (Startprofil) | ab der nächsten Entscheidung | `test_effects_agents.py::test_personality_value_moves_the_scores` |
| `personality.helpfulness` | Hilfsbereitschaft (je Agent) | Bereitschaft zu helfen und zu geben. | 0 bis 100, Schritt 1 % | je Agent (Startprofil) | ab der nächsten Entscheidung | `test_effects_agents.py::test_personality_value_moves_the_scores` |
| `personality.risk_taking` | Risikobereitschaft (je Agent) | Mut bei Dunkelheit, schlechtem Wetter und Unbekanntem. | 0 bis 100, Schritt 1 % | je Agent (Startprofil) | ab der nächsten Entscheidung | `test_effects_agents.py::test_personality_value_moves_the_scores` |
| `personality.conflict_readiness` | Konfliktbereitschaft (je Agent) | Wie offen der Agent widerspricht oder Konflikte anspricht. | 0 bis 100, Schritt 1 % | je Agent (Startprofil) | ab der nächsten Entscheidung | `test_effects_agents.py::test_personality_value_moves_the_scores` |
| `personality.cooperation` | Kooperationsneigung (je Agent) | Neigung, gemeinsam zu arbeiten. | 0 bis 100, Schritt 1 % | je Agent (Startprofil) | ab der nächsten Entscheidung | `test_effects_agents.py::test_personality_value_moves_the_scores` |
| `personality.calm_need` | Bedürfnis nach Ruhe (je Agent) | Wie sehr der Agent Ruhe und Alleinsein braucht. | 0 bis 100, Schritt 1 % | je Agent (Startprofil) | ab der nächsten Entscheidung | `test_effects_agents.py::test_personality_value_moves_the_scores` |
| `personality.conversation_initiative` | Gesprächsinitiative (je Agent) | Wie oft der Agent ein Gespräch beginnt. | 0 bis 100, Schritt 1 % | je Agent (Startprofil) | ab der nächsten Entscheidung | `test_effects_agents.py::test_personality_value_moves_the_scores` |
| `personality.suggestion_acceptance` | Bereitschaft, Vorschläge anzunehmen (je Agent) | Wie bereitwillig der Agent Vorschläge annimmt. | 0 bis 100, Schritt 1 % | je Agent (Startprofil) | ab der nächsten Entscheidung | `test_effects_agents.py::test_personality_value_moves_the_scores` |
| `personality.persistence` | Zielpersistenz (je Agent) | Wie beharrlich der Agent beim Plan bleibt. | 0 bis 100, Schritt 1 % | je Agent (Startprofil) | ab der nächsten Entscheidung | `test_effects_agents.py::test_personality_value_moves_the_scores` |
| `personality.spontaneity` | Spontaneität (je Agent) | Wie oft der Agent spontan vom Plan abweicht. | 0 bis 100, Schritt 1 % | je Agent (Startprofil) | ab der nächsten Entscheidung | `test_effects_agents.py::test_personality_value_moves_the_scores` |
| `personality.autonomy` | Autonomie (je Agent) | Eigene Vorhaben statt Reaktion auf andere. | 0 bis 100, Schritt 1 % | je Agent (Startprofil) | ab der nächsten Entscheidung | `test_effects_agents.py::test_personality_value_moves_the_scores` |

## Charakter

| Schlüssel | Name | Bedeutung | Bereich | Standard | Wirkung | Wirkungstest |
|---|---|---|---|---|---|---|
| `profile.description` | Charakterbeschreibung (je Agent) | Wie der Agent ist. | Text, höchstens 600 Zeichen | je Agent (Startprofil) | ab der nächsten Entscheidung | `test_effects_agents.py::test_profile_text_reaches_the_prompt` |
| `profile.background` | Hintergrund (je Agent) | Vorgeschichte des Agenten. | Text, höchstens 600 Zeichen | je Agent (Startprofil) | ab der nächsten Entscheidung | `test_effects_agents.py::test_profile_text_reaches_the_prompt` |
| `profile.interests` | Interessen (je Agent) | Wofür sich der Agent interessiert (wirkt auch auf die Bewertung von Orten und Objekten). Mehrere Einträge mit Komma trennen. | Text, höchstens 600 Zeichen | je Agent (Startprofil) | ab der nächsten Entscheidung | `test_effects_agents.py::test_profile_text_reaches_the_prompt` |
| `profile.dislikes` | Abneigungen (je Agent) | Was der Agent nicht mag. Mehrere Einträge mit Komma trennen. | Text, höchstens 600 Zeichen | je Agent (Startprofil) | ab der nächsten Entscheidung | `test_effects_agents.py::test_profile_text_reaches_the_prompt` |
| `profile.goals` | Persönliche Ziele (je Agent) | Langfristige Ziele (werden zu Zielen des Agenten). Mehrere Einträge mit Komma trennen. | Text, höchstens 600 Zeichen | je Agent (Startprofil) | ab der nächsten Entscheidung | `test_effects_agents.py::test_profile_text_reaches_the_prompt` |
| `profile.communication_style` | Kommunikationsstil (je Agent) | Wie der Agent spricht. | Text, höchstens 600 Zeichen | je Agent (Startprofil) | ab der nächsten Entscheidung | `test_effects_agents.py::test_profile_text_reaches_the_prompt` |

## Gedächtnis und Reflexion

| Schlüssel | Name | Bedeutung | Bereich | Standard | Wirkung | Wirkungstest |
|---|---|---|---|---|---|---|
| `memory.max_in_context` | Erinnerungen im Prompt | Höchstzahl abgerufener Erinnerungen je Entscheidung. | 3 bis 40, Schritt 1 | 6 | ab der nächsten Entscheidung | `test_effects_memory.py::test_memory_retrieval_parameters` |
| `memory.retrieval_threshold` | Abrufschwelle | Mindestpunktzahl (0–1), ab der eine Erinnerung abgerufen wird. | 0 bis 1, Schritt 0.01 | 0.35 | ab der nächsten Entscheidung | `test_effects_memory.py::test_memory_retrieval_parameters` |
| `memory.w_importance` | Gewicht Wichtigkeit | Wie stark die Wichtigkeit beim Abruf zählt. | 0 bis 1, Schritt 0.05 | 0.6 | ab der nächsten Entscheidung | `test_effects_memory.py::test_memory_weights_change_the_order` |
| `memory.w_recency` | Gewicht Aktualität | Wie stark Neues beim Abruf zählt. | 0 bis 1, Schritt 0.05 | 0.6 | ab der nächsten Entscheidung | `test_effects_memory.py::test_memory_weights_change_the_order` |
| `memory.w_relevance` | Gewicht Relevanz | Wie stark die Passung zur Lage beim Abruf zählt. | 0 bis 1, Schritt 0.05 | 1.0 | ab der nächsten Entscheidung | `test_effects_memory.py::test_memory_weights_change_the_order` |
| `memory.w_shared` | Gewicht gemeinsamer Erlebnisse | Bevorzugung von Erlebnissen mit anderen. | 0 bis 1, Schritt 0.05 | 0.2 | ab der nächsten Entscheidung | `test_effects_memory.py::test_memory_weights_change_the_order` |
| `memory.recency_half_life` | Halbwertszeit der Aktualität | Nach dieser Zeit zählt eine Erinnerung nur noch halb so viel. | 1 bis 168, Schritt 1 Sim-Std. | 36 | ab der nächsten Entscheidung | `test_effects_memory.py::test_memory_weights_change_the_order` |
| `memory.reflection_threshold` | Reflexionsschwelle | Summe der Wichtigkeit neuer Erinnerungen, ab der ein Agent nachdenkt. | 10 bis 300, Schritt 5 Punkte | 80 | ab der nächsten Entscheidung | `test_effects_memory.py::test_lower_reflection_threshold_means_more_reflections` |
| `memory.summary_interval` | Zusammenfassung | Abstand der Tageszusammenfassungen. | 24 bis 168, Schritt 24 Sim-Std. | 24 | ab der nächsten Entscheidung | `test_effects_memory.py::test_summary_interval_and_archive` |
| `memory.archive_after_days` | Archivierung nach | Zusammengefasste Erinnerungen werden nach so vielen Tagen archiviert (0 = nie). | 0 bis 60, Schritt 1 Sim-Tage | 2 | ab der nächsten Entscheidung | `test_effects_memory.py::test_summary_interval_and_archive` |
| `memory.context_token_budget` | Token-Budget für Erinnerungen | Höchstzahl Tokens abgerufener Erinnerungen je Prompt. | 300 bis 4000, Schritt 50 Tokens | 400 | ab der nächsten Entscheidung | `test_effects_memory.py::test_memory_retrieval_parameters` |

## Welt und Bedürfnisse

| Schlüssel | Name | Bedeutung | Bereich | Standard | Wirkung | Wirkungstest |
|---|---|---|---|---|---|---|
| `world.scarcity` | Knappheit | Wie knapp Ressourcen sind: skaliert Bestand und Nachwuchs sofort (100 % = nur noch ein Zehntel). | 0 bis 100, Schritt 1 % | 0 | sofort | `test_effects_world.py::test_scarcity_shrinks_stock_and_regrowth_immediately` |
| `world.resource_availability` | Ressourcen-Obergrenzen | Obergrenze der Vorräte je Ort (100 % = normal). | 0 bis 200, Schritt 5 % | 100 | sofort | `test_effects_world.py::test_availability_scales_caps` |
| `needs.energy.enabled` | Energie: Bedürfnis | Ausgeschaltet: das Bedürfnis steigt nicht mehr und taucht weder in der Bewertung noch im Prompt auf. | an / aus | an | sofort | `test_effects_world.py::test_need_switches_and_rates` |
| `needs.energy.rate` | Energie: Rate | Wie schnell sich das Bedürfnis verändert (100 % = Normalwert). | 0 bis 300, Schritt 5 % | 100 | sofort | `test_effects_world.py::test_need_switches_and_rates` |
| `needs.hunger.enabled` | Hunger: Bedürfnis | Ausgeschaltet: das Bedürfnis steigt nicht mehr und taucht weder in der Bewertung noch im Prompt auf. | an / aus | an | sofort | `test_effects_world.py::test_need_switches_and_rates` |
| `needs.hunger.rate` | Hunger: Rate | Wie schnell sich das Bedürfnis verändert (100 % = Normalwert). | 0 bis 300, Schritt 5 % | 100 | sofort | `test_effects_world.py::test_need_switches_and_rates` |
| `needs.thirst.enabled` | Durst: Bedürfnis | Ausgeschaltet: das Bedürfnis steigt nicht mehr und taucht weder in der Bewertung noch im Prompt auf. | an / aus | an | sofort | `test_effects_world.py::test_need_switches_and_rates` |
| `needs.thirst.rate` | Durst: Rate | Wie schnell sich das Bedürfnis verändert (100 % = Normalwert). | 0 bis 300, Schritt 5 % | 100 | sofort | `test_effects_world.py::test_need_switches_and_rates` |
| `needs.social.enabled` | Geselligkeit: Bedürfnis | Ausgeschaltet: das Bedürfnis steigt nicht mehr und taucht weder in der Bewertung noch im Prompt auf. | an / aus | an | sofort | `test_effects_world.py::test_need_switches_and_rates` |
| `needs.calm.enabled` | Ruhe: Bedürfnis | Ausgeschaltet: das Bedürfnis steigt nicht mehr und taucht weder in der Bewertung noch im Prompt auf. | an / aus | an | sofort | `test_effects_world.py::test_need_switches_and_rates` |
| `needs.warmth.enabled` | Wärme: Bedürfnis | Ausgeschaltet: das Bedürfnis steigt nicht mehr und taucht weder in der Bewertung noch im Prompt auf. | an / aus | aus | sofort | `test_effects_world.py::test_need_switches_and_rates` |
| `world.minutes_per_tick` | Minuten je Takt | Wie viel Simulationszeit ein Schritt vorrückt (schnellerer Tageszyklus; Entscheidungen fallen entsprechend seltener). | 1 bis 15, Schritt 1 Min. | 1 | sofort | `test_effects_world.py::test_minutes_per_tick_advances_the_clock` |
| `world.build_cost` | Baukosten | Kosten der Bauvorlagen (100 % = normal). | 25 bis 300, Schritt 5 % | 100 | sofort | `test_effects_world.py::test_build_cost_and_duration` |
| `world.build_duration` | Bauzeit | Dauer des Bauens (100 % = normal). | 25 bis 300, Schritt 5 % | 100 | sofort | `test_effects_world.py::test_build_cost_and_duration` |
| `world.max_objects` | Höchstzahl Objekte | Grenze für erzeugte Objekte. | 20 bis 500, Schritt 10 Objekte | 150 | sofort | `test_effects_world.py::test_max_objects_limits_building` |
| `world.movement` | Bewegungsfreiheit | Welche Orte die Agenten nicht betreten dürfen (gesperrte Orte kommen in der Wegfindung nicht vor). | `free`, `house_garden`, `no_forest`, `custom` | free | sofort | `test_effects_world.py::test_movement_blocks_locations` |
| `world.movement_custom` | Eigene Sperrliste | Kennungen gesperrter Orte, durch Komma getrennt (gilt bei „eigene Liste“), z. B. lake, forest. | Text, höchstens 300 Zeichen | – | sofort | `test_effects_world.py::test_movement_blocks_locations` |
| `world.failure_consequence` | Folge einer Ablehnung | Was eine abgelehnte oder gescheiterte Handlung kostet. | `none`, `time`, `energy` | time | sofort | `test_effects_world.py::test_failure_consequence` |

## Modell und Inferenz

| Schlüssel | Name | Bedeutung | Bereich | Standard | Wirkung | Wirkungstest |
|---|---|---|---|---|---|---|
| `llm.base_url` | Adresse des Routers | OpenAI-kompatible Adresse. Wird erst nach einem erfolgreichen Verbindungstest übernommen. | Text, höchstens 200 Zeichen | http://maintux:8080/v1 | sofort | `test_effects_llm.py::test_base_url_needs_a_working_connection` |
| `llm.model` | Modell | Das Modell gilt für die ganze Simulation. Wer ein anderes will, legt eine neue Simulation an (Zurücksetzen mit Modellwahl). **Gesperrt:** Das Modell lässt sich im Lauf nicht wechseln. Lege eine neue Simulation an und wähle dort das Modell. | Text, höchstens 100 Zeichen | qwen3.8-9b-uncensored | nur mit Neustart des Modells | `test_effects_llm.py::test_the_model_cannot_change_during_a_run` |
| `llm.temperature` | Temperatur | Wie frei das Modell formuliert (höher = zufälliger). | 0 bis 1.5, Schritt 0.05 | 1.0 | ab der nächsten Entscheidung | `test_effects_llm.py::test_llm_parameters_reach_the_request` |
| `llm.top_p` | Top-p | Begrenzung der Wortauswahl. | 0.1 bis 1, Schritt 0.05 | 0.95 | ab der nächsten Entscheidung | `test_effects_llm.py::test_llm_parameters_reach_the_request` |
| `llm.max_tokens` | Höchstzahl Antwort-Tokens | Längenbegrenzung der Antwort. | 64 bis 2048, Schritt 16 Tokens | 400 | ab der nächsten Entscheidung | `test_effects_llm.py::test_llm_parameters_reach_the_request` |
| `llm.context_budget` | Kontextbudget | Höchstlänge eines Prompts (Schätzung). Darüber werden erst Langzeit-, dann ältere Kurzzeiterinnerungen weggelassen. | 1000 bis 16000, Schritt 250 Tokens | 6000 | ab der nächsten Entscheidung | `test_effects_llm.py::test_context_budget_trims_the_prompt` |
| `llm.max_concurrent` | Gleichzeitige Anfragen | Werte über 1 helfen nur, wenn der Router mehrere Plätze hat. *Hinweis: Werte über 1 brauchen mehr Plätze im Router (Neustart des Routers auf maintux nötig).* | 1 bis 4, Schritt 1 | 1 | sofort | `test_effects_llm.py::test_max_concurrent_limits_parallel_requests` |
| `llm.timeout_s` | Zeitlimit | So lange wartet eine Anfrage auf das Modell. | 5 bis 300, Schritt 5 s | 90 | ab der nächsten Entscheidung | `test_effects_llm.py::test_llm_parameters_reach_the_request` |
| `llm.retries` | Wiederholungen | Wie oft eine fehlgeschlagene Anfrage wiederholt wird. | 0 bis 5, Schritt 1 | 2 | ab der nächsten Entscheidung | `test_effects_llm.py::test_retries_repeat_failed_requests` |
| `llm.thinking` | Denken | Ob das Modell vor der Antwort nachdenkt (kostet deutlich Zeit). | `off`, `short`, `normal` | off | ab der nächsten Entscheidung | `test_effects_llm.py::test_llm_parameters_reach_the_request` |

## Geschwindigkeit und Last

| Schlüssel | Name | Bedeutung | Bereich | Standard | Wirkung | Wirkungstest |
|---|---|---|---|---|---|---|
| `sim.speed` | Tempo | Wie schnell die Simulation läuft (Pause zwischen den Takten). | `0.5x`, `1x`, `2x`, `4x`, `max` | max | sofort | `test_effects_sim.py::test_speed_sets_the_tick_pause` |
| `sim.tick_pause_ms` | Pause je Takt | Feineinstellung der Pause zwischen den Takten (überschreibt das Tempo). | 0 bis 5000, Schritt 50 ms | 0 | sofort | `test_effects_sim.py::test_speed_sets_the_tick_pause` |
| `sim.max_decisions_per_min` | Höchstzahl Entscheidungen je Minute | Begrenzt die Last auf das Modell (0 = unbegrenzt). | 0 bis 60, Schritt 1 /min | 0 | sofort | `test_effects_sim.py::test_decision_limit_throttles_real_time` |
| `sim.time_waits_for_decisions` | Zeit wartet auf Entscheidungen | An: die Simulationszeit steht, bis alle freien Agenten entschieden haben. Aus: die Zeit läuft weiter, Entscheidungen kommen, wenn das Modell fertig ist. | an / aus | an | sofort | `test_effects_sim.py::test_time_can_run_without_waiting_for_decisions` |
| `sim.power_save` | Energiesparen | An: höchstens 4 Entscheidungen je Minute, tagsüber keine Reflexion, Pause, solange kein Browser verbunden ist. | an / aus | aus | sofort | `test_effects_sim.py::test_power_save` |
| `sim.autosave_sim_hours` | Autosave alle … Simulationsstunden | So oft wird automatisch gesichert (0 = aus). Autosaves überschreiben nie manuelle Stände. | 0 bis 48, Schritt 1 Sim-Std. | 6 | sofort | `test_effects_sim.py::test_autosave_follows_the_interval_and_keeps_a_ring` |
| `sim.autosave_real_minutes` | Autosave alle … Echtzeitminuten | Zusätzlich nach so vielen Minuten Echtzeit (0 = aus). | 0 bis 240, Schritt 5 Min. | 30 | sofort | `test_effects_sim.py::test_autosave_follows_the_interval_and_keeps_a_ring` |
| `sim.autosave_keep` | Autosaves behalten | Ringpuffer: so viele Autosaves bleiben, ältere werden gelöscht. | 1 bis 20, Schritt 1 | 5 | sofort | `test_effects_sim.py::test_autosave_follows_the_interval_and_keeps_a_ring` |

## Beobachtungsmodus

| Schlüssel | Name | Bedeutung | Bereich | Standard | Wirkung | Wirkungstest |
|---|---|---|---|---|---|---|
| `mode` | Beobachtungsmodus | Beobachter: die Agenten erfahren nichts. Schöpfer: sie wissen von einer äußeren Instanz. Eingriff: wie Beobachter, mit direkten Nachrichten (später). Änderbar nur, solange die Zeit steht. | `observer`, `creator`, `intervention` | observer | ab der nächsten Entscheidung | `test_effects_sim.py::test_modes_change_the_prompt_but_not_the_memories` |
| `mode.creator_text` | Text für den Schöpfer-Modus | Was die Agenten im Schöpfer-Modus über die äußere Instanz erfahren. | Text, höchstens 600 Zeichen | Du weißt, dass diese Welt und ihre Be … | ab der nächsten Entscheidung | `test_effects_sim.py::test_modes_change_the_prompt_but_not_the_memories` |

## Presets

Sechs mitgelieferte Presets (`backend/simulacra/params/presets/*.json`, schreibgeschützt). Eigene Presets liegen in SQLite (Tabelle `presets`). Beim Laden zeigt die Vorschau jede Änderung mit altem und neuem Wert; Adresse und Modell sind nie Teil eines Presets.

- **Experimentelle Konfiguration** (`experimentelle-konfiguration`, 9 Werte): Stark verändertes Spiel mit Wärmebedürfnis, mehr Zufall, schnelleren Zeitschritten und Entscheidungen im Hintergrund.
- **Freie Exploration** (`freie-exploration`, 11 Werte): Neugierige Figuren, die gern Neues entdecken; wenig Druck durch Bedürfnisse.
- **Hohe Autonomie** (`hohe-autonomie`, 8 Werte): Die Figuren verfolgen eigene Ziele ausdauernd und mit längerem Planhorizont.
- **Kooperative Gemeinschaft** (`kooperative-gemeinschaft`, 7 Werte): Alle helfen einander und teilen Ziele; gemeinsame Erinnerungen zählen mehr.
- **Ressourcenknappheit** (`ressourcenknappheit`, 7 Werte): Holz, Steine und Nahrung sind knapp und wachsen langsam nach; Bauen ist teurer.
- **Soziale Entwicklung** (`soziale-entwicklung`, 7 Werte): Beziehungen stehen im Vordergrund: viel Gespräch, Soziales zählt als Bedürfnis.
