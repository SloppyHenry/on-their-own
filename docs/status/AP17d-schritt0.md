# AP17d – Schritt 0: Mockup Musik und Klänge

Plan: [AP17-plan.md](../arbeitspakete/AP17-plan.md) (AP17d), Frage 34: Henry wollte **beide Varianten vorher hören**, Klänge aus Code und CC0. Gebaut ist nur das Mockup, im Spiel ist nichts davon.

**Ansehen:** `docs/mockups/klang.html` im Browser öffnen (eine Datei, ca. 2,9 MB, alles eingebettet, braucht kein Netz). Erst „Ton einschalten“ klicken (Browser erlauben Ton nur nach einem Klick), Lautstärke am Rechner moderat.

## Aufbau
- **Im Dorf:** das Dorf aus dem Menü-Mockup mit Tageszeit (Morgen, Mittag, Abend, Nacht) und Wetter (klar, Regen), „Das Dorf lebt“ spielt Schritte, Türen, Töpfe, Münzen, Holzhacken und Gespräche in Zufallsfolge, dazu Knöpfe für jedes Ereignis. **Mischpult:** Musik, Umgebung, Figuren, je Kanal Lautstärke und Quelle **Code | CC0** umschaltbar (live).
- **Einzelklänge:** 12 Klänge, je ein Knopf „Code“ und „CC0“ zum direkten Vergleich (Dauerklänge laufen 9 Sekunden oder bis zum zweiten Klick).
- **Stimmen:** Plappern aus Code. Jede Figur (Alex, Mira, Jo) hat Tonhöhe, Tempo und Klangfarbe, der Satz bestimmt Silben, Betonung und Satzmelodie (Frage steigt, Punkt fällt). Eigener Text, Regler live.
- **Musik:** je Tageszeit ein Stück aus Code (Pulswelle, Dreieck-Bass, Rauschen als Becken, Tonart und Tempo je Tageszeit, ändert sich leicht bei jedem Durchlauf; Nacht mit Nachhall und Glockentönen) und je ein CC0-Stück (Morgen, Mittag, Abend).
- **Quellen:** Liste mit Herkunft und Lizenz (auch in `docs/assets.md`).

## Aus Code erzeugt (Web Audio, ohne Dateien)
Schritte auf Gras, Holz und Stein; Tür auf und zu (Knarren, Schlag); Topf mit Zischen; Münzen; Holzhacken; Regen, Wind, Vögel, Wasser, Feuer; Plapperstimmen; Chiptune-Musik.

## CC0 (heruntergeladen, Lizenz geprüft)
Kenney „Impact Sounds“ und „RPG Audio“, Juhani Junkala „JRPG Pack 4 Calm“, Spring Spring „Birds and Wind“, Ylmir „Rain (loopable)“, rubberduck „30 CC0 SFX loops“. **Fehlt in CC0:** knisterndes Feuer und einzelne Vogelrufe; **Stimmen:** fertige CC0-Stimmen sind gesprochene Sätze, passen nicht zu freiem KI-Text.

## Geprüft und nicht geprüft
- Geprüft im Browser: Die Seite lädt ohne Konsolenfehler, alle 20 Aufnahmen werden dekodiert, der Audiokontext läuft, jeder Klang erzeugt messbaren Pegel (Analysator am Ausgang, Code- und CC0-Varianten auf ähnliche Lautstärke abgeglichen), die Reiter funktionieren.
- **Nicht geprüft: wie es klingt.** Das kann ich nicht hören. Ob die Code-Klänge gefallen (besonders Schritte, Tür, Stimmen und die Musik), ob die CC0-Stücke zum Spiel passen und welcher Weg es werden soll, entscheidest du beim Anhören.

## Frage an dich
Frage 34 (Code oder CC0 oder gemischt) kann nach dem Anhören beantwortet werden. Mein Vorschlag nach dem Plan: Stimmen und Geräusche aus Code, Musik und Umgebung je nach Gefallen.
