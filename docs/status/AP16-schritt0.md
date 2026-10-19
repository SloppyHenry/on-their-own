# AP16 – Schritt 0: Mockup „Welt gestalten“

Plan: [AP16-plan.md](../arbeitspakete/AP16-plan.md). Entscheidungen zu Frage 27 bis 30: **Entwurf** statt Sofortbau, Umfang wie vorgeschlagen, **Mockup zuerst** (Empfehlungen angenommen); zu Frage 28 hat Henry am 15.10.2026 anders entschieden: **Gestalten nur vor Beginn einer Runde**, die Agenten dürfen nicht merken, dass es eine höhere Instanz gibt ([AP17-plan.md](../arbeitspakete/AP17-plan.md)). Das Mockup zeigt das Werkzeug deshalb als Schritt „Neue Simulation › Welt gestalten“. Dieses Dokument zeigt das Mockup; im Spiel ist noch nichts davon gebaut.

**Ansehen:** `docs/mockups/welt-optik/gestalten.html` im Browser öffnen (Doppelklick genügt, kein Server nötig). Mit `?demo=1` ist ein Entwurf vorbefüllt, mit `?view=in&room=kueche` startet die Innenansicht.

## Was das Mockup zeigt
Boden, Häuser und Dinge sind die **echten Bausteine** aus Bild A und den Bausteinen (`world.js`, `dorf.js`, `bausteine.js`, Dorf aus Seed 7). Jede Werkzeugaktion ist eine **Aktion**; die Welt wird daraus neu berechnet (der Boden Texel für Texel, wie im Spiel), so wie im Spiel jede Aktion ein Patch ist. Aktionen liegen im **Entwurf** und erscheinen unter dem **Schleier** (gestrichelt, violett, wie die Vorschau in AP12c).

| Zeiger: etwas anfahren zeigt seinen Namen | Haus gewählt: „Von innen einrichten“ |
|---|---|
| ![Zeiger](../mockups/welt-optik/gestalten-1-zeiger.png) | ![Haus gewählt](../mockups/welt-optik/gestalten-2-haus-gewaehlt.png) |
| **Weg ziehen:** Punkte setzen, die Vorschau läuft mit dem Zeiger | **See ausheben:** Fehler am Cursor, hier steht ein Baum im Weg |
| ![Weg](../mockups/welt-optik/gestalten-3-weg.png) | ![See Fehler](../mockups/welt-optik/gestalten-4-see-fehler.png) |
| **Haus setzen:** Vorschau des Sprites, Türmarke vor der Tür (grün = gültig) | **Haus setzen, ungültig:** Grund am Cursor, Türmarke rot |
| ![Haus](../mockups/welt-optik/gestalten-5-haus.png) | ![Haus Fehler](../mockups/welt-optik/gestalten-6-haus-fehler.png) |
| **Löschen:** ein bewohntes Haus lässt sich nicht löschen | **Der Entwurf:** Weg, See, Garten, Haus, drei Bäume, ein Busch gelöscht, Liste mit Rückgängig und Prüfung |
| ![Löschen](../mockups/welt-optik/gestalten-7-loeschen-bewohnt.png) | ![Entwurf](../mockups/welt-optik/gestalten-8-entwurf.png) |
| **Abend:** Laternen leuchten, der Entwurf bleibt erkennbar | **Übernehmen:** Bestätigung (die Runde hat noch nicht begonnen) |
| ![Abend](../mockups/welt-optik/gestalten-9-abend.png) | ![Übernehmen](../mockups/welt-optik/gestalten-10-uebernehmen.png) |

### Haus von innen einrichten
| Möbel setzen: Katalog rechts, Vorschau mit Raster | Ungültig: vor der Tür bleibt es frei |
|---|---|
| ![Möbel](../mockups/welt-optik/gestalten-11-innen-moebel.png) | ![Fehler](../mockups/welt-optik/gestalten-12-innen-fehler.png) |
| **Wandschmuck:** Fenster und Bilder hängen an der Rückwand | **Farben:** Tapete, Boden, Vorhänge, jede Wahl eine Aktion |
| ![Wand](../mockups/welt-optik/gestalten-13-innen-wand.png) | ![Farben](../mockups/welt-optik/gestalten-14-innen-farben.png) |

## Bedienung
- **Werkzeugleiste links** (Tasten 1 bis 7): Zeiger, Weg, See, Garten, Haus, Deko, Löschen. In der Innenansicht: Möbel, Wand, Farben, Löschen. Rechts oben die Optionen des Werkzeugs (Gebäudeart und Farben, Dekokatalog, Möbelkatalog), darunter der **Entwurf** und die **Prüfung**.
- **Weg:** Klick setzt Punkte, Doppelklick oder Enter beendet, Esc bricht ab. **See:** vom Mittelpunkt nach außen ziehen. **Garten:** Rechteck aufziehen, Zaun, Pfähle und drei Beete entstehen von selbst. **Haus:** Art, Dach- und Wandfarbe wählen, klicken; der Cursor rastet auf die Kachel ein. **Deko:** Klick setzt. **Löschen:** Klick löscht, was unter dem Zeiger liegt (als Aktion, die man zurücknehmen kann).
- **Entwurf:** jede Aktion ist eine Zeile mit ×; Rückgängig und Wiederholen (Strg+Z, Umschalt+Strg+Z), Verwerfen. Was übernommen ist, bleibt; bis zum Beginn der Runde lässt sich weiter gestalten.
- **Prüfung** läuft bei jeder Änderung mit den Regeln des Generators: alle Haustüren vom Dorfplatz erreichbar, Figuren auf begehbarem Boden, für jedes neue Haus „Tür, Innenbereich, Räume und Einrichtung werden angelegt“, innen: Tür frei, alle Möbel erreichbar, Raumart-Regel (Schlafzimmer braucht ein Bett, Küche einen Herd). **Ein Entwurf mit einem ✗ lässt sich nicht übernehmen.**
- **Fehler stehen am Cursor** (rot, mit Grund: „Kiefer steht dort“, „Dort ist Wasser“, „Ein Weg führt hindurch“, „Zu klein“, „Vor der Tür bleibt es frei“), statt dass eine Aktion scheitert.
- Raster (Kacheln zu 16 Weltpixeln) ein- und ausschaltbar, Mittag und Abend.

## Was schematisch ist
- **Ansicht:** Das Mockup zeigt „Flach“ (Draufsicht), weil dort Raster und Cursor am deutlichsten sind. Im Spiel arbeiten dieselben Werkzeuge in „Tiefe“ und „Flach“ (Frage 37).
- **Möbel:** Die Innenansicht hat schematische Möbel, damit Katalog, Raster, Prüfung und Farben zu sehen sind. Im Spiel kommen die Sprites und die Optik aus „innen2“, die Möbel sind echte Objektarten mit ihren Handlungen (AP15).
- **„Übernehmen“** rechnet das Mockup sofort selbst; im Spiel läuft es über Trockenlauf und Patch wie in AP12c, aber ohne laufende Simulation (kein Anhalten, kein Ereignis für die Agenten).

## Fragen an dich
Frage 37 in [offene-fragen.md](../offene-fragen.md): Passt die Bedienung (Werkzeuge, Entwurf, Prüfung, Fehler am Cursor)? Soll ich vor dem Bau auch die Ansicht „Tiefe“ als Mockup zeigen? Was soll geändert werden?
