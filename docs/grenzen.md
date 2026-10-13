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

- **Optik** ist noch nicht abgenommen (offene Frage 16, u. a. das geschlossene Haus wirkt zu groß); vorgemerkt für nach den Funktionspaketen.
- Beim Wechsel in den Gedächtnis-Inspektor wird die Welt neu aufgebaut (Kameraposition geht verloren).
- Nebenfiguren und Tiere haben eine Standardfigur.

## Ideen (nicht beauftragt)

1. **Prüfstand für KI-Verhalten:** ein Modus mit weniger Vorsortierung (z. B. alle gültigen Optionen ohne Rangfolge, oder nur freie Handlungen), damit sichtbar wird, was das Modell selbst tut; dazu ein Vergleich zweier Läufe (gleiche Startwelt, anderes Modell oder andere Einstellung) mit Kennzahlen nebeneinander.
2. **Mitspieler** (offene Frage 11): Menschen steuern eigene Figuren, die KIs sehen sie als gleichwertige Bewohner.
3. **Weltgenerator** (AP12) und Hochskalieren auf mehr Figuren (Ereignisse sind dafür bereits verdichtet).
4. **Semantische Erinnerungssuche** mit kleinem Embedding-Modell.
5. **Zweiter Modell-Slot** oder Batch-Entscheidungen, wenn mehr Agenten dazukommen.
