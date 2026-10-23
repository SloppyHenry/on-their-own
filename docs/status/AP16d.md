# AP16d – Probelauf und Härtung (Bericht, 23.10.2026)

**Branch:** `claude/ap16b-aussenwerkzeuge-1ac889`, nicht gemergt, nicht ausgerollt.

- **Probelauf mit Fake-Modell** (`tests/api/test_gestalten_probelauf.py`): erzeugtes Dorf (Seed 7), Bank, Weg und Garten übernehmen, 40 Schritte laufen; danach ein neues Wohnhaus mit Sofa und Tapete, 30 Schritte. Nichts bricht, die Objekte stehen in der Welt, die Prüfung meldet keine Fehler.
- **Prompt-Test „keine höhere Instanz“:** weder in den Prompts (alle Aufrufe des Fake-Modells) noch in den Erinnerungen der Figuren kommen Editor, Leitstelle, Spieler, Gott, Entwurf, Gestalten oder `world.edited` vor; das Ereignis der Übernahme steht nur im Protokoll (Sichtbarkeit `system`).
- **Leistung:** Vorschau mit 20 Aktionen auf einer großen leeren Welt 0,11 s (Grenze 1 s), alle 200 Aktionen 2,7 s (Test: unter 15 s). Der Zwischenspeicher der Werkstatt aus AP16a bleibt.
- **Doku:** `generator.md`, `frontend.md`, `schnittstellen.md`, `welt-erweitern.md` ergänzt; Status in `AP16-plan.md`.
- **Offen (bewusst):** Bilder für die Berichte und Beispielwelten für die Bibliothek (brauchen Henrys Auge); der Entwurf der Werkstatt liegt nicht im `sessionStorage`; Wegoptionen Breite/Belag aus dem Mockup fehlen im Backend.
