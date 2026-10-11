# Agenten und Entscheidungszyklus (AP02)

## Ablauf einer Entscheidung
Ein Agent entscheidet, sobald er keine Aktion mehr ausführt. Die Zeit wartet darauf (ein Schritt = fällige Entscheidungen, dann ein Tick).

1. **Wahrnehmen** (`agents/perception.py`): nur der eigene Ort, sichtbare Personen (derselbe Ort, oder draußen bis 8 Kacheln; Wände verdecken die Sicht), eigener Körper in Worten, Inventar, bekannte Orte, laufendes Gespräch. Verborgene Objekte erscheinen erst nach ihrer Entdeckung.
2. **Erinnern:** die letzten `SIM_SIM_MEMORY_LINES` Beobachtungen (`observations`, bleibt vollständig erhalten; ab AP05 Gedächtnisabruf).
3. **Optionen erzeugen** (`agents/options.py`): rund 20–60 Kandidaten, jeder per **Trockenlauf der Engine** geprüft (`engine.check`). Das Modell sieht nur gültige Handlungen.
4. **Bewerten** (`agents/scoring.py`): Punktzahl 0–100 aus benannten Faktoren: Grundneigung der Art, **Persönlichkeitswerte** (Geselligkeit, Neugier, Hilfsbereitschaft, Risiko, Konflikt, Kooperation, Ruhebedürfnis, Gesprächsinitiative, Annahmebereitschaft), Bedürfnisse (Müdigkeit, Hunger, Durst), Tageszeit, Wetter, Ziele und Interessen (über Themen der Orte), Vorhaben, Wiederholung, Weg. Die besten K (Vielfalt: höchstens 2 je Art) gehen an das Modell; dringende Bedürfnisse und offene Gesprächsfragen erzwingen passende Optionen.
5. **Entscheiden** (`agents/planner.py`, `agents/prompts.py`): fester Systemteil (Rolle, Profil, Regeln) vorn, danach Situation, Erinnerungen, Optionen. Antwort per Schema-Zwang: `option_id`, `intent`, `utterance`, `importance`, optional `plan_next`, `proposal`, `other_action`, `other_params`. `other` erlaubt eine eigene Handlung, die die Engine prüft.
6. **Validieren:** Pydantic-Prüfung, unbekannte Option oder fehlende Äußerung → Korrekturnachricht (bis `SIM_SIM_CORRECTION_RETRIES`). Danach Rückfall `wait 10` und Ereignis `agent.decision_failed`. Netz- und Zeitfehler führen ohne Korrektur zum Rückfall.
7. **Ausführen:** `engine.propose`. Die Engine entscheidet, das Modell behauptet nichts. Eine Ablehnung wird dem Agenten als Beobachtung zurückgemeldet.
8. **Protokoll:** Tabelle `decisions` mit allen angebotenen Optionen samt Punktzahl und Faktoren, Wahl, Absicht, Ergebnis, Latenz, Tokens, Fehlern. `python -m simulacra.cli decisions alex` zeigt es lesbar.

Rohantworten werden nur im Fehlerfall und auf 300 Zeichen gekürzt festgehalten; Gedankenketten werden nicht gespeichert (§13).

## Gespräche (`agents/conversation.py`)
Entstehen mit `speak`, werden mit dem ersten Beitrag aktiv und enden bei: `max_turns`, `timeout` (30 min Stille), `left` (Entfernung > 4 Kacheln), `repetition` (Wortüberschneidung ≥ 0,8 mit eigenem Beitrag der letzten zwei Züge), `farewell`. Der Angesprochene bekommt Optionen „antworten“ und „beenden“. Ein `proposal` wird dem Gegenüber als „annehmen“/„ablehnen“ angeboten; Annahme setzt für beide `plan_next`. Annahmebereitschaft und Kooperation fließen in die Punkte ein.

## Gleichbehandlung aller Figuren
Die Wahrnehmung unterscheidet nicht, wie eine andere Figur gesteuert wird, und der Prompt enthält keinen Hinweis auf Steuerung, Simulation oder einen Schöpfer (per Test abgesichert). Das ist die Grundlage für die vorgemerkten Mitspieler-Charaktere.

## Simulationsschleife (`simulation/runner.py`)
Zustände `stopped`, `running`, `paused`, `stepping`. `pause()` lässt die laufende Modellanfrage zu Ende laufen und hält danach an; `step(n)` führt genau n vollständige Schritte aus; `start(ticks=n)` läuft n Ticks. Reihenfolge der Agenten wechselt je Schritt. Grenzen: `SIM_SIM_MIN_DECISION_GAP_S`, `SIM_SIM_MAX_DECISIONS_PER_MINUTE`, Geschwindigkeit über `SIM_SIM_TICK_DELAY_S`. Zurücksetzen (`Simulation.reset`) sichert die alte Datenbank unter `data/backups/` und löscht nie.

## Werkzeuge
```bash
cd backend
.venv/bin/python -m simulacra.cli run --ticks 200               # echtes Modell, Live-Protokoll und Auswertung
.venv/bin/python -m simulacra.cli run --ticks 200 --provider first   # ohne Modell: immer die erste Option (Offline-Test)
.venv/bin/python -m simulacra.cli sim                           # start · pause · resume · step · speed · status · quit
.venv/bin/python -m simulacra.cli decisions alex --limit 5      # Optionen, Punkte, Faktoren, Wahl, Ergebnis
.venv/bin/python -m pytest -m integration -s                    # Lauf gegen maintux (nicht im Standardlauf)
```
