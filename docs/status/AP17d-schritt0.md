# AP17d – Schritt 0: Mockup Musik und Klänge

Plan: [AP17-plan.md](../arbeitspakete/AP17-plan.md) (AP17d), Frage 34: Henry wollte **beide Varianten vorher hören**, Klänge aus Code und CC0. Gebaut ist nur das Mockup, im Spiel ist nichts davon.

**Ansehen:** `docs/mockups/klang.html` im Browser öffnen (per Doppelklick, braucht kein Netz; seit der zweiten Fassung liegen Skripte und eingebettete Aufnahmen in `docs/mockups/klang/`, damit keine Datei über 400 Zeilen hat). Erst „Ton einschalten“ klicken (Browser erlauben Ton nur nach einem Klick), Lautstärke am Rechner moderat.

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

## Zweite Fassung (18.10.2026)
Henry: Code-Klänge „ganz okay, da geht noch mehr“, Stimmen-Tests „funktionieren noch nicht sauber“.

**Was an den Stimmen-Tests nicht stimmte (gemessen):**
- Im Reiter „Stimmen“ lief das Dorf weiter: Musik, Umgebung und zufällige Gespräche übertönten den Test. Jetzt schweigt das Dorf, sobald ein anderer Reiter offen ist (gemessen: −57 dB).
- Die Stimmen waren rund 10 dB leiser als Schritte, je nach Klangfarbe bis zu 13 dB verschieden (Mira „weich“ laut, Jo „rau“ kaum hörbar). Jetzt rechnet `loudness()` den Pegel aus dem Frequenzgang der Formantfilter aus: alle Klangfarben, Tonhöhen (85–300 Hz) und Größen liegen innerhalb von ±3 dB, eigener Regler „Stimmen“ im Mischpult.
- Zweimal klicken legte zwei Stimmen übereinander, „Alle nacheinander“ wartete fest 4,2 s (überlappte oder ließ Lücken), es gab kein Stopp. Jetzt: eine Stimme je Figur, Gespräche warten auf das Ende der vorigen Zeile, Stopp und Reiterwechsel machen sofort still.
- Die Tonhöhe sprang je Silbe zufällig; der Satz war kaum zu erkennen. Jetzt fest aus dem Text (gleicher Satz klingt gleich).

**Stimmen neu (`klang/stimmen.js`):** ein durchgehender Klang je Äußerung statt eines Tons je Silbe: Oszillator mit Klangfarbe, drei Formantfilter, die von Vokal zu Vokal gleiten (auch ei, au, eu), Rauschzweig für Konsonanten (s und sch zischen, t, k, p knacken, m, n, l, r summen, h haucht). Satzmelodie: Betonung auf der Stammsilbe (nach be-, ge-, ver- … auf der zweiten), Füllwörter leiser, Absinken über den Satz, Ja/Nein-Frage steigt, W-Frage und Aussage fallen nach der letzten Betonung, Komma hebt leicht und hält an, Ausruf weiter und lauter, „…“ verklingt. Lange KI-Texte: Stimme nach 36 Silben (~8 s) ausgeblendet, die Blase zeigt alles. Der Text läuft in der Blase silbengenau mit. Regler: Tonhöhe, Tempo, Größe (Vokalfarbe), Lebhaftigkeit, Hauch, Klang (weich, klar, rau, hohl, piepsig), Art (Plappern, Summen, Piepsen je Buchstabe). Beispielsätze für jede Satzart, Gespräch aller drei.

**Geräusche:** Schritte mit Ferse und Ballen und Fußwechsel (Gras knirscht aus vielen Körnern, Holz klingt hohl mit Bohlenmoden und knarrt selten, Stein klickt mit Sand); Tür mit Riegel, Knarren aus Haftreibung und Raumhall beim Zuschlagen; Topf mit Metallmoden, Deckelklappern, Brutzeln; Münzen als einzelne Metallscheiben im Stereobild; Holzhacken mit Schwung, Holzkörper, manchmal Spalten. Neu: Buch, Tuch, Schloss (mit CC0-Vergleich), Gießkanne, Schlafen.

**Umgebung:** Regen in zwei Kanälen mit Tropfen und Pfützen, Wind mit unregelmäßigen Böen und Pfeifen, Vögel mit eigenen, wiederholten Liedern (drei Arten, Taube am Morgen), Grillen, Eule, Bienen, Bach mit Blasen, Feuer mit Knistern und Knacken, fernes Gewitter. Je Tageszeit eine andere Mischung (Morgen viele Vögel, Mittag Bienen, Abend Grillen und Kamin, Nacht Grillen und Eule).

**Musik:** Stücke mit Form statt Zufallstönen: Akkordfolge je Tageszeit, Motive A A′ B A″, Schluss auf dem Grundton; jeder Durchlauf neues B. Melodie mit Echo und Vibrato, Fläche, laufender Bass, leichtes Schlagwerk (Abend mit Besen und Swing, Nacht Spieluhr). Bei Regen gedämpft und langsamer (Dur-Stücke in Moll). Pegel auf die CC0-Stücke abgeglichen (vorher Spitzen bis 0,92).

**Szene:** Klänge kommen von der Figur (links/rechts, nah/fern leiser und dumpfer, wie im Plan „leiser mit Entfernung“), Gespräche mit Antwort, beim Sprechen treten Musik und Umgebung zurück, Pegelanzeige im Kopf.

**Geprüft:** keine Konsolenfehler in allen Reitern, Tageszeiten, Wetterlagen und beiden Quellen; Pegel aller Code-Klänge mit Analysatoren je Kanal gemessen und auf die CC0-Gegenstücke abgeglichen; Gespräch, Unterbrechen, Stopp, Reiterwechsel, Sonderfälle (leerer Text, Zahlen, „Hm.“, Großschrift, Sonderzeichen). **Nicht geprüft:** wie es klingt – ich kann nicht hören. Bitte besonders Stimmen (alle drei Arten), Tür, Schritte und Musik anhören.
