# AP12 – Weltgenerator (Zusatzpaket, nach AP11)

**Auftrag:** Zusatz von Henry (11.10.2026) · **Abhängig von:** AP04 (Darstellung), AP08 (Welt zur Laufzeit ändern), AP09 (Sicherung vor dem Eingriff) · **Umfang:** L · **Meilenstein:** nach M6

**Reihenfolge:** Dieses Paket wird erst nach AP11 begonnen. Es ist jetzt nur vorbereitet, damit AP04 die Weichen richtig stellt (siehe „Vorgaben für AP04“).

## Ziel
Ein Generator, der die Welt **im Stil des Mockups** (gemütliches Farmdorf, Top-down-Pixelgrafik) erweitert oder neu aufbaut: Straßen und Plätze, Gebäude, Gewässer, Vegetation, Gärten, Zäune, Requisiten. Er erzeugt keine Bilder, sondern **Weltdaten** (Kacheln, Orte, Objekte, Ressourcen) plus Stilangaben. Die Weltansicht zeichnet daraus alles mit denselben Bausteinen wie die Startwelt. Eine erweiterte Welt sieht deshalb nicht aufgesetzt aus und ist sofort bespielbar: Die Agenten finden die neuen Orte, Objekte und Ressourcen.

## Grundsätze
1. **Gleicher Weg wie jede Weltänderung.** Der Generator liefert einen *Patch* (Format aus AP01), der über `engine.edit.*` angewendet wird. Es gibt keinen Sonderweg am Engine vorbei; jede Änderung ist ein Ereignis und wird mitprotokolliert.
2. **Deterministisch.** Gleicher Seed, gleiche Eingaben, gleiches Ergebnis. Der Seed steht im Ereignis und im Spielstand.
3. **Vorschau vor Anwendung.** Erst anschauen, dann übernehmen. Übernommen wird nur nach Bestätigung, nach automatischer Sicherung (AP09).
4. **Nur erzeugen, was bespielbar ist.** Jedes Ergebnis wird geprüft (siehe Validierung). Ein Ergebnis mit unerreichbaren Orten wird nicht angeboten, sondern neu gewürfelt oder repariert.
5. **Vorhandenes bleibt.** Beim Erweitern werden bestehende Kacheln, Orte, Objekte und Agentenpositionen nie überschrieben.

## Was der Generator können soll
| Baustein | Inhalt |
|---|---|
| **Gelände** | Wiese, Sand, Wasser (Teiche, Flüsse), Waldränder; Übergänge ohne harte Kanten |
| **Straßennetz** | Hauptwege, Nebenwege, Plätze; Verbindung zum vorhandenen Netz an definierten Anschlusspunkten |
| **Parzellen und Gebäude** | Häuser, Werkstatt, Scheune, Laden, Stall usw. aus Bauplänen (Größe, Eingang, Räume, Stilvariante); Gärten und Zäune dazu |
| **Orte** | Jedes Gebäude und jeder Platz wird als Ort (`location`) mit Namen, Eigenschaften und Eingängen angelegt, damit Wahrnehmung und Optionen der Agenten funktionieren |
| **Objekte und Ressourcen** | Betten, Herd, Werkbank, Lager, Brunnen, Beete, Holz-, Stein-, Fischstellen nach Regeln je Gebäudeart |
| **Vegetation** | Bäume, Büsche, Blumenflächen, Pilze, Steine; Dichte nach Zone (Waldrand dicht, Dorfkern licht) |
| **Requisiten** | Laternen, Schilder, Bänke, Stege, Marktstände |
| **Namen** | Orte und Straßen bekommen passende deutsche Namen (Liste je Kategorie, aus Seed gewählt) |

## Steuerung (was du angibst)
- **Gebiet:** Rechteck, das erzeugt wird, oder „Karte nach Osten/Süden um N Kacheln erweitern“.
- **Siedlungsdichte, Waldanteil, Wasseranteil, Wegedichte:** drei bis vier Regler.
- **Gebäudemix:** z. B. 4 Wohnhäuser, 1 Werkstatt, 1 Laden.
- **Stimmung/Stil:** Palette und Dachfarben (Rotziegel, Blau, Holz), Jahreszeit der Vegetation (später).
- **Seed.**
- **Vorgaben:** Bereiche, die frei bleiben, und Anschlusspunkte an das bestehende Wegenetz.

## Ablauf der Erzeugung (Schichten)
1. Gelände und Gewässer (Rauschen mit Seed, Ränder zum Bestand angleichen).
2. Straßennetz (Anschluss an Bestand, Hauptachse, Abzweige, Plätze).
3. Parzellen entlang der Straßen, Gebäude aus den Bauplänen hineinsetzen, Eingang zur Straße.
4. Ausstattung der Gebäude und Gärten (Objekte, Ressourcen).
5. Vegetation und Requisiten in den freien Flächen, mit Abstand zu Wegen und Eingängen.
6. Orte und Namen anlegen, Patch zusammenstellen.
7. **Validierung.** Bei Fehlern: Reparaturversuch, sonst neuer Versuch mit abgeleitetem Seed.

## Validierung (muss bestehen)
- Jeder neue Eingang ist vom bestehenden Dorfplatz aus **erreichbar** (Wegsuche der Engine).
- Keine Überlappung von Gebäuden, Wegen, Wasser und Bestand.
- Jedes Gebäude hat Eingang, mindestens ein Objekt zum Schlafen/Arbeiten/Lagern passend zur Art.
- Jede Ressource liegt an einer erreichbaren Kachel und hat gültige Mengen.
- Orte überlappen sich nicht, Namen sind eindeutig.
- Patch besteht die Prüfung der Engine als Trockenlauf, bevor er angewendet wird.

## Schnittstellen
- **Programm:** `simulacra/generator/` mit `plan.py` (Eingaben und Ergebnis als Pydantic-Modelle), `terrain.py`, `roads.py`, `buildings.py`, `props.py`, `vegetation.py`, `names.py`, `validate.py`, `patch.py`. Je Datei höchstens 400 Zeilen.
- **Bauplan-Daten:** `data/blueprints/` (JSON). Neue Gebäudearten sind neue Dateien, kein Code.
- **CLI:** `python -m simulacra.cli generate --seed 7 --area 36,0,24,24 --preview out.json`, `--apply` mit Bestätigung.
- **API:** `POST /api/world/generate` (nur Vorschau, liefert Patch und Prüfbericht), `POST /api/world/generate/apply` (mit Idempotenz-Schlüssel und Bestätigung). Ereignis `world.generated` mit Seed und Zusammenfassung.
- **Frontend:** Bereich „Welt erweitern“ in der Leitstelle: Parameter, Vorschau als halbtransparente Karte über der Welt, Prüfbericht, „Übernehmen“.

## Vorgaben für AP04 (damit der Generator später greift)
1. **Die Welt wird aus Bausteinen mit Parametern gezeichnet**, nicht aus festen Bildern: Haus (Breite, Höhe, Dach- und Wandfarbe, Fensterzahl, Tür), Baum (Art, Größe), Zaun, Beet (Stufe), Marktstand usw. Jeder Baustein bekommt seine Parameter aus den Weltdaten.
2. **Stilangaben stehen in den Weltdaten** (Objekt- und Ortseigenschaften wie `style: {roof: "red"}`), nicht im Zeichencode.
3. **Die Startwelt wird so beschrieben**, wie der Generator später beschreiben würde (Gebäude mit Grundfläche und Stil, Vegetation als Objekte oder Kachelschicht). Dann ist die Startwelt der erste Testfall für die Darstellung.
4. **Unbekannte Bausteine** werden als neutraler Platzhalter gezeichnet, nie als Fehler.

## Tests
- Gleicher Seed → byte-gleicher Patch; anderer Seed → anderes Ergebnis.
- Eigenschaftstests über viele Seeds: Validierung besteht immer, kein Überlapp, alles erreichbar.
- Patch lässt sich auf die Startwelt anwenden, danach laufen 100 Ticks mit Fake-LLM ohne Fehler; Agenten wählen Optionen an neuen Orten.
- Anwenden auf einen alten Spielstand (Migration) funktioniert.
- Playwright: Vorschau erscheint, Übernehmen verändert die Karte live, Reload zeigt dieselbe Welt.
- Sichtprüfung mit Bildschirmfotos mehrerer Seeds im Statusbericht.

## Abnahme
- [ ] Mindestens fünf verschiedene Seeds erzeugen stimmige, bespielbare Erweiterungen im Stil der Startwelt.
- [ ] Vorschau, Übernehmen und Sicherung funktionieren im Browser.
- [ ] Neue Orte erscheinen in Wahrnehmung und Optionen der Agenten; mit echtem Modell besuchen sie sie.
- [ ] Alle Validierungen als Tests grün, Ausgabe im Statusbericht.

## Risiken
| Risiko | Gegenmaßnahme |
|---|---|
| Ergebnisse wirken zufällig statt „gebaut“ | Bauplan- und Regelbasis statt reinem Rauschen; Parzellen entlang der Wege; Sichtprüfung je Seed |
| Neue Gebäudearten sehen nicht stimmig aus | Zeichenbausteine parametrisch halten (Vorgabe AP04), gemeinsame Palette |
| Erweiterung zerstört Bestand | Bestand wird nie überschrieben, Trockenlauf, Sicherung vor dem Anwenden |
| Große Karten werden langsam | Erzeugung auf das Zielgebiet begrenzen; Rendern abschnittsweise (Phaser-Chunks) |

## Offene Fragen an dich (vor Beginn)
- Soll der Generator auch eine **komplett neue Startwelt** erzeugen können (andere Dörfer), oder nur die bestehende erweitern?
- Soll der **Mensch als Mitspieler** später selbst bauen dürfen (Bauplan platzieren), oder bleibt Bauen den Agenten und dem Generator vorbehalten?
