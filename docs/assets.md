# Grafik: Herkunft und Lizenz

Alle Grafiken der Oberfläche und der Welt entstehen **im Projekt aus Code**. Es gibt keine Bilddateien, keine heruntergeladenen Pakete und keine fremde Lizenz.

| Was | Wo | Hinweis |
|---|---|---|
| Gelände, Wände, Böden, Wasser | `frontend/src/world/draw/terrain.ts` | je Kachel aus Pixelbefehlen; Kachelarten mit unbekanntem Namen werden einfarbig gezeichnet |
| Bäume | `draw/vegetation.ts` | sechs Varianten (Eichen, Kiefern) |
| Möbel, Außenobjekte, Pflanzen, Türen, Baustellen, Quellen | `draw/furniture.ts`, `draw/outdoor.ts`, `draw/objects.ts` | je Art eine Zeichenfunktion mit Zustand; unbekannte Arten erscheinen als neutrale Kiste |
| Dächer, Fassadenfenster | `draw/roof.ts`, `draw/terrain.ts` | aus den Räumen der Gebäude abgeleitet |
| Zäune | `draw/fences.ts` | aus `props.style.fence` des Ortes |
| Figuren (vier Richtungen, zwei Laufbilder) | `draw/characters.ts` | Aussehen aus einer Palette je Agent; für unbekannte Agenten aus der Kennung abgeleitet |
| Werkzeuge, Schatten, Schlafzeichen | `draw/tools.ts` | |
| Icons der Oberfläche | `lib/px.ts` | 8 × 8 Pixel, einfarbig |
| Licht, Regen, Nebel | `draw/effects.ts` | |

Der Stil (gemütliches Farmdorf, 16-Pixel-Kacheln, dunkle Konturen, warme Farben) ist an das Genre angelehnt, **ohne Material aus einem bestehenden Spiel zu verwenden**.

## Parametrisch, damit die Welt wächst
Die Bausteine werden aus Weltdaten gezeichnet, nicht aus festen Bildern. Stilangaben stehen in den Daten (`props.style` am Ort: `floor` = `planks|tile|workshop`, `rug`, `surface` = `cobble`, `fence`), Objektzustand in `state` (z. B. `stage` einer Pflanze, `lit` eines Kamins, `locked` einer Tür). Neue Orte und Objekte aus Patches oder dem späteren Generator (AP12) erscheinen deshalb ohne neue Grafik.
