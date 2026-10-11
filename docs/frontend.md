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
- **Bedienung:** Mausrad Zoom · Ziehen verschieben · Klick auf Figur oder Raum öffnet das Detail · Doppelklick auf Figur folgt ihr · `F` folgt dem zuletzt gewählten Agenten · `0` Gesamtansicht.
- **Gezeichnet wird, was der Zustand sagt:** Pflanzenstufe, Tür verschlossen/offen, Kamin an/aus, Baustellenfortschritt, Vorratsmenge (Holzstapel, Steine), Gespräch als Punktlinie, benutztes Objekt mit Umriss. Grafik: siehe [assets.md](assets.md).

## Protokoll
`timeline/describeEvent.ts` erzeugt die Sätze (für jeden Ereignistyp, vom Compiler erzwungen; unvollständige Daten fallen auf den Typnamen zurück). Einzelschritte (`agent.moved`), Statuswechsel und der Takt `world.time` sind standardmäßig ausgeblendet (Filter „Schritte“). Mitscrollen pausiert beim Hochscrollen. Klick öffnet das Ereignisdetail mit Ursachen, Folgen und bei Entscheidungen den Optionen mit Punkten.

## Befehle
```bash
cd frontend
npm run dev            # Vite auf 5173 (Backend 8090); SIM_BACKEND und SIM_FRONTEND_PORT überschreiben
npm test               # Vitest
npm run test:e2e       # Playwright: startet Backend mit Fake-LLM (scripts/e2e_server.py) und Vite selbst
npm run typecheck
```
