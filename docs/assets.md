# Grafik: Herkunft und Lizenz

Alle Grafiken der Oberfläche und der Welt entstehen **im Projekt aus Code**. Es gibt keine Bilddateien, keine heruntergeladenen Pakete und keine fremde Lizenz.

Seit AP13 gilt der Stil von Mockup A (`docs/mockups/welt-optik/world.js`, von Henry gewählt); die Zeichenfunktionen sind daraus 1:1 übertragen.

| Was | Wo | Hinweis |
|---|---|---|
| Hilfen (Sprite, Umriss, Rauschen) | `frontend/src/world/art/pen.ts` | wie `wSprite`, `wHash`, `wNoise`, `wRng` |
| Farben und Tageszeiten | `art/palette.ts` | `WP`, `W_TIMES`; Tageszeiten nach der Uhr gemischt, Wetter dämpft |
| Bäume, Büsche, Sonnenblume, Tomate, Stein, Schilf | `art/nature.ts` | 1:1 aus dem Mockup |
| Haus, Brunnen, Bank, Laterne, Brett, Zaun, Pfosten, Vogelscheuche, Wegweiser, Briefkasten, Fass, Boot | `art/village.ts` | 1:1; das Brett zeigt so viele Zettel wie der Zustand |
| Figuren | `art/people.ts` | Vorderansicht wie `wPerson`, dazu hinten, Seite, vier Laufbilder, Sitzen, Schlafen, Werkzeug; Palette je Agent, unbekannte aus der Kennung |
| Möbel, Pflanzen nach Stufe, Baustelle, Vorräte, Kleinkram | `art/things.ts` | im Stil des Mockups; unbekannte Arten als neutrale Kiste |
| Dorf nach Mockup A: Boden, Himmel, Effekte | `world/dorf/boden.ts`, `bild.ts` | `wTexel` und `frame()` aus `world.js` unverändert, Formen und Deko aus `look` der Weltdatei (AP14) |
| Boden (Gras, Wege, Pflaster, Wasser, Ufer, Steg, Beete, Böden innen) für Welten ohne `look` | `world/view/ground.ts` | wie `wTexel`, aus Kacheln und Orten; Grasbüschel, Blumen, Schatten |
| Himmel, Wolken, Sterne, Mond, Hügel | `view/sky.ts` | wie im Mockup |
| Lichtschein, Teilchen, Regen, Schnee, Nebel, Vignette | `view/post.ts` | Farbstimmung und Tilt-Shift per CSS (`WorldCanvas.tsx`) |
| Haus innen als Puppenhaus (Mockup innen2): Rückwände mit Tapeten, Böden je Raumstil, Teppiche, dünne Wände, Licht | `world/dorf/haus/plan.ts`, `haus/bild.ts` | Stile, Wandschmuck und Einrichtung aus `look.interior` der Weltdatei (Frage 23) |
| Einrichtung innen: Fenster, Bilder, Uhr, Spiegel, Regale, Pflanzen, Lampen, Schrank, Sessel, Küchenzeile, Korb, Katze … | `world/art/rooms.ts` | aus dem Mockup innen2 übernommen |
| Rauch, Schlafzeichen | `view/pieces.ts` | |
| Icons der Oberfläche | `lib/px.ts` | 8 × 8 Pixel, einfarbig |

Der Stil (gemütliches Farmdorf, 16-Pixel-Kacheln, dunkle Konturen, warme Farben, gewölbter Horizont) ist an das Genre angelehnt, **ohne Material aus einem bestehenden Spiel zu verwenden**.

## Parametrisch, damit die Welt wächst
Die Bausteine werden aus Weltdaten gezeichnet, nicht aus festen Bildern. Stilangaben stehen in den Daten (`props.style` am Ort: `floor` = `planks|tile|workshop`, `rug`, `surface` = `cobble`, `fence`), Objektzustand in `state` (z. B. `stage` einer Pflanze, `lit` eines Kamins, `locked` einer Tür). Neue Orte und Objekte aus Patches oder dem späteren Generator (AP12) erscheinen deshalb ohne neue Grafik.
