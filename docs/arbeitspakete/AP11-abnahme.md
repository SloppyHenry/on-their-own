# AP11 – Stabilisierung, Abnahme, Dokumentation

**Auftrag:** §15, §17, §19 · **Abhängig von:** alle · **Umfang:** M · **Meilenstein:** M6

## Ziel
Nachweis, dass alle 16 Akzeptanzkriterien aus §17 erfüllt sind, mit echten Testausgaben. Die Simulation läuft stundenlang stabil innerhalb definierter Grenzen. Die Dokumentation reicht, um das Projekt ohne Vorwissen zu installieren, zu betreiben und zu erweitern.

## Lieferumfang
1. Abnahme-Testsuite `backend/tests/acceptance/` und `frontend/e2e/acceptance/`, je Kriterium ein benannter Test.
2. Langlauf-Bericht.
3. Leistungsoptimierungen nach Messung.
4. Vollständige Dokumentation.
5. Abschlussbericht `docs/status/ABSCHLUSS.md`.

## Abnahmematrix (§17)
| Nr. | Kriterium | Nachweis |
|---|---|---|
| 1 | Zwei Agenten in einer Welt | Test: Snapshot enthält beide mit Position; Playwright: beide Figuren sichtbar |
| 2 | Getrennte Gedächtnisse | Test: Abruf Alex ⊄ Mira; Code-Scan auf `agent_id`-Filter |
| 3 | Eigenständige Aktionswahl | Langlauf: beide haben Entscheidungen ohne Benutzereingriff, mehrere Aktionsarten |
| 4 | Aktionen ändern Welt | Test je Aktionsart: Zustand vorher/nachher |
| 5 | Dialoge live im Browser | Playwright: Dialog-Ereignis → Sprechblase und Protokoll binnen 2 s |
| 6 | Ortswechsel sichtbar | Playwright: Sprite-Position folgt `agent.moved` |
| 7 | Erinnerungen überleben Neustart | Test: Backend-Prozess neu starten, Inspektor-Daten identisch |
| 8 | Slider wirken nachweisbar | Registry-Test + Wirkungstests aus AP07 |
| 9 | Änderungen im Betrieb | Test: Parameter während Lauf ändern, nächste Entscheidung nutzt neuen Wert |
| 10 | Freie Eingaben → validierte, persistente Ereignisse | Elf Beispielsätze aus §10, nach Neustart noch vorhanden |
| 11 | Nur zugängliches Wissen | `inform`-Test, Sichtbarkeits-Tests |
| 12 | Pause/Fortsetzen/Schritt | API- und Playwright-Test |
| 13 | Refresh stellt Zustand her | Playwright: Reload, Vergleich Zustand |
| 14 | Ohne Cloud-LLM | Test mit Netzwerk-Sperre außer maintux (bzw. Container ohne Internet-Route), Simulation läuft |
| 15 | Ungültige Antworten harmlos | Fake-LLM liefert kaputte Antworten in Serie; Integritätsprüfung des Weltzustands |
| 16 | Ressourcenverbrauch begrenzt | Langlauf: LLM-Aufrufe/min, RAM, DB-Größe, Ereignisrate unter Grenzwerten |

## Langlauf
- 2 Stunden Echtzeit mit dem echten Modell auf maintux (bzw. so viele Sim-Tage, wie in der Zeit möglich), Standard-Preset; zusätzlich 4 Stunden mit Fake-LLM bei maximaler Geschwindigkeit.
- Gemessen alle 5 min: Entscheidungen/min, Fehlerquote, mittlere Antwortzeit, RAM des Prozesses, DB-Größe, aktive Erinnerungen je Agent, Ereignisse/min, Anzahl Objekte, Schleifen-Eingriffe.
- Grenzwerte (Vorschlag): RAM < 1 GB, DB-Wachstum < 50 MB/Sim-Tag, keine Fehlerserie > 5, keine Aktion ≥ 5× hintereinander, Gesprächslänge ≤ Höchstwert.
- Ergebnis als Tabelle und Diagramm in `docs/status/langlauf.md`.

## Stabilisierung (je nach Befund)
- Fehlerbehandlung: alle Hintergrund-Tasks mit Überwachung, Neustart einzelner Tasks statt Absturz, strukturierte Logs (JSON) mit Rotation.
- Datenbank: Indizes nach Abfrageprofil, `VACUUM`/`ANALYZE` beim Start optional, WAL-Checkpoint.
- Prompt-Länge: Messung je Prompt-Teil, Kürzung wo nötig; stabile Präfixe für den Prompt-Cache.
- Frontend: Profil der Renderzeiten, Ereignisliste virtualisiert, Phaser-Szene ohne Speicherlecks bei langen Läufen.
- Sicherheitsdurchsicht: keine Ausführung von Modelltexten, Eingaben validiert, Key nie im Frontend oder Log, Abhängigkeiten auf bekannte Schwachstellen geprüft (`pip-audit`, `npm audit`).

## Dokumentation
| Datei | Inhalt |
|---|---|
| `README.md` | Was ist SIMULACRA, Bildschirmfoto, Schnellstart Mac und maintux, Voraussetzungen |
| `docs/installation.md` | Schritt für Schritt: Python, Node, Abhängigkeiten, Konfiguration, Start/Stopp |
| `docs/llm-anbindung.md` | Anbindung an den llama.cpp-Router, Modelle, Key, Messwerte, anderes Modell oder andere Maschine verwenden |
| `docs/konfiguration.md` | alle Parameter (aus der Registry erzeugt) mit Bereich, Standard, Wirkung, Wirkungsklasse |
| `docs/architektur.md` | Module, Datenfluss, Entscheidungszyklus, Ereignismodell, Diagramme |
| `docs/schnittstellen.md` | REST, WebSocket, Ereignistypen, Datenmodelle |
| `docs/betrieb.md` | aus AP10 |
| `docs/erweitern.md` | neue Aktion, neues Objekt, neuer Parameter, neuer Ereignistyp, dritter Agent |
| `docs/grenzen.md` | bekannte Vereinfachungen (z. B. Nebenfiguren ohne Gedächtnis, keine semantische Suche) und Ideen |

## Abschlussbericht
- Liste aller Projektdateien mit Zeilenzahl (Nachweis < 400).
- Startbefehle (lokal, maintux).
- Vollständige Ausgabe der Testläufe (pytest, Vitest, Playwright) mit Datum.
- Abnahmematrix mit Status je Kriterium; nicht erfüllte Punkte offen benannt.
- Langlauf-Ergebnisse.

## Abnahme
- [x] Alle 16 Kriterien mit grünem Nachweis oder offen dokumentierter Abweichung, die du akzeptiert hast. (13.10.2026, Abweichung: offene Frage 17)
- [x] Langlauf ohne Absturz und innerhalb der Grenzwerte.
- [x] Dokumentation vollständig; eine Neuinstallation nach `docs/installation.md` gelingt.
