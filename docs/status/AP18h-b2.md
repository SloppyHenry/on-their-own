# AP18h-b2 – Benutzen und Sagen (Frontend, 22./23.10.2026)

Branch `claude/ap18h-b1-figur-gehen-8d8c59` (auf b1 aufgebaut), nicht in `main`.

- **Benutzen** (`hud/Benutzen.tsx`, Taste `U`): Liste aus `GET /api/player/choices`, gruppiert nach Handlungsart, mit Dauer; Unmögliches bleibt sichtbar mit Grund der Engine. Auswahl über ↑↓/Enter oder Klick, schickt `POST /api/player/act`. Möglichkeiten mit Text (Sprechen) öffnen die Sagen-Zeile.
- **Sagen und Antworten** (`hud/Sagenzeile.tsx`, Taste `T`): Empfänger aus der Nähe (Tab wechselt, sonst der gewählte Bewohner). Spricht dich jemand an, steht die Zeile von selbst da mit „X wartet auf deine Antwort“ und Zähler (60 echte Sekunden, Frage 83; das Backend-Ende der Frist folgt mit a3). Das Gesagte erscheint als normale Sprechblase.
- `T` ist mit eigener Figur „Sagen“ (Tagebuch über die Schaltfläche).
- **Fehler behoben:** Startet das Spiel mit der Figur im Haus, ging die Kamera vor dem ersten Außenbild ins Haus und die Ansicht stürzte pro Bild ab (`bild.frame` null; keine Schilder, keine Blasen). `DorfView.follow` wartet jetzt auf das erste Bild.
- Tests: `e2e/mitleben-benutzen.spec.ts` (Liste, Sagen, Antwortzeile), dazu b1-Tests und world/kamera grün.
