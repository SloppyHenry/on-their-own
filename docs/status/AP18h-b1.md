# AP18h-b1 – Figur und Gehen (Frontend, 22.10.2026)

**Branch:** `claude/ap18h-b1-figur-gehen-8d8c59`, nicht in `main`, nicht ausgerollt. Grundlage: [AP18h-plan.md](../arbeitspakete/AP18h-plan.md), [AP18h-schritt0.md](AP18h-schritt0.md) (Zeile 18h-b1), Mockup `docs/mockups/mitleben.html` Bild 1.

## Was jetzt geht
- **Vorschau weg:** Vorschau-Figur „Du (Vorschau)“, „würde …“-Meldungen, Kontextmenü, Sagen-Feld und der Schalter Einstellungen › Darstellung › Mitspieler-Steuerung (`playerPreview`) sind entfernt.
- **Echte Figur:** `StateSnapshot` trägt `player` und `player_autopilot` (nur für die Oberfläche, nie in einem Prompt). Deine Figur hat einen Himmelblau-Ring unter den Füßen, im Bild gezeichnet (verdeckt wie die Figur selbst), in beiden Ansichten (Dorf und alte Ansicht).
- **Kamera folgt** deiner Figur von Anfang an, auch ins Haus; `F` schaltet um. Plaketten oben links: „Kamera folgt Kim“, „Kim wartet · frei seit …“, „Autopilot“.
- **Handlungsleiste** (`hud/Handlungsleiste.tsx`): Rahmen wie die Werkzeugleiste, Band „Kim geht zum See · noch 9 Min.“ mit **Abbrechen** (auch `Esc`, wenn sonst nichts offen ist). Sagen, Benutzen, Bauen, Gepäck stehen ausgegraut da (b2/b3).
- **Klick geht:** Klick auf eine freie Kachel → `POST /api/player/act` `move_to {tile}`; Weg und „etwa N Min.“ als Vorschau, Ablehnung der Welt als rote Blase drei Sekunden über der Figur. Klick auf Ding/Figur wählt wie bisher aus.
- Hilfsmethode `DorfView.tileCss` (Kachel → Bildschirmpunkt) für Tests; nur im e2e-Server `POST /api/e2e/player` zum Wählen der Figur (bis c1).

## Prüfung
vitest, tsc, Playwright `e2e/mitleben.spec.ts` (5 Fälle: ohne Figur nichts; Leiste/Plakette/Kamera/F; Klick aufs Ufer → Band → Ankunft; Abbrechen; Ablehnung 3 s). Alte `player.spec.ts` ersetzt; `bilder.spec.ts` (opt-in) zeigt `mitleben-leiste`. Ergebnis der Gesamtläufe siehe Abschlussmeldung der Sitzung.

## Bewusst offen / Hinweise
- „Steg“: Die Testwelt hat keinen begehbaren Steg als Ziel; der Test klickt eine freie Uferkachel des Sees.
- Während die Figur geht, lehnt die Engine einen zweiten Klick mit „ist noch beschäftigt“ ab (wie bei jedem Bewohner); erst Abbrechen. Möglich später: automatisch abbrechen.
- Der Fahrplan (`agent.walking`) kommt erst mit dem ersten Schritt; bis dahin zeigt das Band die Schätzung der Wegsuche.
- Banner „Die Zeit steht“ und „Übernehmen“ gehören zu a3/c1. `T` bleibt vorerst Tagebuch (Konflikt mit „Sagen“ klärt b2).
