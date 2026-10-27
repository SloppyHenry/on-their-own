# AP23 – Baustein-Editor: eigene Dinge, Möbel und Häuser mit Funktionen (Plan, 20.10.2026)

**Auftrag:** 14.10. und 17.10.2026 ([ausblick.md](../ausblick.md), Abschnitt 4 und Nachtrag): „eigene Assets in einem Editor entwerfen und Funktionen definieren, damit die KI damit interagieren kann“, dazu „Assets und Häuser selbst entwerfen“. Am 20.10.2026 beauftragt.
**Umfang:** XL, Schritt 0 plus fünf Teilpakete (a–e). **Abhängig von:** AP21 (Katalog und Baukasten, Pflicht), AP18e (Weltenbibliothek, Werkstatt), AP16 (Deko-Werkzeug), AP22a (Paletten je Epoche). AP23e hängt zusätzlich an AP19.

## Ziel
In Menü › Editoren › **Bausteine** zeichnet man ein Ding Pixel für Pixel, gibt ihm Zustände (z. B. aus/an) und legt fest, **was man damit tun kann**: Modi aus dem Baukasten von AP21 (Bedingungen, Dauer, Wirkungen, Texte). Nach einer Prüfung und einem Probelauf steht das Ding in der Werkstatt zum Setzen bereit und, wenn gewünscht, als Bauvorlage für die Bewohner. Dasselbe für Gebäude (Fassade und Räume).

## Festlegungen (Fragen 70–71, Vorschlag)
1. **Kein Code, nie.** Funktionen sind nur Bausteine aus dem Baukasten (AP21). Kein Freitext wird ausgeführt. Texte (Optionstext, Ereignistext) werden mit der Wortprüfung (`META_RE`) geprüft: Treffer sind Warnungen wie im Charaktereditor.
2. **Größen:** Dinge und Möbel bis 32 × 32 Pixel, Deko bis 32 × 48, Gebäudefassaden bis 96 × 80. Höchstens 16 Farben je Baustein, vorgeschlagen aus der Palette der Epoche, eigene erlaubt. Höchstens 4 Zustände.
3. **Grenzen** wie AP21d (Rohstoffe ±5 je Benutzung, Dauer 1–240, höchstens 8 Modi). Zusätzlich: Ein Ding darf in v1 nichts **aus dem Nichts** erzeugen, außer Rohstoffe mit `zufall.chance` ≤ 0,5 und Menge 1 (sonst wäre es eine Geldmaschine). Die Prüfung erklärt jeden Verstoß.
4. **Bewohner dürfen eigene Bausteine bauen**, wenn beim Baustein „Als Bauvorlage anbieten“ an ist und eine Bauvorlage (Kosten, Dauer, Ort) angegeben wurde (Frage 71).
5. **Speicherort:** `data/bausteine/eigene-<id>.json` (Bibliothek neben Vorlagen und Musik). Eine Welt, die eigene Bausteine benutzt, nimmt **Kopien** davon mit (Weltdatei und Spielstand), damit sie auch ohne Bibliothek läuft. Beim Laden gewinnt die Kopie in der Welt.
6. **Keine höhere Instanz:** Für die Bewohner ist ein eigener Baustein ein Ding wie jedes andere. Ereignisse beim Setzen in der Werkstatt gibt es nicht (Werkstatt arbeitet auf der Datei). Im laufenden Spiel (Gott) erscheint das Ding über den Patch-Weg aus AP16a, ohne Ereignis für die Bewohner.

## Datenformat `simulacra-baustein`, Version 1
```json
{
  "format": "simulacra-baustein", "version": 1,
  "id": "eigene-schaukel", "name": "Schaukel", "gruppe": "ding",
  "epoche": "mittelalter",
  "bild": {
    "groesse": [20, 24], "fuss": [10, 23],
    "farben": ["#3b2c3d", "#cf9159", "#a96f42", "#7c4e30"],
    "zustaende": {
      "standard": ["....0000000000000000", "...01111111111111110", "…"],
      "an": null
    },
    "umriss": true
  },
  "ding": {
    "art": "eigene-schaukel", "name": "Schaukel", "blockiert": false, "tragbar": false,
    "zustand": {},
    "modi": {
      "swing": { "optionsart": "rest", "option": "Auf der {obj} schaukeln", "dritte_person": "schaukelt", "verb": "schaukeln",
                 "dauer": 15, "bedingungen": [ { "nicht_besetzt": {}, "sonst": "Jemand schaukelt schon." } ],
                 "wirkungen": [] }
    }
  },
  "bauvorlage": { "anbieten": true, "kosten": { "wood": 4 }, "minuten": 90, "wo": "outdoor", "werkbank": false }
}
```
- `zustaende`: je Zustand eine Liste von Zeilen, ein Zeichen je Pixel: `.` durchsichtig, `0`–`9` und `a`–`f` = Index in `farben`. `null` heißt „wie standard“. Welcher Zustand gezeigt wird, steht in `bild.zustand_an` (Zustandsfeld, z. B. `lit`), wie bei `bild.code` in AP21.
- `ding` ist **genau** ein Eintrag im Katalogformat von AP21 (`dinge.json`). Die Art beginnt immer mit `eigene-`, damit sie nie mit dem Grundpaket kollidiert.
- Ein Modus ohne Wirkungen ist erlaubt (Schaukeln verändert nichts). Dass jemand schaukelt, sehen die anderen schon heute über `agent.action_started` und den Text `dritte_person` („Alex schaukelt.“, `agents/observations.py`, `third_person`).
- `gruppe`: `ding`, `moebel` (nur drinnen setzbar), `deko` (ohne Modi, nur Bild), `gebaeude` (siehe AP23d), `figurenteil` (siehe AP23e).

## Schritt 0 – Mockup (eine Sitzung)
`docs/mockups/bausteine.html` mit `docs/mockups/bausteine/`, Stil aus AP18b:
- **Bild 1, Bibliothek** (Editoren › Bausteine): Karten mit Bild, Gruppe, Epoche, Prüfstatus (geprüft / Fehler), „Neu“, „Aus Vorlage“ (Kopie eines vorhandenen Dings als Startbild, z. B. Bank).
- **Bild 2, Zeichnen:** Raster mit Zoom (4–16-fach), Werkzeuge Stift, Radierer, Füllen, Pipette, Linie, Rechteck, Spiegeln (Symmetrie an/aus), Verschieben; Farbleiste (Palette der Epoche + eigene); Zustände als Reiter; rechts Vorschau in Originalgröße auf Wiese und auf Dielen, Tag und Nacht, Tiefe und Flach; Fußpunkt setzen.
- **Bild 3, Funktionen:** „Was kann man damit tun?“ als Liste von Modi; je Modus Formular: Verb, Optionstext (mit Vorschau „So sieht der Bewohner die Wahl: …“), Dauer, Bedingungen und Wirkungen als Bausteinzeilen mit Auswahllisten (keine freien Felder außer Texten und Zahlen), Ereignistext fürs Tagebuch.
- **Bild 4, Prüfen und Probelauf:** Liste der Prüfungen (grün/rot mit Erklärung), Knopf „Probelauf“ und dessen Bericht.
- **Bild 5, Gebäude:** Fassade zeichnen (wie Bild 2, größer), Grundriss aus Bändern und Räumen (Format `data/gebaeude/*.json`), Tür festlegen.
Die Projektleitung nimmt ab, bevor a beginnt.

## AP23a – Format, Bibliothek, Zeichnen im Spiel (ohne Editor)
1. Backend `backend/simulacra/bausteine/` (neu): `schema.py` (Pydantic, Format oben; `ding` wird mit den Modellen aus AP21 `katalog.py` geprüft), `pruefung.py` (alle Prüfungen aus den Festlegungen mit deutschen Meldungen, Rückgabe `[{"stufe": "fehler"|"warnung", "feld": "...", "text": "..."}]`), `store.py` (wie `TemplateStore`: Liste, Lesen, Anlegen, Ändern, Löschen, Duplizieren, Export, Import legt neu an).
2. **Katalog-Anbindung:** `katalog.load(pakete, eigene=[...])` nimmt Bausteine als zusätzliches Paket `eigene` auf (immer zuletzt). Welt und Spielstand speichern die benutzten Bausteine unter Meta `bausteine` (Liste der vollständigen JSON-Dateien). Beim Laden einer Welt gewinnen diese Kopien.
3. API `api/routes_bausteine.py`: `GET/POST /api/bausteine`, `GET/PUT/DELETE /api/bausteine/{id}`, `…/duplicate`, `…/export`, `POST /api/bausteine/import`, `POST /api/bausteine/{id}/pruefen`.
4. Frontend `frontend/src/world/art/pixel.ts` (neu): `pixelBild(baustein, zustand) -> HTMLCanvasElement` (Zeilen → Pixel, optional Umriss mit `s.outline(WP.outline)` aus `pen.ts`), zwischengespeichert nach `id|zustand|stempel`. `art/things.ts` und `dorf/sprites.ts`: Ist `bild.baustein` gesetzt (Laufzeit-Katalog aus AP21c), zeichne mit `pixelBild`.
5. **Prüfen:** pytest `tests/bausteine/` (Schema, jede Prüfung, Import legt neu an, Spielstand mit eingebettetem Baustein lädt auch ohne Bibliothek); Playwright mit einem Fixture-Baustein (Schaukel) per API in eine Welt gesetzt → erscheint im Bild (Pixelprobe).

## AP23b – Pixel-Editor
1. `frontend/src/bausteine/` (neu): `BausteinBibliothek.tsx`, `PixelEditor.tsx` (Canvas-Raster, Werkzeuge aus Bild 2), `werkzeuge.ts` (reine Funktionen: `stift`, `fuellen` (4er-Nachbarschaft), `linie` (Bresenham), `rechteck`, `spiegeln`; je eine Vitest-Datei), `entwurfStore.ts` (Entwurf, Rückgängig/Wiederholen 50 Schritte mit Strg+Z / Strg+Umschalt+Z, ungespeichert-Hinweis, Rückfrage beim Verlassen nach AP18a).
2. Vorschau mit den echten Zeichenwegen (Wiese, Dielen aus `art/rooms.ts`, Tag/Nacht über `Mood`), damit man sieht, wie es im Spiel aussieht.
3. „Aus Vorlage“: zeichnet ein vorhandenes Ding (`ART` oder `decorSprite`) in ein Canvas und wandelt es in Zeilen mit höchstens 16 Farben (häufigste zuerst; Rest auf die nächste Farbe).
4. Kachel **▣ Bausteine** in Menü › Editoren (`data-testid="editor-bausteine"`).
5. **Prüfen:** Vitest für alle Werkzeuge; Playwright: neuen Baustein anlegen, 3 Pixel setzen, füllen, Strg+Z, speichern, neu laden → gleich.

## AP23c – Funktionen, Prüfung und Probelauf
1. `bausteine/Funktionen.tsx` (Bild 3): Formular je Modus. Auswahllisten kommen aus einer Beschreibung des Baukastens, die das Backend liefert (`GET /api/katalog/baukasten`: je Baustein Name, deutsche Bezeichnung, Felder mit Typ und Grenzen). **So muss das Frontend nicht nachgezogen werden, wenn der Baukasten wächst.**
2. `bausteine/Pruefung.tsx` (Bild 4): zeigt `POST …/pruefen`.
3. **Probelauf** `POST /api/bausteine/{id}/probelauf`: Wegwerf-Simulation im Speicher (wie die Vorschau in `generator/service.py`), kleine Wiese mit dem Ding, ein Bewohner (Alex), Fake-Modell, das **jeden Modus des Dings einmal** wählt, 2 Spielstunden. Bericht: je Modus angeboten ja/nein, angenommen oder abgelehnt (mit Text), Wirkungen (Rohstoffe vorher/nachher, Zustand), Ereignisse. Dauer höchstens 5 Sekunden.
4. Nur **geprüfte** Bausteine (keine Fehler, Probelauf ohne unerwartete Ablehnung) erscheinen in der Werkstatt und als Bauvorlage.
5. **Werkstatt und Gott:** Das Deko-Werkzeug aus AP16b bekommt einen Reiter „Eigene“ mit allen geprüften Bausteinen der Epoche der Welt. Setzen über den Patch-Weg (Objekt plus `look`-Deko).
6. **Bauvorlage:** Ist `bauvorlage.anbieten` an, kommt die Vorlage in den Katalog der Welt; die Optionen der Bewohner bieten „{name} bauen“ an wie bei Bank oder Vogelhaus.
7. **Prüfen:** pytest Probelauf (gute Schaukel: alles grün; Fehler-Fixture mit unmöglicher Bedingung: Bericht nennt sie), Prompt-Test (Optionstext der Schaukel erscheint wörtlich, das Wort „eigene-“ nie), Bauen mit Fake-Modell (Bewohner baut die Schaukel, danach steht sie mit Bild da).

## AP23d – Gebäude und Räume
1. Gruppe `gebaeude`: Fassade wie ein großer Baustein (Zustände `tag`, `nacht` für erleuchtete Fenster), dazu `grundriss` im Format von `data/gebaeude/*.json` (`bands`, `rooms`, `front`) und `tuer` (Pixelstelle in der Fassade).
2. Editor Bild 5: Bänder und Räume als Rechtecke ziehen (Breite in Kacheln, Höhe je Band), Raumart wählen (`kind` aus den vorhandenen: Wohnen, Küche, Schlafen, Werkstatt, Lager …), Name. Prüfung: Tür an der Front, jeder Raum erreichbar, Größe innerhalb der Grenzen von `generator/interiors.py`.
3. Generator und Werkstatt-Werkzeug „Haus setzen“ (AP16b) können eigene Gebäude wählen; der Innenraum wird mit `generator/interiors.py` eingerichtet wie bei den mitgelieferten Häusern.
4. **Prüfen:** pytest (Grundriss-Prüfung, Haus setzen erzeugt Innenraum, Bewohner findet sein Bett darin), Playwright (eigenes Haus setzen, hineinschauen).

## AP23e – Figurenteile
1. Gruppe `figurenteil`: Frisur, Kopfbedeckung, Oberteil oder Zubehör, gezeichnet auf einer Schablone der Figur (15 × 23) für die Richtungen `down`, `up`, `left` (rechts wird gespiegelt) und die Laufbilder; der Editor zeigt Alex' Körper halbdurchsichtig darunter.
2. Der Avatar-Editor (AP19) zeigt geprüfte Figurenteile als zusätzliche Chips; `Appearance` bekommt dafür `eigene_teile: list[str]` (Kennungen). `people.ts` zeichnet sie als Ebene nach Körper und Kopf.
3. **Prüfen:** Figur mit eigenem Hut in allen Richtungen (Pixelprobe), Spielstand-Export nimmt den Hut mit.

## Abnahme
Jemand zeichnet eine Schaukel, gibt ihr „schaukeln“, besteht Prüfung und Probelauf, setzt sie in der Werkstatt in ein Dorf, startet die Simulation, und ein Bewohner schaukelt (sichtbar im Tagebuch). Ein eigenes Haus lässt sich setzen und betreten. Bericht `docs/status/AP23.md`.

## Fallen
- **Pixelzeilen** müssen genau `groesse[0]` Zeichen lang sein und es müssen genau `groesse[1]` Zeilen sein; die Prüfung nennt die erste falsche Zeile.
- **Kollision mit dem Grundpaket:** Nur Arten mit `eigene-` zulassen. Beim Import einer Datei mit bestehender Kennung neue Kennung vergeben (`eigene-schaukel-2`) und `ding.art` mit umbenennen.
- **Leistung:** `pixelBild` zeichnet einmal je Zustand und speichert; nie je Bild neu.
- **Gleichgewicht:** Die Prüfung ist die einzige Schranke gegen Bausteine, die das Spiel kaputt machen. Lieber zu streng; die Projektleitung kann Grenzen später lockern.

## Nicht in diesem Paket
Animationen (mehr als Zustände), eigene Geräusche, Handel mit Bausteinen über das Netz, eigene Bodenarten.
