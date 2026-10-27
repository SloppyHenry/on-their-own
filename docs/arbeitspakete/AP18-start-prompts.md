# AP18 – Startprompts für die Teilpakete (19.10.2026)

Für jedes Teilpaket eine frische Claude-Code-Sitzung im Ordner `<projekt>` starten. Als erste Nachricht kommt der **gemeinsame Teil** und danach der Abschnitt des Pakets (beides zusammen kopieren). Die Reihenfolge steht im [Plan](AP18-plan.md#reihenfolge-vorschlag-frage-61).

---

## Gemeinsamer Teil (immer mitkopieren)

Du arbeitest an **Simulacra** (`<projekt>`), einer Simulation, in der KI-Bewohner (Alex, Mira …) in einem Pixeldorf leben. Dein Auftrag ist ein Teilpaket von **AP18 – Rework: ein Spiel aus einem Guss**. Antworte der Projektleitung auf Deutsch. Er startet für jedes Paket eine neue Sitzung und entscheidet im Chat.

**Zuerst lesen, bevor du etwas baust:**
1. Dein Gedächtnis (`MEMORY.md`), besonders: AP18-Rework, Keine höhere Instanz, Mitspieler-Charaktere, Mockup-Treue, Geteiltes Arbeitsverzeichnis, Skalierung, AP17-Entscheidungen.
2. `docs/arbeitspakete/AP18-plan.md` ganz, darin den Abschnitt deines Pakets genau. Dazu `docs/status/AP18-schritt0.md` (Befund mit Bildern des alten Stands).
3. Das Mockup **`docs/mockups/rework.html`** im Browser öffnen. Die Mockup-Leiste öffnet sich über den Reiter „Mockup ▾“ oben in der Mitte (oder Taste `M`). Es hat 10 Bildschirme, Blasen-Varianten A/B/C und die Taste „Erklärung“; der Code liegt in `docs/mockups/rework/`. Was die Projektleitung abgenommen hat, wird **1:1** gebaut (ganzes Bild, gleiche Abstände, Farben und Texte). Abweichungen legst du ihm offen vor.
4. `docs/offene-fragen.md`, Fragen 52–62 mit den Antworten. Ist eine Frage für dein Paket noch offen, stellst du sie zu Beginn gebündelt mit `AskUserQuestion` (Empfehlung als erste Option).
5. `git status`, `git branch --show-current`, `git log --oneline -15`, `git worktree list`. Lege für dein Paket einen eigenen Branch an (`ap/18x-name`), am besten in einem eigenen Worktree, wenn im Ordner fremde, nicht eingecheckte Änderungen liegen.

**Leitplanken (nicht verhandelbar):**
- **Keine höhere Instanz:** Die Bewohner merken nie, dass es Spieler, Leitstelle, Editor, Spielart oder „Simulation“ gibt. Es gibt keinen Prompt-Text, keine Erinnerung und kein Ereignis für Bewohner über Eingriffe. Bestehende Tests dafür bleiben grün und werden erweitert.
- **Mitspieler sind Gleiche:** Eine menschlich gesteuerte Figur hat in der Engine keinen Sonderstatus.
- **Beobachtbarkeit zuerst:** Alles, was das Verhalten der Bewohner zeigt, bleibt mit höchstens einem Klick erreichbar.
- **Das Menü bleibt** (Liste links, Inhalt rechts, Titelbild). **Die Weltfläche bleibt** (DorfView, Bild A, Innenräume, beide Ansichten Tiefe und Flach). Goldbild-Tests (`e2e/golden.spec.ts`, `e2e/flach.spec.ts`) dürfen sich nicht ändern, außer der Plan sagt es ausdrücklich.
- **Geteiltes Arbeitsverzeichnis:** Nie `git add -A` oder `git add .`, nur eigene Dateien einzeln. Den Branch einer anderen Sitzung nicht wechseln. Playwright nutzt `/tmp/simulacra-e2e-run`, also nicht gleichzeitig mit einer anderen Sitzung laufen lassen.
- Dateien unter ca. 400 Zeilen, Oberfläche und Texte auf Deutsch, Umlaute richtig. **Nichts ausrollen** ohne ausdrückliche Freigabe.

**Vorgehen:** kurzer Plan im Chat, offene Fragen klären, bauen mit Tests (pytest, Vitest, Playwright; die echten Zahlen kommen in den Bericht), Doku pflegen (`docs/frontend.md`, `docs/schnittstellen.md` und was das Paket berührt), Statusbericht `docs/status/AP18x.md` mit Bildern und dem Weg, es anzusehen, Fragen in `docs/offene-fragen.md` mit Datum, Gedächtnis aktualisieren. Danach Abnahme abwarten.

---

## AP18a – Rückweg mit Esc und Brotkrumen
**Ziel:** Esc nimmt überall genau eine Ebene zurück. Vorgabe: „Wenn man ein neues Spiel gestalten will und Escape drückt, soll man zum vorherigen Menü kommen können, das sollte grundsätzlich gehen.“ Hängt nicht von der Mockup-Abnahme ab und kann sofort beginnen.
**Ansetzen:** `frontend/src/layout/StartMenu.tsx` (Esc-Behandlung, `sub`), `world/WorldCanvas.tsx` (Innenansicht), `layout/InsightsMenu.tsx`, `panels/Drawer.tsx`, `controls/ResetDialog.tsx`, `saves/SaveLoadDialog.tsx`, `assistent/Assistent.tsx` und `assistentStore.ts`, `assistent/Charaktereditor.tsx`, `editor/editorStore.ts` (`enterEditor`, `leaveEditor`), `store/uiStore.ts`. Suche alle Stellen mit `grep -rn "Escape" frontend/src`. Bekannter Fehler: Aus „Neues Dorf erzeugen“ und Editoren › Welt führt Esc nicht ins Menü zurück, weil Esc nur bei `appMode === "game"` greift.
**Bauen:** wie im Plan, Abschnitt AP18a (zentraler Rückweg `ui/zurueck.ts`, Brotkrumen wie Mockup Bild 7, Assistent schrittweise, `returnTo` für den Editor, Rückfrage bei ungesichertem Entwurf). Das Aussehen der Brotkrumen kommt aus dem Mockup; den übrigen Stil (HUD) baust du noch nicht.
**Fertig, wenn:** Ein Playwright-Test geht jeden Menüpfad hin und mit Esc Ebene für Ebene zurück, und kein Esc landet unerwartet im Spiel oder im falschen Menü.

## AP18b – Formensprache und Spieloberfläche (HUD)
**Ziel:** Die Welt füllt den Bildschirm. Statt Kopfzeile, Infoleiste und Ereigniszeile gibt es HUD-Teile in den Ecken in der Formensprache des Menüs (Mockup Bilder 1–3, 5 und Hilfe). Voraussetzung: Die Projektleitung hat das Mockup abgenommen (Frage 52), AP18a ist fertig.
**Ansetzen:** `layout/AppShell.tsx`, `Header.tsx`, `SideBar.tsx`, `ViewSettings.tsx` (Hinweiszeile `viewHint` fällt weg), `InsightsMenu.tsx`, `panels/` (AgentPanel, AgentDetail), `timeline/` und `history/` (werden das Tagebuch), `memory/`, `stats/`, `settings/ParameterPanel.tsx` (nur noch im Menü), `composer/EventComposer.tsx` (wird Popover), `controls/SimulationControls.tsx`, `index.css`. Die e2e-Helfer liegen unter `frontend/e2e/` (`showTab`, `viewMenu` und Kopfzeilen-Kennungen): **die zuerst umstellen**.
**Bauen:** wie im Plan, Abschnitt AP18b. Neue Ordner `frontend/src/ui/` (Bausteine) und `frontend/src/hud/`. Farben und Maße kommen aus `docs/mockups/rework/stil.css` und `spiel.css`. Bis AP18d gilt jede Simulation als „Gott“, damit die Ereigniseingabe erreichbar bleibt.
**Fertig, wenn:** Alle bisherigen Abläufe gehen weiterhin (Tests grün), die Bilder in 1440 × 900 und 1100 × 760 entsprechen dem Mockup, und Einstellungen, Neue Simulation und Gestalten haben je genau einen Weg.

## AP18c – Schilder, Sprech- und Denkblasen
**Ziel:** Blasen brechen um statt in die Breite zu laufen. Rede und Gedanke sehen verschieden aus, nichts überdeckt sich, im Haus stehen Bildnisse auf dem Dach. Die Projektleitung hat **Variante A** gewählt, dazu B als Einstellung „wenig Text in der Welt“ (Frage 53).
**Ansetzen:** `world/Overlays.tsx`, `index.css` (`.bubble`, `[data-tag]`), `panels/AgentPanel.tsx` (`activityOf`), `klang/stimmen.ts` (`sprechStand`, die Blase läuft mit der Stimme mit), `world/worldBridge.ts` (Frame: Figuren, Häuser, Innenansicht), `world/dorf/kamera.ts` und DorfView (Folgen). Bekannter Fehler: „Kamera folgt“ auf eine Figur im Haus zeigt draußen eine leere Wiese, nämlich die Lage des Innenraums auf der Karte (Bild `docs/status/img/ap18-ist-6-kamera-folgt.jpg`).
**Bauen:** wie im Plan, Abschnitt AP18c. Das Ausweichen ist eine reine, getestete Funktion. Kosten je Bild bleiben klein (höchstens 8 Bewohner, nur sichtbare).
**Fertig, wenn:** Das Bild entspricht Variante A (und B als Einstellung), lange Gedanken brechen um, zwei Figuren auf einer Kachel überdecken sich nicht, der Kamerafehler ist behoben und die Tests aus dem Plan sind grün.

## AP18d – Spielarten Leben und Gott
**Ziel:** In der Spielart Leben verändern nur die Bewohner die Welt, in der Spielart Gott veränderst du sie von außen (Fragen 54–57; Mockup Bilder 1, 5, 7). „Leben mit eigener Figur“ bleibt ausgegraut bis AP18h.
**Ansetzen:** Backend `simulation/` (Spielstand-Meta, `reset`, `new`), `api/routes_newsim.py` (`/sim/new`), Ereigniseingabe `events_user/` und deren Routen, `api/routes_world.py` (Patch, Generator), Profile und Bewohner-Endpunkte, `agents/modes.py` und `params/specs_sim.py` (`mode` heißt im Text künftig „Wissen der Bewohner“). Frontend: Assistent (`assistent/`, neuer erster Schritt), HUD aus AP18b (Gott-Werkzeuge), `layout/StartMenu.tsx` (Schnellstart).
**Bauen:** wie im Plan, Abschnitt AP18d. Der Schutz liegt im Backend, nicht nur in der Oberfläche. Alte Spielstände gelten als Gott.
**Fertig, wenn:** Die Spielart wird beim Anlegen gewählt, steht im Spielstand und schützt die Endpunkte, das HUD zeigt die passenden Werkzeuge, und kein Prompt enthält ein Wort über die Spielart (Test).

## AP18e – Weltenbibliothek und Welt-Werkstatt
**Ziel:** Welten werden eigene Dateien, die man speichert, öffnet, dupliziert und exportiert. Editoren › Welten öffnet eine **leere Welt** in einer ganzseitigen Werkstatt (Mockup Bilder 8 und 10). Vorgabe: „Wenn ich auf Editor klicke und dann auf Welt, kommt nur die geöffnete Welt und keine leere Welt, die ich gestalten kann … die einzelnen Welten soll man speichern können.“
**Ansetzen:** `saves/` im Backend (Aufbau der Spielstände als Vorbild, aber getrennt), `generator/` (`generate.py`, `service.py`: Wegwerf-Simulation der Vorschau), `world/loader.py`, `simulation/builder.py` (`reset(world=…)`), `api/routes_world.py`, `api/routes_newsim.py`. Frontend: `layout/StartMenu.tsx` (EditorsPane, NewSimPane), `editor/` (WorldEditor, editorStore), `assistent/StepWelt.tsx`, `world/dorf/DorfView.ts` (Gesamtansicht für das Vorschaubild).
**Bauen:** wie im Plan, Abschnitt AP18e. Die Werkzeuge Weg, See, Haus usw. baust du **nicht**, die kommen mit AP16b und AP16c. Die Werkstatt bekommt Zeiger, Startplatz und „Gebiet erzeugen“ (der vorhandene Generator) und eine Werkzeugleiste mit freien Plätzen für die übrigen.
**Fertig, wenn:** Eine leere Welt lässt sich anlegen, mit Startplatz versehen, speichern, wieder öffnen, duplizieren, exportieren und importieren (byte-gleich) und bei Neue Simulation wählen. Spielstände bleiben unberührt, Esc führt aus der Werkstatt zur Bibliothek.

## AP16a–d – Gestalten-Werkzeuge (bestehender Plan)
Den Startprompt bildet der gemeinsame Teil plus [AP16-plan.md](AP16-plan.md) mit dem abgenommenen Mockup `docs/mockups/welt-optik/gestalten.html` (Frage 37). Dazu gelten die Änderungen aus `AP18-plan.md`, Abschnitt „AP16“: zwei Orte (Werkstatt und Spielart Gott), die neuen Werkzeuge Startplatz und Gebiet erzeugen, Bedienteile im Stil aus AP18b. Je Sitzung ein Teilpaket: a (Backend), b (außen), c (innen), d (Härtung).

## AP18f – Generator neu: Vielfalt und Stellgrößen
**Ziel:** Dörfer sehen viel verschiedener aus (Dorfform, Häuser auf beiden Seiten der Wege, mehrere Seen, Bach oder Fluss, Wald, Gärten, Felder), und alle Stellgrößen sind wählbar (Fragen 58, 26; Mockup Bild 9). Den Generator gibt es nur beim Erschaffen einer Welt.
**Ansetzen:** `backend/simulacra/generator/` (`layout.py` ist der Kern, dazu `compose.py`, `tiles.py`, `kits.py`, `validate.py`, `generate.py`, `service.py`), `docs/generator.md`, Frontend `world/dorf/look.ts`, `bild.ts`, `boden.ts`, `szene.ts` und `art/bausteine.ts` (was kann das Bild heute: mehrere Seen? Flüsse quer? Felder?), `world/dorf/erzeugt.test.ts` und die Fixtures. **Vorbild für das Verfahren:** `docs/mockups/rework/generator.js` (Dorfformen, Türwege per kürzestem Weg, Seen, Wald aus Rauschen).
**Bauen:** wie im Plan, Abschnitt AP18f. Zuerst prüfst du den Renderer mit Fixtures aus der Skizze, erst dann baust du das Backend um. Neue Sprites (Felder, breite Brücken) nur mit Mockup und Abnahme.
**Fertig, wenn:** Der Eigenschaftstest über zufällige Stellgrößen ist grün (alles erreichbar, Bild und Kacheln stimmen überein), gleiche Eingaben ergeben dasselbe Dorf, die Startwelt bleibt Pixel für Pixel gleich, und die Oberfläche entspricht dem Mockup.

## AP18g – Bauen im Spiel: mehr Bauvorlagen
**Ziel:** In der Spielart Leben haben die Bewohner mehr Möglichkeiten, die Welt zu verändern (Frage 59 entschieden: zuerst Weg, Beet, Baum, Laterne, Brunnen; die Hütte danach; Mockup Bild 4, Katalog „Bauen“).
**Ansetzen:** `backend/simulacra/data/blueprints.json`, `world/actions/building.py`, `world/object_kinds.py`, `world/patches.py` und `world/look.py` (Bild-Formen), `agents/options.py`, `agents/prompts.py`, `agents/phrases.py`, Frontend `world/dorf/` (wie wird Gebautes gezeichnet).
**Bauen:** wie im Plan, Abschnitt AP18g. Jede Vorlage ändert Kacheln und `look` über denselben Patch-Weg wie AP16a.
**Fertig, wenn:** Mit dem Fake-Modell legt ein Bewohner einen Weg und ein Beet an, das Bild zeigt beides, Bild und Kacheln stimmen überein, und die bestehenden Bauvorlagen laufen weiter.

## AP18i – Die Welt lebt selbst: Ereignisse von allein
**Ziel:** Die Welt bringt in beiden Spielarten von sich aus Ereignisse, die niemand beeinflusst (Antwort zu Frage 54; Katalog und Häufigkeit Frage 62). Voraussetzung ist AP18d (Spielarten).
**Ansetzen:** `backend/simulacra/world/weather.py` (Vorbild: deterministischer Takt aus Seed und Zeit), `events_user/` (Operationen, Prüfung, Wissensverteilung aus AP08; `docs/ereignisse.md`), `simulation/` (Schleife, wo das Wetter weiterschaltet), `params/` (Häufigkeit als Parameter), Assistent Schritt Regeln, Tagebuch aus AP18b (eigenes Zeichen).
**Bauen:** wie im Plan, Abschnitt AP18i. Der Katalog ist Daten, keine Sonderwege an der Engine vorbei. Sichtbare Szenen baust du nicht, die gehören zum Paket Szenen.
**Fertig, wenn:** Mit Häufigkeit „oft“ geschehen in einem Lauf mit Fake-Modell mehrere passende Ereignisse, die Bewohner reagieren darauf wie auf Wetter, gleicher Seed ergibt denselben Ablauf, und kein Prompt nennt einen Urheber.

## AP18h – Mitleben mit eigener Figur
**Ziel:** Du lebst als Bewohner unter Bewohnern (Spielart „Leben mit eigener Figur“; Mockup Bild 4). **Der Plan steht in [AP18h-plan.md](AP18h-plan.md)** (Teilpakete a Backend, b Handlungsleiste, c Assistent und Härtung; Fragen 73–75 mit Vorschlag als Arbeitsannahme). Je Sitzung ein Teilpaket.
**Ansetzen:** wie im Plan, Abschnitt „Ausgangslage“: `simulation/runner.py` (`_due_agents`), `agents/store.py` (`ai_agent_ids`), `agents/conversation.py`, `WorldEngine.propose`, `frontend/src/world/player/` (Vorschau aus AP13).
**Fertig, wenn:** die Abnahme im Plan erfüllt ist und der Test „kein Hinweis auf den Menschen in irgendeinem Prompt“ grün ist.
