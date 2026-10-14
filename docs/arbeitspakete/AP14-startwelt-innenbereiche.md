# AP14 – Startwelt nach Mockup A und Innenbereiche

**Auftrag:** Henry, 13.10.2026 („ok, machen wir so“ zum Vorschlag aus AP13) · **Abhängig von:** AP13 · **Vor:** AP12 · **Umfang:** L · **Stand:** vorgezogen und umgesetzt (13.10.2026, Frage 22), Plan: [AP14-plan.md](AP14-plan.md), Bericht: [../status/AP14.md](../status/AP14.md). Punkt 3 (Mockup-Dinge als echte Objekte) folgt als eigenes Paket [AP15](AP15-dinge.md).

## Ziel
Die Welt soll auch im Grundriss aussehen wie Mockup A (`docs/mockups/welt-optik/`, Bilder `A-mischung-*.png`): ein dichtes kleines Dorf mit Haus, Garten, rundem Platz mit Brunnen, See mit Steg und Boot, Wald ringsum. AP13 übernimmt die Darstellung 1:1; die Abweichung, die bleibt, kommt aus der Startwelt (64 × 40 Kacheln, Haus 24 × 13, Garten 17 × 12, Platz 15 × 9, See 18 × 19), siehe `echt-*.png`.

## Inhalt (Vorschlag)
1. **Innenbereiche in der Welt-Engine:** Ein Gebäude ist draußen klein (wie im Mockup, etwa 5 × 5 Kacheln); seine Räume liegen in einem eigenen Innenbereich, verbunden über die Haustür als Übergang. Wegsuche über Übergänge, Wahrnehmung getrennt nach drinnen und draußen (durch Fenster/Tür?), Ereignisse und Orte wie bisher. Gilt für jedes Gebäude, auch für die vom Generator (AP12).
2. **Neue Startwelt** nach dem Plan von Mockup A, mit gleichen Rollen der Orte (Zimmer Alex, Zimmer Mira, Werkstatt, Küche, Wohnzimmer, Garten, Platz, See, Wald, Wege) und gleichen Objekten, damit das Verhalten der Agenten vergleichbar bleibt.
3. **Dinge aus dem Mockup als echte Objekte** statt Dekoration: Laternen (nachts an), Briefkasten, Wegweiser, Vogelscheuche, Boot, Fässer, Sonnenblumen, Schilf, Steine. Was davon Handlungen anbietet, wird festgelegt.
4. Anpassung von Tests (Backend, Browser-Tests mit Positionen), Spielständen (alte Stände bleiben ladbar) und Doku.
5. Frontend: Die Innenansicht aus AP13 zeigt dann den Innenbereich statt des Grundrisses unter dem Haus; der Garten auf dem alten Grundriss entfällt.

## Vor Beginn zu klären
- Größe der Startwelt: genau wie das Mockup (ca. 16 × 12 Kacheln Dorf plus Wald) oder größer mit gleicher Dichte?
- Sehen und hören Agenten durch Fenster und offene Türen nach draußen und umgekehrt?
- Alte Spielstände: weiter mit alter Welt laden oder umwandeln?
