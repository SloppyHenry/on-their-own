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

## Klang (AP17d, im Spiel seit 18.10.2026)
**Stand 19.10.2026: Die CC0-Aufnahmen sind vorerst ausgeschaltet** (Henry): `CC0_AKTIV = false` in `frontend/src/klang/einstellungen.ts`; alle Quellen sind „Code“, in den Einstellungen gibt es keine Quellenwahl. Dateien und Code bleiben erhalten; mit `true` gilt wieder die Wahl je Kanal. Einzelne Klänge anhören gehört später in den Sound-Generator, nicht in die Einstellungen.

Klänge gibt es in zwei Quellen, je Kanal in den Einstellungen „Ton“ wählbar: **aus Code** (Web Audio im Browser, `frontend/src/klang/`: `geraeusche.ts`, `umgebung.ts`, `stimmen.ts`, `musik.ts`; keine fremde Quelle) und **CC0-Aufnahmen** in `frontend/public/klang/` (Mono-MP3, 32 kHz; geladen erst, wenn CC0 gewählt ist). Das Mockup `docs/mockups/klang.html` bettet dieselben Aufnahmen der ersten Fassung ein. Die Lizenz wurde auf der jeweiligen Seite beziehungsweise in der Lizenzdatei des Pakets geprüft; alle Quellen sind CC0.

| Datei(en) | Quelle | Lizenz |
|---|---|---|
| `schritt_gras_1–4` | gemischt aus HenKonen, „Footsteps Grass.wav“ (freesound.org/s/682128, Rascheln) und Fission9, „Hiking Boot Footsteps on Grass“ (freesound.org/s/521587, Auftreten, tiefpassgefiltert) | CC0 |
| `schritt_weg_1–3` | Fantozzi, „Fantozzi's Footsteps (Grass/Sand & Stone)“, Sand (opengameart.org/content/fantozzis-footsteps-grasssand-stone) | CC0 |
| `schritt_holz_1–2`, `schritt_stein_1–2` | Kenney, „Impact Sounds“ (kenney.nl/assets/impact-sounds) | CC0 |
| `tuer_auf`, `tuer_zu`, `topf`, `muenzen`, `hacken`, `buch`, `tuch`, `schloss` | Kenney, „RPG Audio“ (kenney.nl/assets/rpg-audio) | CC0 |
| `musik_morgen`, `musik_mittag`, `musik_abend`, `musik_nacht`, `musik_drinnen` | Juhani Junkala, „JRPG Pack 4 Calm“ (opengameart.org/content/jrpg-pack-4-calm): A Place I Call Home, Peaceful Days, Summer Memories, Innocence, Sand Castles | CC0 |
| `voegel` | Spring Spring, „Birds and Wind – Ambient“ (opengameart.org/content/birds-and-wind-ambient-birds-wind-and-synth) | CC0 |
| `regen` | Ylmir, „Rain (loopable)“ (opengameart.org/content/rain-loopable) | CC0 |
| `bach` | KEPPLER1332, „Babbling Brook“ (freesound.org/s/691616), Clear Creek bei Portland; 20 s nahtlos geschnitten | CC0 |

Nicht mehr verwendet: der Wasser-Loop aus rubberduck „30 CC0 SFX loops“ (1,9 s, fast nur Höhen über 3 kHz, klang laut Henry nach Urwald) und die Kenney-Grasschritte (nur ein dumpfer Stoß unter 800 Hz, kein Rascheln). Aufbereitung: `scripts/klang_aufnahmen.py`.
