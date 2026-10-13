# AP13 – Weltoptik „Mischung“ und Vorbereitung der Mitspieler-Steuerung

**Auftrag:** Henry, 13.10.2026 (Richtung A aus den Mockups gewählt; offene Fragen 11 und 16) · **Abhängig von:** AP04, AP11 · **Vor:** AP12 (der Generator zeichnet mit dieser Darstellung) · **Umfang:** L

## Ziel
Die Weltansicht bekommt die Optik aus Mockup **A · Mischung**: Pixelart wie heute, aber mit Tiefe. Der Boden wölbt sich zum Horizont (wie bei Animal Crossing), Häuser, Bäume, Dinge und Figuren stehen als aufrechte Pixel-Sprites darauf, dazu Himmel, Dunst, Lichtschein, Tageszeit-Stimmung und Tilt-Shift. Gleichzeitig wird die Bedienung so vorbereitet, dass später ein Mensch **per Point-and-Click** eine eigene Figur steuern und **per Tastatur** sprechen kann. Der Mitspieler-Modus selbst wird in AP13 **nicht** gebaut.

## Referenz
- Mockups: `docs/mockups/welt-optik/` (`index.html` im Browser öffnen; A ist gewählt, B und C nur zum Vergleich; Bilder `A-mischung-*.png`). Arbeitsfläche: https://claude.ai/artifact/5vBSgpQzrGzEXV6Jbx48dq
- `world.js` zeigt die Technik: Projektion `wProject` (Dorfkoordinaten → Bildschirm, Wölbung über `GAMMA` und Horizontkurve `34 + 14·k²`), Bodenabtastung je Pixel, Sprites aus Code (`wTree`, `wHouse`, `wPerson` …), Tageszeiten `W_TIMES`, Lichter, Tilt-Shift, Teilchen. **Mockup-Code, kein Produktionscode:** feste Kamera, feste Welt, kleiner Puffer 320×200 ×4.
- Heutige Weltansicht: `frontend/src/world/` (Phaser 3.90, `WorldScene.ts`, `agentViews.ts`, `cameraRig.ts`, `worldBridge.ts`, `Overlays.tsx`, `draw/*`, Kachel 16 px), Doku `docs/frontend.md`, `docs/assets.md`.

## Leitplanken
1. **Gezeichnet wird, was der Zustand sagt** (wie bisher): Kacheln, Orte, Objekte, Pflanzenstufen, Türen, Baustellen, Wetter, Uhrzeit kommen aus dem Weltzustand; Grafik weiter aus Code erzeugt, parametrisch (AP12 baut darauf auf).
2. **Kamera bleibt beweglich:** Zoom, Ziehen, Folgen (Doppelklick, Taste F), Gesamtansicht (Taste 0). Die Wölbung muss bei jeder Kamerastellung stimmen. Eine Projektion je Pixel auf der CPU wie im Mockup reicht dafür nicht; Vorschlag: Boden als Textur (wie heute einmal gezeichnet) und die gewölbte Abbildung in einem WebGL-Shader, Sprites per CPU projiziert und nach Tiefe sortiert, alles in einen niedrig aufgelösten Puffer (Pixelfaktor 3–4) und dann ohne Glättung hochskaliert. Andere Lösungen sind erlaubt, wenn sie die Ziele erreichen.
3. **Eine Projektion für alles:** Welt → Bildschirm (Sprites, Namensschilder, Sprechblasen, Lichtschein) und Bildschirm → Welt (Klicks) aus derselben Funktion, mit Vitest-Test für den Hin- und Rückweg.
4. **Skalierbar** (Henry plant mehr Figuren und größere Welten): Karte bis 256 × 256 Kacheln, Ziel ≥ 30 fps mit 20 Figuren und 500 Objekten, 60 fps mit der Startwelt bei 1440 × 900. Messen und im Statusbericht zeigen.
5. **Flache Ansicht bleibt als Einstellung** („Ansicht: Tiefe | Flach“): dieselbe Pixelwelt ohne Wölbung (Mockup B). Sie dient als Rückfall, für schwache Geräte und für Tests. `prefers-reduced-motion`: Teilchen und Tilt-Shift aus.
6. **Häuser innen:** Heute öffnet sich das Dach, wenn jemand im Haus ist. Mit aufrechten Fassaden braucht es eine neue Lösung (Vorschlag: Fassade wird durchsichtig bzw. klappt weg, Grundriss und Möbel bleiben sichtbar, sobald jemand drin ist oder ein Raum gewählt ist). Vor dem Bau als offene Frage mit Mockup vorlegen. Dabei auch Frage 16 lösen (das geschlossene Haus wirkt zu groß).
7. **Figuren** brauchen Ansichten von vorn, hinten und der Seite und Laufbilder (das Mockup hat nur die Vorderansicht). Gesichter, Schlaf, Werkzeug wie heute.
8. **Bestehende Bedienung bleibt:** Klick auf Figur oder Raum öffnet das Detail, Protokoll, Inspektor, Tastenkürzel, WebSocket-Fluss über `worldBridge`. Die Browser-Tests (u. a. `e2e/world.spec.ts`, `e2e/acceptance/abnahme.spec.ts` K06/K13) werden angepasst, nicht abgeschaltet.

## Vorbereitung Mitspieler (nur Grundlage, kein Modus)
Henry will später selbst als Figur mitspielen (offene Frage 11): Für die KIs ist der Mensch ein gleichwertiger Bewohner (gleicher Körper, gleiche Aktions-Schnittstelle `propose`, gleiche Wahrnehmung). AP13 legt nur die Bedienung dafür an:

1. **Zeigen und Treffen:** Unter dem Mauszeiger wird erkannt, was dort ist (Kachel, Objekt, Figur, Ort), mit Hervorhebung und passendem Mauszeiger. Treffer über die Rückprojektion und die Sprite-Umrisse in Tiefenreihenfolge.
2. **Point-and-Click:** Klick auf den Boden → Zielkachel mit Markierung und **Wegvorschau** (gepunkteter Weg auf dem Boden, geschätzte Dauer; Wegsuche im Frontend auf dem Kachelraster aus dem Zustand). Klick auf ein Objekt oder eine Figur → kleines Kontextmenü mit Handlungen (ansehen, nehmen, benutzen, ansprechen …; vorerst aus dem Aktionskatalog abgeleitet, später vom Backend geprüft).
3. **Sprechen per Tastatur:** Eingabefeld „Sagen …“ (öffnen mit Enter oder über „ansprechen“), Länge wie `speak` (höchstens 500 Zeichen), Escape bricht ab. Solange das Feld den Fokus hat, lösen Tasten keine Kürzel aus (F, 0 usw.).
4. **Eine Schnittstelle für Absichten:** z. B. `PlayerController` mit `moveTo(tile)`, `interact(targetId, action, params)`, `say(to, text)`. In AP13 zeigt sie nur eine Vorschau („würde gehen nach …“, „würde sagen …“) und schickt **nichts** an die Simulation. Später hängt der Mitspieler-Modus sie an das Backend.
5. **Hinter einem Schalter:** Einstellung „Mitspieler-Steuerung (Vorschau)“, standardmäßig aus. Aus: Klick wählt aus wie heute. An: Klick geht/handelt, Auswählen mit Umschalt-Klick oder Rechtsklick.
6. **Nicht in AP13:** menschlich gesteuerte Figuren im Backend, Anmeldung mehrerer Menschen, Takt für Menschen, Abwesenheit, Gedächtnis des Menschen (die offenen Punkte aus Frage 11).

## Lieferumfang
1. Neue Weltansicht „Tiefe“ plus Einstellung „Flach“, Tageszeiten, Wetter, Lichtschein, Teilchen, Tilt-Shift.
2. Gemeinsame Projektion mit Rückweg; Treffer, Hervorhebung, Wegvorschau, Kontextmenü, Spracheingabe, `PlayerController` (Vorschau) hinter dem Schalter.
3. Tests: Vitest (Projektion hin und zurück, Wegsuche, Treffer, Tastaturfokus), Playwright (Klick auf Figur und Raum in beiden Ansichten, Namensschild folgt der Figur, Wegvorschau, Spracheingabe ohne Auslösen von Kürzeln, Ansicht umschalten), alle bisherigen Tests grün.
4. Leistungsmessung (fps, Bildzeit) mit Startwelt und mit großer Welt; Ergebnis im Statusbericht.
5. Doku: `docs/frontend.md`, `docs/assets.md`, `docs/grenzen.md`; Statusbericht `docs/status/AP13.md` mit Bildschirmfotos (Tag, Abend, Nacht; Tiefe und Flach; Haus innen; Mitspieler-Vorschau).

## Vorgehen
- Branch `ap/13-weltoptik`. Zuerst lesen (Mockups, `frontend/src/world/`, `docs/frontend.md`, `docs/offene-fragen.md` Nr. 11 und 16), dann einen kurzen Plan und die offenen Fragen (mindestens: Häuser innen, Figurenansichten) in `docs/offene-fragen.md` eintragen und Henry vorlegen, bevor gebaut wird.
- Projektregeln wie bisher: Deutsch in Oberfläche, Kommentaren und Commits; keine Datei über 400 Zeilen; keine neue schwere Abhängigkeit ohne Begründung (Phaser ist da); Commit je fertigem Schritt.
- Ausrollen auf maintux oder SecondTux nur nach ausdrücklicher Freigabe.

## Abnahme
- [ ] Ansicht „Tiefe“ entspricht Mockup A in Stimmung und Lesbarkeit; Henry hat sie gesehen und freigegeben.
- [ ] Kamera (Zoom, Ziehen, Folgen, Gesamtansicht) funktioniert in beiden Ansichten; Wölbung stimmt bei jeder Stellung.
- [ ] Klicks treffen das Richtige (Figur, Objekt, Raum, Kachel) in beiden Ansichten; Namensschilder und Sprechblasen sitzen über den Figuren.
- [ ] Mitspieler-Vorschau: Wegvorschau, Kontextmenü und Spracheingabe funktionieren hinter dem Schalter und senden nichts an die Simulation; ausgeschaltet verhält sich alles wie vorher.
- [ ] Leistungsziele erreicht oder Abweichung offen benannt.
- [ ] Alle Tests grün, Doku und Statusbericht vollständig.
