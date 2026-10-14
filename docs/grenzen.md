# Bekannte Grenzen und Ideen

Was SIMULACRA bewusst vereinfacht, was gemessen nicht ideal ist und was als Nächstes sinnvoll wäre. Einzelheiten stehen in den Statusberichten (`docs/status/AP*.md`).

## Verhalten der Agenten

- **Das Modell wählt meist aus vorsortierten Optionen.** Die Engine erzeugt alle jetzt gültigen Handlungen, bewertet sie (Persönlichkeit, Bedürfnisse, Ziele, Tageszeit, Wiederholung) und gibt dem Modell die besten 6 mit Rangfolge-Hinweis (`rank_hint`, Standard an). Freie Handlungen sind möglich, kommen aber selten vor. **Beobachtetes Verhalten ist also Modell plus Bewertungslogik**, nicht das Modell allein. Wer das Modell selbst untersuchen will, braucht einen Modus mit weniger Vorgaben (siehe Ideen).
- **Das 9B-Modell folgt Zielen nur mäßig:** ohne Rangfolge-Hinweis wählte es die bestbewertete Option in 9–24 % der Fälle, mit Hinweis in 52–58 % (AP07). Ziele kommen dadurch langsam voran und werden nach Stunden ohne Fortschritt aufgegeben (gewollt: das Modell ist frei, die Welt entscheidet).
- **Einsichten** (Reflexion) sind beim 9B-Modell teils grüblerisch und wiederholen Themen; Quellenpflicht und Wiederholungsschutz begrenzen das.
- **Schlafen** gibt es seit AP11 auch außerhalb des Zimmers als Weg „zum Schlafen ins Bett“. Im Langlauf mit echtem Modell gingen die Agenten öfter zum Bett (77 ×) als sie einschliefen (17 Schlafphasen in 7,4 Sim-Tagen); die Gewichtung ist noch nicht fein abgestimmt.
- **Tageszusammenfassungen sind regelbasiert**, nicht vom Modell formuliert (spart Last, liest sich nüchtern).
- **Nebenfiguren** (z. B. „Ein Fremder zieht ein“) haben kein Gedächtnis und keine Ziele, nur einfache Regeln; in der Oberfläche als solche gekennzeichnet.
- **Kein Vorrang für Betroffene:** Ein Benutzerereignis wirkt bei der nächsten regulären Entscheidung, nicht sofort.
- **Wiederholungsschutz** sperrt gleiche Handlungen mit gleichem Ziel nach 3 Wiederholungen, **nimmt aber Warten und Gesprächszüge aus** (sie verändern die Welt nicht). Im Fake-Langlauf entstehen nachts, wenn nur „ausruhen“ und „warten“ angeboten werden, längere Warte-Serien ([status/langlauf.md](status/langlauf.md)). Mit dem echten Modell wurden bisher keine solchen Serien beobachtet.

## Gedächtnis

- **Keine semantische Suche:** Abruf über Stichwörter (FTS5, deutsche Grobstammbildung), Person, Ort, Aktualität und Wichtigkeit. Reicht für die kleine Welt; Embeddings bleiben vorgemerkt.
- **Obergrenze aktiver Erinnerungen** (`SIM_MEM_MAX_ACTIVE`, 2000) greift einmal je Sim-Tag bei der Pflege; dazwischen wächst der Bestand. Einsichten, Zusammenfassungen und offene Vorhaben werden dabei nie archiviert. Gelöscht wird nie etwas.

## Leistung und Größe

- **Ein Modell-Slot:** Agenten entscheiden nacheinander. Gemessen mit Qwen 9B auf einer RTX 3060 (SecondTux): Ø 4 s je Entscheidung, ca. 11 Entscheidungen pro Minute für beide zusammen ([status/langlauf.md](status/langlauf.md)). Jeder weitere Agent verlangsamt den Takt anteilig; ein zweiter Slot (`parallel = 2`) würde helfen, kostet aber VRAM (offene Frage 4).
- **Zwei KI-Agenten** sind der getestete Umfang. Ein dritter Agent läuft im Zyklus mit (Tests), ein Langlauf mit drei oder mehr steht aus.
- **Karte** kann nur wachsen (bis 256 × 256), Objektarten nur hinzukommen.
- **Zeitabhängige Tests** messen Takte in Echtzeit und können unter hoher Last (paralleler Compiler-Lauf) fehlschlagen; einzeln wiederholt laufen sie grün.

## Modell und Betrieb

- **Modell je Simulation fest** (offene Frage 10): Wechsel nur über eine neue Simulation. Zwei Modelle nebeneinander vergleichen geht nur über zwei getrennte Läufe, ein Vergleichswerkzeug gibt es nicht.
- **Bonsai 27B** liefert auf maintux nur `////…` (ungeklärt, [llm-anbindung.md](llm-anbindung.md)); Standard ist Qwen 9B.
- **Python 3.14** in Entwicklung und Container; 3.12 (Auftrag) ist erlaubt, aber nie gelaufen.
- **Zugangsschutz** ist ein gemeinsames Token über HTTP ohne TLS, gedacht fürs Heimnetz, keine Benutzerverwaltung. Die Rate-Grenze für freie Eingaben (10/min) und für Anmeldungen gilt im Speicher und beginnt nach einem Neustart neu.
- **Kein Rückspulen** (optional laut Auftrag): Laden eines Spielstands oder Autosaves ist das Zurückspringen.
- **Kein nächtliches Backup** ohne Freigabe; Backup und Wiederherstellung von Hand ([betrieb.md](betrieb.md)).
- **Neustart von maintux** als Teil der AP10-Abnahme ausgesetzt (Entscheidung Henry); der Container hat `restart: unless-stopped`, Docker startet beim Hochfahren.

## Oberfläche

- **Welt nach Mockup A (AP14):** Das Dorf ist so klein wie im Bild (etwa 16 × 12 begehbare Kacheln, dazu der Waldrand), Wege sind entsprechend kurz. Figuren stehen auf Kacheln, die Dinge aus A an ihren Bildstellen; die Startplätze von Alex und Mira liegen darum bis zu 10 Pixel neben denen im Bild. Laternen, Briefkasten, Fässer, Büsche, Sonnenblumen, Tomaten, Schilf, Boot und Vogelscheuche sind Deko aus `look`, keine Objekte mit Handlungen. Der Gartenzaun sperrt ganze Kacheln. Was eine Welterweiterung (`extend_map`, Patches) außerhalb des Bildausschnitts von A anlegt, ist in der Dorfansicht nicht zu sehen. Alte Spielstände ohne `look` zeigen die Ansicht aus AP13.
- **Browser-Tests** beginnen wie bisher mit Alex und Mira in Alex' Zimmer (`scripts/e2e_server.py`); die echte Startwelt hat beide draußen (Garten und Platz) wie Bild A.
- **Deko ohne Zustand:** Laternen, Briefkasten, Fässer, Büsche am Haus, Schilf, Steine, Boot, Vogelscheuche und Sonnenblumen sind bis AP14 nur gezeichnet; Agenten kennen sie nicht.
- **Ohne Grafikkarte** (Software-Rendering, z. B. Browser in einer VM): Die Dorfansicht (AP14) hält 60 fps. In der Ansicht für Welten ohne `look` kostet die Tilt-Shift-Unschärfe viel: gemessen 25–30 fps in „Tiefe“, 58 fps in „Flach“. Abhilfe: „Flach“ wählen oder reduzierte Bewegung einschalten (dann ohne Tilt-Shift und Teilchen). Mit Grafikkarte überall 60 fps (`docs/status/messung/ap13-leistung-gpu.json`).
- **Ferne Böden** werden in gröberen Stufen gelesen; feine Muster (Pflaster) erscheinen in der Gesamtansicht als ruhige Fläche.
- **Innenansicht** (Puppenhaus) ordnet Räume nach ihrer oberen Kante in Reihen; Räume, die eine Reihe nur teilweise überdecken, bekommen keine eigene Rückwand. Wandschmuck und Einrichtung stehen fest in `look.interior` der Weltdatei und wandern nicht mit, wenn Agenten Möbel bauen oder abreißen. Der Kamin leuchtet nur, wenn er in der Simulation brennt (im Mockup nach Tageszeit).
- **Dinge im Dorf** (AP15): Laternen und Lampen schalten nur die Agenten; vergessen sie es, bleibt das Dorf abends dunkel (so gewollt). Im Probelauf mit dem Fake-Modell, das immer die bestbewertete Option nimmt, blieben die Laternen dunkel, weil die Agenten abends im Haus waren; darum bekommen Agenten, die abends draußen sind, den Gang zur nächsten dunklen Laterne angeboten. Briefe merkt man erst am Briefkasten („Post für dich“), niemand wird benachrichtigt. Die Kachel eines Dings ist für Wege und Wahrnehmung da; Dinge auf Mauer, Zaun oder Wasser (Briefkasten, Regentonnen, Vogelscheuche, Boot) stehen logisch auf der nächsten passenden Kachel. Die Katze ist ein Ding, keine Figur: Sie springt zwischen ihren Plätzen, statt zu laufen.
- **Kamera durch die Welt (AP12a):** Beim Fahren kostet ein Bild etwa 2,5 ms Rechenzeit (95 %: 5,7 ms) mit Grafikkarte im großen Retina-Fenster 2560 × 1300 (60 fps, [status/messung/ap12a-nachbesserung-leistung-gpu-retina.json](status/messung/ap12a-nachbesserung-leistung-gpu-retina.json)); vorher 10 ms. Im Stillstand 0,2 ms. Die Zeichenfläche ist so groß wie das Fenster; Sprites ändern ihre Größe mit der Tiefe (wie in A), beim Fahren nach vorn und hinten springen sie dadurch in Stufen. Herausgezoomt (½×, ¼×) hat der Boden keine Gräser und Schatten, die Wölbung des Horizonts bleibt im Stillstand wie in A. Die Startwelt zeichnet außerhalb ihres Originalblocks keine Gräser (`legacy.plainOutside`), damit Bild A Pixel für Pixel gleich bleibt.
- **Mitspieler-Vorschau** sendet nichts; die Vorschau-Figur bewegt sich nicht, gesperrte Kacheln aus Regeln (`forbidden`) kennt die Wegsuche im Browser nicht.
- Beim Wechsel in den Gedächtnis-Inspektor wird die Welt neu aufgebaut (Kameraposition geht verloren).
- Nebenfiguren und Tiere haben eine aus der Kennung abgeleitete Figur.

## Ideen (nicht beauftragt)

1. **Prüfstand für KI-Verhalten:** ein Modus mit weniger Vorsortierung (z. B. alle gültigen Optionen ohne Rangfolge, oder nur freie Handlungen), damit sichtbar wird, was das Modell selbst tut; dazu ein Vergleich zweier Läufe (gleiche Startwelt, anderes Modell oder andere Einstellung) mit Kennzahlen nebeneinander.
2. **Mitspieler** (offene Frage 11): Menschen steuern eigene Figuren, die KIs sehen sie als gleichwertige Bewohner.
3. **Weltgenerator** (AP12) und Hochskalieren auf mehr Figuren (Ereignisse sind dafür bereits verdichtet).
4. **Semantische Erinnerungssuche** mit kleinem Embedding-Modell.
5. **Zweiter Modell-Slot** oder Batch-Entscheidungen, wenn mehr Agenten dazukommen.
