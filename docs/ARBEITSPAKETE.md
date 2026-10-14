# SIMULACRA – Arbeitspakete (Übersicht)

Quelle: [AUFTRAG.md](AUFTRAG.md). Verweise `§n` beziehen sich auf dessen Abschnitte.
Jedes Paket hat eine eigene Datei unter [arbeitspakete/](arbeitspakete/) mit Ziel, Lieferumfang, Dateien, Schnittstellen, Arbeitsschritten, Tests, Abnahme und Risiken.

| Paket | Datei | Inhalt | Auftrag | Abhängig von | Umfang |
|---|---|---|---|---|---|
| AP00 | [AP00-umgebung.md](arbeitspakete/AP00-umgebung.md) | Umgebung, Gerüst, LLM-Sondierung | §2, §19 | – | S |
| AP01 | [AP01-welt-engine.md](arbeitspakete/AP01-welt-engine.md) | Weltmodell, Welt-Engine, Datenbank | §3, §5, §16 | AP00 | L |
| AP02 | [AP02-agentenzyklus.md](arbeitspakete/AP02-agentenzyklus.md) | LLM-Client, Agentenzyklus, Simulationsschleife | §4, §5 | AP01 | L |
| AP03 | [AP03-api-websocket.md](arbeitspakete/AP03-api-websocket.md) | Event-Bus, REST, WebSocket | §12 | AP01 | M |
| AP04 | [AP04-browserwelt.md](arbeitspakete/AP04-browserwelt.md) | Frontend-Grundlage, Weltansicht, Leitstelle | §3, §7 | AP03 | L |
| AP05 | [AP05-gedaechtnis.md](arbeitspakete/AP05-gedaechtnis.md) | Gedächtnis, Abruf, Reflexion, Inspektor | §6, §8.3 | AP02 | L |
| AP06 | [AP06-autonomie.md](arbeitspakete/AP06-autonomie.md) | Ziele, Bedürfnisse, Beziehungen, Schutz, Erklärbarkeit | §4, §5, §13, §15 | AP05 | L |
| AP07 | [AP07-parameter.md](arbeitspakete/AP07-parameter.md) | Parameter-Registry, Slider, Presets, Modi | §8, §9, §11 | AP04, AP06 | L |
| AP08 | [AP08-ereignisse.md](arbeitspakete/AP08-ereignisse.md) | Freie Ereigniseingabe, Wissensverteilung | §10 | AP07 | L |
| AP09 | [AP09-spielstaende.md](arbeitspakete/AP09-spielstaende.md) | Speichern, Laden, Export, Statistik | §14 | AP07 | M |
| AP10 | [AP10-container.md](arbeitspakete/AP10-container.md) | Docker-Container, Betrieb auf maintux | §2, §19 | AP04 (Probe), AP09 (final) | M |
| AP11 | [AP11-abnahme.md](arbeitspakete/AP11-abnahme.md) | Stabilisierung, Abnahme, Dokumentation | §15, §17, §19 | alle | M |
| AP12 | [AP12-weltgenerator.md](arbeitspakete/AP12-weltgenerator.md) | Weltgenerator: Straßen, Gebäude, Vegetation im Stil der Startwelt (Zusatz, nach AP11; neu geplant 14.10.2026 in [AP12-plan.md](arbeitspakete/AP12-plan.md), Teilpakete AP12a–c) | Zusatz Henry | AP04, AP08, AP09, AP13–AP15 | XL |
| AP13 | [AP13-weltoptik.md](arbeitspakete/AP13-weltoptik.md) | Weltoptik „Mischung“ (Pixelwelt mit Tiefe) und Vorbereitung der Mitspieler-Steuerung (Point-and-Click, Spracheingabe) | Zusatz Henry | AP04, AP11 | L |
| AP14 | [AP14-startwelt-innenbereiche.md](arbeitspakete/AP14-startwelt-innenbereiche.md) · [Plan](arbeitspakete/AP14-plan.md) | Welt genau wie Mockup A: Startwelt nach dem Bild, Haus innen hinter der Tür als Übergang, Dorfansicht mit Zoom in ganzen Stufen | Zusatz Henry | AP13 | L |
| AP15 | [AP15-dinge.md](arbeitspakete/AP15-dinge.md) | Dinge im Dorf: Deko aus Mockup A und innen2 wird benutzbar (Boot, Laternen, Briefkasten, Ernte, Katze, Ablagen …) | Zusatz Henry | AP14 | L |
| AP16 | [AP16-plan.md](arbeitspakete/AP16-plan.md) | Gestalten: Wege, Seen, Gärten, Häuser, Bäume und Deko selbst setzen, Häuser von innen einrichten (Entwurf, Vorschau, Übernehmen); Plan vom 14.10.2026, wartet auf Fragen 27–30 | Zusatz Henry (Ausblick) | AP12c | L |

Umfang: S = etwa eine Sitzung, M = zwei bis drei, L = drei bis fünf.

## Meilensteine (entsprechen den Phasen aus §18)

| Meilenstein | Pakete | Was du danach sehen und ausprobieren kannst |
|---|---|---|
| M1 Grundsystem | AP00–AP02 | Alex und Mira handeln in der Konsole gegen das echte Modell auf maintux; Weltzustand in SQLite. |
| M2 Browserwelt | AP03–AP04 | Die Welt im Browser: Figuren laufen, Sprechblasen, Protokoll, Start/Pause/Schritt. |
| M3 Autonomie und Gedächtnis | AP05–AP06 | Erinnerungen, Reflexionen, Ziele, Beziehungen, Entscheidungsbegründungen, Gedächtnis-Inspektor. |
| M4 Steuerung | AP07 | Alle Slider wirken nachweisbar, Presets, Beobachtungsmodi. |
| M5 Ereignisse | AP08 | Freie Texteingabe verändert die Welt und das Wissen gezielt. |
| M6 Betrieb | AP09–AP11 | Spielstände, Container auf maintux, alle 16 Abnahmekriterien geprüft. |

## Übergreifende Festlegungen

### Umgebung
- **Zielrechner maintux:** Ryzen 9 5950X, 31 GB RAM, RTX 3080 mit 10 GB VRAM, Docker 29.x. Der Auftrag nennt eine RTX 3060 mit 12 GB; alle Vorgaben gelten sinngemäß, das VRAM-Budget ist knapper.
- **LLM:** llama.cpp-Router (PrismML-Fork) auf `maintux:8080`, OpenAI-kompatibel, API-Key. Standardmodell `qwen3.8-9b-uncensored` (64k Kontext, ca. 23 Token/s), Alternative `bonsai2-27b` (ca. 22 Token/s). Der Router hält immer nur ein Modell im VRAM, beide Agenten teilen es.
- **Entwicklung auf dem Mac:** Python 3.14, Node 24, kein Docker. Die App läuft dort ohne Container, das LLM wird über das Netz angesprochen.
- **Betrieb:** ein Docker-Container auf maintux für Backend und gebautes Frontend; das LLM bleibt außerhalb (braucht die GPU).

### Architekturprinzipien
1. **Die Welt-Engine ist die einzige Instanz, die den Weltzustand ändert.** Agenten, Ereignis-Controller und API reichen nur *Vorschläge* ein. Jede Änderung läuft durch dieselbe Validierung und erzeugt ein Ereignis.
2. **Ereignisse sind die Wahrheit für die Oberfläche.** Jede Zustandsänderung erzeugt genau ein Ereignis im Event-Bus mit fortlaufender Sequenznummer. Das Frontend baut seinen Zustand aus Snapshot plus Ereignissen auf.
3. **Hybrid-Entscheidung:** Die Engine erzeugt gültige Handlungsoptionen und bewertet sie mit Persönlichkeit, Bedürfnissen und Zielen (deterministisch, nachvollziehbar). Das LLM wählt aus diesen Kandidaten und liefert Inhalte wie Dialogtext, Begründung und Wichtigkeit. So wirken die Slider messbar, und das Modell kann keine unmöglichen Aktionen behaupten.
4. **Wissen ist pro Agent getrennt.** Ein Agent sieht im Prompt nur, was er wahrgenommen, erfahren oder erinnert hat.
5. **Nichts geht still verloren.** Historie wird archiviert, nicht gelöscht; Laden und Zurücksetzen verlangen Bestätigung.
6. **Das LLM führt nie Code oder Befehle aus.** Es liefert nur JSON, das gegen ein Schema geprüft wird.

### Technologie (Versionen werden in AP00 geprüft und gepinnt)
- **Backend:** Python 3.12 im Container (3.14 lokal muss ebenfalls laufen), FastAPI, Uvicorn, Pydantic v2, pydantic-settings, httpx (LLM-Aufrufe, kein OpenAI-SDK), SQLite aus der Standardbibliothek mit FTS5, pytest und pytest-asyncio.
- **Frontend:** React mit TypeScript, Vite, Tailwind CSS, Phaser 3 für die Welt, Zustand (`zustand`) als kleiner Store, Playwright für Browser-Tests.
- **Typen:** Pydantic-Modelle sind die Quelle; daraus wird JSON-Schema und daraus TypeScript erzeugt (`scripts/gen_types.sh`). Keine doppelte Pflege.

### Verzeichnisstruktur (Ziel)
```
simulacra/
  backend/simulacra/      Python-Paket (Module siehe AP01–AP09)
  backend/tests/          pytest
  frontend/src/           React-App (Komponenten siehe AP04, AP07, AP08)
  frontend/e2e/           Playwright
  scripts/                dev.sh, stop.sh, gen_types.sh, probe_llm.py, backup.sh
  docs/                   Auftrag, Pakete, Schnittstellen, Konfiguration, Statusberichte
  deploy/                 Dockerfile, compose.yaml, env.example
  data/                   Laufzeitdaten (git-ignoriert)
```

### Definition of Done (gilt für jedes Paket)
- Der vereinbarte Lieferumfang ist umgesetzt, Vereinfachungen sind in `docs/status/APxx.md` offen benannt.
- `scripts/dev.sh` startet das Projekt; die bestehenden Funktionen laufen weiter.
- Alle Tests laufen grün; die echte Ausgabe steht im Statusbericht. Nicht ausgeführte Tests werden als solche genannt.
- Keine Datei über 400 Zeilen; `wc -l` wird im Statusbericht aufgeführt.
- Neue Parameter sind in `docs/konfiguration.md`, neue Schnittstellen in `docs/schnittstellen.md` dokumentiert.
- Commit auf einem Paket-Branch, Zusammenführung erst nach deiner Freigabe.

### Abnahmekriterien §17 → Paket
| Nr. | Kriterium | Umgesetzt in | Geprüft in |
|---|---|---|---|
| 1 | Zwei Agenten in einer Welt | AP01, AP02 | AP02 |
| 2 | Getrennte Gedächtnisse | AP05 | AP05 |
| 3 | Eigenständige Aktionswahl | AP02, AP06 | AP02, AP06 |
| 4 | Aktionen ändern den Weltzustand | AP01 | AP01 |
| 5 | Dialoge live im Browser | AP03, AP04 | AP04 (Playwright) |
| 6 | Ortswechsel sichtbar | AP04 | AP04 (Playwright) |
| 7 | Erinnerungen überleben Neustart | AP05 | AP05, AP11 |
| 8 | Slider ändern Parameter nachweisbar | AP07 | AP07 |
| 9 | Änderungen im Betrieb | AP07 | AP07 |
| 10 | Freie Texteingabe → validierte, persistente Ereignisse | AP08 | AP08 |
| 11 | Nur zugängliches Wissen | AP05, AP08 | AP08 |
| 12 | Pause, Fortsetzen, Schritt | AP02, AP04 | AP02, AP04 |
| 13 | Refresh stellt Zustand her | AP03, AP04 | AP03, AP04 |
| 14 | Ohne Cloud-LLM | AP00, AP02 | AP11 |
| 15 | Ungültige Antworten beschädigen nichts | AP02 | AP02 |
| 16 | Ressourcenverbrauch begrenzt | AP06, AP07 | AP11 |

### Arbeitsweise
1. Vor jedem Paket: kurzer Plan im Chat, offene Fragen aus `docs/offene-fragen.md` klären.
2. Umsetzung auf Branch `ap/xx-name`, Tests, Statusbericht `docs/status/APxx.md` mit echten Ausgaben.
3. Vorführung (Screenshots oder Konsolenlauf), dann deine Freigabe zum Zusammenführen.
4. Auf maintux wird nur mit deiner ausdrücklichen Freigabe etwas installiert, gestartet oder neu gestartet.

## Vorgemerkt: Mitspieler-Charaktere
Anforderung vom 11.10.2026 (siehe `offene-fragen.md`, Nr. 11): Menschen steuern eigene Charaktere, die für die KI-Agenten gleichwertige Bewohner sind. Wird nach AP08 als eigenes Paket geschnitten. Schon jetzt beachten: Agenten haben in der Engine keinen Sonderstatus der KI (`add_agent`, `propose` gelten für jeden Körper), und die Wahrnehmung in AP02 darf nichts über die Steuerungsart eines Agenten verraten.
