# AP17c – Modelle im Tool und Install-Skript (Plan, 17.10.2026)

**Auftrag (Henry, 17.10.2026):** Simulacra soll sich mit **einem Install-Skript** auf Linux und macOS einrichten lassen, unabhängig vom Rechner. Im Tool wählt man das Sprachmodell und lädt es herunter, mit **Vorschlägen nach Hardware und immer aktuell** (es erscheinen ständig neue lokale Modelle). Es soll auf maintux (derzeit offline) und thirdtux laufen; Downloads und Installation dort sind freigegeben. **Umfang:** L. **Voraussetzung:** AP17a (Menü, Bereich „Einstellungen“) ist gebaut. Mockup: [modelle.html](../mockups/modelle.html).

## Ist-Stand
- Die Anbindung ist ein OpenAI-kompatibler Endpunkt (`llm/providers.py`, Einstellungen `SIM_LLM_BASE_URL`, `SIM_LLM_MODEL`, Schlüssel aus Datei oder Umgebung). Das Modell wird nur beim Anlegen einer Simulation gewählt (Entscheidung 10.10., `ResetDialog`). Gemessen ist `qwen3.8-9b-uncensored` auf maintux (`docs/llm-anbindung.md`); Standardvariante: `json_schema` ohne Denken, Ø 5,5 s je Entscheidung.
- Es gibt keine eigene Laufzeit, keine Hardware-Erkennung und kein Install-Skript. `docs/installation.md` beschreibt die Handarbeit (uv, Node, `.env`), `deploy/` den Container ohne Modell.
- Dieser Rechner: Apple M1, 16 GB (Metal). maintux: RTX 3080 mit 10 GB (aus AP00).

## Bausteine

### 1. Hardware-Erkennung (`backend/simulacra/models/hardware.py`)
Betriebssystem, Architektur, Arbeitsspeicher, Grafik (NVIDIA über `nvidia-smi --query-gpu`, Apple Silicon über `sysctl`/`system_profiler` mit **gemeinsamem Speicher**, AMD über `rocm-smi`, sonst CPU), freier Plattenplatz im Datenordner. Ergebnis `Hardware(kind, name, vram_mb, vram_free_mb, ram_mb, free_disk_mb, os, arch)` (gebaut mit **freiem** statt gesamtem Grafikspeicher); der Parser liest Textausgaben, damit er mit Beispielausgaben testbar ist. `GET /api/hardware`. Das Install-Skript nutzt dieselben Befehle in der Shell für die Wahl der Laufzeit.

### 2. Modellkatalog, immer aktuell (`models/catalog.py`)
Zwei Quellen, zusammengeführt:
- **Live:** Hugging Face API (`/api/models` mit Filter `gguf`, Sortierung nach Trend und Downloads, optional Herausgeber wie `unsloth`, `bartowski`, `Qwen`; `/api/models/<id>?blobs=true` liefert Dateien mit Größe und SHA-256 der LFS-Datei). Antworten werden 6 Stunden zwischengespeichert (`data/models/cache/`).
- **Kuratiert:** `backend/simulacra/data/models.json` im Repository: unsere **geprüften** Empfehlungen mit Messwerten (Format, Zeit je Entscheidung) und der Rückfall ohne Netz. Sie wird nur von uns gepflegt, nicht von der Live-Liste überschrieben.
- **Passung** je Datei: Dateigröße plus geschätzter KV-Cache (Kontext 8192) und Puffer gegen den freien Speicher der Hardware ergibt **passt gut** (bis 70 %), **passt** (bis 90 %), **knapp** (bis 100 %), **zu groß**. *(Gebaut in `models/fit.py`.)* Die Zeit je Entscheidung ist vorab nur **grob geschätzt** (Speicherbandbreite geteilt durch Dateigröße) und als Schätzung gekennzeichnet; erst die Messung (Baustein 5) liefert Zahlen.
- Auswahlregeln: nur Textmodelle im GGUF-Format, Quantisierung Q4 bis Q8, Lizenz wird angezeigt; Filter nach Größe, Herausgeber, „nur passende“. Welche Modelle auftauchen, sagt das Netz; unser Zutun ist die Passung und die Prüfung.

### 3. Laufzeit (`models/runtime.py`)
`llama.cpp` (`llama-server`) als **vom Backend verwalteter Kindprozess**: Start mit Modelldatei, volle GPU-Auslagerung (`-ngl 99`), Kontext 8192, ein Slot (`--parallel 1`, passend zu `llm_max_concurrent`), `--jinja`, Port nur auf 127.0.0.1; Gesundheitsprüfung über `/health`; Stopp beim Beenden; ein Modell zugleich (Wechsel = Neustart des Prozesses). Die Binärdatei liegt in `data/runtime/llama.cpp/<Version>/` und kommt vom Install-Skript (Baustein 7) oder auf Knopfdruck aus dem Tool („Laufzeit installieren“).
- **Zwei Betriebsarten** (je Gerät in `data/llm.json`): **Eingebaut** (Backend startet `llama-server`, `llm_base_url` zeigt auf ihn) oder **Externer Server** (wie heute, z. B. der Router auf maintux). Die Umgebungsvariablen `SIM_LLM_*` gewinnen weiter vor der Datei, damit bestehende Installationen unverändert laufen.
- Das Verhalten der Anfragen (Schema-Zwang, Denken aus) bleibt wie in AP00; `FakeProvider` bleibt für Tests.

### 4. Download (`models/download.py`)
Nur über HTTPS von `huggingface.co` und dessen CDN (feste Liste erlaubter Hosts), **nach Bestätigung** mit Dateiname, Quelle und Größe (Regel „Downloads nur nach Bestätigung“). Fortsetzen mit `Range`, Fortschritt über WebSocket (`models.download` Ereignisse), Prüfung der **SHA-256** gegen die Angabe der Hugging-Face-API, erst danach Umbenennen in `data/models/<name>.gguf`; Abbruch räumt `.part` weg. Vorab Plattenplatz prüfen (Größe plus 10 %). Ein Download zugleich. Löschen mit Rückfrage.
- Einschränkung: Für gesperrte Modelle (Anmeldung nötig) fehlt ein Token; Henry hat dafür bisher nichts vorgesehen: sie werden gekennzeichnet („Anmeldung nötig, nicht unterstützt“).

### 5. Messung (`models/probe.py`)
Nach dem Download ein **Probelauf** mit dem Messprompt aus AP00 (`scripts/probe_llm.py` wird zum Modul): 10 Anfragen mit `json_schema`, Ergebnis **gültig in %**, **Ø Sekunden je Entscheidung**, **Token/s**. Das Ergebnis steht als Siegel am Modell (**geprüft**, **mit Einschränkung**, **ungeeignet**) und in `data/models/probes.json`. Ein Modell unter 90 % gültig wird als ungeeignet gekennzeichnet, lässt sich aber weiter wählen. So bleibt „aktuell“ ehrlich: Die Live-Liste schlägt vor, die Messung sagt, ob es hier taugt.

### 6. Oberfläche (Menü → Einstellungen → Modelle, Mockup `modelle.html`)
Kopf mit **erkannter Hardware** („Apple M1, 16 GB gemeinsamer Speicher, 180 GB frei“), darunter **Betriebsart** (Eingebaut oder Externer Server mit Adresse und Verbindungstest), **Empfohlen für diesen Rechner** (die besten passenden Modelle der Live-Liste und der kuratierten Liste, mit Passung, Schätzung, Größe, Lizenz, Siegel), **Installiert** (Siegel, Messwerte, „Testen“, „Als Modell für neue Simulationen“, Löschen), **Alle Modelle suchen** (Suchfeld, Filter), **Download** mit Fortschritt und Abbrechen. Die Kopfzeile zeigt wie bisher Verbindung und Modell. Die Wahl gilt für **neue Simulationen** (Entscheidung 10.10. bleibt: je Simulation fest); das Neustart-Fenster zeigt das gewählte Modell.

### 7. Install-Skript (`install.sh` im Projektordner)
Für Linux und macOS, idempotent, mit `--yes` (ohne Rückfragen), `--dry-run` (zeigt nur), `--no-model`, `--headless` (kein Browser), `--update`, `--uninstall`.
1. **Prüfen:** Betriebssystem, Architektur, git, Python (3.12 und neuer), uv, Node (22 und neuer), Plattenplatz.
2. **Voraussetzungen holen**, wenn sie fehlen und der Nutzer zustimmt: `uv` und Node über die offiziellen Installer (kein `sudo`, Ablage im Benutzerordner).
3. **Projekt einrichten:** Backend-Umgebung (`uv`, `requirements.lock`), Frontend bauen (`npm ci`, `npm run build`).
4. **Hardware erkennen** und die **passende `llama.cpp`-Version** aus den offiziellen GitHub-Releases holen: macOS Apple Silicon (Metal), Linux mit NVIDIA (CUDA), sonst Vulkan oder CPU. Die Prüfsumme kommt aus dem `digest`-Feld der Release-API.
5. **Modell vorschlagen** (ruft die Katalog-Logik des Backends auf) und nach Bestätigung laden und messen; ein Aufruf von `scripts/probe` ist der Prüflauf.
6. **Dienst einrichten** (nach Frage): `systemd --user` auf Linux, `launchd` auf macOS, damit Simulacra beim Anmelden startet; sonst `scripts/dev.sh`/`start.sh`.
7. **Schluss:** Adresse (`http://127.0.0.1:8090`), Pfad der Daten, wie man aktualisiert.
- Der Container (`deploy/`) bleibt der Weg für Server mit externem Modell; für maintux und thirdtux läuft das Skript per `ssh … install.sh --yes --headless`.
- Prüfung: `shellcheck`, ein Trockenlauf je Plattform-Beispiel (aufgezeichnete Ausgaben von `nvidia-smi`, `sysctl` als Testdaten), ein Lauf in einem sauberen Container (Linux, CPU, kleines Prüfmodell).

## Reihenfolge der Teilpakete (geändert am 17.10.2026 auf Henrys Wunsch: zuerst das Install-Skript)
- **17c-1: Install-Skript** (`install.sh`, `scripts/start.sh`, kuratierte Liste `models.json`, Tests mit nachgestellten Rechnern). **Gebaut**, siehe [status/AP17c.md](../status/AP17c.md).
- **17c-2: Hardware und Katalog im Backend** (`backend/simulacra/models/`, `GET /api/hardware`, `GET /api/models/catalog`, `python -m simulacra.models`). **Gebaut** am 18.10.2026, siehe [status/AP17c.md](../status/AP17c.md). Das Skript nutzt für die Modellwahl dieselbe Rechnung. Abweichungen vom Plan: Stufen 70/90/100 % (statt 70/90 %/„knapp“ ohne Grenze), Datei-Liste über `/tree/main` (nicht `?blobs=true`), Zeit je Entscheidung mit Wirkungsgrad 0,7, Positivliste der Herausgeber in `models.json`.
- **17c-3:** Download mit Fortschritt, Laufzeit-Verwaltung durch das Backend (statt Dienst), Probelauf.
- **17c-4:** Oberfläche (Bereich Modelle), Neustart-Fenster mit Modell, Statusanzeige, Handbuch, Probelauf auf thirdtux und maintux.

## Tests
- Python: Parser für `nvidia-smi`/`sysctl`/`system_profiler` mit Beispielausgaben; Passung (Grenzwerte); Katalogzusammenführung und Zwischenspeicher mit Mock-Transport; Download (Fortsetzen, falsche Prüfsumme, zu wenig Platz, nicht erlaubter Host, Abbruch); Laufzeit mit Fake-Prozess (Start, Gesundheit, Absturz, Wechsel); Probe mit Fake-Provider; API (Bestätigungspflicht, Idempotency-Key).
- Frontend: Vitest für die Anzeige (Passung, Siegel), Playwright mit gefälschtem Katalog und Download (Fortschritt, Abbruch, Bestätigung).
- Skript: `shellcheck`, `--dry-run` je Beispielplattform, Container-Lauf.
- Sicherheit: erlaubte Hosts, kein `sudo`, keine Ausführung heruntergeladener Skripte außer den offiziellen Installern von `uv` und Node (nach Zustimmung), Prüfsummen überall, wo der Anbieter sie liefert.

## Offene Punkte
Fragen 39 bis 43 in [offene-fragen.md](../offene-fragen.md). Nicht entschieden und nicht geprüft: welche `llama.cpp`-Builds die Releases heute anbieten (Namen ändern sich; das Skript fragt die Release-API und scheitert mit klarer Meldung, wenn nichts passt), und ob die Prism-Fork auf maintux (Bonsai-Problem, `llm-anbindung.md`) dasselbe Verhalten wie die offizielle Version zeigt.
