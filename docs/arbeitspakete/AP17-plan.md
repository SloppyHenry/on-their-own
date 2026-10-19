# AP17 – Bedienung, Startmenü, Modelle im Tool, Klang (Plan, 15.10.2026)

**Auftrag:** Henry, Rückmeldungen aus dem Spiel vom 15.10.2026. **Umfang:** L, fünf Teilpakete. **Status:** Sofortkorrekturen umgesetzt (unten), der Rest ist Plan; vor dem Bau brauchen die Fragen 31 bis 36 in [offene-fragen.md](../offene-fragen.md) deine Antwort.

## Grundsatz (Henry, 15.10.2026)
**Die Agenten dürfen nicht merken, dass es eine höhere Instanz gibt.** Gestaltet wird trotzdem auch im laufenden Spiel, und zwar **wie der Baumodus bei Sims**: ein eigener Editor-Modus, in dem die Zeit stillsteht.
- **Betreten hält die Simulation an** (die Uhr steht, keine Entscheidungen), **Verlassen setzt sie fort**, wenn sie vorher lief. Änderungen werden beim Übernehmen in einem Zug angewendet, mit Sicherung davor (wie AP12c).
- **Für die Agenten ist die Welt danach einfach so**, wie sie ist: kein Ereignis, keine Erinnerung und kein Prompt-Text, der einen Eingriff verrät („die Welt wurde verändert“, „ein Haus erschien“). Das Protokoll der Leitstelle zeichnet die Änderung auf, die Agenten sehen sie nicht.
- Was eine Figur gerade belegt (Kachel, getragenes oder benutztes Ding), lässt sich nicht überbauen; ein laufender Weg, der durch Umbau ungültig wird, wird neu geplant, ohne dass die Figur „bemerkt“, warum.
- Der Editor ist erreichbar aus dem Startmenü (vor Beginn einer Runde, auch im Assistenten „Neue Simulation“) **und** im Spiel über „Welt gestalten“.
- Ereignisse aus der Ereigniseingabe (Regen, ein Fremder zieht ein) erscheinen als natürliche Vorgänge der Welt. Einblicke (Verlauf, Statistik, Gedächtnis) sind reine Beobachtung.
- Prüfung: Ein Test stellt sicher, dass Prompts und Erinnerungen nach Umbau, Welt-Erzeugung, Spielstand-Laden und Einblicken keine Hinweise auf Leitstelle, Editor, Spieler oder Simulation enthalten.

## Rückmeldungen und Einordnung

| # | Rückmeldung | Einordnung |
|---|---|---|
| 1 | Figuren liegen aufeinander, man sieht nur eine | **erledigt** (Sofortkorrektur) |
| 2 | Gehen in Schüben („5er-Schritte“), kein durchgehender Gang | **erledigt** (Sofortkorrektur) |
| 3 | Schilder „denkt“, „erinnert sich“ unspezifisch, „geht Wohnzimmer“ liest sich schlecht | **erledigt** (Sofortkorrektur) |
| 4 | Bewohnerkacheln zu groß, Protokoll kaum lesbar → Reiter rechts | **erledigt** (Sofortkorrektur) |
| 5 | Ansicht Flach/Tief als eigener Reiter mit passenden Einstellungen | **erledigt** (Reiter „Ansicht“); weitere Einstellungen dort mit AP17a |
| 6 | Kopfzeile: Verbindung und Modell nicht zu sehen | **erledigt** (Status rechts immer sichtbar); Neuordnung der Kopfzeile mit AP17a |
| 6a | Verlauf, Statistik, Gedächtnis in ein Untermenü | **erledigt** (Untermenü „Einblicke“) |
| 6b | Agenten merken keine höhere Instanz; Gestalten als Editor-Modus wie bei Sims | Grundsatz oben; AP16, AP17a |
| 7 | Startmenü: Neue Simulation, Laden, Welteditor, Charaktereditor, Einstellungen | AP17a |
| 8 | Simulation selbst definieren | AP17b |
| 9 | LLM im Tool auswählen und herunterladen; „All-inclusive-Paket“ | AP17c |
| 10 | Hintergrundmusik und Klänge für die Figuren | AP17d |

## Sofortkorrekturen (15.10.2026, ohne Frage, im Arbeitsverzeichnis)
- **Gang:** Die Figur läuft nicht mehr einen Kachelschritt in 0,5 s und steht dann 1,5 s, sondern verteilt den restlichen Weg auf den gemessenen Abstand bis zum nächsten Schritt der Simulation (mit etwas Nachlauf). Gemessen bei 1×: vorher 0,5 s Gehen und 1,5 s Stehen je Kachel, jetzt durchgehend. `world/view/figures.ts`, Test `figures.test.ts`.
- **Auseinanderrücken:** Wer ruhig auf derselben Kachel steht, rückt seitlich auseinander (zwei Figuren 10 px, bleibt auf der eigenen Kachel); beim Gehen und Schlafen nicht.
- **Schilder:** „→ Wohnzimmer“ statt „geht · Wohnzimmer“; „überlegt: …“ mit dem nächsten Plan statt „entscheidet“; „ohne Vorhaben“ statt „frei“; Gedächtnis-Hinweis mit Inhalt („＋ merkt sich: …“, „↺ erinnert sich an: …“) statt nur „gemerkt“.
- **Infoleiste mit Reitern** Bewohner · Protokoll · Ansicht (je Gerät gemerkt), jeder mit voller Höhe. Bewohnerkarten verdichtet (kleineres Bild, Stimmung in der Kopfzeile, Ziel einzeilig). Wo die Infoleiste fehlt (Welteditor, eingeklappt), steht der Ansichtsschalter wie bisher über der Welt.
- **Untermenü „Einblicke“** (Verlauf, Statistik, Gedächtnis) statt dreier Knöpfe; ist ein Einblick offen, führt „← Zur Welt“ zurück. Infoleiste als kleines Symbol (» / «). Bei 1440 px passt die Kopfzeile jetzt ohne Rollen.
- **Kopfzeile:** Verbindung und Modell stehen rechts als fester Statusknopf (Klick öffnet Einstellungen → Status); die Bereichsknöpfe rollen bei schmalem Fenster seitlich, statt den Status hinauszuschieben.

## AP17a – Startmenü und Menüführung
**Ziel:** Beim Öffnen ein Titelbild (die Welt gedimmt im Hintergrund, Logo) mit **Fortsetzen** (wenn eine Simulation läuft), **Neue Simulation**, **Simulation laden**, **Welteditor**, **Charaktereditor**, **Einstellungen**. Esc im Spiel öffnet das Menü. Die Kopfzeile im Spiel wird schlank: Uhr und Tempo links, Einblicke als Untermenü (schon umgesetzt), rechts Status (Verbindung, Modell, Warteschlange) und ein Menüknopf. **„Welt gestalten“** gibt es im Startmenü (vor Beginn einer Runde) und im Spiel als Editor-Modus mit stehender Zeit (Grundsatz oben).
- „Einstellungen“ teilen sich in **Spiel** (Parameter wie heute), **Darstellung** (Tiefe/Flach, Effekte, Schilder, Sprechblasen), **Ton** (AP17d) und **Modelle** (AP17c).
- Der vorhandene Modus `appMode = "menu"` (AP12c, „Neue Simulation“) wird zum Startmenü ausgebaut; Spielstände (AP09) werden zur Liste „Simulation laden“ mit Vorschaubild.
- Mockup zuerst (`docs/mockups/startmenue.html`).

## AP17b – Simulation selbst definieren
**Ziel:** Ein Assistent „Neue Simulation“ in Schritten: **Welt** (Startwelt, Generator mit Seed, Seeufer, Gebäudemix wie AP12c, oder selbst gestaltet mit AP16) → **Bewohner** (Anzahl; je Bewohner Vorlage wählen und anpassen: Name, Alter, Persönlichkeit, Werte, Ziele, Beziehungen zueinander, Wohnort; Nebenfiguren) → **Regeln** (Preset der Parameter, Autonomie, Knappheit) → **Modell** (aus AP17c, nach Frage 10 fest je Simulation) → **Start**.
- Bewohnerprofile sind heute Daten (`data/`), die Engine kennt keinen Sonderstatus. Neu: Profil-Schema mit Prüfung, Speichern als Vorlage, Export/Import.
- Der **Charaktereditor** im Startmenü ist dieselbe Profilmaske, ohne laufende Simulation; das Aussehen (Ausblick Nr. 2, Avatar aus Teilen) kommt als eigenes Paket dazu und hängt sich in diese Maske ein.

## AP17c – Modelle im Tool, All-inclusive
**Ziel:** Simulacra bringt alles mit: Wer das Paket startet, kann im Tool ein Modell aus einer **geprüften Liste** wählen (Größe, Speicherbedarf, Geschwindigkeit, Qualität aus unseren Messungen), es mit Fortschritt herunterladen und sofort nutzen. Ein externer Server (wie heute der Router auf maintux, OpenAI-kompatibel) bleibt als Option.
- **Laufzeit:** `llama.cpp` (`llama-server`) als mitgelieferter Dienst; das Backend startet und stoppt ihn, lädt Modelle und prüft Speicher (VRAM/RAM), bevor es eines anbietet.
- **Katalog:** kuratierte GGUF-Modelle (z. B. Qwen 3 in mehreren Größen und Quantisierungen), je Eintrag Quelle, Lizenz, Prüfsumme, Größe; jedes Modell muss den Messprompt aus AP00 mit `json_schema` bestehen, bevor es in die Liste kommt. Herunterladen nur nach Bestätigung mit Größenangabe.
- **Oberfläche:** Einstellungen → Modelle (installiert, verfügbar, Download mit Fortschritt, Löschen, Test-Anfrage), Status in der Kopfzeile.
- **Verpackung (Frage 33, 17.10.2026):** ein **Install-Skript für Linux und macOS**. Es erkennt die Hardware (NVIDIA-VRAM, Apple Silicon, nur CPU), holt passendes `llama.cpp`, startet den Dienst und schlägt Modelle nach Hardware vor. Die Modellliste kommt **live von Hugging Face** (GGUF, nach Beliebtheit und Datum, nach Speicher gefiltert); eine kleine kuratierte Liste im Repository ist die Rückfalloption offline und markiert geprüfte Empfehlungen. Zielrechner: maintux (derzeit offline) und thirdtux; Downloads sind freigegeben.

## Leitgedanke (Henry, 17.10.2026)
Auch wenn die Simulation mehr zum Spiel wird: **Im Mittelpunkt bleibt, das Verhalten und die Entwicklung der Agenten zu sehen.** Menü, Editoren, Klang und Szenen dienen dem. Folge für jede Entscheidung: Beobachtbarkeit (Einblicke, Protokoll, Gedächtnis) darf nie hinter Spielfunktionen zurücktreten.

## AP17d – Musik und Klänge
**Ziel:** Ruhige Hintergrundmusik nach Tageszeit und Wetter, Umgebungsklänge (Vögel, Wasser, Regen, Wind, Feuer), Klänge der Figuren (Schritte je Boden, Türen, Werkzeuge, Kochen, Schlafen) und eine **eigene Stimme je Figur** beim Sprechen (Plappern in Tonhöhe und Klangfarbe der Figur, wie in gemütlichen Dorfspielen; der Text bleibt in der Blase). Lautstärke je Kanal (Musik, Umgebung, Figuren), stumm schalten, je Gerät gemerkt. Klänge nur für Sichtbares, leiser mit Entfernung zur Bildmitte.
- Quelle nach Frage 34. Technik: Web Audio im Browser, keine Last fürs Backend.

## AP17e – Abnahme
Probelauf mit Fake-Modell und echtem Modell, Browser-Tests (Startmenü, Assistent, Modell-Download gegen einen Prüfserver), Doku (`frontend.md`, `installation.md`, `llm-anbindung.md`, `konfiguration.md`), Statusbericht mit Bildern.

## Reihenfolge (Vorschlag, Frage 35)
AP17a → AP17c → AP17b → AP17d, danach AP16 (Gestalten als Editor-Modus). Begründung: Startmenü und Modellwahl sind die Tür ins Spiel und die Voraussetzung für „All-inclusive“; der Assistent setzt beides voraus; Klang ist unabhängig und kann parallel laufen.
