# AP17a – Startmenü und Menüführung

Mockup: [startmenue.html](../mockups/startmenue.html), abgenommen am 17.10.2026 („gefällt mir“). Schritt-0-Bericht: [AP17a-schritt0.md](AP17a-schritt0.md). Plan: [AP17-plan.md](../arbeitspakete/AP17-plan.md).

## Gebaut
- `layout/StartMenu.tsx`: Titelbild beim Öffnen (echte Welt dahinter, langsame Kamerafahrt, Fortsetzen mit Live-Zeilen), Pausenmenü mit Esc und Knopf „☰ Menü“, Liste links, Inhalt rechts ohne Fenster.
- Bereiche: Neue Simulation (Startwelt neu beginnen, Neues Dorf erzeugen, Aus Spielstand; „Selbst gestalten“ als „später“), Simulation laden (der bisherige Spielstand-Dialog eingebettet), Editoren (Welt öffnet den Welteditor; Figuren, Häuser, Dinge als „später“), Einstellungen (Inhalt der Schublade, jetzt auch im Menü).
- Kopfzeile: Menüknopf neu, „Spielstände“ entfällt (liegt im Menü). Titelbild ohne Kopfzeile, Infoleiste und Eingabeleiste.
- Titelbild je Gerät abschaltbar (Menü → Einstellungen).
- Esc: öffnet das Menü nur, wenn keine Schublade, Auswahl, Innenansicht oder der Editor es braucht.

## Bewusst nicht gebaut
- Einstellungen als eine Spalte mit Sprungmarken (Mockup): im Menü stehen vorerst die bestehenden Bereiche (Autonomie bis Status) mit Suche. Die Neuordnung in Spiel, Darstellung, Ton, Modelle kommt mit AP17c und AP17d, wenn Ton und Modelle existieren.
- Vorschaubilder der Spielstände: Das Backend liefert noch keine; die Liste bleibt die bisherige.
- Figuren, Häuser und Dinge im Editoren-Menü: Platzhalter (AP17b, später).

## Tests
Vitest 130 grün. Playwright: neue `e2e/menue.spec.ts` (6 Tests: Titelbild und Fortsetzen, Abschalten je Gerät, Esc und Pausenmenü, Pfeiltasten, Esc mit offener Schublade, Editoren und Neue Simulation); die übrigen Tests starten mit abgeschaltetem Titelbild (`playwright.config.ts`), `saves.spec.ts` öffnet die Spielstände über das Menü.
