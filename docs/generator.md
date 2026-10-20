# Weltgenerator

Der Generator (`backend/simulacra/generator/`, AP12) erzeugt **Weltdaten**, nie Bilder: Kacheln, Orte, Objekte, Quellen, Übergänge und die Gestaltung (`look`, siehe [welt-erweitern.md](welt-erweitern.md)). Die Weltansicht zeichnet daraus alles mit denselben Bausteinen wie die Startwelt (Bild A). Gleicher Seed und gleiche Eingaben ergeben **byte-gleiche** Ergebnisse (eigene Zufallsfolge wie `wRng` in `world.js`, unabhängig von der Python-Version).

## Zwei Wege, ein Dorf
| Weg | Ergebnis | Aufruf |
|---|---|---|
| **Neue Startwelt** | komplette Weltdatei (wie `world_default.json`): Heimhaus mit Zimmer Alex, Zimmer Mira, Werkstatt, Küche, Wohnzimmer, Platz, Garten, See, Wald; Alex und Mira starten im Dorf | `generator.new_world(seed)`, `cli world new --seed 7 --out dorf.json`, dann `cli world init --world-file dorf.json` |
| **Erweiterung** | Patch für `engine.edit.apply_patch`: neues Dorf südlich des letzten Gebiets, die Karte wächst, eine Landstraße verbindet es mit dem Bestand | `generator.extension_patch(WorldInfo.from_state(state), seed)`, `cli world generate --seed 7 --preview patch.json`, `--apply --yes` |

Beides kommt aus `compose.build_village`; der Unterschied ist nur der Anschluss und die Namen (die Startwelt nutzt die Rollen-IDs `square`, `garden`, `lake`, `forest`, `house.living` …, ein erweitertes Dorf Vorsilbe `v2`, `v3` …: `v2.square`, `v2_boat`, `house.v2h1_kueche`).

**Dorf nach Maß (AP17b):** `new_world(seed, residents=[{id, name, home}])` erzeugt ein Dorf für genau diese Bewohner (1 bis 8): kein Heimhaus, **höchstens 2 Personen je Haus** (aufgerundet halb so viele Wohnhäuser, `default_mix`; ab 5 Bewohnern ein Stall, ab 7 eine Scheune), jedes Wohnhaus mit **zwei Betten ohne Besitzer** (ein Haus mit nur einem Schlafraum bekommt ein zweites Bett), Startplätze `r0 …` verteilt auf dem Dorfplatz. Nur „wohnt schon in Haus N“ setzt bei einem Bett den Besitzer und legt den Start ins Haus. `world["generator"]` nennt `houses` (Name, Präfix, Betten) und `known` (Platz, Garten, Gemeinschaftsräume). Ohne `residents` bleibt jede Ausgabe wie bisher (Heimhaus für Alex und Mira).

Eingaben (`Params`): `seed`, `lake` (`east` wie in A, `south` mit Brücke über den Bach, oder nach Seed), `mix` (Gebäude je Rolle: `house`, `shop`, `workshop`, `barn`, `stable`; Standard 3 Häuser plus 2 Sondergebäude).

**Stellgrößen (AP18f, `stil.py`):** Dazu kommt `Params.stil` mit der Dorfform und weiteren Größen. Die Vorgaben (`Stil()`) ergeben genau das Dorf von vorher; nur abweichende Werte ändern etwas, und gleicher Seed mit gleichen Stellgrößen ergibt dasselbe Dorf. Was nicht passt, lässt der Generator weg und nennt es im Prüfbericht („2 passten nicht“, „ein Feld passte nicht“); das ist ein Hinweis, kein Fehler.

| Stellgröße | Werte | Wirkung |
|---|---|---|
| `form` | `strasse` (Vorgabe), `beidseitig`, `haufen`, `zufall` | Häuser nur nördlich der Straße (wie bisher), zusätzlich eine zweite Zeile südlich der Straße oder verstreut um den Platz; `zufall` wählt eine der drei nach Seed |
| `groesse` | `klein` (Vorgabe), `mittel`, `gross` | Länge der Hauptstraße nach Westen (mehr Platz für Gebäude) |
| `seen` | 0 bis 4 (Vorgabe 1) | der große See mit Steg und Boot, dazu Teiche; bei 0 entfallen See, Steg, Boot und Angelplatz (Wasser gibt es dann nur am Brunnen und am Wasserlauf) |
| `wasser` | `keiner`, `bach` (Vorgabe), `fluss` | Wasserlauf aus dem Nordwald; ein Fluss ist drei Stränge breit, die Brücke wird breiter |
| `wald` | `licht`, `mittel` (Vorgabe), `dicht` | Zahl der Waldbäume |
| `baeume` | 0 bis 40 (Vorgabe 10) | einzelne Bäume im Dorf |
| `gaerten` | 0 bis 5 (Vorgabe 1) | der Gemeinschaftsgarten (mit Tor, Ort „Garten“) und weitere Gärten mit Zaun an drei Seiten und Beeten (je Beet ein Ding „Beet“); bei 0 entfällt auch der Gemeinschaftsgarten |
| `felder` | 0 bis 4 (Vorgabe 0) | größere Beetflächen ohne Zaun |
| `wege` | `geschwungen` (Vorgabe), `gerade` | Hauptstraße, Südstraße und Türwege als Geraden |

`layout.make_layout` baut zuerst das Grundlayout wie bisher; `layout_extra.apply_stil` setzt danach die Stellgrößen um (eigener Zufallsstrom aus dem Seed): `layout_haeuser.py` (zweite Zeile, Haufendorf, **Türwege um die Häuser herum**, weil die Tür immer nach Süden zeigt), `layout_gaerten.py` (Teiche, Gärten, Felder), `layout_welt.py` (gerade Wege, Wasserlauf, Bäume, Wald), `layout_geo.py` (Platzprüfung). Das Dorf darf dabei nach Süden wachsen (`Layout.extra_h`, Vielfaches von 16). Weitere Seen, Wasserstränge, Gärten und Brücken stehen als Listen in den Formen des Gebiets (`shapes.lakes`, `streams`, `gardens`, `bridges`), die die Weltansicht schon immer zeichnen konnte. Bei 0 Seen oder Gärten fehlen die Orte „See“ beziehungsweise „Garten“.

**Nicht umgesetzt (offen):** Anger (Ringstraße um eine Wiese mit Teich), Fluss quer durch die ganze Karte mit Straße am Ufer und Streusiedlung mit eigenen Wegen je Hof; dazu Dörfer mit mehreren Plätzen. Die Dorfformen gelten für „Welt erzeugen“ und den Assistenten, nicht für „Dorf anfügen“ im Spiel.


## Aufbau
1. **`layout.py`** – das Dorf in Dorfkoordinaten (Port des abgenommenen Mockup-Generators): Platz, Hauptstraße, Südstraße, See mit Steg und Boot, Bach (mündet im See, im Süden unter einer Brücke), Garten mit Beeten, Häuserzeile entlang der Straße, Deko, Wald. Die Breite des Dorfs richtet sich nach der Zahl der Gebäude.
2. **`tiles.py`** – **Kacheln aus denselben Formen wie das Bild**: Jede Kachel (16 × 16 Weltpixel) wird an 16 Stellen abgetastet und bekommt die überwiegende Art (Wasser, Sand, Weg, Steg, Gras); Mauern der Gebäude, Zäune und Bäume kommen aus dem Fußpunkt der Deko, Wege bleiben begehbar, das Gartentor bleibt offen. Ein Test im Frontend (`erzeugt.test.ts`) vergleicht die Kacheln mit den echten Bodenregeln des Bildes.
3. **`interiors.py`** – **Innenbereiche aus Bauplänen** (`data/gebaeude/*.json`, neue Gebäudeart = neue Datei): Reihen von Räumen mit Art, Breite und Höhe; Türen zwischen den Räumen, Haustür vorn; Möbel als Objekte (Bett, Truhe, Sofa, Tisch, Kamin, Bücherregal, Herd, Wasserhahn, Werkbank, Kisten …) und Quellen (Speisekammer, Holzstapel, Samenkiste, Waren), Tapete, Boden, Vorhang und Wandschmuck je Raumart. Das Heimhaus (`heim.json`) ist die Einrichtung der Startwelt wörtlich.
4. **`kits.py`** – **Dorfbausteine im Freien** aus der Deko: Brunnen, Bank, Brett, Laternen, Briefkästen, Wegweiser, Vogelscheuche, Boot, Beete, Tomaten, Sonnenblumen, Regentonnen, Schilf, Steine, Apfelbäume, Angelplatz, dazu die Quellen am See und im Wald; jeweils mit Bildstelle (`look.place`) und Orten mit Namen und Wendungen für die Agenten (`names.py`).
5. **`compose.py`** – setzt alles zu einem Fragment zusammen: links das Dorf im Freien, rechts daneben die Innenbereiche, übereinander; `place(tx0, ty0)` setzt es in eine Welt.
6. **`validate.py`** – **Prüfung** (muss bestehen, sonst wird mit einem abgeleiteten Seed neu gewürfelt, höchstens 8 Versuche): Raster rechteckig, Startpunkt begehbar, jede Haustür, jede Quelle, jedes Ding und der Startplatz von Alex und Mira **vom Dorfplatz aus erreichbar** (wie die Wegsuche der Engine: Übergänge, gesperrte Möbelkacheln), Übergänge auf begehbaren Kacheln, Mengen gültig, IDs und Ortsnamen eindeutig (auch gegen den Bestand), Orte überlappen sich nicht, jedes Gebäude hat Tür und Räume, jedes Schlafzimmer ein Bett.
7. **`generate.py`** – die Schnittstelle (`new_world`, `extension_patch`, `WorldInfo`).

## Bedienung in der Leitstelle (AP12c)
`generator/service.py` ist die Schicht zwischen Generator und API ([schnittstellen.md](schnittstellen.md)). Ein **Wunsch** (`Wish`: Art, Seed, Seeufer, Gebäudemix) ergibt auf derselben Welt immer denselben Patch; dessen Prüfsumme (`digest`) steht in der Vorschau und wird beim Anwenden verglichen, damit nur übernommen wird, was angeschaut wurde.
- **Trockenlauf** (`WorldEditor.dry_run`): Der Patch wird in der echten Datenbank angewendet, `inspect()` baut daraus den Zustandsabzug (`GET /api/state`), dann rollt die Transaktion zurück und die Zwischenspeicher werden neu aufgebaut. Es entsteht kein Ereignis, die Ereignisnummer ändert sich nicht, die Patch-Liste bleibt leer. Er gilt für jeden Patch (`POST /api/world/patch/preview`), damit später auch Einzeländerungen des Editors ihre Vorschau bekommen.
- **Neue Simulation:** Die Vorschau legt die Weltdatei in einer Wegwerf-Simulation im Speicher an; Anwenden ist `Simulation.reset(world=…, backup_label=…)` mit der Weltdatei statt der Standardwelt.
- **Anwenden einer Erweiterung** (`WorldEditor.apply_generated`): Patch und `world.generated` in einer Transaktion, davor `saves.backup("Vor dem Erweitern")`.

## Regeln
- **Der Bestand wird nie überschrieben.** Die Karte wächst nur (nach Süden), das neue Dorf liegt auf neuem Land; die Landstraße ändert im Bestand höchstens Wildnis und Wald (nur wenn die Ausfahrt mitten im Bestand liegt, nicht bei der Startwelt).
- **Gleicher Weg wie jede Weltänderung:** Patch → `engine.edit`, ein Ereignis je Änderung (`world.look_changed`, `world.links_added` …), atomar.
- **Neue Orte sind zunächst unbekannt**; die Agenten finden sie über „Unbekanntes erkunden“ oder über einen Wegweiser (er nennt alle Orte draußen und macht sie bekannt).
- **Objektgrenze:** Ein Dorf bringt rund 65 Objekte (Türen, Möbel, Dinge); der Patch hebt `max_objects` auf 500 an.
- **Kartengröße:** höchstens 256 × 256; jede Erweiterung rückt nach Süden und etwas nach Osten (die Landstraße kommt von der Südausfahrt des letzten Dorfs).

## Grenzen
- Zurzeit nur nach Süden. „Nach Osten“ aus dem Plan ist offen (die Startwelt hat im Osten ihren Innenbereich und den See).
- Neue Gebäudearten brauchen für das Bild einen Baustein (`frontend/src/world/art/bausteine.ts`, `dorf/sprites.ts`); ein Bauplan allein reicht nicht.
- Ein Dorf hat genau einen Platz und einen Wald; Seen und Gärten sind Stellgrößen (0 bis 4 und 0 bis 5), mehrere Plätze kennt der Generator nicht.
- Die Namen kommen aus festen Listen (12 Dörfer, 12 Häuser, je einige Läden, Werkstätten, Scheunen, Ställe).
