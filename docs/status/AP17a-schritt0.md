# AP17a – Schritt 0: Mockup Startmenü

Plan: [AP17-plan.md](../arbeitspakete/AP17-plan.md). Entscheidungen (17.10.2026, Henry): Frage 31 Empfehlung angenommen (Titelbild beim Öffnen, „Fortsetzen“ zuerst, Mockup vor dem Bau), Reihenfolge nach Frage 35 (17a, 17c, 17b, 17d, danach AP16). Leitgedanke: Im Mittelpunkt bleibt, Verhalten und Entwicklung der Agenten zu sehen.

**Ansehen:** `docs/mockups/startmenue.html` im Browser öffnen (eine Datei, Bilder eingebettet). Tasten ↑ ↓ Enter Esc; unten links wechselt „Zustand“ zwischen Frisch gestartet, Simulation läuft und Im Spiel, Menü offen. Mit `?open=load|settings|editors|newsim` springt man zu einem Bereich.

## Überarbeitung nach Henrys Frage „wie eleganter?“ (17.10.2026)
- **Keine Fenster:** Links bleibt die Liste, rechts erscheint der Inhalt des gewählten Punkts (Laden, Einstellungen, Editoren, Neue Simulation). Esc geht eine Ebene zurück.
- **Lebende Welt:** Hinter dem Menü wandert die Kamera langsam, die Tageszeit wechselt, Figuren tragen ihre Schilder. Beim Öffnen eines Bereichs blenden die Schilder aus. Im Bau läuft hier die echte Simulation (oder die Vorschau der Startwelt).
- **Fortsetzen** zeigt, was gerade passiert („Alex geht zur Küche“).
- **Laden:** Vorschaubild, Name, Zeit; Einzelheiten und Knöpfe nur beim gewählten Stand.
- **Einstellungen:** eine Spalte mit Suche und Sprungmarken (Spiel, Darstellung, Ton, Modelle), kein Reiterwechsel.
- **Editoren:** Obermenüpunkt mit Bildkacheln (Welt, Figuren; Häuser/Gebäude und Dinge/Assets gedämpft „später“).
- **Im Spiel (Esc):** dieselbe Menüform über der Welt; „Zurück zum Spiel“, Speichern und laden, Editoren (Editor-Modus, Zeit steht still), Einstellungen, Hauptmenü.

## Offen für deine Abnahme
Soll „Welt gestalten“ in der Kopfzeile bleiben (Editor-Modus) oder nur unter Editoren stehen? Gefällt das Logo mit Pixel-Haus?
