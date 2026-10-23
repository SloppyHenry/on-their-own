# AP16c – Haus von innen einrichten (Bericht, 23.10.2026)

**Plan:** [AP16-plan.md](../arbeitspakete/AP16-plan.md), [AP16-schritt0.md](AP16-schritt0.md); davor [AP16b](AP16b.md). **Branch:** `claude/ap16b-aussenwerkzeuge-1ac889` (zusammen mit AP16b und AP16d), nicht gemergt, nicht ausgerollt.

## Was fertig ist
- **Backend** (`generator/edit/innen.py`): Aktionen `moebel` (14 Arten aus der Objektregistry, damit mit allen Handlungen aus AP15), `wand` (neun Arten Wandschmuck, ohne Überlappung), `teppich` (drei Farben), `farbe` (Tapete, Boden, Vorhang je Raum). Regeln mit Grund am Cursor: nur freier Boden in einem Raum, nichts neben einer Tür, kein Möbel, das einen Weg im Haus abschneidet (Zusammenhangsprüfung), im Spiel nichts auf Figuren oder Dingen. Sperrende Möbel setzen die Kachel auf `m`, Löschen gibt sie wieder frei. Löschen im Haus entfernt Möbel (Betten mit Besitzer nicht), Teppich und Wandschmuck (oberste Reihe des Raums).
- **Neue Operation `replace`** in `look_ops` (Python) und `applyLookOps` (Browser): ändert den Eintrag eines Hauses an derselben Stelle, damit die Hausnummern stabil bleiben. Katalog unter `innen` in `GET /api/gestalten/katalog`.
- **Frontend:** Klick auf ein Haus öffnet das Puppenhaus, die Leiste wechselt auf Zeiger, Möbel, Wand, Teppich, Farben, Löschen; Katalog mit Möbeln samt Handlungen, Wandschmuck, Teppichfarben und Farbfeldern; „← Nach draußen“. Raster, Geist und Fehler am Cursor arbeiten auch im Haus (Projektion des Puppenhauses). Das Haus bleibt beim Neuaufbau der Ansicht offen; Esc geht erst nach draußen, dann aus dem Gestalten.
- Gilt in Werkstatt und Spiel; Bewohner und Möbel mit Besitzer: siehe Frage 82 (bewohnte Häuser dürfen eingerichtet werden, Betten mit Besitzer und Türen bleiben).

## Tests
`tests/generator/test_innen.py` (21: Möbel, Sperren, Ablehnungen, Zusammenhang über viele Möbel, Wand/Teppich/Farben, Datei = Engine, Katalog, jedes Möbel einzeln), `e2e/gestalten-innen.spec.ts` (4: Werkzeuge im Haus und Esc-Ebenen, Möbel übernehmen, Farben und Teppich, Rückgängig). pytest gesamt 1512 grün (vor AP16d), Vitest 230, Playwright Gestalten 17.

## Grenzen
Möbel werden einzeln auf Kacheln gestellt (kein Drehen: die Sprites haben nur eine Ausrichtung); die Prüfung „Schlafzimmer braucht ein Bett, Küche einen Herd“ kommt aus AP16a und gilt hier mit.
