# AP18h – Mitleben mit eigener Figur (Plan, 20.10.2026)

**Auftrag:** Frage 11 (11.10.2026): Menschen steuern eigene Figuren, für die KI-Bewohner sind sie „einer von ihnen“. Im Rework (AP18) die Spielart **„Leben mit eigener Figur“** (Mockup `docs/mockups/rework.html`, Bild 4). Dieser Plan ersetzt das „eigene Schritt 0“ aus `AP18-plan.md`; die offenen Punkte aus Frage 11 sind als Fragen 73–75 mit Vorschlag festgehalten.
**Umfang:** L, drei Teilpakete (a–c). **Abhängig von:** AP18d (Spielart, Meta `player`), AP18b (HUD), AP18g (Bauvorlagen), AP19 (eigenes Aussehen, empfohlen, nicht Pflicht).

## Grundsätze (nicht verhandelbar)
1. **Gleicher Körper, gleiche Schnittstelle:** Die eigene Figur ist ein ganz normaler Bewohner (`agents_body`, `agent_profiles`, Profilmaske aus AP17b). Jede Handlung geht über `WorldEngine.propose` mit denselben Prüfungen und Ablehnungstexten wie bei den KI-Bewohnern.
2. **Kein Hinweis für die anderen:** Kein Prompt, keine Erinnerung, kein Ereignis verrät, dass die Figur menschlich gesteuert ist. Wer gesteuert wird, steht **nur** in der Meta `player` des Spielstands, die nie in einen Prompt gelangt.
3. **Beobachtbarkeit bleibt:** Du siehst weiter die ganze Welt, das Tagebuch und die Einblicke wie in der Spielart Leben.

## Festlegungen (Fragen 73–75, Vorschlag)
1. **Takt (Frage 73):** Standard **„Zeit läuft, deine Figur wartet“**: Die Welt läuft im gewählten Tempo weiter; hat deine Figur nichts zu tun, steht sie da (Status `idle`), wie ein Bewohner, der abwartet. Dazu zwei Schalter in Einstellungen › Spielart:
   - **„Anhalten, wenn ich dran bin“**: Ist deine Figur frei und spricht dich jemand an oder ist deine Handlung zu Ende, pausiert die Simulation, bis du etwas tust (rundenweise Spielen).
   - **„Autopilot, wenn ich nichts tue“** (mit Minuten, Standard 30 Spielminuten): Danach entscheidet das Modell für deine Figur wie für jeden Bewohner (Profil und Persönlichkeit deiner Figur), bis du wieder eingreifst. Im HUD steht dann „Autopilot“.
2. **Ein Mensch je Simulation (Frage 74).** Mehrere Menschen über das Netz kommen, wenn überhaupt, als eigenes Paket.
3. **Gedächtnis (Frage 74):** Deine Figur sammelt Beobachtungen und Erinnerungen wie alle (billig, ohne Modell). Reflexionen und Tagesplanung mit dem Modell laufen nur, wenn der Autopilot an ist. Du siehst die Erinnerungen deiner Figur im Gedächtnis-Einblick wie bei den anderen.
4. **Abwesenheit (Frage 74):** Ist kein Browser verbunden, gilt der Autopilot, wenn er an ist; sonst bleibt die Figur, wo sie ist, und ruht nachts im eigenen Bett (die Engine schickt sie mit der vorhandenen Bleibe-Logik nicht los; sie „wartet“).
5. **Sicht (Frage 75):** Du siehst die ganze Welt wie bisher. „Nur sehen, was meine Figur sieht“ ist eine spätere Einstellung.
6. **Antworten im Gespräch:** Spricht dich ein Bewohner an, erscheint seine Blase und unten eine Antwortzeile. Antwortest du nicht innerhalb von 10 Spielminuten (oder 60 echten Sekunden, was später kommt), endet das Gespräch wie bei einem schweigenden Bewohner (`ConversationManager.expire`). Mit Autopilot antwortet das Modell.

## Ausgangslage
- Spielart und `player` in der Meta kommen mit AP18d. Der Assistent zeigt „Leben mit eigener Figur“ bis hierher ausgegraut.
- Die Vorschau der Mitspieler-Steuerung aus AP13 liegt in `frontend/src/world/player/`: `PlayerController.ts` (Vorschau-Figur, Weg, Kontextmenü, „würde …“, schickt **nichts** ans Backend), `actions.ts` (`choicesFor`: Handlungen je Ziel), `pathfind.ts`.
- Entscheidungen der KI: `simulation/runner.py`, `_due_agents` nimmt alle aus `store.ai_agent_ids()` (heute = alle Profile), `_decide` → `planner.ask` → `_apply` → `engine.propose`.
- Gespräche: `agents/conversation.py` (`note_intent`, `on_dialogue`, `expire`).

## AP18h-a – Backend: die Figur steuern
1. **Wer entscheidet:** `AgentStore.ai_agent_ids()` bekommt einen Filter: Die Kennung aus Meta `player` fällt heraus, **außer** der Autopilot ist gerade aktiv. Die Meta liest `simulation/` (eine Hilfsfunktion `player_id(state) -> str | None` in `simulation/spielart.py`, die AP18d anlegt oder hier neu entsteht). Sonst ändert sich am Runner nichts.
2. **Endpunkte** `api/routes_player.py` (neu), alle nur in der Spielart `leben` mit gesetztem `player`, sonst 409 mit Text:
   - `POST /api/player/act` `{action, params}` → `engine.propose_async(player, action, params)`. Antwort: angenommen (mit erwarteter Dauer) oder abgelehnt mit **dem Ablehnungstext der Engine**. Erlaubt sind dieselben Handlungen wie `ALLOWED_OTHER` in `agents/prompts.py`.
   - `POST /api/player/say` `{to, text}` → wie `speak` (höchstens 500 Zeichen, `SAY_MAX` in `PlayerController.ts`); vorher `convs.note_intent(player, to)` wie in `runner._apply`.
   - `GET /api/player/choices` → die Optionen, die der Optionsgenerator (`agents/options.py`, `generate`) für deine Figur gerade anbieten würde, mit Text und Parametern. So bekommt die Handlungsleiste dieselben Möglichkeiten wie die KI.
   - `POST /api/player/autopilot` `{an: bool, nach_minuten: int}` und Meta `player_autopilot`.
3. **Ereignis der Entscheidung:** Für Handlungen des Menschen gibt es **kein** `agent.decision`-Ereignis (es gibt ja keine Optionsliste und keinen Grund). Damit fehlt nichts für die anderen: Sie sehen die Handlung über `agent.action_started` wie immer. Im Tagebuch steht die Handlung deiner Figur ohne „Warum“.
4. **Anhalten, wenn ich dran bin:** Der Runner prüft nach jedem Schritt: Schalter an, Figur frei (`action is None`) und (`agent.dialogue` an die Figur in diesem Schritt **oder** Handlung der Figur gerade beendet) → `pause()` und Ereignis `simulation.waiting_for_player` (keine Agenten, nie im Prompt). `POST /api/player/act` oder `/say` setzt danach automatisch fort.
5. **Autopilot:** Merkt sich die Minute der letzten Eingabe. Nach `nach_minuten` ohne Eingabe nimmt `_due_agents` die Figur wieder auf; jede Eingabe schaltet zurück.
6. **Prüfen:** pytest `tests/player/`:
   - Gleichheit: dieselbe Handlung über `/player/act` und über den Runner (Fake) ergibt dieselben Ereignisse ohne `agent.decision` und dieselben Ablehnungstexte (Tabelle aus 6 Fällen: zu weit weg, Rohstoff fehlt, voll, besetzt, verschlossen, ungültiges Ziel).
   - Kein Hinweis: In allen Prompts eines Laufs mit Fake (andere Bewohner sprechen mit deiner Figur) kommen „Spieler“, „Mensch“, „gesteuert“, „player“, „Autopilot“ nicht vor; die Profile der anderen sind unverändert.
   - Runner: Die Figur wird ohne Autopilot nie entschieden; mit Autopilot nach der Frist schon.
   - Anhalten: Bewohner spricht die Figur an → Simulation pausiert, `say` setzt fort.

## AP18h-b – Frontend: Handlungsleiste und Steuerung
1. **Handlungsleiste** unten in der Mitte (Mockup Bild 4) in `frontend/src/hud/Handlungsleiste.tsx`: **Sagen** (Textfeld, Empfänger aus der Nähe; `Enter` sendet), **Benutzen** (Liste aus `GET /api/player/choices`, gruppiert nach Ding), **Bauen** (Bauvorlagen, die gerade gehen, mit Kosten), **Gehen** (Klick in die Welt), **Gepäck** (Inventar und getragene Dinge; Ablegen, Geben).
2. `world/player/PlayerController.ts`: Die Vorschau wird echt. Klick auf eine Kachel → `move_to` mit `tile`; Klick auf Ding/Figur → Kontextmenü (`choicesFor`), Auswahl → `/player/act`. Die Vorschau-Figur „Du (Vorschau)“ fällt weg; gezeigt wird deine echte Figur mit Ring in deiner Akzentfarbe.
3. **Rückmeldung:** Abgelehnte Handlungen erscheinen als kleine Blase über deiner Figur mit dem Ablehnungstext (3 Sekunden). Angenommene zeigen die Dauer in der Leiste („Angeln · noch 18 min“) mit Knopf „Abbrechen“ (wenn die Engine Abbrechen kann; sonst ausgegraut).
4. **Antwortzeile** im Gespräch (siehe Festlegung 6), Zähler der verbleibenden Zeit.
5. **Kamera:** Folgt deiner Figur standardmäßig (Taste `F` schaltet um), auch ins Haus (Innenansicht öffnet sich, wenn deine Figur hineingeht).
6. **Tasten:** `T` Sagen, `U` Benutzen, `B` Bauen, `I` Gepäck, `Leertaste` Pause. Esc schließt die oberste Ebene (AP18a).
7. **Prüfen:** Playwright `e2e/mitleben.spec.ts`: Assistent mit „Leben mit eigener Figur“, Figur ausgewählt → Leiste sichtbar; Klick auf den Steg → Figur geht hin; Benutzen › Angeln → Tagebuch zeigt es; Sagen an Mira → ihre Antwort erscheint (Fake); Ablehnung zeigt Text; Anhalten-Schalter pausiert bei Ansprache.

## AP18h-c – Assistent, Einstellungen, Härtung
1. Assistent Schritt Spielart: „Leben mit eigener Figur“ wählbar; danach im Schritt Bewohner „Das bist du“ an einer Figur (Profilmaske wie alle, plus Aussehen aus AP19, wenn vorhanden). Höchstens eine Figur.
2. Einstellungen › Spielart: Schalter „Anhalten, wenn ich dran bin“, „Autopilot“ mit Minuten; „Eigene Figur wechseln“ (mit Bestätigung; die alte Figur wird ein normaler Bewohner mit Autopilot).
3. Spielstand: `player`, `player_autopilot`, Schalter werden gespeichert und geladen. Laden eines Spielstands mit eigener Figur setzt das HUD richtig.
4. Härtung: Langlauf mit Fake 1 Spieltag mit Autopilot an (`scripts/langlauf.py --mode fake`), keine Lücken in den Ereignisnummern, Figur nie „hängend“.
5. Doku: `docs/mitleben.md` (Bedienung, Grundsätze, Schalter) und `docs/schnittstellen.md` (neue Endpunkte).

## Korrekturen aus Schritt 0 (21.10.2026)
Befund, Mockup ([mitleben.html](../mockups/mitleben.html)) und Zerlegung in acht Teilschritte (a1–a3, b1–b3, c1, c2) stehen in [AP18h-schritt0.md](../status/AP18h-schritt0.md). Was dort am Plan zu ändern ist:
- **Meta `player` gibt es noch nicht** (AP18d brachte nur `play_mode`); sie entsteht in a1.
- **`ai_agent_ids()` nicht filtern**, sondern in `profile_ids()` (alle Bewohner: Bedürfnisse, Beobachtungen, Statistik, Wissensverteilung) und `thinking_ids()` (nutzt das Modell: Entscheidung, Reflexion, Zielplanung) teilen; die eigene Figur gehört zu `thinking_ids` nur bei laufendem Autopilot. Die Takt-Logik kommt in `simulation/mitleben.py` (`runner.py` hat schon 341 Zeilen).
- **Fristen in echter Zeit** statt Spielminuten (Frage 83); **Abbrechen** für den Menschen (Frage 85); Wahl und Wechsel der Figur (Frage 84).

## Abnahme
Ein Mensch startet „Leben mit eigener Figur“, geht zum See, angelt, spricht mit Mira und bekommt eine Antwort; Mira behandelt ihn wie jeden anderen (Gedächtnis-Einblick zeigt keine Besonderheit). Bericht `docs/status/AP18h.md`.

## Fallen
- **Reihenfolge im Runner:** Handlungen des Menschen kommen zwischen zwei Schritten an. Sie laufen über `engine.db.run` wie alles andere, nie direkt auf der Datenbank im Request-Thread.
- **Gesprächspartner wartet:** Der KI-Bewohner wartet auf eine Antwort wie heute auf einen anderen Bewohner. Ohne Antwort beendet `expire` das Gespräch; das muss im Test einmal durchlaufen.
- **Wortprüfung:** Was du sagst, geht wörtlich in die Erinnerung der anderen. Das ist gewollt (du bist ein Bewohner). Schreibst du „ich bin der Spieler“, erfährt Mira genau diesen Satz, mehr nicht. Kein Filter, aber ein Hinweis in `docs/mitleben.md`.

## Nicht in diesem Paket
Mehrere Menschen, Netzspiel, Spracheingabe, „nur sehen, was meine Figur sieht“.
