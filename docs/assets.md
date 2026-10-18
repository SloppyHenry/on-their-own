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
| Dorf nach Mockup A: Boden, Himmel, Effekte | `world/dorf/boden.ts`, `grund.ts`, `bild.ts` | `wTexel` und `frame()` aus `world.js`, verallgemeinert auf Listen, mehrere Gebiete und Blöcke; Formen und Deko aus `look` der Weltdatei (AP14, AP12a) |
| Neue Bausteine: Wohnhaus in drei Breiten, sechs Dach- und fünf Wandfarben, Werkstatt, Laden, Scheune, Stall, Marktstände, Heu, Holz, Kiste | `art/bausteine.ts`, Arten `bh:Breite:Dach:Wand`, `bw`, `bs`, `bb`, `bt`, `bm:N`, `bhay`, `blog`, `bcr` in `dorf/sprites.ts` | 1:1 aus `docs/mockups/welt-optik/bausteine.js` (von Henry am 14.10.2026 freigegeben) |
| Boden (Gras, Wege, Pflaster, Wasser, Ufer, Steg, Beete, Böden innen) für Welten ohne `look` | `world/view/ground.ts` | wie `wTexel`, aus Kacheln und Orten; Grasbüschel, Blumen, Schatten |
| Himmel, Wolken, Sterne, Mond, Hügel | `view/sky.ts` | wie im Mockup |
| Lichtschein, Teilchen, Regen, Schnee, Nebel, Vignette | `view/post.ts` | Farbstimmung und Tilt-Shift per CSS (`WorldCanvas.tsx`) |
| Haus innen als Puppenhaus (Mockup innen2): Rückwände mit Tapeten, Böden je Raumstil, Teppiche, dünne Wände, Licht | `world/dorf/haus/plan.ts`, `haus/bild.ts` | Stile, Wandschmuck und Einrichtung aus `look.interior` der Weltdatei (Frage 23) |
| Einrichtung innen: Fenster, Bilder, Uhr, Spiegel, Regale, Pflanzen, Lampen, Schrank, Sessel, Küchenzeile, Korb, Katze … | `world/art/rooms.ts` | aus dem Mockup innen2 übernommen |
| Dinge im Dorf (AP15): umgefallene Vogelscheuche (gekippte Vogelscheuche aus A), gelöschte Kerze | `world/dorf/sprites.ts` (`scareDown`), `world/art/rooms.ts` (`kerzeAus`) | alle übrigen Dinge mit den unveränderten Sprites aus A und innen2 |
| Rauch, Schlafzeichen | `view/pieces.ts` | |
| Icons der Oberfläche | `lib/px.ts` | 8 × 8 Pixel, einfarbig |

Der Stil (gemütliches Farmdorf, 16-Pixel-Kacheln, dunkle Konturen, warme Farben, gewölbter Horizont) ist an das Genre angelehnt, **ohne Material aus einem bestehenden Spiel zu verwenden**.

## Parametrisch, damit die Welt wächst
Die Bausteine werden aus Weltdaten gezeichnet, nicht aus festen Bildern. Stilangaben stehen in den Daten (`props.style` am Ort: `floor` = `planks|tile|workshop`, `rug`, `surface` = `cobble`, `fence`), Objektzustand in `state` (z. B. `stage` einer Pflanze, `lit` eines Kamins, `locked` einer Tür). Neue Orte und Objekte aus Patches oder dem späteren Generator (AP12) erscheinen deshalb ohne neue Grafik.

## Klang (Mockup AP17d, 18.10.2026; noch nicht im Spiel)
Das Mockup `docs/mockups/klang.html` bettet CC0-Aufnahmen zum Vergleich mit Klängen aus Code ein (zu Mono-MP3, 32 kHz, umgewandelt). Alle Quellen sind CC0; die Lizenz wurde auf der jeweiligen Seite beziehungsweise in der Lizenzdatei des Pakets geprüft.

| Was | Quelle | Lizenz |
|---|---|---|
| Schritte (Gras, Holz, Stein) | Kenney, „Impact Sounds“ (kenney.nl/assets/impact-sounds) | CC0 |
| Tür, Topf, Münzen, Hacken, Tuch, Buch, Schloss | Kenney, „RPG Audio“ (kenney.nl/assets/rpg-audio) | CC0 |
| Musik Morgen, Mittag, Abend | Juhani Junkala, „JRPG Pack 4 Calm“ (opengameart.org/content/jrpg-pack-4-calm): A Place I Call Home, Peaceful Days, Summer Memories | CC0 |
| Vögel und Wind | Spring Spring, „Birds and Wind – Ambient“ (opengameart.org/content/birds-and-wind-ambient-birds-wind-and-synth) | CC0 |
| Regen | Ylmir, „Rain (loopable)“ (opengameart.org/content/rain-loopable) | CC0 |
| Wasser | rubberduck, „30 CC0 SFX loops“ (opengameart.org/content/30-cc0-sfx-loops) | CC0 |
