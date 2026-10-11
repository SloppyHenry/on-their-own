# Frontend (AP04)

React 19, TypeScript, Vite, Tailwind 4, Phaser 3.90 (Welt), Zustand (Zustand der App), `@tanstack/react-virtual` (Protokoll). Alle Versionen exakt gepinnt.

## Datenfluss
```
Backend ──/ws──▶ wsClient ──▶ Bündelung (40 ms) ──▶ simStore (Snapshot + Reducer) ──▶ React-Komponenten
                                                          │
                                                          └──▶ worldBridge ──▶ Phaser-Szene (nur lesend)
```
- **`net/wsClient.ts`:** `hello` mit `last_seq`, Lückenprüfung (`net/gap.ts`), Resync, Wiederverbindung mit Backoff (0,5/1/2/4/8 s), Wächter (45 s Stille → neu verbinden). Status: `connecting`, `open`, `reconnecting`, `closed`.
- **`net/connect.ts`:** verbindet Client und Store, lädt nach einem Snapshot die letzten 400 Ereignisse nach, holt bei „veraltet“ (abgeschnittene Kachelliste) einen neuen Snapshot, aktualisiert den Simulationsstatus alle 10 s.
- **`store/reducers/`:** reine Funktionen `applySnapshot` und `applyEvent`. Doppelte und alte Nummern ändern nichts, unbekannte Ereignistypen ändern nur Uhr und Nummer. Die Uhr folgt der Ereigniszeit (`lib/clock.ts` spiegelt die Backend-Uhr).
- **`store/simStore.ts`:** Welt, Ereignisliste (letzte 5000), Sprechblasen (nur aus *Live*-Ereignissen), Verbindungsstatus. **`store/uiStore.ts`:** Auswahl, Kamera-Folgen, Protokollfilter.
- **Jeder verändernde Aufruf** (`net/api.ts`) trägt einen `Idempotency-Key`. Die Oberfläche zeigt, was das Backend meldet (Ereignisse), nicht das Ergebnis des Knopfdrucks.

## Weltansicht
- **`world/WorldCanvas.tsx`:** Phaser nur in eigenem Container; Namensschilder und Sprechblasen als DOM-Overlay (`Overlays.tsx`), Licht und Wetter auf einer eigenen 2D-Fläche darüber.
- **`world/worldBridge.ts`:** die einzige Verbindung zwischen React/Zustand und Phaser. Die Szene liest, die Oberfläche bekommt Bildschirmpositionen (ohne React neu zu rendern).
- **`world/scenes/WorldScene.ts`:** baut Boden (einmal in eine Textur), Bäume, Objekte, Quellen und Zäune aus dem Zustand auf und gleicht sie bei Änderungen ab (nur geänderte Teile). **`agentViews.ts`:** weiche Bewegung zwischen Kacheln (Tempo folgt der Simulationsgeschwindigkeit), Blickrichtung, Laufbild, Schlafen (liegend, Zeichen), Werkzeug bei Arbeit. **`cameraRig.ts`:** Zoom um den Mauszeiger, Ziehen, Folgen, Gesamtansicht.
- **Dach (`draw/roof.ts`):** Gebäude = zusammenhängender Block aus Wänden, Böden und Türen, der Räume (`style.floor`) enthält. Das Dach deckt alles außer der Südfassade ab, ist geschlossen, wenn niemand darin ist, und blendet sich weich aus, sobald jemand hineingeht oder ein Raum gewählt ist. Gilt für jedes Gebäude, auch für später erzeugte.
- **Bedienung:** Mausrad Zoom · Ziehen verschieben · Klick auf Figur oder Raum öffnet das Detail · Doppelklick auf Figur folgt ihr · `F` folgt dem zuletzt gewählten Agenten · `0` Gesamtansicht.
- **Gezeichnet wird, was der Zustand sagt:** Pflanzenstufe, Tür verschlossen/offen, Kamin an/aus, Baustellenfortschritt, Vorratsmenge (Holzstapel, Steine), Gespräch als Punktlinie, benutztes Objekt mit Umriss. Grafik: siehe [assets.md](assets.md).

## Protokoll
`timeline/describeEvent.ts` erzeugt die Sätze (für jeden Ereignistyp, vom Compiler erzwungen; unvollständige Daten fallen auf den Typnamen zurück). Einzelschritte (`agent.moved`), Statuswechsel und der Takt `world.time` sind standardmäßig ausgeblendet (Filter „Schritte“). Mitscrollen pausiert beim Hochscrollen. Klick öffnet das Ereignisdetail mit Ursachen, Folgen und bei Entscheidungen den Optionen mit Punkten.

## Gedächtnis-Inspektor (AP05)
Eigene Ansicht über die Schaltfläche „Gedächtnis“ in der Kopfleiste (oder „Gedächtnis öffnen“ im Agenten-Detail); die Simulation läuft im Hintergrund weiter, neue Erinnerungen erscheinen live mit der Markierung „neu“. Spalte links: Agent, Reiter (Erinnerungen, Was ich weiß, Abrufe), Filter nach Art, Status, Person, Ort, Freitext und Sortierung, Umschalter „Alle nebeneinander“. Detail rechts: Text, Metadaten, Stichwörter, Quellereignis (Sprung ins Protokoll), Quellerinnerungen bei Einsichten, abgeleitete Einsichten, Abrufe mit Punktzahl und Entscheidung. Am Agenten in der Welt leuchtet das Namensschild beim Speichern (grün, „＋ gemerkt“) und beim Abrufen (violett, „↺ erinnert sich“) auf. Gedächtnis-Ereignisse im Protokoll sind über den Filter „Gedächtnis“ zuschaltbar (standardmäßig aus, sie sind häufig).

## Autonomie in der Oberfläche (AP06)
Agentenkarte: Ziel mit Fortschrittsbalken, Stimmung (Wort), Bedürfnisbalken (voll = gedeckt, kritisch rot). Agenten-Detail: Bedürfnisse und Stimmung mit den einzelnen Beiträgen, Ziele (langfristig, aktuelles kurzfristiges mit Erfüllungsbedingung in Worten und abgehaktem Plan, bisherige mit Ausgang), Beziehungen (vier Werte, gemeinsame Erlebnisse, offene Konflikte, jüngste Änderungen mit Grund), Fehlschläge, Entscheidungen mit „Warum?“. Protokoll: Entscheidungen haben „Warum?“ (Erklärtext aus den Daten und Faktorbalken, umschaltbar auf die Gruppen der Spezifikation), Filter „Fehlschläge“; Ereignisdetail einer Entscheidung zeigt alle Optionen mit Punkten und je Option die Faktoren. Daten: `/api/overview` (alle 5 s und bei Ziel-, Beziehungs- und Schutzereignissen).

## Befehle
```bash
cd frontend
npm run dev            # Vite auf 5173 (Backend 8090); SIM_BACKEND und SIM_FRONTEND_PORT überschreiben
npm test               # Vitest
npm run test:e2e       # Playwright: startet Backend mit Fake-LLM (scripts/e2e_server.py) und Vite selbst
npm run typecheck
```

## Einstellungen (AP07)
Die Schublade „Einstellungen“ (Header-Knopf) liegt rechts über der Welt, damit man Wirkungen sofort sieht. Sie baut sich aus `GET /api/params/schema` (`settings/ParameterPanel.tsx`): Bereiche Autonomie, Agenten, Gedächtnis, Welt, Modell, Tempo, Modus, Presets, Status; Suche über alle Einstellungen; Esc schließt.

- **Regler** (`ParamControl.tsx`): Schieber mit Zahl und Einheit, Schalter, Auswahl, Text (gesendet nach 0,7 s Ruhe oder beim Verlassen). Daneben die **Statusmarke** der letzten Änderung: *übernommen*, *ab nächster Entscheidung*, *Neustart nötig*, *abgelehnt* (mit Grund); „Standard“ setzt den Regler zurück. Gesperrte Regler (Modell) sind ausgegraut und nennen den Grund.
- **Schieber werden gedrosselt** (`paramStore.ts`): höchstens eine Anfrage je Regler und 250 ms, der letzte Wert gewinnt. Angezeigt wird nach der Antwort der Wert **vom Verbraucher** (`GET /api/params`), nicht der gesendete.
- **Agenten** (`ParamGroup.tsx`): Persönlichkeit (12 Werte) und Charaktertexte stehen für Alex und Mira nebeneinander.
- **Presets** (`PresetManager.tsx`): Vorschau mit altem und neuem Wert vor dem Laden, speichern (optional nur ausgewählte Gruppen), duplizieren, umbenennen, löschen mit Bestätigung.
- **Status** (`StatusPanels.tsx`): Modell und Last, alle 3 s aufgefrischt; im Header erscheinen wartende Anfragen und Fehler der letzten 15 Minuten, sobald es welche gibt.
- Tempo: Knöpfe 0,5×, 1×, 2×, 4×, Max. Zurücksetzen fragt nach dem Modell der neuen Simulation.
- Protokollsatz für jede Änderung: „Einstellung „Knappheit“: 0 → 40.“

## Eingabeleiste (AP08)
Dauerhaft am unteren Rand (`composer/EventComposer.tsx`). Enter sendet, Shift+Enter macht eine neue Zeile, Esc bricht ab. Optional: betroffene Figuren (Chips) und Zeitpunkt (sofort, in 30 Minuten, in 2 Stunden, Uhrzeit heute/morgen/übermorgen; gilt nur für die eine Eingabe). Vorschläge beim Fokussieren: zuletzt verwendete, aus der Welt abgeleitete und die elf Beispiele.

Der Status steht in der Leiste: *wird gelesen …* → *Rückfrage* (`ClarifyCard`: Auswahl oder Freitext) → *Vorschau* (`PreviewCard`: Klartext der Änderungen, „Ausführen“) → *ausgeführt ✓* oder *abgelehnt: Grund*. Einfache Ereignisse laufen ohne weitere Bestätigung; was das Sprachmodell gedeutet hat, zeigt immer die Vorschau. Das Ergebnis erscheint im Protokoll („Ereignis eingegeben …“ plus die Folgeereignisse, Auslieferungen als „Mira erfährt …“); entsteht ein Objekt, zentriert die Weltansicht darauf. „Verlauf“ listet die eigenen Eingaben mit Status, springt zum Protokolleintrag und übernimmt eine frühere Eingabe erneut. Nebenfiguren tragen in der Bewohnerliste die Kennzeichnung „Nebenfigur“.

## Spielstände, Verlauf, Statistik (AP09)
- **Spielstände** (Header-Knopf, `saves/SaveLoadDialog.tsx`): Liste mit Art, Sim-Zeit, Datum, Größe und Modell; Speichern (bei gleichem Namen die ausdrückliche Rückfrage „Neuen Namen wählen“ oder „Überschreiben“), Laden (mit dem Hinweis, dass vorher gesichert wird), Löschen (mit Rückfrage), Exportieren (Download) und Importieren (Datei wählen). Der Zurücksetzen-Dialog sagt, wo gesichert wird, und lässt wählen: komplett Standard oder Profile behalten.
- **Verlauf** (`history/EventHistory.tsx`): alle Ereignisse mit Filtern nach Kategorie, Figur, Ort, Art, Text und Zeitraum (Tag und Uhrzeit), „Mehr laden“, Export als CSV und JSON mit demselben Filter; ein Klick öffnet das Ereignis.
- **Statistik** (`stats/StatsView.tsx`, `LineChart.tsx`): Kennzahlen, Aktionen nach Art, Zeit je Ort, Gespräche, Modell, Erinnerungen je Tag, Verläufe der Bedürfnisse, der Stimmung und der Beziehungen als eigene SVG-Liniendiagramme (keine Bibliothek); Figur und Zeitraum wählbar.
