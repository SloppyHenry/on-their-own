# AP18h-b3 – Gepäck und Bauen (Frontend, 23.10.2026)

- **Bauen** (Taste `B`, Leiste): dieselbe Liste wie Benutzen, gefiltert auf `build` und „Bau fortsetzen“; die Bauvorlagen stehen mit Kosten da, Unmögliches mit dem Grund der Engine (zu wenig Rohstoffe, Sturm, Werkbank …).
- **Gepäck** (Taste `I`, `hud/Gepaeck.tsx`): Hände (getragene Dinge) und Rucksack (Vorräte aus `inventory`) mit **Ablegen**, **Geben an …** (nur wer am selben Ort steht) und **Essen**; schickt `drop`, `give`, `eat` über `/api/player/act`.
- Hilfe um die Tasten ergänzt. Test: `e2e/mitleben-benutzen.spec.ts` (B, I, Geben).
- Hinweis: Das Ablegen von Rohstoffen aus dem Rucksack gibt es in der Engine nicht (`drop` nimmt nur Dinge); dort stehen nur Geben und Essen.
