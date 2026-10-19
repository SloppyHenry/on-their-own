# AP17d – Musik und Klänge im Spiel

Plan: [AP17-plan.md](../arbeitspakete/AP17-plan.md) (AP17d), Mockup: [AP17d-schritt0.md](AP17d-schritt0.md). Henry am 18.10.2026: „So umsetzen, beides einbauen (Code und CC0), in den Einstellungen selbst entscheiden; Stimmen der Personen wie im Mockup einstellbar.“ Dazu Nachschärfen: Gras-Schritte (Code und CC0), Tür schließen (Code), Gießkanne, Bach (Code und CC0), Musik im Haus.

## Was gebaut ist
**Klang-Modul `frontend/src/klang/`** (aus dem Mockup nach TypeScript übertragen, alle Dateien unter 400 Zeilen):
- `kern.ts`: Audiokontext, Kanäle Musik, Umgebung (draußen, hinter einer „Wand“), Umgebung drinnen, Figuren, Stimmen; Raumhall, Echo, Kompressor und Begrenzer, Ducking beim Sprechen, Bausteine.
- `geraeusche.ts`, `umgebung.ts`, `musik.ts`, `stimmen.ts` und `sprache.ts`: die Klänge aus Code.
- `aufnahmen.ts`: CC0-Aufnahmen aus `frontend/public/klang/` (2,7 MB, laden erst, wenn eine Quelle auf CC0 steht; bis dahin spielt Code).
- `regie.ts`: Umgebung und Musik nach Tageszeit (Uhr der Welt), Wetter (klar, bewölkt, Nebel, Regen, Sturm, Schnee) und Ort; weiche Überblendung. Der Kontext startet beim ersten Klick (Browserregel).
- `buehne.ts`: Klänge aus dem Spiel, nur für Sichtbares. Links und rechts je nach Lage im Bild, leiser und dumpfer mit Abstand zur Bildmitte.
  - **Schritte** aus der Bewegung der Figur, der Boden kommt aus der Kachel unter den Füßen: Gras, Weg, Holz (im Haus, Steg), Stein (Pflaster, Fliesen).
  - **Türen** beim Betreten und Verlassen eines Hauses.
  - **Geräusche** aus den Aktionen: Kochen, Gießen, Holz hacken, Graben, Bauen, Lesen, Schreiben, Anzünden, Löschen, Essen und Trinken, Angeln und Rudern, Schlösser und Truhen, Katze streicheln. Wer schläft, schnarcht leise.
  - **Stimmen** zu den Gesprächen: eine Zeile nach der anderen, jede mit der Stimme ihrer Figur. Der Text läuft in der Sprechblase mit, und die Blase bleibt, bis die Zeile gesprochen ist.
  - Eine Bremse verhindert Lärm bei schneller Simulation: je Haus höchstens alle 2,5 s eine Tür, je Figur höchstens alle 1,5 s ein Geräusch, insgesamt höchstens 6 Geräusche pro Sekunde.

**Drinnen (neu):** Wer ins Haus schaut, hört ein eigenes Lied, die „Stube“ (G-Dur, 72 bpm, gezupft wie eine Laute, warme Fläche, ohne Schlagzeug; nachts langsamer, mit Spieluhr). Als CC0 läuft „Sand Castles“ von Junkala. Die Umgebung von draußen klingt durch die Wand gedämpft: Tiefpass bei 650 Hz und 8 dB leiser. Bei Regen trommelt es aufs Dach, ein brennender Kamin oder eine Kerze im Haus knistert nah. Verlässt man das Haus, kommt die Musik zur Tageszeit zurück.

**Einstellungen → Ton** (auch im Menü unter Einstellungen; Mischpult und Quellen je Gerät, Stimmen in der Welt; die Bewohner merken nichts):
- Ton an/aus und Gesamtlautstärke.
- Mischpult: Musik, Umgebung, Figuren und Stimmen, je mit Lautstärke und Quelle **Code | CC0** (Stimmen nur aus Code).
- „Musik anhören“: alle fünf Stücke in der gewählten Quelle.
- „Klänge anhören“: 22 Einzelklänge und 9 Dauerklänge, je in Code und CC0.
- **Stimmen der Bewohner** wie im Mockup, **gespeichert in der Welt** (Nachtrag 19.10.2026, Henry: „Stimmen müssen in den Spielstand wandern“):
  - Regler je Person: Tonhöhe, Tempo, Größe, Lebhaft, Hauch.
  - Auswahl je Person: Klang (weich, klar, rau, hohl, piepsig) und Art (Plappern, Summen, Piepsen).
  - „anhören“ mit eigenem Probesatz; nach dem Loslassen eines Reglers ist die Stimme sofort zu hören.
  - „Standard“ setzt die Person auf den Vorschlag zurück. Der Vorschlag kommt aus Geschlecht und Alter und ist für jede Figur fest.
- In der Kopfzeile schaltet 🔊/🔇 den Ton aus und ein (Rechtsklick öffnet die Einstellungen „Ton“).
- Standard: Musik aus CC0, Umgebung und Figuren aus Code. Im automatisierten Browser bleibt der Ton aus, bis etwas gespeichert ist.

## Nachgeschärft (Henrys Rückmeldung zum Mockup)
| Klang | Befund | Jetzt |
|---|---|---|
| Gras, Code | Viele scharfe Körner ohne Nachklang: klang nach Kies | weiches Auftreten ohne Klick, Rascheln der Halme als unruhige Kurve über 0,2–0,3 s (Ferse, dann Abrollen), selten ein trockener Stängel. Das alte Knirschen ist jetzt der Boden „Weg“ |
| Gras, CC0 | Kenneys „Gras“ ist gemessen nur ein dumpfer Stoß (98 % der Energie unter 800 Hz), kein Rascheln | neue Mischung aus echtem Grasrascheln (HenKonen) und leichtem Auftreten (Fission9), 39 % der Energie bei 1–3 kHz |
| Tür schließen, Code | tiefer Körper bei 65–78 Hz mit langem Nachklang: eher Trommel | kurzes Schwingen der Angel mit Luftzug, dann heller Schlag des Türblatts (1–1,25 kHz), kurzer Holzkörper (95–115 Hz, Ausklang 0,16 s), dumpfer Rahmen, die Falle schnappt ein und klappert nach, kurzer Raumhall |
| Gießkanne, Code | breites Rauschen: klang nach starkem Regen | Anheben (Blechton, Schwappen), dünner Strahl als schmales, wanderndes Band, Gluckern aus Tönen, Tropfen auf Blätter, zum Schluss einzelne Nachtropfen |
| Bach, Code | laute Rauschwand: Wasserfall | Murmeln: fünf Töne springen alle 30–90 ms auf neue Höhen (260–1100 Hz) und gleiten hin, jeder an seinem Ort; darunter nur ein leises, wanderndes Band |
| Bach, CC0 | rubberduck-Loop: 1,9 s, 56 % der Energie bei 3–8 kHz, schnelle Wiederholung (Insekten-, „Urwald“-Eindruck) | KEPPLER1332 „Babbling Brook“ (Clear Creek, windstill, ohne Vögel), 20 s nahtlos, 82 % der Energie bei 300–3000 Hz, gemessen ohne Vogelrufe |

Neu aus Code: Hämmern, Graben, Anzünden, Ausblasen, Geschirr, Paddel und Angel, Schreiben, Schnurren, Regen aufs Dach. Neu als CC0: Musik für die Nacht („Innocence“) und für drinnen („Sand Castles“), beide aus demselben Paket wie die anderen Stücke.

## Geprüft
- Tests: Vitest (neu `src/klang/klang.test.ts`: Textzerlegung, Satzmelodie, Kürzen langer Texte, Sonderfälle, Stimmvorschlag, Aktion → Klang, Boden, Tageszeit), Playwright (neu `e2e/klang.spec.ts`: Ton läuft, drinnen das eigene Lied und zurück, Ausschalten; Einstellungen Ton: Quelle umschalten, Klang anhören, Stimme einstellen, nach Neuladen behalten), dazu die ganze Suite.
- **Pegel im Browser gemessen**, alle Klänge in Code und CC0 auf ähnliche Lautheit abgeglichen. Beispiele über dasselbe Zeitfenster: Gras −31 dB (Code) und −30 dB (CC0), Weg −31 und −33 dB, Tür schließen −32 und −30 dB, Bach −32 und −30 dB (vorher lag CC0 22 dB über Code). Draußen: Musik und Umgebung je −30 dB. Drinnen: Stube −34 dB, die Umgebung von draußen gedämpft. Stimmen −25 dB.
- **Im laufenden Spiel** (Testserver mit Fake-Modell) erklangen ohne Konsolenfehler: Schritte auf Gras, Weg, Stein und Holz, Türen, Kochen, Essen, Graben, Hämmern, Anzünden, Löschen, Lesen, Wasser, Schnurren, Schnarchen und die Stimmen der Gespräche.
- Die Kopfzeile passt bei 1440 px weiterhin; dafür ist die Anzeige des Modellnamens 28 px schmaler.
- **Nicht geprüft: wie es klingt.** Ich kann nicht hören. Bitte besonders anhören: Gras (Code und CC0), Tür schließen, Gießkanne, Bach (Code und CC0), die Stube drinnen.

## Nachtrag 19.10.2026: Stimmen im Spielstand
Henry: „Stimmen müssen in den Spielstand wandern.“
- **Backend:** Die Stimmen liegen in der Welt-Datenbank (`meta.voices`, Modul `world/voices.py`). Damit stecken sie in jedem Spielstand, in Export und Import.
- **API:** `PUT /api/agents/{id}/voice` mit Prüfung der Grenzen und Idempotency-Key. Der Zustandsabzug liefert `voices`, jede Änderung meldet das Systemereignis `simulation.voice_changed`, sodass alle offenen Browser die neue Stimme sofort hören. Im Protokoll steht „Stimme von … eingestellt“, unter „System“.
- **Zurücksetzen:** Mit „Bewohner behalten“ bleiben die Stimmen wie die Profile, sonst beginnen die Figuren mit dem Vorschlag.
- **Bewohner:** Sie erfahren nichts: kein Prompt, keine Beobachtung, keine Kennung im Ereignis (Test prüft die Prompts).
- **Oberfläche:** Ziehen ändert zuerst nur die Anzeige. Beim Loslassen (oder bei der Wahl von Klang und Art) geht die Stimme an die Welt und erklingt. „Standard“ setzt auf den Vorschlag zurück.
- **Übernahme:** Stimmen, die die erste Fassung im Browser gespeichert hatte, werden beim nächsten Start einmal in die Welt übernommen (nur für Figuren ohne eigene Stimme) und danach im Browser gelöscht.
- **Tests:** Backend `tests/saves/test_voices.py` (API, Grenzen, Ereignis, Spielstand hin und zurück, Zurücksetzen mit und ohne Profile, nie im Prompt), Vitest (Zustandsabzug, Ereignis, Vorschlag), Playwright (Stimme einstellen, aus der Welt nach dem Neuladen und in einem „anderen Browser“ ohne lokalen Speicher, Standard).

## Grenzen und Hinweise
- Lautstärken und Quellen gelten je Gerät (Browser).
- Alte Spielstände ohne Dorfgestaltung (Ansicht ohne `look`): Musik, Umgebung, Aktionen und Stimmen laufen, Schritte und Türen nicht (diese Ansicht liefert keine Weltposition).
- Später: Musik-Editor (siehe `docs/ausblick.md`, Nachtrag 18.10.2026).

## Ansehen
`./install.sh` oder wie gewohnt starten, einmal in die Seite klicken (Browserregel), dann Einstellungen → Ton. Ins Haus schauen: Klick aufs Haus, Esc führt zurück.
