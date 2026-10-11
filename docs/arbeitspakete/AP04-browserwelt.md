# AP04 – Browserwelt und Leitstelle (Grundlage)

**Auftrag:** §3 (Darstellung), §7 · **Abhängig von:** AP03 · **Umfang:** L · **Meilenstein:** M2

## Ziel
Die Simulation ist im Browser beobachtbar und steuerbar: eine atmosphärische 2D-Welt mit laufenden Figuren, Sprechblasen und Tag-Nacht-Licht, daneben Agentenübersicht, Live-Protokoll und Steuerleiste. Alles, was angezeigt wird, stammt aus Snapshot und Ereignissen des Backends; es gibt keine Anzeige, hinter der kein Zustand steht.

## Vorgehen: Mockup zuerst
1. HTML-Mockup der Leitstelle (statische Datei `docs/mockups/leitstelle.html`) mit Layout, Farben, Typografie, Beispielinhalten. Zeigt auch Detailpanel für Agent und Ort, Ereignisdetail und eingeklappte Parameterleiste (Platz für AP07) sowie Ereignisleiste (Platz für AP08).
2. **Freigabe durch dich.**
3. Umsetzung in React.

## Gestaltung
- **Dunkles, ruhiges Design:** Hintergrund nahe Schiefer (#12151a-Bereich), Flächen leicht abgesetzt, eine Akzentfarbe je Agent (z. B. warmes Bernstein für Alex, Salbeigrün für Mira) plus eine neutrale Systemfarbe. Farben als CSS-Variablen/Tailwind-Tokens.
- **Typografie:** eine gut lesbare Grotesk für die Oberfläche, Monospace nur für IDs und Zeiten. Klare Größenstufen.
- **Keine Kachelwüste:** wenige, klar getrennte Bereiche, Details in Panels statt überall gleichzeitig.
- **Welt-Stil:** Top-down-Pixelgrafik, weiche Farben, leichte Animationen (Wasser, Blätter), Nacht als blaue Abdunklung mit warmen Fensterlichtern.

## Layout (Desktop ab 1280 px, nutzbar ab 1024 px)
```
┌───────────────────────────── Kopfleiste ─────────────────────────────┐
│ SIMULACRA · Tag 2, 08:42 ☀  │ ▶ ❚❚ ⏭ │ Tempo ▸▸ │ Modell ● 0,9 s │ ⚙ │
├──────────────────────────────────────────────┬───────────────────────┤
│                                              │ Agentenübersicht (B)  │
│            Weltansicht (A)                   │  Alex …               │
│            Zoom/Pan, Klick                   │  Mira …               │
│                                              ├───────────────────────┤
│                                              │ Live-Protokoll (C)    │
│                                              │  Filter · Liste       │
├──────────────────────────────────────────────┴───────────────────────┤
│ Ereignisleiste (kommt mit AP08)                                       │
└───────────────────────────────────────────────────────────────────────┘
```
Die Ereignisleiste wird erst in AP08 sichtbar; in AP04 erscheint dort nichts (keine toten Bedienelemente).

## Bereiche im Detail

### A. Weltansicht (`WorldCanvas`, Phaser 3)
- Karte aus `world_default.json` bzw. dem Snapshot gerendert: Bodenschicht, Objektschicht, Figuren, Lichtschicht, Oberflächen-Overlay (Namen, Blasen).
- **Figuren:** Sprite-Animationen für Laufen in vier Richtungen, Stehen, Sitzen/Schlafen, Arbeiten. Bewegung folgt den `agent.moved`-Ereignissen; zwischen Kacheln wird weich interpoliert, die Dauer richtet sich nach der Simulationsgeschwindigkeit.
- **Namensschild** mit aktueller Aktivität („Mira · gießt das Beet“).
- **Sprechblasen** bei `agent.dialogue`, Anzeigedauer abhängig von Textlänge, lange Texte gekürzt mit Klick zum Protokolleintrag.
- **Hervorhebung:** laufendes Gespräch als Verbindungslinie, gerade benutztes Objekt mit Umriss.
- **Objekte** zeigen ihren Zustand: Pflanzenstufen, Baustelle mit Fortschritt, offene/verschlossene Tür, Ressourcenmenge (z. B. Holzstapel-Größe).
- **Tag-Nacht:** Lichtwert aus der Uhr; Wetter als Overlay (Regen, Nebel).
- **Steuerung:** Mausrad-Zoom (3 Stufen + stufenlos), Ziehen zum Verschieben, Doppelklick auf Agent = Kamera folgt, Taste `F` = folgen an/aus, Taste `0` = Gesamtansicht.
- **Klick auf Agent** → Detailpanel (rechts, überlagert B): Profil kurz, Status, aktuelle Aktion, Ziele/Bedürfnisse (ab AP06), letzte Erinnerungen (ab AP05), letzte Aktionen.
- **Klick auf Ort/Objekt** → Panel mit Objekten dort, deren Zustand, jüngsten Ereignissen am Ort.

### B. Agentenübersicht (`AgentPanel`)
Je Agent eine Karte: Charakterbild (Sprite-Porträt), Name, Ort, Aktivität, Handlungsstatus als Symbol (entscheidet, handelt, spricht, schläft, steckt fest), letzte Aktion mit Ergebnis (✓/✗ mit Grund). Felder für kurz-/langfristiges Ziel, Stimmung, Energie und Bedürfnisse werden angelegt, aber erst angezeigt, wenn AP06 die Daten liefert (keine leeren Platzhalter-Werte).

### C. Live-Protokoll (`EventTimeline`)
- Zeilen „08:42 – Mira verlässt das Haus.“ mit Symbol und Farbe je Kategorie (Welt, Dialog, Planung, System).
- Lesbare Sätze werden im Frontend aus Ereignistyp und Daten erzeugt (`describeEvent()`), nicht vom Modell.
- Filter: Kategorie, Agent, Freitext. Automatisches Mitscrollen, das bei manuellem Hochscrollen pausiert.
- Klick → Detailansicht: alle Felder, verknüpfte Ereignisse (`caused_by`), bei Entscheidungen die Optionen mit Punkten.
- Virtualisierte Liste, damit tausende Einträge flüssig bleiben.

### D. Simulationssteuerung (`SimulationControls`)
Start, Pause, Fortsetzen, Einzelschritt, Geschwindigkeitsstufen (z. B. 0,5×, 1×, 2×, 4×, max.), Zurücksetzen mit Bestätigungsdialog (Eingabe „zurücksetzen“). Speichern/Laden folgt in AP09. Jeder Knopf ruft die API mit Idempotenz-Schlüssel und zeigt den Status, den das Backend zurückmeldet.

### Kopfleiste
Simulationsuhr und Kalender, Wetter, Verbindungsstatus WebSocket (verbunden, verbinde neu, getrennt), Modellstatus (erreichbar, mittlere Antwortzeit; Detail in AP07).

## Datenfluss im Frontend
- `useSimStore` (zustand): Snapshot + Ereignis-Reducer; einzige Quelle für alle Komponenten.
- `wsClient.ts`: Verbindung, `hello` mit `last_seq`, Lückenprüfung, Resync, Wiederverbindung mit Backoff; zeigt den Status in der Kopfleiste.
- Phaser liest aus dem Store über eine schmale Brücke (`worldBridge.ts`), damit React und Phaser sich nicht gegenseitig neu rendern.

## Grafik
**Entschieden (11.10.2026):** Variante 2 im Stil eines gemütlichen Farmdorfs, Referenz ist das freigegebene Mockup (`docs/mockups/`). Die Bausteine (Häuser, Bäume, Zäune, Beete, Stände, Figuren) werden **parametrisch** aus Weltdaten gezeichnet, damit der Generator (AP12) später passend erweitern kann; Vorgaben siehe dort. Phaser-Texturen entstehen zur Laufzeit aus diesen Zeichenfunktionen, es gibt keine Bilddateien.

- Variante 1 (Vorschlag): freie CC0-Pakete (z. B. Kenney „Tiny Town“ / „Roguelike“-Sets) – Download und Lizenz bestätigst du vorher.
- Variante 2: eigene, einfache Pixel-Sprites, im Projekt erzeugt.
- Herkunft und Lizenz in `docs/assets.md`.

## Module (je unter 400 Zeilen)
`src/store/simStore.ts`, `src/store/reducers/*.ts`, `src/net/wsClient.ts`, `src/net/api.ts`, `src/world/WorldCanvas.tsx`, `src/world/scenes/WorldScene.ts`, `src/world/layers/*.ts`, `src/world/sprites.ts`, `src/world/worldBridge.ts`, `src/panels/AgentPanel.tsx`, `src/panels/AgentDetail.tsx`, `src/panels/LocationDetail.tsx`, `src/timeline/EventTimeline.tsx`, `src/timeline/describeEvent.ts`, `src/timeline/EventDetail.tsx`, `src/controls/SimulationControls.tsx`, `src/layout/AppShell.tsx`, `src/layout/Header.tsx`.

## Tests
- Vitest: Reducer (Snapshot + Ereignisse = erwarteter Zustand), `describeEvent` für alle Typen, Lückenerkennung im WS-Client.
- Playwright (gegen Backend mit Fake-LLM, deterministisch):
  - Start → Figur bewegt sich sichtbar (Position im Canvas ändert sich) (§17 Nr. 6).
  - Dialog-Ereignis → Sprechblase und Protokolleintrag (§17 Nr. 5).
  - Pause → keine neuen Ereignisse; Schritt → genau ein Tick (§17 Nr. 12).
  - Seite neu laden → gleiche Uhrzeit, Positionen und Protokoll (§17 Nr. 13).
  - Backend kurz trennen → Anzeige „verbinde neu“, danach vollständiger Stand.

## Abnahme
- [ ] Mockup freigegeben.
- [ ] Mit echtem Modell: Figuren laufen durch die Welt, Gespräche erscheinen live, Tag-Nacht sichtbar.
- [ ] Klick auf Agent, Ort und Ereignis öffnet die jeweiligen Details mit echten Daten.
- [ ] Playwright- und Vitest-Lauf grün, Ausgabe im Statusbericht.

## Risiken
| Risiko | Gegenmaßnahme |
|---|---|
| Phaser und React kommen sich in die Quere | Phaser nur im eigenen Canvas, Datenübergabe über `worldBridge` |
| Zu viele Positionsereignisse | Pfadabschnitte statt Einzelkacheln (mit AP03 abgestimmt) |
| Grafik wirkt uneinheitlich | Ein Asset-Set, eine Palette; Mockup als Referenz |
