# Abschlussbericht SIMULACRA (AP11)

Stand: 13.10.2026 · Branch `ap/11-abnahme` · Freigabe zum Zusammenführen: **erteilt (13.10.2026)**

## Ergebnis in Kürze

- **Alle 16 Kriterien aus Auftrag §17 haben einen grünen Nachweis**, je Kriterium ein benannter Test (`backend/tests/acceptance/`, `frontend/e2e/acceptance/`). Eine Abweichung braucht eine Entscheidung (offene Frage 17, siehe unten).
- **Langläufe** mit dem endgültigen Code: 2 Stunden mit dem echten Modell (Qwen 9B auf SecondTux, 7,4 Sim-Tage, 1190 Entscheidungen, 99,4 % gültig) und 4 Stunden mit Fake-LLM bei Höchsttempo (1027 Sim-Tage, 220 146 Entscheidungen), ohne Absturz und innerhalb aller Grenzwerte.
- **Sieben Befunde** aus Abnahme und Langlauf behoben, darunter zwei, die man im Alltag gemerkt hätte: Die Agenten schliefen nie, und bei Höchsttempo entstand alle 3–4 Sekunden eine volle Kopie der Datenbank. Dazu ein Befund, der das Repository betraf: Die Weltdaten waren nie eingecheckt.
- **Dokumentation vollständig**; eine Neuinstallation an einem frischen Klon nach `docs/installation.md` gelingt (Einrichtung, alle Tests, Build, Start mit Oberfläche und Modell).
- **SecondTux** (`tuxtower`) läuft als zweiter Rechner mit derselben Einrichtung wie maintux: `http://tuxtower:8090`, Modell `qwen3.8-9b` auf der RTX 3060. Der Langlauf mit echtem Modell lief gegen diesen Router, weil maintux aus war.

## Abnahmematrix (§17)

| Nr. | Kriterium | Status | Nachweis |
|---|---|---|---|
| 1 | Zwei Agenten in einer Welt | ✅ | `test_k01_zwei_agenten_existieren_gleichzeitig_in_derselben_welt`; Playwright `K01 …`: beide Figuren mit Position im Zustand und sichtbar im Canvas |
| 2 | Getrennte Gedächtnisse | ✅ | `test_k02_getrennte_gedaechtnisse` (Abruf Alex ⊄ Mira), `test_k02_jede_gedaechtnisabfrage_filtert_nach_agent` (Code-Scan: jede Abfrage filtert nach `agent_id`) |
| 3 | Eigenständige Aktionswahl | ✅ | `test_k03_beide_waehlen_eigenstaendig_mehrere_aktionsarten`; Langlauf echtes Modell: 1190 Entscheidungen ohne Benutzereingriff, 14 Aktionsarten (u. a. 630 × gehen, 154 × sprechen, 143 × geben, 71 × benutzen, 48 × ansehen, 33 × trinken, 32 × essen, 27 × sammeln, 5 × pflanzen, 4 × schlafen, 2 × bauen) |
| 4 | Aktionen ändern die Welt | ✅ | `test_k04_*`: je registrierter Aktion (16) Zustand vorher/nachher, dazu `test_k04_jede_registrierte_aktion_hat_einen_nachweis` |
| 5 | Dialoge live im Browser | ✅ | Playwright `K05 …`: Sprechblase und Protokollzeile binnen 2 s nach Empfang des Ereignisses; `test_k05_dialoge_kommen_live_binnen_zwei_sekunden` (WebSocket) |
| 6 | Ortswechsel sichtbar | ✅ | Playwright `K06 …`: Bildschirmbewegung der Figur folgt dem Fahrplan aus `agent.walking` (Richtung und Maßstab), Engine steht am Ende auf der Zielkachel; `test_k06_ortswechsel_folgen_im_client_jeder_minute` |
| 7 | Erinnerungen überleben Neustart | ✅ | `test_k07_erinnerungen_ueberleben_einen_harten_neustart` (Serverprozess mit SIGKILL beendet, Inspektor-Daten identisch) |
| 8 | Slider wirken nachweisbar | ✅ | `test_k08_jeder_regler_aendert_seinen_parameter_nachweisbar`, `test_k08_jeder_regler_hat_einen_echten_wirkungstest` (Registry: jeder Parameter mit Abnehmer und Wirkungstest) |
| 9 | Änderungen im Betrieb | ✅ | `test_k09_aenderung_im_laufenden_betrieb_wirkt_ab_der_naechsten_entscheidung` |
| 10 | Freie Eingaben → validierte, persistente Ereignisse | ✅ | `test_k10_freie_eingaben_werden_validierte_persistente_ereignisse`: die elf Beispielsätze aus §10, nach hartem Neustart noch vorhanden |
| 11 | Nur zugängliches Wissen | ✅ | `test_k11_agenten_erhalten_nur_zugaengliches_wissen` (`inform`, Sichtbarkeit, Mithören nur in Reichweite) |
| 12 | Pause/Fortsetzen/Schritt | ✅ | Playwright `K12 …` über die Bedienleiste; `test_k12_pause_fortsetzen_einzelschritt` (API) |
| 13 | Refresh stellt Zustand her | ✅ | Playwright `K13 …`: Neuladen mitten auf einem Weg, Uhr, Protokoll und Figurenpositionen gleich; `test_k13_neu_verbinden_…` (WebSocket) |
| 14 | Ohne Cloud-LLM | ✅ | `test_k14_simulation_laeuft_hinter_einer_netzsperre_nur_mit_lokalem_modell`, `test_k14_kein_cloud_endpunkt_in_code_oder_konfiguration`; mit echtem Modell: `test_k14_echtes_modell_im_heimnetz_hinter_der_netzsperre` gegen SecondTux (nur der Router kommt durch die Sperre) |
| 15 | Ungültige Antworten harmlos | ✅ | `test_k15_serie_kaputter_antworten_laesst_die_welt_unbeschaedigt`: Garbage-Serie (leer, kein JSON, falsche Typen, erfundene Optionen, Shell-Befehle, 200 000 Zeichen, Netzfehler …), danach Integritätsprüfung des Weltzustands |
| 16 | Ressourcenverbrauch begrenzt | ✅ | `test_k16_*`: Entscheidungen je Minute, Objekte, aktive Erinnerungen, Gesprächslänge, Eingaben je Minute, WebSocket-Rückstand halten im Lauf; `test_k16_langlauf_bleibt_innerhalb_der_grenzwerte` gegen beide Langläufe |

### Abweichung, die eine Entscheidung braucht

- **Warte-Serien (offene Frage 17):** Der AP11-Grenzwert „keine Aktion ≥ 5× hintereinander“ ist für alle Aktionen geprüft, die der Wiederholungsschutz überwacht. Warten und Gesprächszüge nimmt der Schutz absichtlich aus. Im Fake-Lauf kamen nachts Warte-Serien bis 7 vor (vor der neuen Schlaf-Option bis 8), im Lauf mit echtem Modell höchstens 3 gleiche Aktionen in Folge, gleich welcher Art. Geprüft ist der Grenzwert deshalb nur für überwachte Aktionen (dort höchstens 3). Soll Warten ebenfalls begrenzt werden?

### Sonst offen benannt (bereits entschieden oder dokumentiert)

- Langlauf mit echtem Modell gegen **SecondTux statt maintux** (maintux war aus). Gleiches Modell in anderer Quantisierung (`qwen3.8-9b` Q8_0 statt `-uncensored`), RTX 3060 statt 3080.
- Die **Obergrenze aktiver Erinnerungen** greift einmal je Sim-Tag (bei der Pflege), nicht hart; Einsichten, Zusammenfassungen und offene Vorhaben werden nie archiviert ([grenzen.md](../grenzen.md)).
- Neustart von maintux als Teil der AP10-Abnahme ausgesetzt (Entscheidung); Python 3.14 statt 3.12.
- Alle bekannten Vereinfachungen: [grenzen.md](../grenzen.md).

## Befunde und Korrekturen in AP11

| Befund | Wirkung | Korrektur |
|---|---|---|
| Sprechen an sich selbst legte ein Gespräch `[x, x]` an (K15) | Gesprächsansicht stürzte ab | kein Gespräch mit sich selbst oder Unbekannten; Regressionstest |
| Agenten schliefen nie (Langlauf, echtes Modell: 0 Schlaf in vier Sim-Tagen) | Energie sank dauerhaft, nachts Betrieb wie am Tag | neue Option „Zum Schlafen ins Bett gehen“ (Nacht oder Energie < 50), bewertet wie Schlafen; Tests bis zum Schlaf im Zyklus |
| Autosave bei Höchsttempo alle 3–4 s (≈ 400 MB je Kopie, ≈ 100 MB/s Schreiblast) | SSD-Verschleiß, Speicherspitzen | Mindestabstand 2 min Echtzeit für den Sim-Stunden-Autosave; Test |
| Fake-Modell protokollierte jeden Aufruf unbegrenzt | Speicher des Fake-Langlaufs wuchs stetig (nur Tests) | Protokoll gekappt |
| Weltdaten (`world_default.json`, `blueprints.json`) nie im Repository | frischer Klon startete nicht (Ausrollen ging, weil rsync den Arbeitsordner kopiert) | `.gitignore` auf `/data/` beschränkt, Dateien eingecheckt |
| Langlauf maß mit `time.monotonic()` | auf macOS steht die Uhr im Ruhezustand: der „2-Stunden“-Lauf dauerte 21 h | Uhrzeit, Start mit `caffeinate` |
| Abruf-Test im Browser hing an der Reihenfolge der Tests | gelegentlich rot nach Serverstart | wartet, bis ein Abruf da ist |

Außerdem: Bewegung verdichtet (ein Fahrplan je Weg statt eines Ereignisses je Kachel, offene Frage 13), Wiederholungsschutz auch bei kurzen Optionslisten und freien Aktionen, Deploy-Skript für andere Ziele (`SIM_SSH_OPTS`, `SIM_DEPLOY_USER`), Playwright-Ports wählbar.

Nicht behoben, als eigene Aufgabe vorgeschlagen: `test_clock_after_reset_never_carries_the_old_minute` ist einmal in der vollen Suite unter Last gescheitert (isoliert 25 von 25 grün); möglicherweise ein seltenes Rennen beim Uhrtakt nach dem Zurücksetzen.

## Langlauf

Vollständiger Bericht mit Messtabellen und Diagrammen: [langlauf.md](langlauf.md).

| | echtes Modell (SecondTux) | Fake-LLM, Höchsttempo |
|---|---|---|
| Dauer / simulierte Zeit | 2 h / 7,4 Sim-Tage | 4 h / 1027 Sim-Tage |
| Entscheidungen (gültig) | 1190 (1183) | 220 146 (220 146) |
| LLM-Fehler / längste Fehlerserie | 6 / 2 | 0 / 0 |
| RAM höchstens (Grenze 1 GB) | 93 MB (Start), danach 54–63 MB | 139 MB |
| DB-Wachstum je Sim-Tag (Grenze 50 MB) | 2,9 MB | 2,5 MB |
| längste Folge gleicher überwachter Aktion (Grenze < 5) | 3 | 3 |
| längste Gesprächslänge (Höchstwert 8) | 8 | 2 |
| Lücken in der Ereignisfolge (WebSocket) | 0 | 0 |
| aktive Erinnerungen am Ende (Grenze 2000 je Tag) | 731 / 706 | 2079 / 2031 |

Beobachtungen, keine Grenzwertverletzung:
- **Schlaf:** 17 Schlafphasen in 7,4 Sim-Tagen (vorher 0). Die Agenten gehen aber öfter zum Bett (77 ×), als sie dort einschlafen; gut die Hälfte aller Entscheidungen ist ein Weg (630 von 1190). Das Gleichgewicht zwischen „ins Bett gehen“ und „schlafen“ ist ein Kandidat für die Feinabstimmung.
- **Aktive Erinnerungen** liegen im Fake-Lauf knapp über 2000: die Obergrenze greift einmal je Sim-Tag, dazwischen wächst der Bestand (dokumentiert in [grenzen.md](../grenzen.md)).
- **Gespräche im Fake-Lauf** sind selten (7 in 1027 Sim-Tagen): das deterministische Fake-Modell bringt die beiden kaum zusammen. Mit dem echten Modell waren es 96 in 7,4 Sim-Tagen.
- Der Lauf mit echtem Modell teilte sich etwa 6 Minuten lang den einzigen Modell-Slot mit dem Integrationstest (K14); das senkte in diesem Fenster die Entscheidungen je Minute.
- Frühere Läufe (vor den Korrekturen, mit Autosave-Flut bzw. ohne Schlaf-Option) liegen in `data/langlauf-alt/`.

## Testläufe

Vollständige Ausgaben mit Datum in [testlaeufe/](testlaeufe/):

| Lauf | Ergebnis | Datei |
|---|---|---|
| Backend (pytest, alle außer `integration`/`slow`) | 956 bestanden | [pytest.txt](testlaeufe/pytest.txt) |
| Backend mit echtem Modell und Langlauf-Test (`-m "integration or slow"`, Router SecondTux) | 3 bestanden | [pytest-integration-slow.txt](testlaeufe/pytest-integration-slow.txt) |
| Frontend: `tsc` und Vitest | sauber, 72 bestanden | [vitest.txt](testlaeufe/vitest.txt) |
| Browser (Playwright, Fake-Modell, inkl. `e2e/acceptance/`) | 49 bestanden | [playwright.txt](testlaeufe/playwright.txt) |
| `pip-audit`, `npm audit` | keine bekannten Schwachstellen | – |

## Sicherheitsdurchsicht

- `pip-audit -r requirements.lock`: keine bekannten Schwachstellen. `npm audit`: 0 Schwachstellen.
- API-Schlüssel: nicht im gebauten Frontend, nicht in Logs, Datenbanken oder Spielständen, nicht in Antworten von `/api/health`, `/api/status`, `/api/state`, `/api/overview`, `/api/params`, `/api/params/schema`, `/api/stats`, nicht im Image und nicht in den Container-Logs auf SecondTux (geprüft durch Suche nach dem Schlüsselwert). In der Konfiguration als `SecretStr`.
- Keine Ausführung von Modelltext: kein `eval`, `exec`, `subprocess`, `os.system`, `pickle` im Backend; K15 belegt, dass Befehle in Antworten wirkungslos bleiben.
- Eingaben werden geprüft (Pydantic, Weltregeln, Längen- und Ratengrenzen), verändernde Anfragen brauchen einen Idempotency-Key, der optionale Zugangsschutz ist in [betrieb.md](../betrieb.md) beschrieben.

## Dokumentation

| Datei | Stand |
|---|---|
| `README.md` | neu: was SIMULACRA ist, Bildschirmfoto, Schnellstart Mac und Server |
| `docs/installation.md` | neu, an einem frischen Klon nachvollzogen |
| `docs/llm-anbindung.md` | ergänzt: anderes Modell oder andere Maschine, Messung SecondTux |
| `docs/konfiguration.md`, `docs/parameter.md` | aktuell (`parameter.md` aus der Registry erzeugt) |
| `docs/architektur.md` | neu: Module, Datenfluss, Entscheidungszyklus, Ereignismodell, Diagramme |
| `docs/schnittstellen.md` | aktuell (REST, WebSocket, Ereignistypen, Datenmodelle) |
| `docs/betrieb.md` | ergänzt: anderer Rechner (SecondTux) |
| `docs/erweitern.md` | neu: Aktion, Objektart, Parameter, Ereignistyp, dritter Agent |
| `docs/grenzen.md` | neu: Vereinfachungen und Ideen |

## Startbefehle

```bash
# lokal (Entwicklung)
scripts/dev.sh                     # Backend :8090, Oberfläche http://127.0.0.1:5173; beenden: scripts/stop.sh

# lokal (wie im Container, gebautes Frontend)
cd frontend && npm run build && cd ../backend && SIM_DATA_DIR=../data SIM_STATIC_DIR=../frontend/dist .venv/bin/python -m simulacra

# maintux (vom Mac, nur nach Freigabe)
scripts/deploy_maintux.sh

# SecondTux (vom Mac)
SIM_DEPLOY_HOST=tuxtower SIM_DEPLOY_USER=<benutzer> SIM_SSH_OPTS="-o IdentitiesOnly=yes -i $HOME/.ssh/id_ed25519_server" scripts/deploy_maintux.sh

# Langlauf und Bericht
caffeinate -i backend/.venv/bin/python scripts/langlauf.py run --mode real --hours 2 --out data/langlauf/real
backend/.venv/bin/python scripts/langlauf_report.py data/langlauf/real data/langlauf/fake
```

## Projektdateien

Alle eingecheckten Quelldateien mit Zeilenzahl. Vorgabe: keine Datei über 400 Zeilen. Eingehalten von allen handgeschriebenen Dateien; größte: `backend/simulacra/events/models.py` mit 377 Zeilen. Darüber liegen nur erzeugte Dateien (`frontend/src/types/generated.ts`, `schema.json` aus den Pydantic-Modellen; `package-lock.json`, `requirements.lock`).

<details><summary>368 Dateien</summary>

```
   57  README.md
   31  backend/pyproject.toml
    1  backend/simulacra/__init__.py
   15  backend/simulacra/__main__.py
    0  backend/simulacra/agents/__init__.py
  164  backend/simulacra/agents/autonomy.py
   25  backend/simulacra/agents/context.py
  172  backend/simulacra/agents/conversation.py
   15  backend/simulacra/agents/defaults/alex.json
   15  backend/simulacra/agents/defaults/mira.json
   72  backend/simulacra/agents/explain.py
   50  backend/simulacra/agents/factors/__init__.py
   99  backend/simulacra/agents/factors/core.py
   78  backend/simulacra/agents/factors/drive.py
   44  backend/simulacra/agents/factors/needs.py
   62  backend/simulacra/agents/factors/social.py
  189  backend/simulacra/agents/goals.py
   88  backend/simulacra/agents/guards.py
   68  backend/simulacra/agents/model.py
   25  backend/simulacra/agents/modes.py
   46  backend/simulacra/agents/mood.py
  113  backend/simulacra/agents/needs.py
  142  backend/simulacra/agents/observations.py
  147  backend/simulacra/agents/options.py
  130  backend/simulacra/agents/perception.py
   88  backend/simulacra/agents/phrases.py
  169  backend/simulacra/agents/planner.py
  209  backend/simulacra/agents/plans.py
   91  backend/simulacra/agents/prompts.py
  163  backend/simulacra/agents/relations.py
  101  backend/simulacra/agents/scoring.py
  122  backend/simulacra/agents/store.py
    0  backend/simulacra/api/__init__.py
   90  backend/simulacra/api/app.py
  122  backend/simulacra/api/auth.py
   53  backend/simulacra/api/idempotency.py
  269  backend/simulacra/api/models.py
  130  backend/simulacra/api/models_autonomy.py
   57  backend/simulacra/api/models_inject.py
  106  backend/simulacra/api/models_memory.py
  155  backend/simulacra/api/models_params.py
  128  backend/simulacra/api/models_saves.py
  126  backend/simulacra/api/routes_autonomy.py
   79  backend/simulacra/api/routes_events.py
   59  backend/simulacra/api/routes_inject.py
  122  backend/simulacra/api/routes_memory.py
  153  backend/simulacra/api/routes_params.py
  101  backend/simulacra/api/routes_saves.py
   85  backend/simulacra/api/routes_sim.py
   34  backend/simulacra/api/routes_state.py
   19  backend/simulacra/api/routes_stats.py
   92  backend/simulacra/api/schema_export.py
   92  backend/simulacra/api/state.py
   26  backend/simulacra/api/static.py
  113  backend/simulacra/api/ws.py
    5  backend/simulacra/app.py
  204  backend/simulacra/cli.py
  166  backend/simulacra/cli_sim.py
   75  backend/simulacra/config.py
   54  backend/simulacra/data/blueprints.json
  122  backend/simulacra/data/world_default.json
    0  backend/simulacra/db/__init__.py
  126  backend/simulacra/db/connection.py
    0  backend/simulacra/events/__init__.py
   92  backend/simulacra/events/bus.py
  377  backend/simulacra/events/models.py
   42  backend/simulacra/events/models_move.py
   64  backend/simulacra/events/models_user.py
   39  backend/simulacra/events/schema.py
   64  backend/simulacra/events/store.py
  135  backend/simulacra/events/types.py
   16  backend/simulacra/events/ulid.py
    0  backend/simulacra/events_user/__init__.py
  250  backend/simulacra/events_user/apply.py
  104  backend/simulacra/events_user/interpret.py
   47  backend/simulacra/events_user/knowledge.py
  116  backend/simulacra/events_user/lexicon.py
  115  backend/simulacra/events_user/npc.py
  279  backend/simulacra/events_user/rules.py
   44  backend/simulacra/events_user/scheduler.py
  153  backend/simulacra/events_user/schema.py
  241  backend/simulacra/events_user/service.py
   54  backend/simulacra/events_user/times.py
  353  backend/simulacra/events_user/validate.py
    0  backend/simulacra/llm/__init__.py
   62  backend/simulacra/llm/client.py
   47  backend/simulacra/llm/metrics.py
  148  backend/simulacra/llm/providers.py
    0  backend/simulacra/memory/__init__.py
   38  backend/simulacra/memory/importance.py
   46  backend/simulacra/memory/keywords.py
   85  backend/simulacra/memory/knowledge.py
   67  backend/simulacra/memory/maintenance.py
   43  backend/simulacra/memory/models.py
   38  backend/simulacra/memory/params.py
  151  backend/simulacra/memory/reflection.py
  129  backend/simulacra/memory/retrieval.py
  138  backend/simulacra/memory/store.py
   62  backend/simulacra/memory/system.py
  160  backend/simulacra/memory/writer.py
    0  backend/simulacra/params/__init__.py
  124  backend/simulacra/params/apply.py
  118  backend/simulacra/params/presets.py
   16  backend/simulacra/params/presets/experimentelle-konfiguration.json
   24  backend/simulacra/params/presets/freie-exploration.json
   21  backend/simulacra/params/presets/hohe-autonomie.json
   26  backend/simulacra/params/presets/kooperative-gemeinschaft.json
   14  backend/simulacra/params/presets/ressourcenknappheit.json
   23  backend/simulacra/params/presets/soziale-entwicklung.json
   13  backend/simulacra/params/registry.py
   76  backend/simulacra/params/spec.py
  123  backend/simulacra/params/specs_agents.py
   79  backend/simulacra/params/specs_llm.py
   33  backend/simulacra/params/specs_memory.py
   49  backend/simulacra/params/specs_sim.py
  116  backend/simulacra/params/specs_world.py
   23  backend/simulacra/params/store.py
    0  backend/simulacra/saves/__init__.py
  178  backend/simulacra/saves/cli.py
   49  backend/simulacra/saves/index.py
  107  backend/simulacra/saves/portable.py
  151  backend/simulacra/saves/service.py
   49  backend/simulacra/saves/snapshot.py
    0  backend/simulacra/simulation/__init__.py
  162  backend/simulacra/simulation/builder.py
   40  backend/simulacra/simulation/limits.py
  341  backend/simulacra/simulation/runner.py
    0  backend/simulacra/stats/__init__.py
  139  backend/simulacra/stats/queries.py
   17  backend/simulacra/stats/sampler.py
    0  backend/simulacra/world/__init__.py
   13  backend/simulacra/world/actions/__init__.py
  105  backend/simulacra/world/actions/base.py
  110  backend/simulacra/world/actions/building.py
  170  backend/simulacra/world/actions/items.py
  180  backend/simulacra/world/actions/movement.py
   81  backend/simulacra/world/actions/needs.py
  191  backend/simulacra/world/actions/resources.py
   31  backend/simulacra/world/actions/social.py
  203  backend/simulacra/world/actions/use_modes.py
   62  backend/simulacra/world/clock.py
  324  backend/simulacra/world/engine.py
   37  backend/simulacra/world/events.py
  295  backend/simulacra/world/extend.py
   58  backend/simulacra/world/grid.py
   84  backend/simulacra/world/loader.py
  124  backend/simulacra/world/models.py
   89  backend/simulacra/world/object_kinds.py
   93  backend/simulacra/world/patches.py
   60  backend/simulacra/world/pathfinding.py
   24  backend/simulacra/world/rules.py
  228  backend/simulacra/world/state.py
   25  backend/simulacra/world/weather.py
    0  backend/tests/acceptance/__init__.py
   81  backend/tests/acceptance/conftest.py
   73  backend/tests/acceptance/test_k01_k03_agenten.py
  181  backend/tests/acceptance/test_k04_aktionen.py
  137  backend/tests/acceptance/test_k05_k06_k12_k13_live.py
   77  backend/tests/acceptance/test_k07_k10_neustart.py
   97  backend/tests/acceptance/test_k08_k09_k11_steuerung_wissen.py
  124  backend/tests/acceptance/test_k14_ohne_cloud.py
   93  backend/tests/acceptance/test_k15_kaputte_antworten.py
   99  backend/tests/acceptance/test_k16_ressourcen.py
    0  backend/tests/agents/__init__.py
   74  backend/tests/agents/conftest.py
  210  backend/tests/agents/test_conversation_observations.py
  229  backend/tests/agents/test_perception_options.py
  145  backend/tests/agents/test_planner.py
  266  backend/tests/agents/test_runner.py
    0  backend/tests/api/__init__.py
   55  backend/tests/api/conftest.py
   47  backend/tests/api/test_autonomy_api.py
   84  backend/tests/api/test_idempotency.py
   80  backend/tests/api/test_memory_api.py
  150  backend/tests/api/test_rest.py
  109  backend/tests/api/test_serving.py
   49  backend/tests/api/test_types.py
  218  backend/tests/api/test_ws.py
    0  backend/tests/autonomy/__init__.py
   60  backend/tests/autonomy/helpers.py
   96  backend/tests/autonomy/test_explain.py
  196  backend/tests/autonomy/test_factors.py
  240  backend/tests/autonomy/test_goals.py
  230  backend/tests/autonomy/test_guards.py
   51  backend/tests/autonomy/test_longrun.py
  124  backend/tests/autonomy/test_needs_mood.py
  153  backend/tests/autonomy/test_relations.py
    5  backend/tests/conftest.py
    0  backend/tests/events/__init__.py
  217  backend/tests/events/test_bus_store.py
    0  backend/tests/events_user/__init__.py
   42  backend/tests/events_user/conftest.py
   95  backend/tests/events_user/test_api.py
  168  backend/tests/events_user/test_examples.py
  303  backend/tests/events_user/test_pipeline.py
    0  backend/tests/integration/__init__.py
   40  backend/tests/integration/test_live_model.py
    0  backend/tests/llm/__init__.py
  171  backend/tests/llm/test_client.py
    0  backend/tests/memory/__init__.py
  135  backend/tests/memory/test_integration.py
  185  backend/tests/memory/test_reflection_maintenance.py
  177  backend/tests/memory/test_store_retrieval.py
    0  backend/tests/params/__init__.py
   25  backend/tests/params/conftest.py
  115  backend/tests/params/test_api.py
   10  backend/tests/params/test_doc.py
  137  backend/tests/params/test_effects_agents.py
   97  backend/tests/params/test_effects_llm.py
   82  backend/tests/params/test_effects_memory.py
  137  backend/tests/params/test_effects_sim.py
  145  backend/tests/params/test_effects_world.py
   26  backend/tests/params/test_live_change.py
  100  backend/tests/params/test_presets.py
  108  backend/tests/params/test_registry.py
    0  backend/tests/saves/__init__.py
   37  backend/tests/saves/conftest.py
   86  backend/tests/saves/test_api.py
  127  backend/tests/saves/test_backup_cli.py
  127  backend/tests/saves/test_portable.py
  139  backend/tests/saves/test_saves.py
  196  backend/tests/saves/test_scripts.py
  100  backend/tests/saves/test_stats.py
   47  backend/tests/test_config.py
   19  backend/tests/test_file_size.py
   69  backend/tests/test_health.py
    0  backend/tests/world/__init__.py
   73  backend/tests/world/conftest.py
  121  backend/tests/world/test_building.py
   62  backend/tests/world/test_db.py
  256  backend/tests/world/test_engine.py
  334  backend/tests/world/test_extend.py
  178  backend/tests/world/test_items.py
  131  backend/tests/world/test_movement.py
   67  backend/tests/world/test_pathfinding.py
  256  backend/tests/world/test_resources.py
   64  backend/tests/world/test_time_weather.py
  109  backend/tests/world/test_walking.py
   62  backend/tests/world/test_world_data.py
   27  deploy/compose.yaml
  115  frontend/e2e/acceptance/abnahme.spec.ts
   31  frontend/e2e/auth.spec.ts
   71  frontend/e2e/autonomy.spec.ts
  115  frontend/e2e/composer.spec.ts
   48  frontend/e2e/helpers.ts
   82  frontend/e2e/memory.spec.ts
  139  frontend/e2e/saves.spec.ts
  107  frontend/e2e/settings.spec.ts
  139  frontend/e2e/simulation.spec.ts
   48  frontend/e2e/world.spec.ts
   12  frontend/index.html
   34  frontend/package.json
   30  frontend/playwright.config.ts
   23  frontend/src/App.tsx
   36  frontend/src/auth/Login.tsx
   72  frontend/src/composer/Cards.tsx
   87  frontend/src/composer/EventComposer.tsx
  102  frontend/src/composer/composerStore.test.ts
  106  frontend/src/composer/composerStore.ts
   56  frontend/src/composer/suggestions.ts
   41  frontend/src/controls/ResetDialog.tsx
   50  frontend/src/controls/SimulationControls.tsx
   80  frontend/src/history/EventHistory.tsx
   69  frontend/src/index.css
   45  frontend/src/layout/AppShell.tsx
   60  frontend/src/layout/Header.tsx
    8  frontend/src/lib/Icon.tsx
   14  frontend/src/lib/Portrait.tsx
   24  frontend/src/lib/autonomyText.test.ts
   26  frontend/src/lib/autonomyText.ts
   47  frontend/src/lib/clock.ts
   22  frontend/src/lib/names.ts
   46  frontend/src/lib/px.ts
   10  frontend/src/lib/useNames.ts
   10  frontend/src/main.tsx
   32  frontend/src/memory/KnowledgeView.tsx
   55  frontend/src/memory/MemoryDetail.tsx
   83  frontend/src/memory/MemoryInspector.tsx
   44  frontend/src/memory/MemoryList.tsx
   28  frontend/src/memory/RetrievalLog.tsx
    7  frontend/src/memory/labels.ts
   41  frontend/src/memory/useMemories.ts
  140  frontend/src/net/api.ts
   76  frontend/src/net/connect.ts
   12  frontend/src/net/gap.test.ts
    8  frontend/src/net/gap.ts
   24  frontend/src/net/useHealth.ts
   29  frontend/src/net/useOverview.ts
  124  frontend/src/net/wsClient.test.ts
  159  frontend/src/net/wsClient.ts
   73  frontend/src/panels/AgentDetail.tsx
   64  frontend/src/panels/AgentPanel.tsx
   17  frontend/src/panels/Drawer.tsx
   21  frontend/src/panels/FailureList.tsx
   45  frontend/src/panels/GoalView.tsx
   36  frontend/src/panels/LocationDetail.tsx
   19  frontend/src/panels/NeedsBars.tsx
   38  frontend/src/panels/RelationView.tsx
   20  frontend/src/panels/useDetail.ts
  109  frontend/src/saves/SaveLoadDialog.tsx
   89  frontend/src/settings/ParamControl.tsx
   42  frontend/src/settings/ParamGroup.tsx
   76  frontend/src/settings/ParameterPanel.tsx
  106  frontend/src/settings/PresetManager.tsx
   58  frontend/src/settings/StatusPanels.tsx
   27  frontend/src/settings/labels.ts
   84  frontend/src/settings/paramStore.test.ts
   92  frontend/src/settings/paramStore.ts
   40  frontend/src/stats/LineChart.tsx
   93  frontend/src/stats/StatsView.tsx
   67  frontend/src/store/reducers/agents.ts
   30  frontend/src/store/reducers/helpers.ts
   54  frontend/src/store/reducers/index.ts
  121  frontend/src/store/reducers/reducers.test.ts
   13  frontend/src/store/reducers/sim.ts
   78  frontend/src/store/reducers/walks.test.ts
   62  frontend/src/store/reducers/walks.ts
   63  frontend/src/store/reducers/world.ts
   98  frontend/src/store/simStore.test.ts
   84  frontend/src/store/simStore.ts
   54  frontend/src/store/types.ts
   73  frontend/src/store/uiStore.ts
   38  frontend/src/test/fixtures.ts
   37  frontend/src/timeline/DecisionDetail.tsx
   45  frontend/src/timeline/EventDetail.tsx
   92  frontend/src/timeline/EventTimeline.tsx
   30  frontend/src/timeline/FactorBars.tsx
   28  frontend/src/timeline/describeEvent.test.ts
  129  frontend/src/timeline/describeEvent.ts
   18  frontend/src/timeline/filter.ts
 2197  frontend/src/types/generated.ts
 6663  frontend/src/types/schema.json
   58  frontend/src/world/Overlays.tsx
   57  frontend/src/world/WorldCanvas.tsx
   97  frontend/src/world/draw/characters.ts
   80  frontend/src/world/draw/effects.ts
   28  frontend/src/world/draw/fences.ts
   92  frontend/src/world/draw/furniture.ts
   47  frontend/src/world/draw/objects.ts
  109  frontend/src/world/draw/outdoor.ts
   38  frontend/src/world/draw/pen.ts
   43  frontend/src/world/draw/roof.test.ts
   94  frontend/src/world/draw/roof.ts
  204  frontend/src/world/draw/terrain.ts
   34  frontend/src/world/draw/tools.ts
   63  frontend/src/world/draw/vegetation.ts
  259  frontend/src/world/scenes/WorldScene.ts
  120  frontend/src/world/scenes/agentViews.ts
   71  frontend/src/world/scenes/cameraRig.ts
   56  frontend/src/world/worldBridge.ts
   17  frontend/tsconfig.json
   16  frontend/vite.config.ts
    5  frontend/vitest.config.ts
   14  scripts/_compose.sh
   44  scripts/_remote_up.sh
   35  scripts/backup.sh
   44  scripts/deploy_maintux.sh
   37  scripts/dev.sh
   84  scripts/e2e_server.py
   68  scripts/gen_config_doc.py
   24  scripts/gen_types.sh
  229  scripts/langlauf.py
  138  scripts/langlauf_report.py
  296  scripts/probe_llm.py
   27  scripts/restore.sh
   21  scripts/rsync-excludes.txt
   25  scripts/stop.sh
   63  scripts/ws_tail.py
```
</details>
