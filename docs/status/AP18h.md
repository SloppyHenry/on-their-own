# AP18h – Mitleben mit eigener Figur: Abschluss (23.10.2026)

Alle Teilschritte stehen auf dem Branch `claude/ap18h-b1-figur-gehen-8d8c59` (aufbauend auf a1/a2 in `main`), nicht gemergt, nicht ausgerollt. Einzelberichte: [b1](AP18h-b1.md), [b2](AP18h-b2.md), [b3](AP18h-b3.md). Bedienung: [mitleben.md](../mitleben.md), Schnittstellen: [schnittstellen.md](../schnittstellen.md).

| Schritt | Stand |
|---|---|
| a1, a2 | in `main` (Grundlage, Handeln) |
| a3 Takt | Anhalten, Autopilot (echte Minuten), Antwortfrist 60 s echte Zeit, Schalter-API, Ereignis `simulation.player_takt`; `tests/player/test_takt.py` |
| b1 Figur und Gehen | Ring, Kamera folgt, Handlungsleiste, Klick geht |
| b2 Benutzen und Sagen | Liste aus `choices`, Sagen-Zeile, Antwortzeile mit Zähler |
| b3 Gepäck und Bauen | Gepäck (Ablegen, Geben, Essen), Bauvorlagen |
| c1 Einrichten | Assistent „Leben mit eigener Figur“ und „Das bist du“, `NewSimRequest.player`, Einstellungen › Eigene Figur (Schalter, Wechseln) |
| c2 Härtung | Test „ein Spieltag mit Autopilot“ (lückenlose Ereignisnummern, nie hängend), Doku |

## Abweichungen und offene Punkte
- Autopilot bei fehlendem Browser (Plan, Festlegung 4): Ist 30 Sekunden lang kein Browser verbunden (`ABSENT_SECONDS`), schaltet der Autopilot sofort ein, sofern erlaubt; Gesprächsschutz und „Anhalten, wenn ich dran bin“ greifen dann nicht, damit die Welt nicht stehen bleibt. Kürzere Neuverbindungen zählen nicht. Bewusst nicht gebaut: Ist der Autopilot nicht erlaubt, geht die Figur nachts nicht ins eigene Bett, sondern bleibt stehen.
- `scripts/langlauf.py --mode fake` wurde nicht eigens gelaufen; ersetzt durch den pytest-Tag mit Autopilot.
- Esc: Abbrechen einer Handlung hat nur den Knopf; Esc gehört dem Menü. Folgt die Kamera der Figur, beendet Esc aus dem Haus das Folgen.
- Fehler behoben (b2): Start mit der Figur im Haus ließ die Ansicht pro Bild abstürzen.
