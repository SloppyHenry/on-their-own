# AP16 – Gestalten: Dörfer selbst bauen und Häuser einrichten (Plan, 14.10.2026)

**Auftrag:** Henry, Ausblick Nr. 1 ([ausblick.md](../ausblick.md)); Reihenfolge am 14.10.2026 bestätigt, AP12b und AP12c abgenommen. **Abhängig von:** AP12c (Trockenlauf, Vorschau, Werkzeugleiste, `appMode = editor`). **Umfang:** L, vier Teilpakete. **Status:** Plan, angepasst am 15.10.2026 (Grundsatz unten), **Schritt 0 neu am 21.10.2026 gebaut und wartet auf Abnahme** (siehe Block darunter); nach AP17 vorgeschlagen (Frage 35); Fragen 27, 29 und 30 am 15.10.2026 mit den Empfehlungen beantwortet. **Schritt 0 (Mockup) gebaut** ([status/AP16-schritt0.md](../status/AP16-schritt0.md)), wartet auf deine Abnahme (Frage 37); vor dem Bau außerdem Frage 36 klären.

> **Nachtrag 19.10.2026 (AP18):** AP16 läuft jetzt innerhalb des Reworks nach AP18e (Weltenbibliothek und Werkstatt), siehe [AP18-plan.md](AP18-plan.md#ap16--gestalten-werkzeuge-bestehender-plan-angepasst). Die Werkzeuge arbeiten an zwei Orten: in der Welt-Werkstatt an einer Welt-Datei und im Spiel nur bei Spielart Gott. Neu sind die Werkzeuge Startplatz und (nur Werkstatt) Gebiet erzeugen. Im Spiel gibt es keinen Generator mehr. Die Bedienteile kommen im Stil aus AP18b.

> **Stand 23.10.2026: AP16b (Außenwerkzeuge), AP16c (Innenausbau) und AP16d (Probelauf, Prompt-Test, Doku) gebaut**, Berichte [AP16b](../status/AP16b.md), [AP16c](../status/AP16c.md), [AP16d](../status/AP16d.md); wartet auf Abnahme.

> **Stand 22.10.2026: AP16a (Backend) gebaut**, Bericht [status/AP16a.md](../status/AP16a.md), wartet auf Abnahme; AP16b–d folgen.

> **Stand 21.10.2026 (Schritt 0 neu, auf `main` nach AP18):** Abgleich, Architektur und Zerlegung stehen in [status/AP16-schritt0.md](../status/AP16-schritt0.md); das Rahmen-Mockup ist [`docs/mockups/gestalten-neu.html`](../mockups/gestalten-neu.html), wartet auf Abnahme (Fragen 77–82). Was sich gegenüber dem Plan unten ändert:
> - **Zwei Orte, ein Werkzeugkasten:** Werkstatt (Weltdatei, „Speichern“, Entwurf = ungespeicherter Stand) und Gestalten im Spiel in der Spielart Gott (Entwurf, „Übernehmen“). Ein Aktionsmodul `generator/edit/`, zwei Wege: `POST /api/worlds/draft` (zustandslos, Werkstatt) und `POST /api/world/draft/preview|apply` (Spiel).
> - **Werkzeuge neu:** Startplatz und Gebiet erzeugen (nur Werkstatt), **Karte erweitern** (beide Orte) statt „Dorf anfügen“ im Spiel.
> - **AP16a beginnt mit einem Spike:** Kacheln aus gespeicherten `look`-Formen ableiten (heute nur aus dem Generator-`Layout`); Ändern/Entfernen baut auf `world/build_look.py` (AP18g) auf; Dorf A (`look.legacy`) wird maskiert statt gestrichen.
> - **Prüfung mit drei Stufen** (✓, ! Hinweis, ✗ Fehler); die Zeit muss beim Betreten wirklich anhalten (heute nicht sichtbar gebaut).
> - Der Reiter „Gestalten“ im Welteditor und der Start „aus dem Startmenü vor Rundenbeginn“ sind durch Werkstatt und „Damit spielen“ ersetzt.

## Grundsatz (Henry, 15.10.2026)
**Editor-Modus wie der Baumodus bei Sims; die Agenten dürfen nicht merken, dass es eine höhere Instanz gibt.** Betreten hält die Simulation an, Verlassen setzt sie fort (wenn sie lief); der Entwurf wird in einem Zug übernommen (Sicherung davor). Für die Agenten gibt es danach keinen Hinweis auf den Umbau: das Ereignis der Änderung steht im Protokoll der Leitstelle, aber nicht in Wahrnehmung, Gedächtnis oder Prompt. Laufende Wege, die der Umbau ungültig macht, werden still neu geplant. Erreichbar im Spiel („Welt gestalten“) und aus dem Startmenü vor Beginn einer Runde (AP17a/b). Prüfung im Abnahmeteil (AP16d): Prompts und Erinnerungen nach einem Umbau enthalten keine Hinweise auf Editor, Leitstelle oder Spieler.

## Ziel
Im Editor-Modus Werkzeuge, mit denen du die Welt selbst formst: **Wege** ziehen, **Seen** ausheben, **Gärten** setzen, **Häuser** setzen (aus den vorhandenen Gebäudearten), **Bäume und Deko** setzen, und **Häuser von innen einrichten** (Möbel, Wandschmuck, Teppiche, Farben). Alles löschen und ändern, was man gesetzt hat. Das Ergebnis ist sofort bespielbar: Kacheln, Orte, Objekte, Quellen und Bild stimmen überein, wie beim Generator.

## Was schon trägt (aus AP12)
- Die Gestaltung ist Daten: `look` Version 2 (Gebiete mit Listen von Wegen, Plätzen, Seen, Gärten, Stegen, Bächen, Brücken, Deko, Häusern mit `interior`). Das Bild zeichnet nur daraus.
- Kacheln leitet `generator/tiles.py` aus denselben Formen ab; ein Frontend-Test hält Bild und Kacheln zusammen.
- Patch → `engine.edit` mit Ereignis, Sicherung und **Trockenlauf mit Vorschau** (`POST /api/world/patch/preview`, Schleier, Kamerafahrt).
- Werkzeugleiste im Editor-Modus ohne Infoleiste; beide Ansichten (Tiefe, Flach).

## Was fehlt (Lücken, die das Paket füllt)
1. **Ändern und Löschen.** Patches hängen heute nur an: `look` kennt nur „Gebiete und Landstraßen anhängen“; die Engine hat `remove_object`, aber kein Löschen von Orten, Quellen, Übergängen und Formen im `look`. Formen haben keine festen Kennungen.
2. **Kacheln lokal neu ableiten.** `tiles.py` rastert ein ganzes Dorf aus einem `Layout`. Für ein einzelnes Werkzeug (ein Weg, ein See) muss derselbe Code ein **Rechteck** aus den Formen eines Gebiets neu abtasten.
3. **Häuser nachträglich.** Ein Haus braucht Tür, Innenbereich in der Tasche, Orte, Möbel, Übergang und Bildstelle in einem Zug; der Generator kann das nur als Teil eines ganzen Dorfs (`compose`, `interiors`).
4. **Bearbeitungsfläche im Browser:** Zeiger auf Kachel (Raster-Cursor), Ziehen von Linien und Flächen, Vorschau des Gesetzten, Auswahl, Löschen, Rückgängig.
5. **Innen als Bearbeitungsfläche:** Platzieren von Möbeln auf dem Raster der Räume, mit Stellplätzen und Ausrichtung.

## Leitsätze
1. **Jede Werkzeugaktion ist ein Patch**; es gibt keinen Sonderweg an der Engine vorbei. Ein Ereignis je Änderung, atomar, Sicherung vor dem Übernehmen.
2. **Entwurf statt Sofortbau** (Frage 27, Empfehlung): Die Aktionen sammeln sich in einem Entwurf, der als **ein** zusammengesetzter Patch im Trockenlauf liegt und unter dem Schleier angezeigt wird. Zurücknehmen und Wiederholen sind im Entwurf beliebig; „Übernehmen“ wendet ihn einmal an (mit Sicherung). Nach dem Übernehmen gilt der Spielstand als Rückweg.
3. **Bild, Kacheln und Orte kommen aus denselben Formen.** Der Editor ändert Formen und leitet alles andere mit denselben Funktionen ab wie der Generator.
4. **Nur Bespielbares** (Validierung wie beim Generator, dazu: nichts überbauen, was Figuren oder Dinge belegen; jedes Haus erreichbar; Quellen erreichbar). Ein verbotenes Setzen zeigt den Grund am Cursor, statt zu scheitern.
5. **Nur vorhandene Bausteine.** Gesetzt wird, was es schon gibt (Gebäudearten, Möbel, Dinge, Bäume, Deko aus Bild A und den Bausteinen). Neue Möbel oder Gebäude zeichnen ist der spätere Baustein-Editor.
6. **Die Zeit steht still, solange der Editor offen ist** (Frage 28, Grundsatz oben): Betreten pausiert, Verlassen setzt fort. Flächen mit Figuren oder Dingen lassen sich nicht überbauen (`blocked`).
7. **Neue Bilder erst als Mockup** (Frage 30): Werkzeugleiste, Cursor, Raster, Vorschau des Gesetzten und Innenausbau, bevor Code entsteht.

## Teilpakete

### Schritt 0 – Mockup (nichts im Spiel)
`docs/mockups/welt-optik/gestalten.html`: das Dorf aus Bild A mit der Werkzeugleiste. Wege ziehen (Linienzug mit Vorschau), See ausheben, Garten, Haus setzen (mit Vorschau des Sprites und der Tür), Baum und Deko, Löschen, Entwurf mit Rückgängig; dazu die Innenansicht mit Möbelkatalog und Raster. Ergebnis: deine Abnahme oder Änderungswünsche.

### AP16a – Backend: Ändern, Löschen, lokales Ableiten
1. **Patch-Format erweitern:** `look`-Abschnitt kann Formen **ändern und entfernen** (feste Kennungen je Form, die der Generator ab jetzt vergibt; ohne Kennung bleibt alles wie heute, die Startwelt bleibt Pixel für Pixel gleich). Neue Engine-Operationen: Ort entfernen/ändern, Quelle entfernen, Übergänge entfernen, Objekt versetzen; Ereignisse mit Reducern im Browser.
2. **`generator/tiles.py`:** Funktion für ein Rechteck („leite diese Kacheln aus den Formen des Gebiets neu ab“); Kacheln außerhalb bleiben.
3. **Aktionen als Funktionen** (`generator/edit/`, je Datei höchstens 400 Zeilen): `draw_path`, `dig_lake`, `place_garden`, `place_house` (nutzt `interiors`/`kits`), `place_prop`, `remove_*`, `furnish_room`. Jede liefert einen Patch-Baustein; ein Entwurf ist eine Liste davon und ergibt **einen** Patch.
4. **Validierung** für Entwürfe (Erreichbarkeit, Überlappung, Belegung, Kartengrenzen), Fehler mit Grund und Ort.
5. API: `POST /api/world/draft/preview` (Liste von Aktionen → zusammengesetzter Patch, Prüfbericht, Zustandsabzug) und `…/apply` (Bestätigung, Idempotenz, Sicherung, Ereignis `world.edited`); baut auf `dry_run` und `apply_generated` auf.
6. Tests: byte-gleich, Eigenschaftstest (zufällige Aktionsfolgen → Bild und Kacheln stimmen, alles erreichbar), alte Spielstände, Startwelt unverändert.

### AP16b – Außenwerkzeuge im Browser
Werkzeugleiste „Gestalten“ als dritter Reiter, Raster-Cursor und Hilfslinien in der Weltansicht (`DorfView`-Schicht), Weg, See, Garten, Haus, Baum/Deko, Auswahl und Löschen, Entwurf mit Rückgängig und Wiederholen, Anzeige des Grundes bei verbotenem Setzen, Vorschau unter dem Schleier (Tiefe und Flach), Übernehmen mit Bestätigung.

### AP16c – Innenausbau
Innenansicht als Bearbeitungsfläche: Möbelkatalog (vorhandene Objektarten mit ihren Sprites), Platzieren auf dem Raster der Räume, Drehen, Wandschmuck, Teppiche, Farben von Tapete, Boden und Vorhang. Möbel sind echte Objekte (Bett, Herd, Werkbank, Truhe …) mit ihren Handlungen aus AP15; die Einrichtung wird mit `furnish_room` zum Patch. Prüfung: Schlafzimmer braucht ein Bett, Wege im Raum bleiben frei.

### AP16d – Abnahme und Härtung
Probelauf mit Fake-Modell auf einer selbst gebauten Welt (Figuren nutzen neue Möbel und Orte), Leistungsmessung mit vielen Formen, Doku (`welt-erweitern.md`, `generator.md`, `frontend.md`, `schnittstellen.md`), Statusbericht mit Bildern, Bilder von Beispielwelten.

## Risiken
| Risiko | Gegenmaßnahme |
|---|---|
| Bild und Kacheln laufen auseinander | gleiche Funktionen für Generator und Editor; Abgleichstest über zufällige Aktionsfolgen |
| Bestehende Dörfer verändern sich durch die neuen Kennungen | Kennungen optional, Goldbild-Tests, Startwelt byte-gleich |
| Entwurf wird sehr groß (Vorschau langsam) | Trockenlauf nur auf Anforderung und mit Verzögerung; Zustandsabzug nur für den Ausschnitt (später: Differenz statt voller Abzug) |
| Bauen unter den Füßen der Figuren | `blocked` der Engine, Anzeige am Cursor, Übernehmen nur bei pausierter Simulation |
| Innenräume wachsen nicht mit (Tasche im Streifen) | Tasche mit Reserve anlegen; Hausgröße bleibt an die Bauvorlagen gebunden (Grenze 256 × 256 beachten) |

## Bewusst festgelegt (ohne Frage)
- Keine Höhen und kein Gelände (wie AP12); Wege und Seen bleiben flach, Hügel bleiben Hintergrund.
- Mitspieler und Agenten bauen weiter **nur** über die Aktion `build` mit Bauvorlagen; der Editor ist ein Werkzeug der Leitstelle ([Frage 14](../offene-fragen.md)).
- Ausrollen nur nach deiner Freigabe.

## Nicht Teil dieses Pakets
Gebiete oder Häuser verschieben, neue Möbel und Gebäudearten zeichnen, Funktionen für die KI definieren, Epochen, Figuren-Editor: siehe [ausblick.md](../ausblick.md) (Nr. 2 bis 4).
