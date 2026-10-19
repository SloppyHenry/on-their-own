# AP18 Schritt 0 – Befund, Mockup, Fragen (19.10.2026)

**Auftrag:** Henry, 19.10.2026 (Wortlaut im [Plan](../arbeitspakete/AP18-plan.md)). **Gebaut:** Plan `docs/arbeitspakete/AP18-plan.md`, Startprompts `docs/arbeitspakete/AP18-start-prompts.md`, Mockup `docs/mockups/rework.html` mit `docs/mockups/rework/`, Fragen 52–62 in `docs/offene-fragen.md`. **Kein Anwendungscode** wurde geändert.

## So siehst du es an
`docs/mockups/rework.html` im Browser öffnen (Doppelklick genügt, alles liegt lokal). Oben in der Mitte öffnet der Reiter **„Mockup ▾“** (oder die Taste `M`) die **Mockup-Leiste** mit zehn Bildschirmen, den Blasen-Varianten **A · B · C** und der Taste **Erklärung** (der Kasten links, je Bild ein kurzer Text). Bedienbar sind:
- im Spiel `?` (Hilfe), `T` (Tagebuch), Klick auf ein Bildnis (Karte), im Gott-Modus `E` und `B`, und `Esc` schließt jeweils das Oberste;
- im Menü Weiter, Zurück, Brotkrumen und `Esc`, das genau eine Ebene zurückgeht;
- bei „Welt erzeugen“ jede Stellgröße und Würfeln. Der Plan wird jedes Mal neu erzeugt, und die vier kleinen Pläne zeigen andere Seeds;
- in der Werkstatt Werkzeuge mit `1`–`9`, ein Klick in die Wiese setzt das Gewählte.

## Befund: der alte Stand
| Bild | Was auffällt |
|---|---|
| ![Spiel](img/ap18-ist-1-spiel.jpg) | **Kopfzeile mit 17 Bedienelementen** (Uhr, Wetter, Start, Schritt, fünf Tempi, Zurücksetzen, Einstellungen, Welt gestalten, », Einblicke, Status, Ton, Menü), **Infoleiste** 380 px, **Ereigniszeile** 80 px. Die Welt bekommt 1060 × 770 von 1440 × 900 px. Der Stil (grau, kleine Knöpfe) passt nicht zum Menü. |
| ![Hinweiszeile](img/ap18-ist-2-hinweiszeile.jpg) | Bei eingeklappter Leiste schweben Ansichtswahl und die **Hinweisschrift** über der Welt. |
| ![Einstellungen](img/ap18-ist-3-einstellungen.jpg) | Die Einstellungen sind eine Schublade **zwischen** Welt und Infoleiste, zehn Reiter mit Reglern. Dieselben Einstellungen gibt es ein zweites Mal im Menü. |
| ![Welt gestalten](img/ap18-ist-4-welt-gestalten.jpg) | „Welt gestalten“ heißt nur: Seed, Seeufer, Gebäudemix, Vorschau. Es gibt keine Werkzeuge, keine leere Welt und kein Speichern als Welt. |
| ![Innen](img/ap18-ist-5-innen-schilder.jpg) | In der Innenansicht überdecken sich die Schilder („Alex Mira · ohne Vorhaben“). |
| ![Kamera](img/ap18-ist-6-kamera-folgt.jpg) | **Fehler:** „Kamera folgt“ auf Alex, der im Haus ist, zeigt eine leere Wiese, nämlich die Lage des Innenraums auf der Karte. Am linken Rand hängen abgeschnittene Schilder („…ben“). |
| ![Assistent](img/ap18-ist-7-assistent.jpg) | Der Assistent ist eine lange Rollseite im Menübereich. Esc führt hier zurück, aus dem Editor aber nicht. |
| ![Neue Simulation](img/ap18-ist-8-neue-simulation.jpg) | Unter Neue Simulation stehen fünf Kacheln mit sich überschneidenden Wegen: Startwelt, Dorf erzeugen, Selbst definieren, Selbst gestalten („später“), Aus Spielstand. |

Weitere Befunde aus dem Code:
- **Schilder:** `world/Overlays.tsx` setzt Name, Tätigkeit und `＋ merkt sich: …` in ein Element mit `whitespace-nowrap`. Daher laufen die „Denkboxen“ in die Breite. Die Sprechblase hat schon `max-w-52`, ist aber nicht von einem Gedanken zu unterscheiden.
- **Esc:** Es gibt sieben eigene Esc-Behandler (Menü, Innenansicht, Einblicke, Schublade, Dialoge, Assistent, Editor) ohne gemeinsame Reihenfolge. Das Menü öffnet Esc nur bei `appMode === "game"`, also kommt man aus dem Editor mit Esc nicht zurück, auch wenn man aus dem Menü kam.
- **Generator** (`generator/layout.py`): Es gibt ein Muster, nämlich Platz, Hauptstraße, Südstraße, Häuserzeile entlang der Straße, einen See (Osten oder Süden), einen Garten und einen Wald. Die Stellgrößen sind nur Seed, Seeufer und Gebäudemix (Frage 26).
- **Bauvorlagen der Bewohner** (`data/blueprints.json`): Es sind sechs (Bank, Vogelhaus, Feuerstelle, Gartenzaun, Steg-Verlängerung, Korb). Damit kann eine Spielart „nur die Bewohner verändern die Welt“ wenig bewirken. Rohstoffe sind Holz, Stein, Schilf, Saatgut, Nahrung und Wasser.
- **Modus** (`agents/modes.py`): Beobachter, Schöpfer und Eingriff regeln, **was die Bewohner wissen**, nicht, wer die Welt verändern darf. Die neuen Spielarten sind etwas anderes (Frage 57).

## Das Mockup
| Bild | Inhalt |
|---|---|
| ![1](img/ap18-mockup-1-spiel.jpg) | **Spiel, Spielart Leben.** HUD in den Ecken, Bewohnerleiste unten links, Einblicke und Ticker unten rechts, keine Hinweisschrift. Blasen Variante A. |
| ![2](img/ap18-mockup-2-bewohner.jpg) | **Bewohner-Karte** statt Infoleiste: was die Figur tut und will, Bedürfnisse, Beziehungen, letzte Entscheidung mit „Warum?“. |
| ![3](img/ap18-mockup-3-tagebuch.jpg) | **Tagebuch** = Protokoll und Verlauf in einem, mit Filterchips. |
| ![4](img/ap18-mockup-4-figur.jpg) | **Leben mit eigener Figur:** Handlungsleiste und Bauen-Katalog (heutige sechs Vorlagen und sechs neue). |
| ![5](img/ap18-mockup-5-gott.jpg) | **Spielart Gott:** Werkzeugleiste unten Mitte, die Ereigniseingabe als Popover. |
| ![6](img/ap18-mockup-6-gestalten.jpg) | **Gestalten im Spiel** (Gott): Die Zeit steht still, Werkzeuge wie in AP16, Übernehmen, kein Generator. |
| ![7](img/ap18-mockup-7-neue-simulation.jpg) | **Neue Simulation › Spielart** im unveränderten Menü, mit Brotkrumen und „Esc zurück zu …“. |
| ![8](img/ap18-mockup-8-welten.jpg) | **Editoren › Welten:** die Weltenbibliothek. |
| ![9](img/ap18-mockup-9-erzeugen.jpg) | **Welt erzeugen** mit allen Stellgrößen und einem echten Verfahren (Dorfform zufällig, hier eine Streusiedlung). |
| ![10](img/ap18-mockup-10-werkstatt.jpg) | **Welt-Werkstatt** auf einer leeren Welt: Name, ungespeichert, Speichern, Damit spielen. |
| ![A](img/ap18-mockup-blasen-A.jpg) ![B](img/ap18-mockup-blasen-B.jpg) ![C](img/ap18-mockup-blasen-C.jpg) | **Blasen A · B · C** (Frage 53): A Wolke mit Bläschen und kleinem Namen am Fuß, B leise (nur „•••“, Text beim Zeigen), C kleine Karte (Name, Handlung, Gedanke). Alle brechen um, Gemerktes erscheint als verblassendes Zeichen, und wer im Haus ist, steht als Bildnis auf dem Dach. |
| ![Hilfe](img/ap18-mockup-hilfe.jpg) | **Hilfe** auf `?` statt Hinweiszeile. |

**Was das Mockup nicht ist:**
- Die Weltbilder sind Aufnahmen des echten Spiels (Fake-Modell). Figuren, Blasen und HUD liegen als HTML darüber, die Bewegung fehlt.
- Die Bildnisse sind genähert gezeichnet; im Spiel kommen sie aus `lib/Portrait.tsx`.
- Die Sprites in der Werkstatt sind aus dem flachen Dorfbild freigestellt, die Kanten sind daher nicht ganz sauber. Im Spiel zeichnet DorfView die echten Bausteine.
- Der Plan bei „Welt erzeugen“ ist schematisch (eine Kachel ein Punkt). Im Spiel steht dort die echte Vorschau in Tiefe und Flach, nur die vier kleinen Pläne bleiben schematisch.
- Die Hanne-Figur ist eine der Vorlagen aus AP17b und dient nur dem Beispiel „jemand ist im Haus“.

## Arbeitsweise
- Jedes Teilpaket bekommt eine eigene Sitzung mit dem Startprompt aus `AP18-start-prompts.md`, einen eigenen Branch und, wenn nötig, einen Worktree. Es wird nie `git add -A` verwendet, denn Henry arbeitet oft parallel im selben Ordner. Bei Schritt 0 lagen fremde, nicht eingecheckte Änderungen im Ordner (`ParameterPanel.tsx`, `uiStore.ts`, `people.ts`, `menue.spec.ts`, ein Goldbild).
- **AP18a** (Esc) hängt nicht vom Mockup ab und kann sofort beginnen. Alles andere wartet auf Henrys Abnahme (Frage 52).
- Für die Aufnahmen lief ein eigenes Backend mit Fake-Modell auf Port 8391 und Vite auf 5391, mit eigenem Datenordner im Sitzungsverzeichnis. Die Skripte liegen nicht im Repo.
