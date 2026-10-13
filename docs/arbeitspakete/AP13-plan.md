# AP13 – Plan (Entwurf zur Freigabe, 13.10.2026)

Auftrag: [AP13-weltoptik.md](AP13-weltoptik.md). Offene Fragen dazu: Nr. 18–21 in [offene-fragen.md](../offene-fragen.md). Mockups: `docs/mockups/welt-optik/haus-innen.html` (Bilder `haus-*.png`, `figuren-16x24.png`).

## Technik in Kürze
- **Eine Projektion** (`world/view/projection.ts`): Kamera = Fokuspunkt (Weltpixel) + Zoom, Ansicht „Tiefe“ oder „Flach“. `project(wx, wy, höhe)` und `unproject(sx, sy)` aus denselben Formeln wie im Mockup A (Wölbung `GAMMA`, Horizontkurve), nur mit beweglicher Kamera. Beide Richtungen sind geschlossen lösbar; im Mockup `haus.js` schon erprobt. Alles (Sprites, Schilder, Blasen, Licht, Klicks, Wegvorschau) geht hierüber.
- **Phaser bleibt** (keine neue Abhängigkeit). Das Spiel rendert in einen kleinen Puffer (Bildschirm ÷ Pixelfaktor 3) und wird ohne Glättung hochskaliert. Die Phaser-Kamera steht fest, Zoom/Ziehen/Folgen/Gesamtansicht rechnet `cameraRig` auf der eigenen Kamera.
- **Boden:** wie heute einmal als Textur gezeichnet, in Blöcken bis 2048 px (eine 256 × 256-Karte sind 4096 px, zu groß für manche Grafikkarten). Die gewölbte Abbildung, der Dunst und das Wasserglitzern macht ein Fragment-Shader (Phaser-`Shader`, Werte aus `projection.ts`). „Flach“ zeigt die Textur direkt und dient auch als Rückfall ohne WebGL.
- **Aufrechtes:** Bäume, Objekte, Zäune, Figuren und Wandstücke sind Sprites, je Bild per CPU projiziert und nach Welt-y sortiert. Dächer sind angehobene Flächen (zweite Shader-Ebene mit Höhe). Was vor einem offenen Haus oder der gewählten/verfolgten Figur steht, wird halb durchsichtig.
- **Stimmung:** Himmel, Hügel, Wolken, Sterne aus der Uhr (Tageszeiten fließend gemischt statt vier fester Stufen), Wetter aus dem Zustand, Lichtschein mit Höhe, Teilchen, Tilt-Shift (Phaser-PostFX). `prefers-reduced-motion`: Teilchen und Tilt-Shift aus.
- **Zeigen und Treffen** (`world/view/picking.ts`): Sprites in umgekehrter Tiefenreihenfolge, Treffer über die Pixelmaske des Sprites, sonst Boden per Rückprojektion → Kachel → Objekt/Ort. Hervorhebung als Umriss, passender Mauszeiger.
- **Mitspieler-Vorschau** (`world/player/`): `PlayerController` (`moveTo`, `interact`, `say`) zeigt nur Vorschau, sendet nichts. Wegsuche A* im Frontend auf `walkable`/`cost` der Kacheln (gleiche Regeln wie `pathfinding.py`). Handlungen des Kontextmenüs aus der Objekt-Registry (`object_kinds.py`, Modi und „tragbar“) als generierte Tabelle wie die Typen. Schalter „Ansicht: Tiefe | Flach“ und „Mitspieler-Steuerung (Vorschau)“ lokal im Browser (Ansicht-Menü an der Welt), nicht im Backend.
- **Leistung:** Messanzeige (fps, Bildzeit) hinter `?messen`; Playwright-Messlauf mit Startwelt (1440 × 900) und einer erzeugten 256 × 256-Testwelt mit 20 Figuren und 500 Objekten (nur als Testdatei, kein Spielstand).

## Schritte (je ein Commit, Tests grün)
0. Plan, offene Fragen, Mockups Haus innen und Figuren (dieser Stand).
1. Projektion und Kamera für beide Ansichten, Vitest hin und zurück; „Flach“ läuft schon über die neue Projektion, alle bisherigen Tests grün.
2. Tiefe: Puffer mit Pixelfaktor, Boden-Shader in Blöcken, Himmel, Hügel, Dunst; Ansicht umschaltbar.
3. Aufrechte Sprites im Stil von Mockup A (Bäume, Objekte, Zäune, Vorräte), Tiefensortierung, Durchsicht für Verdecker.
4. Häuser: Fassade, Dach, Innenansicht nach Antwort auf Frage 18; Fenster abends warm.
5. Figuren nach Antwort auf Frage 19; Namensschilder und Sprechblasen über die Projektion.
6. Tageszeiten, Wetter, Lichtschein, Teilchen, Tilt-Shift, reduzierte Bewegung.
7. Zeigen und Treffen, Hervorhebung, Mauszeiger; Klick auf Figur und Raum in beiden Ansichten; `world.spec.ts`, K06, K13 angepasst.
8. Mitspieler-Vorschau hinter dem Schalter: Wegvorschau mit Dauer, Kontextmenü, „Sagen …“ (Enter öffnet, Esc bricht ab, höchstens 500 Zeichen, keine Kürzel solange es Fokus hat), Vitest und Playwright.
9. Leistungsmessung, falls nötig nachbessern.
10. Doku (`frontend.md`, `assets.md`, `grenzen.md`), Statusbericht `docs/status/AP13.md` mit Bildschirmfotos. Danach Vorlage bei Henry; ausgerollt wird erst nach Freigabe.

## Bewusst festgelegt (ohne Frage)
- Die Kamera dreht sich nicht, Norden ist immer hinten. Jenseits des Kartenrands zeigt die Tiefe Wald und Wiese bis zum Horizont (wie im Mockup), ohne Weltdaten.
- Das geschlossene Haus wird nicht verkleinert: Wege, Klicks und Räume müssen dort liegen, wo der Zustand sie hat. Gegen „wirkt zu groß“ (Frage 16) helfen die Tiefe, die das Dach verkürzt, und eine niedrige Fassade (1,6 Kacheln).
- Risiko: WebGL in Playwright (headless, Software-Rendering) ist langsam. Die Browser-Tests laufen in beiden Ansichten, die Leistung wird aber nur in einem echten Browser gemessen.
