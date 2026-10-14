# AP12 – Plan (neu, 14.10.2026): Weltgenerator im Stil von Mockup A

Auftrag: [AP12-weltgenerator.md](AP12-weltgenerator.md) (Ziel, Validierung und Tests gelten weiter; Vorgaben für AP04 und Darstellung sind durch diesen Plan ersetzt). Dieser Plan berücksichtigt AP13 bis AP15. Branch `ap/12-weltgenerator`.

## Entscheidungen (Henry, 14.10.2026)
| Frage | Entscheidung |
|---|---|
| **14a** Neue Startwelten oder nur erweitern? | **Beides, ein Generator.** Neue Startwelt = Dorf ohne Anschluss in einer neuen Weltdatei; Erweiterung = Dorf mit Weg zum Bestand. Gleicher Code, Unterschied nur Anschlusspunkt und Startplätze der Agenten. |
| **14b** Darf der Mitspieler bauen? | **Nur wie die Agenten:** dieselbe Aktion `build` mit denselben Bauvorlagen. Dörfer und Gebäude erzeugt nur der Generator in der Leitstelle, nicht die Figur im Spiel (gleichwertige Bewohner, keine Schöpfer). Freies Platzieren von Häusern wäre ein eigenes Paket. |
| **Darstellung** | **Die Kamera scrollt durch eine zusammenhängende Welt.** Ich hatte „Bilder wie A, Wechsel am Rand“ empfohlen, weil sich der gewölbte Boden beim Scrollen neu abtastet und Krisseln droht (siehe Risiko 1). Dein Wunsch gilt; darum beginnt das Paket mit einem Prototyp, an dem du die Bewegung beurteilst. |

## Was sich seit dem alten Plan geändert hat (Ist-Stand)
1. **Der Renderer zeichnet genau ein Bild.** `look` kennt je einen See, Platz, Garten, ein Haus und einen Steg; der Dorfrand (`inV`) ist fest eingebaut, ebenso Rauch am einen Schornstein und Lichter; es gibt einen Innenbereich (`interior = 0`). Die Textur (384 × 288) wird einmal gebacken, mit Zufall, der über die ganze Fläche läuft. Die Kamera zeigt immer denselben Ausschnitt von Bild A, Zoom 2×/3× schneidet aus dem fertigen Bild aus. Was der Generator hinter dem Rand erzeugt, wäre unsichtbar.
2. **Patches kennen weder `look` noch `links`.** Ein generiertes Haus mit Tür und Innenbereich ist also nicht darstellbar, und der Browser erfährt von Änderungen am `look` nichts (Reducer gibt es nur für Kacheln, Orte, Objekte).
3. **Bild und Kacheln haben zwei Quellen.** Das Bild kommt aus den Formen in `look`, die Begehbarkeit aus den Kacheln; `scripts/startwelt_a.mjs` leitet die Kacheln aus den Bodenregeln von A ab. Der Generator muss beides aus denselben Formen ableiten, sonst steht man im Bild auf dem Wasser.
4. **Die Karte ist 51 × 19**: Dorf links (Spalten 0–24), Innenbereich des Hauses rechts (26–50). Land kann nur nach Süden und Osten wachsen, der Innenbereich bleibt eine Tasche, die im Außenbild als Wildnis erscheint.
5. **Dinge (AP15)** bestehen aus Objekt/Quelle in der Welt plus Bildstelle in `look.place`. Generierte Dinge brauchen beides.

## Leitsätze
1. **Die Startwelt bleibt Pixel für Pixel gleich.** Ein Goldbild-Test (Mittag, Abend, Nacht, Zoom 1×–3×) vergleicht die Startwelt vor und nach jeder Änderung am Renderer. Abweichung = Fehler.
2. **Bausteine statt Bilder.** Der Generator setzt *Dorfbausteine* zusammen. Ein Baustein ist ein Rezept mit allem, was dazugehört: Kacheln, Ort, Objekte und Quellen, Bildstelle, Zustand. Beispiele: Garten (Zaun, Beete, Tomaten, Sonnenblumen, Regentonnen, Vogelscheuche), Seeufer (Steg, Boot, Schilf, Steine, Angelplatz), Platz (Brunnen, Bank, Brett, Laternen, Wegweiser), Haus (Außenhaus, Innenbereich mit Räumen, Einrichtung, Briefkasten). So sieht Erzeugtes aus wie A und ist sofort bespielbar.
3. **Gleicher Weg wie jede Weltänderung** (Patch → `engine.edit`, ein Ereignis, Sicherung vorher, Trockenlauf, Idempotenz). Neue Startwelten sind eine neue Weltdatei im selben Format.
4. **Deterministisch** (gleicher Seed, gleicher Patch, byte-gleich) und **nur Bespielbares** (Validierung, Reparatur, sonst neuer Seed).
5. **Skalierbar** ([Skalierung](../grenzen.md)): Boden in Blöcken und nur im Sichtbereich, Dinge nach Gebiet indiziert, Kosten pro Bild unabhängig von der Weltgröße; Generierung nur für das Zielgebiet.
6. **Neue Bilder erst als Mockup.** Alles, was es in A nicht gibt (Werkstatt, Scheune, Laden, Stall, andere Dachfarben, Brücke, Marktstand, Landstraße), zeichne ich zuerst als Mockup im Stil von `world.js`; du nimmst es ab, danach wird es 1:1 übernommen.

## Aufteilung in drei Teilpakete
Das Paket ist größer als „L“; drei Teilpakete mit je eigener Abnahme, jeweils eigener Statusbericht.

### Schritt 0 – Prototypen (Mockups, nichts im Spiel)
- **Scrollen** (`docs/mockups/welt-optik/scrollen.html`): Boden von A mit beweglicher Kamera über eine größere Fläche, damit du das Krisseln selbst siehst. Drei Bewegungsarten zum Vergleich: (a) frei fließend, (b) ganze Kachelschritte mit sanftem Gleiten, (c) fließend, nach dem Stoppen sofort scharf. Dazu Zoom 1×–3×. Ergebnis: deine Wahl, notfalls Rückfall auf das Bild-Wechsel-Konzept.
- **Neue Bausteine** (`bausteine.html`): die neuen Gebäudearten, Dachfarben, Brücke, Marktstand, Landstraße und ein erzeugtes Beispieldorf, als Bild A daneben.
- Abnahme durch dich, bevor Code im Spiel entsteht.
- **Stand 14.10.2026: gebaut, wartet auf deine Abnahme** (Fragen 24 und 25 in [offene-fragen.md](../offene-fragen.md)). Bericht mit Bildern: [status/AP12-schritt0.md](../status/AP12-schritt0.md).

### AP12a – Darstellung: scrollende Welt, verallgemeinertes `look` (gebaut 14.10.2026, Bericht [status/AP12a.md](../status/AP12a.md), wartet auf Abnahme)
1. **`look` Version 2:** Listen statt Einzelstücke (Gebiete mit Seen, Plätzen, Gärten, Wegen, Stegen; Häuser mit Tür, Innenbereich, Rauch; Lichter). Die Startwelt wird in diese Form umgeschrieben (`startwelt_a.mjs`), die alte Form lädt über einen Adapter weiter. Goldbild-Test grün.
2. **Boden in Blöcken:** Dorfrand und Wildnis ergeben sich aus den Gebieten, Zufall (Gräser, Blumen, Seerosen, Keimlinge) wird je Block aus Blockkoordinaten gezogen. Der Block mit der Startwelt behält die alte Reihenfolge, damit er byte-gleich bleibt. Hintergrund (Himmel, Hügel, Wolken) bleibt wie in A.
3. **Kamera mit Fokus:** `Frame` bekommt die Kameralage; bei der Startlage identisch zu A. WASD, Ziehen, Mausrad (ganze Stufen), „hingehen“, Folgen, Gesamtansicht; Bewegungsart **(d)** (Entscheidung Henry, 14.10.2026): weich beim Fahren, Horizontkrümmung nur im Stillstand, im Stillstand exakt Bild A. **Zoom:** 1× ist immer Standard; herauszoomen auf ½× und ¼× (Übersicht der Welt; der Boden wird dafür in gröberen Stufen vorgehalten, Blöcke je Stufe), hineinzoomen auf 2×/4× wie in AP14. Die Bildmitte bleibt beim Zoomen am Ort.
4. **Mehrere Häuser:** Klick auf jedes Haus, Innenansicht je Haus (`look.houses[i].interior`), Schilder mit Bewohnern, Rauch je Haus, Licht je Laterne und Fenster.
5. **Sichtbereich:** Dinge, Schilder und Klicktreffer nur für das, was im Bild ist (Index nach Block).
6. **Leistung:** Messlauf mit 256 × 256 Welt, 50 Figuren, 1000 Dingen; Ziel 60 fps wie bisher.
7. Neue Sprites aus Schritt 0 (1:1 übertragen), Browser-Tests, Bilder, Doku.

### AP12b – Generator im Backend (gebaut 14.10.2026, Bericht [status/AP12b.md](../status/AP12b.md), wartet auf Abnahme)
1. **Patch-Format:** neue Abschnitte `links` (Türen) und `look` (additiv: Listen anhängen, Lage der Karte angleichen), Ereignis `world.look_changed` mit Reducer im Browser; Rückgängigmachen läuft über Spielstand (AP09), nicht über Gegenpatch.
2. **Kern** `backend/simulacra/generator/` (je Datei höchstens 400 Zeilen): `plan.py` (Eingaben/Ergebnis), `terrain.py` (Gebiet, Wald, See), `roads.py` (Wege und Landstraßen, Anschluss), `lots.py` (Parzellen entlang der Wege), `kits/` (Garten, Seeufer, Platz, Haus als Bausteine), `interiors.py` (Räume, Einrichtung aus Zimmerart), `things.py` (Dinge aus AP15 nach Regeln), `names.py`, `tiles.py` (Kacheln aus denselben Formen wie das Bild), `validate.py`, `patch.py`. Bauplandaten in `data/gebaeude/` (JSON, neue Gebäudeart = neue Datei; `data/blueprints.json` bleibt die Liste der Bauvorlagen für die Aktion `build`).
3. **Neue Startwelt** (`cli world new --seed N`): vollständige Weltdatei, Alex und Mira starten im Dorf, Rollen der Orte wie die Startwelt.
4. **Erweitern:** Gebiet nach Süden/Osten mit Landstraße zum Bestand; Karte wächst; Bestand wird nie überschrieben; Innenbereiche in eigenen Taschen, die das Außenbild nicht zeigt.
5. **Validierung:** alle Punkte aus dem alten Plan, dazu Bild/Kachel-Abgleich (Vitest-Test rechnet die Texeltypen aus `look` und vergleicht mit den Kacheln), jedes Haus mit Tür, Räumen, Bett/Herd/Werkbank nach Art, jede Quelle erreichbar, Wegweiser nennen neue Orte.
6. **Agenten:** neue Orte sind zunächst unbekannt und werden über Wegweiser, Erkunden oder das Gespräch bekannt (Mechanik aus AP15 prüfen); lange Wege kosten Zeit, keine Sonderregel.
7. Tests: byte-gleicher Patch, Eigenschaftstest über viele Seeds, 100 Ticks mit Fake-Modell auf erweiterter Welt, alter Spielstand.

### AP12c – Bedienung in der Leitstelle (gebaut 14.10.2026, Bericht [status/AP12c.md](../status/AP12c.md), wartet auf Abnahme)
1. **API:** `POST /api/world/generate` (Trockenlauf auf einer Kopie; liefert Patch, Prüfbericht, Vorschau), `POST /api/world/generate/apply` (Idempotenz-Schlüssel, Bestätigung, automatische Sicherung), Ereignis `world.generated` mit Seed und Zusammenfassung.
2. **Oberfläche „Welt gestalten“** (Frage 26: Regler und Palette gibt der Generator nicht her, umgesetzt sind Seed, Ufer des Sees und Gebäudemix): Seed, „Würfeln“, Vorschau in der Weltansicht (die Kamera fährt hin, das neue Dorf erscheint unter einem Schleier mit Rahmen), Prüfbericht, „Übernehmen“. Neue Startwelt: „Neue Simulation mit Dorf …“ mit Vorschau.
3. Browser-Tests, Probelauf mit echtem Modell (besuchen die Agenten neue Orte?), Bilder mehrerer Seeds, Doku (`welt-erweitern.md`, `frontend.md`, `assets.md`, `schnittstellen.md`), Statusbericht.

## Risiken
| Risiko | Gegenmaßnahme |
|---|---|
| **1. Krisseln beim Scrollen.** Der gewölbte Boden wird punktweise gelesen; jede Kamerabewegung ändert, welcher Texel in welchem Bildpunkt landet (ferne Reihen lesen 1,5 Texel je Pixel). Genau das hast du in AP13 abgelehnt. | Schritt 0 zeigte es vor jedem Umbau; Variante (d) gewählt; im Stillstand ist das Bild immer exakt A. Notfalls Rückfall auf Bild-Wechsel am Rand (Daten und Generator bleiben gleich, nur die Kamera ändert sich). |
| Umbau verändert das abgenommene Dorf | Goldbild-Test an jeder Stelle, Startwelt-Block byte-gleich |
| Bild und Kacheln stimmen nicht überein | Kacheln aus denselben Formen, Abgleichstest über viele Seeds |
| Erzeugtes wirkt zufällig | Bausteine und Rezepte statt Rauschen, Sichtprüfung je Seed mit Bildern im Bericht |
| Neue Gebäude passen nicht zu A | Erst Mockup, dann 1:1 (Schritt 0) |
| Große Welt wird langsam | Blöcke, Sichtbereich, Index; Messlauf 256 × 256 |
| Tasche für Innenräume wächst mit | Taschen in einem eigenen Streifen, Außenbild blendet sie aus; Grenze 256 × 256 beachten |

## Bewusst festgelegt (ohne Frage)
- Keine Jahreszeiten, kein Gelände mit Höhen; Hügel bleiben Hintergrund wie in A.
- Landstraßen verbinden Dörfer; innerhalb eines Dorfs sehen Wege aus wie in A.
- Mitspieler und Agenten sehen erzeugte Dörfer gleich (Wahrnehmung nach Ort und Hörweite wie bisher).
- Ausrollen nur nach deiner Freigabe.

## Spätere Wünsche (nicht Teil von AP12)
Dörfer selbst gestalten, eigene Figuren, Epochen, Baustein-Editor mit Funktionen für die KI: [ausblick.md](../ausblick.md). In AP12c darauf achten: Vorschau und Trockenlauf nicht nur für ganze Dörfer, sondern auch für Einzeländerungen auslegen; `appMode = editor` ist der Platz für die Werkzeuge.
