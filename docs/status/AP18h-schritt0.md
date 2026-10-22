# AP18h Schritt 0 – Befund, Mockup, Fragen, Zerlegung (21.10.2026)

**Auftrag:** Vorbereitung von „Mitleben mit eigener Figur“ (Plan: [AP18h-plan.md](../arbeitspakete/AP18h-plan.md), Frage 11, Fragen 73–75). Nur Schritt 0: **kein Produktivcode**. **Branch:** `claude/ap18h-mitleben-877267` (Worktree `ap18h-mitleben-877267`), nicht in `main`, nicht ausgerollt. Gelesen wurden Plan, `AP18-plan.md`, `AP18.md`, die offenen Fragen und die Gedächtnisnotizen zu Mitspieler-Charakteren und „keine höhere Instanz“.

## So siehst du es an
`docs/mockups/mitleben.html` im Browser öffnen (alles liegt lokal, am besten über `python3 -m http.server` im Ordner `docs/mockups/`). Oben in der Mitte öffnet **„Mockup ▾“** (Taste `M`) die Leiste mit **acht Bildschirmen**: 1 Gehen, 2 Benutzen, 3 Abgelehnt, 4 Sagen, 5 Takt, 6 Gepäck, 7 Was die anderen sehen, 8 Einrichten. Die Gruppe „Takt“ in der Leiste schaltet die drei Zustände (Wartet, Anhalten, Autopilot), „Erklärung“ blendet den Text links ein. Im Spiel funktionieren `T`, `U`, `B`, `I`, `Esc`, im Bild 4 sendet `Enter`.

Das Mockup nutzt Stil, HUD, Bewohnerleiste und Bilder des abgenommenen Rework-Mockups (`rework/`) unverändert; neu sind nur `mitleben.html`, `mitleben/mitleben.css`, `mitleben/mitleben.js`. Dorf A, innen2 und beide Skins sind nicht berührt.

## Befund: was nach AP18 schon da ist

| Teil | Stand |
|---|---|
| **Spielart** | `play_mode` `leben` oder `gott` (Meta, `world/spielart.py`; alte Stände = Gott), Wechsel `PUT /api/sim/play-mode`, Schutz mit 403 in `api/spielart_schutz.py`. **Eine Meta `player` gibt es nicht**, auch keine Hilfsfunktion `player_id`. Der Plan ging davon aus, AP18d bringe sie; sie kommt jetzt mit AP18h-a. |
| **Assistent** | `StepSpielart.tsx` zeigt „Leben mit eigener Figur“ ausgegraut („kommt mit Mitleben“), nur Leben und Gott sind wählbar. `NewSimRequest` kennt kein `player`. |
| **HUD** | Uhr, Zeit, Spielart-Abzeichen, Bewohnerleiste (bis 8), Einblicke, Ticker, Hilfe, Werkzeuge nur bei Gott (`hud/Werkzeuge.tsx`). Für Leben mit Figur gibt es noch keine Handlungsleiste. |
| **Vorschau der Steuerung (AP13)** | `world/player/` (`PlayerController`, `actions.ts` mit `choicesFor`, `pathfind.ts`, `PlayerLayer`) rechnet Weg, Dauer und Kontextmenü, schickt aber **nichts** ans Backend. Eine graue Vorschau-Figur „Du (Vorschau)“ steht auf dem Platz. Schalter: Einstellungen › Darstellung › „Mitspieler-Steuerung (Vorschau)“, lokal im Browser (`playerPreview`). |
| **Engine** | `WorldEngine.propose` und `propose_async(actor, action, params)` gelten für jeden Agenten; `interrupt(actor)` unterbricht eine laufende Handlung (Ereignis `agent.action_interrupted`). Beides ist ohne Änderung für die eigene Figur nutzbar. |
| **Entscheidungsschleife** | `simulation/runner.py` (341 Zeilen): `_due_agents` nimmt `store.ai_agent_ids()`, `_decide` → `planner.ask` → `_apply` → `engine.propose`. Es gibt keine Unterscheidung nach Steuerung. |
| **Gespräche** | `agents/conversation.py`: `note_intent` (vor dem Sprechen), `on_dialogue`, `expire` (Stille endet ein Gespräch nach 30 Spielminuten, `SILENCE_MINUTES`). Jeder Teilnehmer ist nur eine Kennung; nichts setzt voraus, dass er das Modell ist. |
| **Profile** | Profilmaske, Wortprüfung (`agents/schema.py`, warnt vor „Spieler“, „Leitstelle“ …) und Vorlagen (`agents/defaults/`, u. a. Kim) sind da; Mitspieler-Charaktere waren dort schon mitgedacht. |

## Befund: was fehlt und was der Plan korrigieren muss

1. **`ai_agent_ids()` ist heute „alle Bewohner mit Profil“ und wird an 16 Stellen für sehr Verschiedenes benutzt.** Ein Filter in `ai_agent_ids` (Plan AP18h-a, Punkt 1) würde die eigene Figur auch aus dem **Gedächtnis (Beobachtungen, Wartung), den Bedürfnissen, Beziehungen, der Statistik, den Reglern und der Wissensverteilung der Ereigniseingabe** nehmen: Kim würde nicht hungrig, bekäme keine Erinnerungen und erführe von Wetter und Weltereignissen (AP18i) nichts. Es muss **zwei Mengen** geben: `profile_ids()` (alle Bewohner, passive Pflege wie Bedürfnisse, Beobachtungen, Statistik, Regler, „wer erfährt es“) und `thinking_ids()` (wer das Modell nutzt: `_due_agents`, Reflexion, Zielplanung in `autonomy.housekeeping`, Entscheidungen). Die eigene Figur gehört zu `profile_ids`, zu `thinking_ids` nur bei laufendem Autopilot. Stellen: `runner.py` (192, 196, 219, 291, 292, 321, `_due_agents`), `autonomy.py` (109, 135), `params/apply.py:25`, `api/routes_stats.py:18`, `api/routes_autonomy.py:73`, `events_user/apply.py` (107, 242), `events_user/service.py:55`, `events_user/welt.py:50`, `stats/sampler.py:9`.
2. **Autopilot, Gesprächsfrist und „Spielminute“.** Die Simulation läuft grob 1 Spielminute je Sekunde (Messung AP02). Der Plan nennt 10 Spielminuten (Antwort im Gespräch) und 30 Spielminuten (Autopilot): das sind **rund 10 und 30 echte Sekunden**, zu kurz zum Tippen. Vorschlag in Frage 83: Fristen in echter Zeit.
3. **Abbrechen:** Die Engine kann es, die KI nutzt es nicht. Für den Menschen ist es nötig (Mockup Bild 1). Frage 85.
4. **`player` und die Wahl der Figur** gibt es nicht, ebenso keinen Weg, die Figur nachträglich zu wählen oder zu wechseln, und keine Regel beim Wechsel auf Gott. Frage 84.
5. **`runner.py` hat 341 Zeilen** (Grenze 400, `tests/test_file_size.py`). Die Takt-Logik (Anhalten, Autopilot, Frist) gehört deshalb in ein eigenes Modul `simulation/mitleben.py` und nicht in den Runner.
6. **Das Vorschau-Zubehör fällt weg**, wenn die Steuerung echt wird: Vorschau-Figur, „würde …“-Meldungen, der Darstellungsschalter. `choicesFor` und `pathfind` bleiben als Weg- und Dauervorschau (Gepunkteter Weg, „etwa 6 Min.“), die Auswahl der Handlungen kommt aber aus dem Backend (`GET /api/player/choices`), damit Frontend und Optionsgenerator nie auseinanderlaufen.
7. **Plan stimmt, bleibt gültig:** Gleichheit (gleicher Körper, `propose`, dieselben Ablehnungstexte), kein Hinweis für die anderen (Test über alle Prompts), kein `agent.decision` für Handlungen des Menschen, Anhalten über ein Systemereignis ohne Agenten, `ALLOWED_OTHER` als Handlungsmenge.

## Das Mockup

| Bild | Was es zeigt |
|---|---|
| **1 Gehen** | Klick auf eine Kachel: gepunkteter Weg, Zielmarke „Ufer am See · etwa 6 Min.“, Band „Kim geht zum See · noch 6 Min.“ mit **Abbrechen**. Ring in deiner Akzentfarbe (Himmelblau, nur bei dir), Kamera folgt (`F`), Plakette „Kim wartet“. Schild und Name von Kim sehen wie bei jedem Bewohner aus. |
| **2 Benutzen** | Liste der Möglichkeiten hier und jetzt, gruppiert nach Ding (See, Boot, Alex), mit Dauer und Kosten; Unmögliches bleibt sichtbar mit Grund („braucht Eimer“). Dieselbe Liste bekäme ein Bewohner. |
| **3 Abgelehnt** | Rote Blase über Kim mit dem **Ablehnungstext der Engine** (3 Sekunden), dazu das Band „abgelehnt · du kannst es gleich neu versuchen“. |
| **4 Sagen** | Alex spricht Kim an; unten **Antwortzeile** mit Name des Wartenden, Zähler „bleibt noch 22 Min.“ und `Enter`. Gesagtes erscheint als normale Sprechblase. |
| **5 Takt** | Einstellungen › Spielart: „Anhalten, wenn ich dran bin“, „Autopilot, wenn ich nichts tue“ (Frist), Sicht, „Eigene Figur wechseln“. HUD je Zustand: Plakette „Kim wartet“, Banner „Die Zeit steht: Kim ist dran“, Plakette „Autopilot · Übernehmen“. |
| **6 Gepäck** | Hände und Rucksack, Ablegen, Geben (nur in Reichweite), Essen. `B` öffnet die Bauvorlagen aus AP18g (Vorbild: Bild 4 des Rework-Mockups). |
| **7 Was die anderen sehen** | Miras Gedächtnis-Einblick und Prompt-Ausschnitt („In deiner Nähe: … Kim (See, angelt)“, nirgends „Spieler“), daneben dein Tagebuch ohne „Warum“ bei Kims Handlungen. |
| **8 Einrichten** | Assistent, Schritt Bewohner: „Das bist du“ (höchstens eine Figur); Einstellungen › Spielart mit den Schaltern und „Eigene Figur wechseln“. |

Bewusste Abweichungen vom Plan: Das Band „Was deine Figur gerade tut“ (mit Abbrechen) steht über der Leiste; der Rucksackinhalt steht im Gepäck, nicht mehr als Textzeile in der Leiste; „Gehen“ in der Leiste ist nur ein Hinweis, gegangen wird per Klick. Das Mockup nimmt Alex als Gesprächspartner, weil Mira im Hintergrundbild hinten im Wald steht.

## Fragen (`docs/offene-fragen.md`, Nr. 83–86)
- **77 Fristen in echter Zeit** (Gespräch mindestens 60 echte Sekunden, Autopilot in echten Minuten, Standard 5; Hinweis bei Tempo 4×/Max).
- **78 Wer ist deine Figur** (zählt zu den 8 Bewohnern, Bett im Haus, Wahl im Assistenten und später in den Einstellungen, nur in Leben; Wechsel auf Gott macht Kim zum Bewohner mit Autopilot).
- **79 Abbrechen** (ja, für den Menschen, für die anderen wie jeder Abbruch, ohne Vermerk).
- **80 Mockup abnehmen.**
Die Fragen 73–75 (Takt, mehrere Menschen/Gedächtnis/Abwesenheit, Sicht) bleiben „Vorschlag gilt als Arbeitsannahme“; Frage 83 ändert an 73 nur die Einheit der Autopilot-Frist.

## Zerlegung in Teilschritte
Der Plan hat drei Pakete (a–c). Für Sitzungen und Abnahmen ist das zu grob; Vorschlag, je Teilschritt ein Branch `ap/18h-<x>` aus `main`, ein Bericht, kleine Abnahme:

| Schritt | Inhalt | Größe | Prüfung |
|---|---|---|---|
| **18h-a1 Grundlage** | Meta `player` und `player_autopilot`, `simulation/mitleben.py` (`player_id`, Autopilot-Zustand), `store.profile_ids()` und `thinking_ids()`, alle 16 Stellen zugeordnet, Runner entscheidet die eigene Figur nie. Kein neuer Endpunkt, keine Oberfläche. | M | pytest: ohne Autopilot wird Kim nie entschieden, trotzdem Hunger, Beobachtungen, Wissensverteilung; alte Spielstände unverändert |
| **18h-a2 Handeln** | `api/routes_player.py`: `act`, `say` (mit `note_intent`), `choices` (Optionsgenerator), `cancel`; kein `agent.decision`; 409 außerhalb Leben mit Figur. | M | pytest: Gleichheitstabelle (6 Ablehnungsfälle), kein Hinweis in allen Prompts (Wortliste), Gespräch läuft bis `expire` |
| **18h-a3 Takt** | `simulation.waiting_for_player` und Anhalten, Autopilot nach Frist (Frage 83), Abwesenheit ohne Browser, Gesprächsfrist, Schalter in den Einstellungen (API). | M | pytest: Ansprache pausiert, `say` setzt fort; Autopilot nach Frist, jede Eingabe schaltet zurück |
| **18h-b1 Figur und Gehen** | Vorschau-Figur und Darstellungsschalter weg, echte Figur mit Ring, Kamera folgt (auch ins Haus), Handlungsleiste (Rahmen, Band, Abbrechen), Klick geht (`move_to`), HUD-Plakette je Takt. | M | Playwright: Leiste sichtbar, Klick auf den Steg, Figur geht |
| **18h-b2 Benutzen und Sagen** | Benutzen-Liste und Kontextmenü aus `choices`, Ablehnungsblase, Sagen-Zeile, Antwortzeile mit Zähler, Tasten `T U Esc`. | M | Playwright: Angeln im Tagebuch, Sagen an Alex mit Antwort (Fake), Ablehnung zeigt Text |
| **18h-b3 Gepäck und Bauen** | Gepäck (`take`, `drop`, `give`, Essen), Bauen mit Kosten (AP18g), `I`, `B`; Hilfe ergänzen. | S bis M | Playwright: Ablegen, Geben, Bauen einer Bank |
| **18h-c1 Einrichten** | Assistent „Das bist du“ (Maske, Wortprüfung), Einstellungen › Spielart (Schalter, Figur wechseln, Gott-Wechsel), Spielstand speichern und laden, `NewSimRequest.player`. | M | Playwright `mitleben.spec.ts` über den ganzen Weg; Laden setzt das HUD |
| **18h-c2 Härtung** | Langlauf 1 Spieltag mit Fake und Autopilot, keine Lücken in den Ereignisnummern, `docs/mitleben.md`, `docs/schnittstellen.md`, Abschlussbericht `AP18h.md`. | S | `scripts/langlauf.py --mode fake`, vollständige Läufe |

Abhängigkeiten: a1 → a2 → a3, b1 braucht a2, b2 und b3 brauchen b1 und a2, c1 braucht a1 (und b1 für das HUD), c2 zuletzt. **Parallel möglich:** nach a1 laufen a2 und c1-Backend, nach a2 laufen b1 und a3 (verschiedene Dateien). Reihenfolge ohne Parallelität: a1, a2, b1, b2, a3, b3, c1, c2. Neue Dateien bleiben unter 400 Zeilen; Takt-Logik also in `simulation/mitleben.py`, Frontend in `hud/Handlungsleiste.tsx`, `world/player/` und `hud/Antwortzeile.tsx`.

## Nicht getan, bewusst
Kein Produktivcode, keine Änderung an Tests und Daten, nicht nach `main` gemergt, nichts ausgerollt. `AP18h-plan.md` hat einen kurzen Abschnitt „Korrekturen aus Schritt 0“ bekommen, die Pläne selbst sonst unverändert. Wartet auf Henrys Abnahme des Mockups (Frage 80) und die Antworten zu 77–79.
