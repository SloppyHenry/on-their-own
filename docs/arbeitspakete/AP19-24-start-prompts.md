# AP19–AP24 – Startprompts (20.10.2026)

Für jedes Teilpaket eine frische Claude-Code-Sitzung im Ordner `<projekt>` starten. Als erste Nachricht kommt der **gemeinsame Teil** und danach der Abschnitt des Pakets (beides zusammen kopieren). Die Pläne sind so geschrieben, dass auch ein kleineres Modell sie Schritt für Schritt abarbeiten kann.

## Gesamtreihenfolge nach AP18 (Vorschlag)
1. AP18a–g, AP18i und AP16a–d wie in [AP18-plan.md](AP18-plan.md#reihenfolge-frage-61-wie-vorgeschlagen)
2. **AP19** Aussehen der Figuren (Schritt 0, a, b, c)
3. **AP18h** Mitleben mit eigener Figur (a, b, c)
4. **AP24** Szenen (Schritt 0, a, b, c)
5. **AP20** Musik-Editor (Schritt 0, a–d); geht auch früher, sobald AP18b fertig ist
6. **AP21** Gegenstände als Daten (a–d)
7. **AP22** Epochen (a, dann je Epoche Schritt 0, 1, 2: b Industrialisierung, c Gegenwart, d Zukunft)
8. **AP23** Baustein-Editor (Schritt 0, a–e)

---

## Gemeinsamer Teil (immer mitkopieren)

Du arbeitest an **Simulacra** (`<projekt>`), einer Simulation, in der KI-Bewohner (Alex, Mira …) in einem Pixeldorf leben. Antworte auf Deutsch. Für jedes Paket gibt es eine neue Sitzung, entschieden wird im Chat.

**Zuerst lesen, bevor du etwas baust:**
1. Dein Gedächtnis (`MEMORY.md`), besonders: Stand, Keine höhere Instanz, Mitspieler-Charaktere, Mockup-Treue, Geteiltes Arbeitsverzeichnis, Skalierung.
2. Den **Plan deines Pakets ganz** (`docs/arbeitspakete/AP<nr>-plan.md`). Er nennt Dateien, Datenformate, Schritte, Tests und Fallen. Halte dich an die Reihenfolge der Schritte.
3. `docs/offene-fragen.md`: die Fragen, die dein Paket nennt. Steht dort „Vorschlag gilt als Arbeitsannahme“, baust du nach dem Vorschlag. Ist etwas wirklich offen, frag die Projektleitung zu Beginn gebündelt mit `AskUserQuestion` (Empfehlung als erste Option).
4. `git status`, `git branch --show-current`, `git log --oneline -15`, `git worktree list`. Lege einen eigenen Branch (`ap/<nr>-name`) in einem eigenen Worktree an (`.claude/worktrees/<nr>`, `backend/.venv` und `frontend/node_modules` verlinken), ausgehend von `main`.

**Leitplanken (nicht verhandelbar):**
- **Keine höhere Instanz:** Die Bewohner merken nie, dass es Spieler, Leitstelle, Editor, Spielart, Epoche oder „Simulation“ gibt. Kein Prompt-Text, keine Erinnerung, kein Ereignis für Bewohner über Eingriffe. Bestehende Tests dafür bleiben grün und werden erweitert.
- **Mitspieler sind Gleiche:** Eine menschlich gesteuerte Figur hat in der Engine keinen Sonderstatus.
- **Das Modell führt nie Code aus.** Neue Funktionen für Dinge gibt es nur als Daten aus dem Baukasten (AP21).
- **Mockup-Treue:** Neue Bilder und Bildschirme erst nach Mockup und Abnahme, dann **1:1** (ganzes Bild, gleiche Abstände, Farben und Texte). Abweichungen legst du offen vor.
- **Die Weltfläche bleibt:** Goldbilder (`e2e/golden.spec.ts`, `e2e/flach.spec.ts`) ändern sich nur, wenn der Plan es ausdrücklich sagt.
- **Geteiltes Arbeitsverzeichnis:** Nie `git add -A` oder `git add .`, nur eigene Dateien einzeln. Den Branch einer anderen Sitzung nicht wechseln. Playwright nutzt `/tmp/simulacra-e2e-run`, also nicht gleichzeitig mit einer anderen Sitzung laufen lassen.
- Dateien unter ca. 400 Zeilen, Oberfläche und Texte auf Deutsch, Umlaute richtig. **Nichts ausrollen** ohne ausdrückliche Freigabe.

**Arbeitsweise für jeden Schritt:**
1. Lies die Dateien, die der Schritt nennt, bevor du sie änderst. Stimmt etwas im Plan nicht mehr mit dem Code überein (Datei umbenannt, Funktion anders), **rate nicht**: Suche die neue Stelle (`grep -rn`), und schreib die Abweichung in den Bericht.
2. Wo der Plan sagt „zuerst sichern“ (Gleichlauf-Test, Pixel-Basis, Noten-Schnappschuss), machst du genau das **vor** jeder anderen Änderung und committest es allein.
3. Nach jedem Schritt die Prüfungen aus dem Plan laufen lassen: `cd backend && .venv/bin/pytest -q`, `cd frontend && npx vitest run`, `npx tsc --noEmit`, die genannten Playwright-Tests (`npx playwright test e2e/<datei>`). Erst wenn alles grün ist, kommt der nächste Schritt.
4. Kleine Commits je Schritt mit Nachricht `AP<nr><teil>: <was>`.
5. Am Ende: Doku pflegen (`docs/frontend.md`, `docs/schnittstellen.md` und was das Paket nennt), Statusbericht `docs/status/AP<nr><teil>.md` mit Bildern, echten Testzahlen und dem Weg, es anzusehen; Fragen mit Datum in `docs/offene-fragen.md`; Gedächtnis (Stand) aktualisieren. Danach Abnahme abwarten, **nicht** selbst nach `main` zusammenführen.

---

## AP19 – Aussehen der Figuren (Avatar-Editor)
**Plan:** [AP19-plan.md](AP19-plan.md). **Fragen:** 64, 65.
**Je Sitzung:** Schritt 0 (Mockup `docs/mockups/avatar.html`, kein Anwendungscode) → a (Daten und Zeichnen, keine sichtbare Änderung; zuerst `e2e/figuren-basis.spec.ts` auf dem alten Code) → b (Editor) → c (im Spiel und neue Teile).
**Fertig, wenn:** Alex und Mira Pixel für Pixel gleich sind, eine neue Figur im Editor gestaltet, als Vorlage gespeichert, in einer Simulation gestartet und in Welt, Bewohnerleiste und Karte richtig gezeigt wird, und kein Prompt ein Wort über das Aussehen enthält.

## AP20 – Musik-Editor
**Plan:** [AP20-plan.md](AP20-plan.md). **Frage:** 66.
**Je Sitzung:** Schritt 0 (Mockup `docs/mockups/musik.html`) → a (Noten als reine Funktion, zuerst Schnappschuss `klang/noten.test.ts`) → b (Bibliothek und Zuordnung im Backend) → c (Editor) → d (Motive zeichnen).
**Fertig, wenn:** Die fünf Standardstücke dieselben Noten wie vorher liefern, ein eigenes Stück gebaut, vorgehört, dem Regen zugeordnet und im Spiel bei Regen gespielt wird, und Export/Import byte-gleich sind.

## AP21 – Gegenstände als Daten
**Plan:** [AP21-plan.md](AP21-plan.md). Keine offenen Fragen; keine sichtbare Änderung.
**Je Sitzung:** a (zuerst `tests/world/test_katalog_gleichlauf.py` auf dem alten Code, dann Katalog mit Handlern) → b (Baukasten, einfache Modi als Daten, nach **jedem** Modus Gleichlauf) → c (Optionen, Frontend, Typen) → d (Anleitung `docs/dinge-katalog.md`, Regentonne als Probe, Härtung).
**Fertig, wenn:** Der Gleichlauf-Test nach jedem Teilpaket grün ist und die Regentonne aus dem Fixture-Paket ohne eine Zeile Python funktioniert.

## AP22 – Epochen
**Plan:** [AP22-plan.md](AP22-plan.md). **Fragen:** 67–69. **Voraussetzung:** AP21 fertig.
**Je Sitzung:** a (Mittelalter wird ein Paket, nichts ändert sich sichtbar) → je Epoche (b Industrialisierung, c Gegenwart, d Zukunft) **drei** Sitzungen: Schritt 0 (Mockup „Bild A“ der Epoche, Katalogvorschlag als `AP22<x>-<id>.md`, Abnahme), Schritt 1 (Daten und Bild), Schritt 2 (Generator, Probelauf, Bericht).
**Fertig, wenn:** (a) Gleichlauf, Goldbilder und Generator-Fixtures unverändert sind und die Epoche im Spielstand steht; (b–d) man in Neue Simulation die Epoche wählt und ein erzeugtes Dorf der Epoche dem abgenommenen Mockup entspricht und bespielbar ist.

## AP23 – Baustein-Editor
**Plan:** [AP23-plan.md](AP23-plan.md). **Fragen:** 70, 71. **Voraussetzung:** AP21, AP18e, AP16, AP22a.
**Je Sitzung:** Schritt 0 (Mockup `docs/mockups/bausteine.html`) → a (Format, Bibliothek, Zeichnen im Spiel) → b (Pixel-Editor) → c (Funktionen, Prüfung, Probelauf, Werkstatt, Bauvorlage) → d (Gebäude und Räume) → e (Figurenteile, braucht AP19).
**Fertig, wenn:** jemand eine Schaukel zeichnet, ihr „schaukeln“ gibt, Prüfung und Probelauf bestehen, sie in der Werkstatt setzt und ein Bewohner im Spiel darauf schaukelt.

## AP24 – Szenen
**Plan:** [AP24-plan.md](AP24-plan.md). **Frage:** 72. **Voraussetzung:** AP18i.
**Je Sitzung:** Schritt 0 (Mockup `docs/mockups/szenen.html`, Abnahme je Szene) → a (Backend: Katalog, Operation `scene`, Wahrnehmung) → b (Szenen-Schicht im Bild) → c (Feuer, Tornado, Meteor).
**Fertig, wenn:** In einem Lauf mit Ereignissen „oft“ Gewitter mit Blitz, umgestürzter Baum und Sternschnuppen sichtbar sind, die Bewohner darauf reagieren und kein Prompt einen Urheber nennt.
