# AP18 – Rework: ein Spiel aus einem Guss (Plan, 19.10.2026)

**Auftrag:** 19.10.2026: „Unser Tool wirkt zusammengewürfelt und unübersichtlich … ein wirkliches Rework – das Einzige, was Bestand hat, ist das Menü.“ Dazu: Spielmodi (nur Bewohner verändern die Welt oder man ist Gott), Welt individuell weitergestalten statt nur Seeds, Generator nur beim Erschaffen und viel abwechslungsreicher mit Stellgrößen, keine Hinweisschrift über der Welt, neue Denkblasen, Esc führt immer zum vorherigen Menü, Editor › Welt öffnet eine leere Welt mit Werkzeugen, Welten einzeln speichern.
**Mockup:** [`docs/mockups/rework.html`](../mockups/rework.html) (zehn Bildschirme, Blasen-Varianten A/B/C, Erklärung je Bild). **Befund und Bilder:** [`docs/status/AP18-schritt0.md`](../status/AP18-schritt0.md). **Startprompts je Teilpaket:** [`AP18-start-prompts.md`](AP18-start-prompts.md).
**Umfang:** XL, neun Teilpakete (je eine Sitzung oder mehr) plus das schon geplante AP16. **Status:** Schritt 0 abgenommen (20.10.2026, Fragen 52–63 entschieden). AP18a gebaut, wartet aufs Zusammenführen. AP18h hat einen eigenen ausführlichen Plan: [AP18h-plan.md](AP18h-plan.md).

## Befund (kurz, Einzelheiten im Bericht)
1. **Zwei Formensprachen.** Das Menü (warmes Glas, Gold, große Kacheln) passt nicht zur Spieloberfläche (graue Werkzeugleisten, kleine Knöpfe).
2. **Bedienelemente um die Welt herum statt in ihr.** Die Kopfzeile hat 17 Bedienelemente, rechts liegt eine 380 px breite Infoleiste, unten eine 80 px hohe Ereigniszeile. Die Welt bekommt 1060 × 770 von 1440 × 900 px.
3. **Doppelte Wege.** Einstellungen gibt es als Schublade und im Menü, „Welt gestalten“ in der Kopfzeile und unter Editoren, „Zurücksetzen“ in der Kopfzeile und als „Neue Simulation“, Protokoll und Verlauf getrennt.
4. **Hinweisschrift über der Welt** („Klick aufs Haus: hineinschauen · …“) und die Ansichtswahl schweben über dem Bild, sobald die Infoleiste zu ist.
5. **Schilder laufen in die Breite.** Name, Tätigkeit und „überlegt: …“ oder „＋ merkt sich: …“ stehen in einer Zeile ohne Umbruch (`whitespace-nowrap`). Im Haus überdecken sich die Schilder, am Bildrand werden sie abgeschnitten.
6. **Fehler: Kamera folgt einer Figur im Haus.** Draußen zeigt die Kamera dann eine leere Wiese, nämlich die Lage des Innenraums auf der Karte.
7. **„Welt gestalten“ kann nur würfeln.** Editoren › Welt öffnet die laufende Welt mit dem Seed-Formular, ohne Werkzeuge und ohne leere Welt. Welten lassen sich nicht einzeln speichern, es gibt nur Spielstände.
8. **Der Generator kennt nur ein Muster.** Die Häuser stehen in einer Zeile an der Straße, es gibt einen See und einen Garten, und der See liegt immer im Osten oder Süden (`layout.py`).
9. **Esc ist uneinheitlich.** Im Assistenten führt Esc zurück. Aus „Neues Dorf erzeugen“ (Editor) führt Esc nicht ins Menü zurück, weil Esc nur bei `appMode === "game"` greift. Zum Teil wird Esc auch an Eingabefeldern verschluckt.

## Leitbild
- **Die Welt füllt den Bildschirm.** Bedienteile schweben klein in den Ecken (HUD), wie bei Sims oder Animal Crossing. In der Mitte steht nur, was zur Welt gehört: Figuren, Blasen, Schilder.
- **Eine Formensprache, die des Menüs:** dunkles warmes Glas, Gold als einzige Akzentfarbe, Creme für alles in der Welt (Blasen, Schilder), runde Ecken, Pixelbildnisse. Tokens in `index.css`, Bausteine in `frontend/src/ui/`.
- **Alles Beobachtbare bleibt mit einem Klick erreichbar** (Leitgedanke aus AP17): Bewohnerleiste, Ticker, Tagebuch, Bewohner-Karte, Einblicke. Nichts davon ist dauerhaft offen.
- **Ein Weg je Sache.** Einstellungen nur im Menü, Neue Simulation nur im Menü, Gestalten nur als Werkzeug der Spielart Gott oder in der Welt-Werkstatt.
- **Esc nimmt immer genau eine Ebene zurück.** Oben stehen Brotkrumen, und nie landet man aus Versehen woanders.
- **Keine höhere Instanz** ([Grundsatz](AP16-plan.md#grundsatz-15102026)): Spielart Gott, Gestalten und die Werkstatt bleiben für die Bewohner unsichtbar.

## Die Spielarten (neu)
| Spielart | Wer verändert die Welt | Bedienung im Spiel |
|---|---|---|
| **Leben** (Standard) | nur die Bewohner, mit dem, was das Spiel hergibt (Bauvorlagen, Dinge, Ernte …) | zuschauen, Zeit steuern, Einblicke; keine Ereignisse, kein Gestalten |
| **Leben mit eigener Figur** | die Bewohner und du als Bewohner unter Bewohnern | dazu Handlungsleiste: Sagen, Benutzen, Bauen, Gehen (Mitspieler, [Frage 11](../offene-fragen.md)) |
| **Gott** | du von außen, jederzeit | dazu Werkzeugleiste: Ereignis, Gestalten (Zeit steht still), Bewohner, Weltregeln |

**In beiden Spielarten lebt die Welt selbst** (Frage 54): Das Wetter wechselt von selbst (gibt es schon), und die Welt bringt Ereignisse von sich aus, die niemand beeinflusst (neu, AP18i).

Die Spielart gehört zum Spielstand und wird beim Anlegen gewählt. Der bisherige „Beobachtungsmodus“ (`mode`: Beobachter, Schöpfer, Eingriff) regelt etwas anderes, nämlich **was die Bewohner wissen**, und wandert unter „Erweitert“ (Frage 57).

## Teilpakete

### Schritt 0 – Plan, Mockup, Fragen (diese Sitzung)
Mockup `docs/mockups/rework.html` mit `rework/` (Stil, Spiel, Menü, Editor, Generator-Skizze), Befund mit Bildern, Fragen 52–61. **Ergebnis:** Abnahme oder Änderungswünsche. Vorher entsteht kein Anwendungscode, ausgenommen AP18a.

### AP18a – Rückweg mit Esc und Brotkrumen (S, hängt vom Mockup nicht ab)
1. Zentraler Rückweg `frontend/src/ui/zurueck.ts`: Jede offene Ebene (Menübereich, Assistentenschritt, Dialog, Schublade, Detail, Innenansicht, Editor) meldet einen Rückweg an. Esc ruft den obersten auf. Die verstreuten Esc-Behandler in `StartMenu`, `WorldCanvas`, `InsightsMenu`, `Drawer`, `ResetDialog`, `SaveLoadDialog`, `Assistent`, `Charaktereditor` und `editor/` ziehen dorthin um.
2. Menübereiche bekommen Brotkrumen und einen Hinweis „Esc zurück zu …“ wie im Mockup (Bild 7). Die Krumen sind anklickbar.
3. Im Assistenten führt Esc einen Schritt zurück. Beim ersten Schritt führt Esc zu „Neue Simulation“, von dort zur Liste.
4. Wer den Editor aus dem Menü öffnet („Neues Dorf erzeugen“, Editoren › Welt), kommt mit Esc oder „Zurück“ **an dieselbe Menüstelle** zurück (`returnTo` im uiStore), nicht ins Spiel.
5. Im Eingabefeld nimmt das erste Esc den Fokus, das zweite geht zurück. Bei ungesichertem Entwurf (Assistent, Editor) fragt das Spiel vorher nach.
6. Tests: Playwright läuft jeden Menüpfad hin und mit Esc zurück und prüft dabei Ebene für Ebene (Titelbild, Pausenmenü, Assistent 1–5, Charaktereditor, Editor aus dem Menü, Innenansicht). Vitest prüft den Stapel.

### AP18b – Formensprache und Spieloberfläche (L, nach Abnahme des Mockups)
1. **Tokens und Bausteine:** In `index.css` kommen Glas, Kante, Creme, Tinte und Schatten hinzu, abgeleitet aus dem Menü. In `frontend/src/ui/` entstehen `Glas`, `Knopf`, `Pille`, `Segment`, `Chip`, `Leiste` und `Bildnis`. Einstellungen, Einblicke, Dialoge und Spielstände ziehen auf diese Bausteine um, inhaltlich bleiben sie gleich.
2. **AppShell ohne Kopfzeile, Infoleiste und Ereigniszeile.** Die Welt füllt den Bildschirm. Die HUD-Teile kommen nach `frontend/src/hud/`, alles wie im Mockup:
   - oben links Uhr-Plakette (Tag, Zeit, Wochentag, Wetter, Dorfname), Zeitsteuerung (Pause, Schritt, ½ · 1× · 2× · 4× · Max), Abzeichen der Spielart;
   - oben rechts Modellpunkt (Klick: Menü › Einstellungen › Modell), Ton, Hilfe, Menü;
   - unten links die Bewohnerleiste (Bildnis, Name, Laune, Zustandszeichen; Klick öffnet die Karte, Doppelklick folgt; bis 8 Bewohner);
   - unten rechts Einblicke (Tagebuch, Gedächtnis, Statistik, Wissen) und darüber ein Ticker der letzten drei Ereignisse, der verblasst.
3. **Bewohner-Karte** (rechts, Glas) aus `AgentDetail`: Reiter Überblick, Ziele, Beziehungen, Entscheidungen, Fehlschläge. Knöpfe für Kamera folgt, Gedächtnis und Stimme.
4. **Tagebuch** = Protokoll (`EventTimeline`) und Verlauf (`EventHistory`) in einem: als Schublade mit Filterchips, „Alles · Ausfuhr“ öffnet die volle Ansicht mit Suche und Export.
5. **Einblicke** Gedächtnis, Statistik und Wissen werden ganzseitige Glasflächen über der Welt, keine eigene Ansicht mit „← Zur Welt“ mehr.
6. **Weg fallen:** die Schublade „Einstellungen“ (nur noch im Menü), „Zurücksetzen“ (nur Menü › Neue Simulation), „Welt gestalten“ in der Kopfzeile (Gott-Werkzeug, AP18d), Reiter „Ansicht“, Hinweiszeile `viewHint` und Ansichtswahl über der Welt.
7. Neu ist der Bereich Einstellungen › **Darstellung** (Tiefe/Flach, auch Taste `V`; Titelbild; Hilfe beim Start). Die **Hilfe** öffnet sich mit `?` und blendet sich beim ersten Start einmal ein.
8. Die Ereigniseingabe (`EventComposer`) wird ein Popover und hängt in AP18b vorläufig am Gott-Knopf. Bis AP18d bleibt jede Simulation „Gott“, damit nichts verloren geht.
9. Tests: e2e-Helfer (`showTab`, `viewMenu`, Kopfzeilen-Kennungen) auf das HUD umstellen, alle bestehenden Abläufe bleiben grün. Goldbilder der Welt bleiben unverändert (die Weltfläche wird nicht berührt). Neu sind Bildvergleiche des HUD in 1440 × 900 und 1100 × 700. Unter etwa 1320 px Breite zeigen die Einblicke nur Symbole und die Werkzeuge keine Tastenhinweise, damit sich unten nichts überdeckt (im Mockup so umgesetzt).

### AP18c – Schilder, Sprech- und Denkblasen (M, Frage 53 entschieden)
1. `world/Overlays.tsx` neu nach **Variante A** (Wolke, kleiner Name am Fuß, Rede als Sprechblase). Dazu kommt **Variante B** als Einstellung „wenig Text in der Welt“ (Einstellungen › Darstellung). Blasen brechen um (höchstens etwa 210 px breit, Gedanken höchstens 3 Zeilen). Rede und Gedanke sehen verschieden aus. Gemerktes und Erinnertes erscheint als kleines Zeichen, das verblasst, statt angehängtem Text.
2. **Kein Überlappen:** Schilder und Blasen weichen einander je Bild aus (gierig nach oben stapeln) und bleiben am Bildrand, mit Zeiger zur Figur.
3. **Im Haus:** Auf dem Dach stehen kleine Bildnisse statt gestapelter Textschilder. In der Innenansicht bekommt jede Figur ihr eigenes Schild, ohne Überdeckung.
4. **Fehler beheben:** Folgt die Kamera einer Figur im Haus, zeigt sie **das Haus** (Frage 53b) mit dem Bildnis auf dem Dach, nicht die Lage des Innenraums auf der Karte.
5. Tests: Vitest für das Ausweichen (reine Funktion), Playwright prüft, dass lange Gedanken umbrechen (Breite höchstens das Maximum, mehrere Zeilen), dass sich zwei Figuren auf einer Kachel nicht überdecken und dass „Kamera folgt“ im Haus aufs Haus zeigt.

### AP18d – Spielarten Leben und Gott (M)
1. Backend: `play_mode` (`leben` | `gott`) und `player` (Kennung der eigenen Figur oder leer) im Spielstand (`meta`). Gesetzt wird beides beim Anlegen (`POST /api/sim/new`, Assistent), gewechselt nur über Menü › Einstellungen › Spielart mit Bestätigung (Frage 55). Das Systemereignis `simulation.play_mode_changed` hat keine Agenten und steht nie in einem Prompt.
2. **Schutz im Backend:** In der Spielart Leben lehnen Ereigniseingabe, Gestalten-Entwürfe, Weltpatches und das Bearbeiten von Bewohnern mit 403 und klarem Text ab. Die Regler bleiben erlaubt (Frage 56).
3. Der bisherige `mode` heißt im Text „Wissen der Bewohner“ (Beobachter, Schöpfer, Eingriff) und steht unter „Erweitert“. Am Verhalten ändert sich nichts (Frage 57).
4. Frontend: **Neue Simulation hat nur noch zwei Kacheln** (Frage 63, Mockup Bild 7): „Schnellstart“ (immer Dorf am See mit Alex und Mira, Leben, ein Klick) und „Selbst definieren“ (der Assistent, erster Schritt „Spielart“). Darunter steht nur ein Verweis „Einen Spielstand laden →“ auf Menü › Simulation laden. Es fallen weg: „Startwelt neu beginnen“ (geht im Schnellstart auf), „Neues Dorf erzeugen“ (wandert in den Schritt Welt, AP18e/f), „Selbst gestalten“ (wird Editoren › Welten, AP18e) und die Kachel „Aus Spielstand“. Das HUD zeigt die Werkzeuge der Spielart: Gott hat Ereignis (`E`), Gestalten (`B`), Bewohner und Weltregeln. Leben hat keine Leiste.
5. Gestalten im Spiel öffnet bis AP16b den heutigen Editor ohne Generator: „Dorf anfügen“ fällt im Spiel weg, der Generator gibt es nur beim Erschaffen (AP18e/f).
6. „Leben mit eigener Figur“ steht im Assistenten als Möglichkeit, ist aber bis AP18h ausgegraut („kommt mit Mitleben“).
7. Tests: Spielart im Spielstand (speichern, laden, alte Stände gelten als Gott), Schutz je Endpunkt, HUD je Spielart, Prompt-Test: kein Wort zur Spielart im Prompt.

### AP18e – Weltenbibliothek und Welt-Werkstatt (L)
1. **Welten als eigene Dateien**, getrennt von Spielständen: `data/welten/<id>/welt.json` (Weltdatei wie `world_default.json`, ohne Gedächtnis), `info.json` (Name, Herkunft: leer, erzeugt mit Seed und Stellgrößen, Kopie, Import; Größe; Zähler; geändert) und `vorschau.png`. Die Startwelt „Dorf am See“ ist mitgeliefert und schreibgeschützt („Kopie bearbeiten“).
2. API: `GET/POST/PATCH/DELETE /api/worlds`, `…/duplicate`, `…/export`, `…/import`, `POST /api/worlds/blank` (Größe, Rand), `POST /api/worlds/from-sim` (die laufende Welt ohne Bewohner und Gedächtnis als Welt sichern). Die Vorschau zeichnet der Browser (DorfView, Gesamtansicht) und lädt sie hoch.
3. **Leere Welt:** `generator.blank_world(size, edge)` erzeugt Wiese, wahlweise mit Waldrand oder Seeufer, ohne Häuser und ohne Startplatz. Speichern geht immer, Starten erst mit Startplatz (Prüfung).
4. **Editoren › Welten** (Mockup Bild 8): Bibliothek mit Leere Welt, Welt erzeugen (vorerst der heutige Generator), Karten mit Öffnen, Duplizieren, Umbenennen, Export und Löschen.
5. **Welt-Werkstatt** (Mockup Bild 10): ganzseitiger Editor auf einer Datei, nicht auf der laufenden Simulation. Er arbeitet in einer Wegwerf-Simulation im Speicher, wie die Vorschau „Neue Simulation“ in AP12c. Oben stehen Name, „ungespeichert“, Speichern, Speichern als und „Damit spielen …“ (führt zu Neue Simulation mit vorgewählter Welt), links die Werkzeugleiste. In AP18e gibt es nur Zeiger, Startplatz und „Gebiet erzeugen“ (der vorhandene Generator als Rechteck). Die übrigen Werkzeuge kommen mit AP16b und AP16c.
6. **Neue Simulation › Selbst definieren › Welt** wählt aus der Bibliothek: Dorf am See, eigene Welten aus der Werkstatt, oder „Neue Welt erzeugen“ (Generator, AP18f). Eine leere Welt legt man nur in der Bibliothek an, nicht im Assistenten. Die Welt wird kopiert, die Bibliothek bleibt unverändert.
7. Tests: Welt anlegen, speichern, laden, duplizieren, exportieren und importieren (byte-gleich), alte Spielstände unberührt, leere Welt ohne Startplatz nicht startbar, Esc aus der Werkstatt führt zur Bibliothek.

### AP16 – Gestalten-Werkzeuge (bestehender Plan, angepasst)
[AP16-plan.md](AP16-plan.md) mit dem abgenommenen Mockup `gestalten.html` (Frage 37) bleibt gültig, mit drei Änderungen:
- Die Werkzeuge arbeiten an **zwei Orten**: in der Welt-Werkstatt (Datei, „Speichern“) und im Spiel bei Spielart Gott (laufende Welt, Zeit steht still, „Übernehmen“ mit Sicherung).
- Neu sind die Werkzeuge **Startplatz** und, nur in der Werkstatt, **Gebiet erzeugen**.
- Bedienteile in der Formensprache aus AP18b (Mockup Bild 6 und 10).
Reihenfolge der Teilpakete wie geplant: AP16a (Backend), AP16b (Außenwerkzeuge), AP16c (Innenausbau), AP16d (Härtung).

### AP18f – Generator neu: Vielfalt und Stellgrößen (L, ersetzt die Antwort auf Frage 26)
1. `generator/layout.py` wird ein Satz von **Dorfformen**: Straßendorf (Häuser auf beiden Seiten einer geschwungenen Straße), Haufendorf (Platz mit drei bis fünf Ästen und Abzweigen), Anger (Ringstraße um eine Wiese mit Teich), am Fluss (Fluss quer durch die Karte, Straße am Ufer, Brücken), Streusiedlung (Höfe mit eigenen Wegen) und Zufall. Die Skizze des Verfahrens steht in `docs/mockups/rework/generator.js`, als Vorbild wie `dorf.js` in AP12.
2. **Stellgrößen** (`Params`): Seed, Dorfform, Kartengröße (Klein, Mittel, Groß), Gebäude je Art (Wohnhäuser bis 12, Läden, Werkstätten, Scheunen, Ställe), Seen 0–4, Wasserlauf (keiner, Bach, Fluss), Wald (licht, mittel, dicht), Bäume im Dorf, Gärten 0–5, Felder 0–4, Wege (gerade, geschwungen). Was nicht passt, steht im Prüfbericht („2 passten nicht“).
3. **Türwege um Häuser herum:** Die Tür zeigt immer nach Süden, also bekommt ein Haus südlich der Straße einen Weg ums Haus herum, berechnet mit kürzestem Weg wie in der Skizze.
4. Bild: Prüfen, ob `look` v2 und DorfView mehrere Seen, Flüsse in jeder Lage, mehrere Plätze, Felder und Brücken über breite Flüsse zeichnen. Fehlendes wird ergänzt, etwa Felder aus den Beet-Bausteinen und breite Brücken. Neue Sprites nur nach Mockup.
5. **Nur beim Erschaffen:** Der Generator gibt es in Neue Simulation › Welt › Erzeugen und in Editoren › Welten › Welt erzeugen. Dazu kommt das Werkstatt-Werkzeug „Gebiet erzeugen“. Im Spiel gibt es ihn nicht.
6. Oberfläche wie im Mockup (Bild 9): links die Stellgrößen, rechts die echte Vorschau (Tiefe/Flach), darunter vier schnelle Pläne anderer Seeds. Die Pläne zeichnet der Browser aus den Kacheln, die das Backend liefert.
7. Tests: Eigenschaftstest über zufällige Stellgrößen und Seeds (immer bespielbar: alle Türen, Quellen und Startplatz erreichbar; Bild und Kacheln stimmen überein), gleicher Seed und gleiche Stellgrößen ergeben dasselbe Dorf, die Startwelt bleibt Pixel für Pixel gleich. Gespeicherte Welten und Spielstände sind Daten und ändern sich nicht. Die Fixtures (`dorf-seed-12.json`) werden bewusst neu erzeugt.

### AP18g – Bauen im Spiel: mehr Bauvorlagen (M bis L, Frage 59 entschieden)
In der Spielart Leben verändern nur die Bewohner die Welt, also brauchen sie mehr Möglichkeiten. Heute gibt es sechs Bauvorlagen (Bank, Vogelhaus, Feuerstelle, Gartenzaun, Steg-Verlängerung, Korb). Neu sind (19.10.2026) zuerst **Weg anlegen** (Stein je Feld), **Beet anlegen** (Saatgut), **Baum pflanzen** (Saatgut), **Laterne** (Holz, Stein) und **Brunnen** (Stein). Die **Hütte**, ein Haus mit Innenraum, folgt danach als eigenes Stück. Jede Vorlage ändert Kacheln **und** `look`, damit DorfView sie zeichnet; dafür gilt derselbe Patch-Weg wie in AP16a. Die Optionen und Prompts der Bewohner kennen die neuen Vorlagen. Tests laufen mit dem Fake-Modell: Ein Bewohner legt einen Weg an, und Bild und Kacheln stimmen danach überein.

### AP18i – Die Welt lebt selbst: Ereignisse von allein (M, Frage 62)
Antwort zu Frage 54: „Es sollte schon Wetter und Ereignisse geben, die wir nicht beeinflussen können.“ Das Wetter wechselt heute schon von selbst (`world/weather.py`, Folgewetter aus Seed und Zeit). Ereignisse von selbst gibt es noch nicht.
1. **Katalog als Daten** (`data/ereignisse_welt.json`): je Ereignis Bedingungen (Wetter, Jahreszeit, Tageszeit, Ort, z. B. „nur wenn es einen Garten gibt“), Gewicht und Wirkung als **Operationen der Ereigniseingabe** aus AP08. Damit laufen sie durch dieselbe Prüfung und Wissensverteilung: Wer es sieht, erfährt es. Für den Anfang: Gewitter oder Sturm, ein Baum stürzt um (Weg versperrt, Holz liegt da), Fuchs im Garten, reiche Ernte oder Pilze im Wald, Hochwasser am See, Nachtfrost, Sternschnuppennacht.
2. **Takt im Backend** wie beim Wetter: deterministisch aus Seed und Zeit, damit ein Spielstand gleich weiterläuft. Die Häufigkeit ist aus, selten, manchmal (Standard) oder oft und wird beim Anlegen (Schritt Regeln) und in den Einstellungen gewählt.
3. **In beiden Spielarten.** Für die Bewohner sind es natürliche Vorgänge ohne Urheber („keine höhere Instanz“). Im Tagebuch stehen sie mit eigenem Zeichen (🌩), damit du siehst, was die Welt selbst gebracht hat.
4. Sichtbare Szenen (Blitz, umgestürzter Baum, Hochwasser als Bild) kommen mit dem Paket **Szenen** (Frage 38). Bis dahin zeigen sich die Ereignisse über Wetter, veränderte Dinge und das Tagebuch.
5. Tests: gleicher Seed ergibt dieselben Ereignisse zur selben Zeit, Bedingungen werden eingehalten, bei „aus“ geschieht nichts, kein Prompt enthält einen Urheber, das Wissen kommt nur bei denen an, die es wahrnehmen.

### AP18h – Mitleben mit eigener Figur (L, eigener Plan)
Ausführlicher Plan mit Teilpaketen a–c und den Festlegungen zu Takt, Autopilot, Gedächtnis und Sicht (Fragen 73–75): **[AP18h-plan.md](AP18h-plan.md)**. Kurz: Die menschliche Figur ist ein Bewohner wie die anderen ([Mitspieler-Charaktere](../ARBEITSPAKETE.md#vorgemerkt-mitspieler-charaktere), Frage 11), derselbe Körper, dieselbe `propose`-Schnittstelle, keine Kennzeichnung im Prompt der anderen; dazu die Handlungsleiste aus Mockup Bild 4.

## Reihenfolge (Frage 61: wie vorgeschlagen)
1. **AP18a** Esc (klein, sofort möglich), 2. **AP18b** HUD und Formensprache, 3. **AP18c** Blasen, 4. **AP18d** Spielarten, 5. **AP18i** Ereignisse von allein, 6. **AP18e** Weltenbibliothek und Werkstatt, 7. **AP16a–d** Gestalten-Werkzeuge, 8. **AP18f** Generator, 9. **AP18g** Bauen im Spiel, 10. **AP18h** Mitleben.
AP18f hängt nur an AP18e (Speichern der erzeugten Welt) und kann auch vor AP16 kommen, wenn die Vielfalt wichtiger ist als die Werkzeuge. AP17b und AP17c-3/-4 hat die Projektleitung am 19.10.2026 zum Zusammenführen freigegeben; die AP18-Pakete beginnen auf dem Stand von `main` danach.

## Risiken
| Risiko | Gegenmaßnahme |
|---|---|
| Viele e2e-Tests hängen an Kopfzeile und Infoleiste (94 Playwright-Tests) | AP18b stellt zuerst die Helfer um, Kennungen (`data-testid`) bleiben, wo der Inhalt bleibt |
| Ohne Infoleiste sieht man weniger vom Verhalten der Bewohner | Ticker, Zustandszeichen in der Bewohnerleiste, Tagebuch mit einem Klick; Abnahme am Mockup |
| Ausweichen der Blasen kostet je Bild Zeit | einfache gierige Anordnung, nur sichtbare Figuren, höchstens 8 Bewohner (später Bündeln, [Skalierung](../offene-fragen.md)) |
| Spielart Leben ohne genug Bauvorlagen wirkt starr | AP18g direkt nach dem Generator; bis dahin ist Gott Standard für alte Stände |
| Neue Dorfformen sprengen den Renderer | AP18f prüft DorfView zuerst mit Fixtures aus der Skizze, bevor das Backend umgebaut wird |
| Welten und Spielstände werden verwechselt | eigene Bibliothek, eigene Kacheln im Menü, Spielstände enthalten Bewohner und Gedächtnis, Welten nicht |
| Parallele Sitzungen im selben Ordner | je Teilpaket ein eigener Branch und Worktree, nie `git add -A` ([geteiltes Arbeitsverzeichnis](../status/AP18-schritt0.md#arbeitsweise)) |

## Bewusst festgelegt (ohne Frage)
- Das **Menü** (Liste links, Inhalt rechts, Titelbild, Fortsetzen-Karte) bleibt in Aussehen und Bedienung. Nur die Inhalte der Bereiche sind neu.
- Die **Weltfläche** (DorfView, Tiefe und Flach, Bild A, Innenräume nach innen2) bleibt unverändert. Das Rework betrifft alles darüber und darum herum.
- Beide Ansichten **Tiefe und Flach** bleiben wählbar (AP12b).
- Ausrollen nur nach Freigabe, immer aus einem sauberen Checkout.
