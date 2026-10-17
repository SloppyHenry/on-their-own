# AP17a – Schritt 0: Mockup Startmenü

Plan: [AP17-plan.md](../arbeitspakete/AP17-plan.md). Entscheidungen (17.10.2026, Henry): Frage 31 Empfehlung angenommen (Titelbild beim Öffnen, „Fortsetzen“ zuerst, Mockup vor dem Bau), Reihenfolge nach Frage 35 (17a, 17c, 17b, 17d, danach AP16). Leitgedanke: Im Mittelpunkt bleibt, Verhalten und Entwicklung der Agenten zu sehen.

**Ansehen:** `docs/mockups/startmenue.html` im Browser öffnen. Tasten ↑ ↓ Enter Esc; unten links „Zustand“ wechselt zwischen „Simulation läuft“ und „Frisch gestartet“ (dann fehlt „Fortsetzen“). Mit `?screen=load|settings|newsim|worldeditor|chareditor|pause` und `&tab=Spiel|Darstellung|Ton|Modelle` springt man direkt zu einer Ansicht.

## Was es zeigt
- **Titelbild** beim Öffnen: Welt gedimmt dahinter, Logo, Menü mit Fortsetzen (Ort, Tag, Bewohner), Neue Simulation, Simulation laden, Welteditor, Charaktereditor, Einstellungen.
- **Esc im Spiel** öffnet ein kleines Menü über der Welt (Zurück zum Spiel, Speichern und laden, Einstellungen, Hauptmenü); die Simulation läuft weiter.
- **Kopfzeile im Spiel** schlank: Uhr und Tempo, Einblicke, Welt gestalten, rechts Status und Menüknopf.
- **Simulation laden:** Liste mit Vorschaubild, Name, Zeit, Tag, Bewohnerzahl, Modell; Autosicherungen und Sicherungen gekennzeichnet.
- **Einstellungen** in vier Reitern: Spiel, Darstellung, Ton (AP17d), Modelle (Vorschau AP17c mit Empfehlungen nach Hardware).
- **Neue Simulation, Welteditor, Charaktereditor** als Einstiege; Inhalt folgt in AP17b und AP16.

Offen für deine Abnahme: Passt die Aufteilung? Soll „Welt gestalten“ in der Kopfzeile bleiben (Editor-Modus mit stehender Zeit) oder nur im Menü stehen?
