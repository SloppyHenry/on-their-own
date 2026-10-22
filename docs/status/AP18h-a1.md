# AP18h-a1 Grundlage (22.10.2026)

**Branch:** `claude/ap18h-a1-grundlage-eec941`, nicht in `main`, nicht ausgerollt. Nur a1: kein Endpunkt, keine Oberfläche, keine Frist (kommt in a3).

## Was jetzt da ist
- **`simulation/mitleben.py`** (neu): `player_id(state)`, `set_player`, `autopilot_on`, `set_autopilot`, `human_controlled`. Zustand in der Meta `player` (Kennung) und `player_autopilot` (bool). `player_id` gilt **nur in der Spielart „leben“** und nur für einen existierenden Bewohner; in „gott“ (auch nach einem Wechsel) ist die Figur ein normaler Bewohner, für den das Modell entscheidet (Entscheidung 84). `set_player` schaltet den Autopilot aus. Alte Spielstände ohne Meta: kein Mensch, alles wie bisher.
- **`AgentStore`**: `ai_agent_ids()` ist ersetzt durch `profile_ids()` (alle Bewohner mit Profil) und `thinking_ids()` (ohne die eigene Figur, solange der Autopilot aus ist).
- Die eigene Figur zählt wie jeder Bewohner (max. 8, braucht Bett); das ist Sache der Wahl in c1, a1 ändert daran nichts.

## Zuordnung der Stellen
Zu `thinking_ids` (Modell denkt): `runner._due_agents` (Entscheidung), `runner._housekeeping` Reflexion (Zeile 196), `autonomy.housekeeping` (Zielplanung).
Zu `profile_ids` (passive Pflege): `runner` Gedächtniswartung am Tag, `_remember` (2×), Status in `_after_tick`; `autonomy.after_tick` (Bedürfnisse, Beziehungen, Ortswissen, Fehlschläge); `params/apply.py`; `api/routes_stats.py`, `stats/sampler.py`; `api/routes_autonomy.py` (Übersicht); `events_user/apply.py` (2×), `service.py`, `welt.py` (Wissensverteilung, Lexikon). Die fünf Tests, die `ai_agent_ids` nannten, nutzen `profile_ids`.

## Prüfung
`backend/tests/player/test_grundlage.py` (7 Tests): alter Stand unverändert; Mengen und Autopilot-Umschaltung, Wechsel auf Gott; unbekannte Figur abgelehnt; Runner entscheidet die Figur ohne Autopilot nie (keine Zeile in `decisions`, kein Prompt „Du bist Alex“, keine Handlung); Hunger steigt trotzdem; Alex hört Mira zu (Beobachtung) und erfährt ein Weltereignis (`agent.informed`); mit Autopilot entscheiden beide.

## Hinweise
- Die Tests brauchen Python 3.14 (`list[...]` in Klassen mit Methode `list`); `uv run` ohne `--python 3.14` nimmt 3.12 und scheitert schon beim Import, unabhängig von a1.
- Die Auslieferung der Meta in den Spielstand läuft über `saves/snapshot.copy_db` (kopiert die ganze `meta`), a1 musste dort nichts ändern.
