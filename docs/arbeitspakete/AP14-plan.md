# AP14 – Plan: Welt genau wie Mockup A

**Auftrag:** Henry, 13.10.2026 (Frage 22): Die Welt soll **genau** aussehen wie Bild A (`docs/mockups/welt-optik/A-mischung-abend.png`, Code `world.js`): gleicher Bildausschnitt, gleiche Skalierung, gleiche Bäume, See mit Boot, Effekte. Klick aufs Haus zeigt es von innen. Kamera „wie A, aber beweglich“, Startwelt „ja, Welt wie A“. Branch `ap/14-startwelt-a` (baut auf `ap/13-weltoptik` auf).

## Entscheidungen
- **Bild:** `createWorld` aus `world.js` wird 1:1 übernommen (Puffer 320 × 200, Projektion `wProject`, Bodenregeln `wTexel`, Himmel, Wolken, Hügel, Dunst, Wasserglitzern, Rauch, Farbstimmung, Lichtschein, Tilt-Shift, Teilchen, Vignette). Nur die Figuren, Dinge und Pflanzen kommen aus dem Weltzustand statt fest aus dem Mockup.
- **Beweglich ohne Flimmern:** Zoom 1× ist genau Bild A. 2× und 3× vergrößern das fertige Bild A in ganzen Stufen; dann verschieben WASD, Pfeile und Ziehen den Ausschnitt. Das Bild wird nie neu abgetastet, darum flimmert nichts. Fenstergrößen werden in ganzen Pixelstufen ausgefüllt (mehr Himmel oder Wald am Rand, nie gestaucht).
- **Startwelt = Plan von A:** Die Karte ist der Bodenbereich von A (384 × 288 Weltpixel = 24 × 18 Kacheln, Dorf in der Mitte, Wald hinten und an den Seiten). Kachelarten folgen den Formen aus A (Wege, runder Platz, See, Steg, Garten mit drei Beeten). Bäume aus A sind Hindernisse. Formen, Bäume und Deko stehen als Daten in der Weltdatei (`look`), nicht im Code, damit spätere Welten (AP12) dieselbe Darstellung nutzen.
- **Haus innen:** Draußen steht das kleine Haus aus A. Die fünf Räume (Zimmer Alex, Zimmer Mira, Werkstatt, Küche, Wohnzimmer) liegen in einem eigenen Innenbereich der Karte, verbunden über die Haustür als **Übergang** (Wegsuche und Bewegung gehen hindurch). Innen sieht und hört man nur innen, draußen nur draußen (wie bisher nach Ort und Hörweite). Innenansicht wie im Mockup `ruhig.html` (eben, ganze Pixelstufen, Wände unten).
- **Gleiche Rollen:** Orte, Objekte und Ressourcen behalten ihre Kennungen, damit Verhalten, Tests und Auswertungen vergleichbar bleiben. Sechs Beete liegen in den Reihen 1 und 3 von A, die Tomaten in Reihe 2 und die Sonnenblumen sind Deko wie im Bild.
- **Alte Spielstände** behalten ihre alte Welt und werden mit der AP13-Darstellung gezeigt (ohne `look`).

## Schritte (je ein Commit, mit Tests)
1. Backend: Übergänge (`links`) in Raster, Wegsuche, Bewegung, Weltdatei und Spielstand.
2. Backend: neue Startwelt nach A mit `look`; API liefert `look`; Tests angepasst.
3. Frontend: Dorfansicht 1:1 nach `createWorld` (Zoomstufen, Verschieben, Klicks, Schilder, Folgen, Mitspieler-Vorschau).
4. Frontend: Innenansicht des Hauses.
5. Browser-Tests, Leistungsmessung, Bilder, Doku, Statusbericht.

Ausrollen nur nach Henrys Freigabe.
