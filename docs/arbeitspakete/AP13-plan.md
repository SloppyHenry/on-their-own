# AP13 – Plan (13.10.2026, freigegeben)

Auftrag: [AP13-weltoptik.md](AP13-weltoptik.md). Offene Fragen dazu: Nr. 18–21 in [offene-fragen.md](../offene-fragen.md). Mockups: `docs/mockups/welt-optik/echt.html` (**Maßstab: Darstellung 1:1 wie Mockup A**, Bilder `echt-*.png`), `haus-innen.html` (Haus draußen und innen: `haus-A-draussen.png`, `haus-B-innen.png`). Den Grundriss der Startwelt passt das Folgepaket [AP14](AP14-startwelt-innenbereiche.md) an.

**Leitsatz:** Es soll 1:1 aussehen wie im Mockup. Darum werden Sprites, Bodenmuster, Farben, Tageszeiten und Effekte aus `world.js` nicht nachgezeichnet, sondern nach TypeScript übertragen (gleiche Pixel), und das Ergebnis wird gegen die Mockup-Bilder verglichen.

## Technik in Kürze
- **Eine Projektion** (`world/view/projection.ts`): Kamera = Fokuspunkt (Weltpixel) + Zoom, Ansicht „Tiefe“ oder „Flach“. `project(wx, wy, höhe)` und `unproject(sx, sy)` aus denselben Formeln wie im Mockup A (Wölbung `GAMMA`, Horizontkurve), nur mit beweglicher Kamera. Beide Richtungen sind geschlossen lösbar; im Mockup `haus.js` schon erprobt. Alles (Sprites, Schilder, Blasen, Licht, Klicks, Wegvorschau) geht hierüber.
- **Phaser bleibt** (keine neue Abhängigkeit). Das Spiel rendert in einen kleinen Puffer (Bildschirm ÷ Pixelfaktor 3) und wird ohne Glättung hochskaliert. Die Phaser-Kamera steht fest, Zoom/Ziehen/Folgen/Gesamtansicht rechnet `cameraRig` auf der eigenen Kamera.
- **Boden:** wie heute einmal als Textur gezeichnet, in Blöcken bis 2048 px (eine 256 × 256-Karte sind 4096 px, zu groß für manche Grafikkarten). Die gewölbte Abbildung, der Dunst und das Wasserglitzern macht ein Fragment-Shader (Phaser-`Shader`, Werte aus `projection.ts`). „Flach“ zeigt die Textur direkt und dient auch als Rückfall ohne WebGL.
- **Aufrechtes:** Bäume, Objekte, Zäune, Figuren und Wandstücke sind Sprites, je Bild per CPU projiziert und nach Welt-y sortiert. Was vor der gewählten oder verfolgten Figur steht, wird halb durchsichtig.
- **Häuser (Frage 18):** Draußen das Haus `wHouse` aus Mockup A (bei breiteren Gebäuden mit mehr Fenstern, sonst unverändert), Tür an der echten Haustür (aus `findBuildings`), Fenster warm, sobald jemand drin ist oder es Abend ist. Der restliche Grundriss wird Garten (aus Code, deterministisch). Figuren im Haus werden draußen ausgeblendet; ein Schild über dem Dach zeigt, wer drin ist (dort erscheinen auch ihre Sprechblasen). **Innenansicht:** Klick aufs Haus fährt die Kamera auf den Grundriss, Dach und Fassade weg, Innenwände als Sockel, Raumnamen, Umgebung abgedunkelt; Esc, „←“ oder Klick daneben führen zurück. Folgen (F) geht mit der Figur hinein und hinaus. Der Zustand „innen in Haus X“ liegt im `uiStore`.
- **Stimmung:** Himmel, Hügel, Wolken, Sterne aus der Uhr (Tageszeiten fließend gemischt statt vier fester Stufen), Wetter aus dem Zustand, Lichtschein mit Höhe, Teilchen, Tilt-Shift (Phaser-PostFX). `prefers-reduced-motion`: Teilchen und Tilt-Shift aus.
- **Zeigen und Treffen** (`world/view/picking.ts`): Sprites in umgekehrter Tiefenreihenfolge, Treffer über die Pixelmaske des Sprites, sonst Boden per Rückprojektion → Kachel → Objekt/Ort. Hervorhebung als Umriss, passender Mauszeiger.
- **Mitspieler-Vorschau** (`world/player/`): `PlayerController` (`moveTo`, `interact`, `say`) zeigt nur Vorschau, sendet nichts. Wegsuche A* im Frontend auf `walkable`/`cost` der Kacheln (gleiche Regeln wie `pathfinding.py`). Handlungen des Kontextmenüs aus der Objekt-Registry (`object_kinds.py`, Modi und „tragbar“) als generierte Tabelle wie die Typen. Schalter „Ansicht: Tiefe | Flach“ und „Mitspieler-Steuerung (Vorschau)“ lokal im Browser (Ansicht-Menü an der Welt), nicht im Backend.
- **Leistung:** Messanzeige (fps, Bildzeit) hinter `?messen`; Playwright-Messlauf mit Startwelt (1440 × 900) und einer erzeugten 256 × 256-Testwelt mit 20 Figuren und 500 Objekten (nur als Testdatei, kein Spielstand).

## Schritte (je ein Commit, Tests grün)

**Umsetzung (13.10.2026):** Der Wechsel auf den neuen Renderer ließ sich nicht sinnvoll teilen; die Schritte 2–7 stecken in einem Commit („Schritt 2“), danach Mitspieler-Vorschau („Schritt 3“), Leistung („Schritt 4“), Doku. Technik-Abweichung (Canvas2D statt Shader, Phaser entfernt): siehe [Statusbericht](../status/AP13.md).

0. Plan, offene Fragen, Mockups (erledigt).
1. Projektion und Kamera für beide Ansichten, Vitest hin und zurück; „Flach“ läuft schon über die neue Projektion, alle bisherigen Tests grün.
2. Tiefe: Puffer mit Pixelfaktor, Boden nach `wTexel` (Grasbüschel, Blumen, weiche Ufer, runder Platzrand) in Blöcken, Boden-Shader, Himmel, Wolken, Hügel, Dunst; Ansicht umschaltbar.
3. Sprites aus `world.js` übertragen (Bäume, Brunnen, Bank, Brett, Zaun, Haus …), Objekte des Zustands darauf abgebildet, Deko wie im Mockup bis AP14 aus Code (Laternen, Briefkasten, Schilf, Steine …), Schatten im Boden, Tiefensortierung, Durchsicht für Verdecker.
4. Häuser: Haus-Sprite draußen, Garten auf dem Grundriss, Anzeige „im Haus“, Innenansicht nach Klick mit Kamerafahrt, Zurück; Folgen ins Haus. Ersetzt das Dach-Ausblenden (der Browser-Test „Dach offen/geschlossen“ wird zu „Anzeige im Haus / Innenansicht“).
5. Figuren: Vorderansicht 1:1 `wPerson`, hinten/Seite/Laufbilder, Sitzen, Schlafen im Bett, Arbeiten im selben Stil; Namensschilder und Sprechblasen über die Projektion.
6. Tageszeiten, Wetter, Lichtschein, Teilchen, Tilt-Shift, reduzierte Bewegung.
7. Zeigen und Treffen, Hervorhebung, Mauszeiger; Klick auf Figur, Haus (→ innen) und Raum in beiden Ansichten; `world.spec.ts`, K06, K13 angepasst.
8. Mitspieler-Vorschau hinter dem Schalter: Wegvorschau mit Dauer, Kontextmenü, „Sagen …“ (Enter öffnet, Esc bricht ab, höchstens 500 Zeichen, keine Kürzel solange es Fokus hat), Vitest und Playwright.
9. Leistungsmessung, falls nötig nachbessern.
10. Doku (`frontend.md`, `assets.md`, `grenzen.md`), Statusbericht `docs/status/AP13.md` mit Bildschirmfotos. Danach Vorlage bei der Projektleitung; ausgerollt wird erst nach Freigabe.

## Bewusst festgelegt (ohne Frage)
- Die Kamera dreht sich nicht, Norden ist immer hinten. Jenseits des Kartenrands zeigt die Tiefe Wald und Wiese bis zum Horizont (wie im Mockup), ohne Weltdaten.
- Auch „Flach“ zeigt draußen das Haus-Sprite und innen den Grundriss, damit beide Ansichten gleich bedient werden.
- Risiko: WebGL in Playwright (headless, Software-Rendering) ist langsam. Die Browser-Tests laufen in beiden Ansichten, die Leistung wird aber nur in einem echten Browser gemessen.
