# Installation

## Schnell: ein Aufruf (Linux und macOS)

```bash
git clone <repository> simulacra && cd simulacra
./install.sh
```

Das Skript prüft den Rechner (System, Arbeitsspeicher, Grafikkarte), holt fehlende Werkzeuge (`uv`, Node.js; im Benutzerordner, kein `sudo`), richtet Backend und Oberfläche ein, lädt die passende **llama.cpp**-Version aus den offiziellen GitHub-Releases (Metal auf dem Mac, CUDA oder Vulkan oder Prozessor unter Linux; Prüfsumme aus dem `digest` der Release-API, dazu ein Probelauf von `llama-server --version`), schlägt ein **Modell nach Speicher** vor und lädt es von Hugging Face (fortsetzbar, SHA-256-geprüft), schreibt `backend/.env` und richtet auf Wunsch einen **Dienst** ein (`systemd --user` oder `launchd`). Am Ende läuft ein Selbsttest. Jeder Schritt mit Wirkung fragt vorher nach.

| Schalter | Wirkung |
|---|---|
| `--yes` | ohne Rückfragen, mit den Standardantworten |
| `--dry-run` | zeigt nur, was geschehen würde (liest das Netz, ändert nichts) |
| `--model qwen3-8b` | ein bestimmtes Modell der kuratierten Liste (`backend/simulacra/data/models.json`) |
| `--no-model` / `--no-llm` | kein Modell laden / auch keine Laufzeit (externer Server wie maintux) |
| `--headless` | Server ohne Bildschirm: lauscht im Netz (IPv4 und IPv6), Dienst als Standard; **ohne** Zugangsschutz |
| `--token` | mit `--headless`: erzeugt einen Zugangsschutz (`SIM_ACCESS_TOKEN` in `backend/.env`, bleibt bei jedem Lauf gleich); ohne den Schalter wird ein früher geschriebenes Token wieder entfernt |
| `--update` | Projekt (`git pull`), Oberfläche und llama.cpp aktualisieren, Dienste neu starten |
| `--uninstall` | Dienste entfernen; mit `--purge` auch die Daten (mit Rückfrage) |

- Ohne Dienst: `scripts/start.sh` startet Modell und Simulacra im Vordergrund (Strg+C beendet beides).
- Auf einem Server: `ssh server 'cd simulacra && ./install.sh --yes --headless'`; damit die Dienste ohne Anmeldung laufen, einmal `sudo loginctl enable-linger $USER`.
- Ein vorhandener Eintrag in `backend/.env` (zum Beispiel `SIM_LLM_BASE_URL`) bleibt unberührt; das Skript schreibt nur seinen eigenen, markierten Block.
- Die Auswahl der llama.cpp-Datei und des Modells ist mit nachgestellten Rechnern getestet (`backend/tests/test_install_script.py`); ein echter Lauf auf Apple M1 mit Qwen3-4B ist im Bericht [status/AP17c.md](status/AP17c.md) beschrieben.
- Die Modellwahl rechnet `python -m simulacra.models` (dieselbe Rechnung wie das Tool; kuratierte Liste, geprüft). Die Live-Liste von Hugging Face zeigt das Tool: Menü → Einstellungen → **Modelle** (Hardware, Betriebsart, Empfehlungen, Download mit Fortschritt, Messung); die Schnittstelle steht in [schnittstellen.md](schnittstellen.md#modellverwaltung-ap17c-3--4). Von Hand: `cd backend && .venv/bin/python -m simulacra.models hardware` zeigt den erkannten Rechner, `… catalog --only-fit` die passenden Modelle (Zwischenspeicher 6 Stunden in `data/models/cache/`).

Die folgenden Abschnitte beschreiben dasselbe von Hand.

Schritt für Schritt auf einem Entwicklungsrechner (macOS oder Linux). Für den Betrieb als Container auf einem Server siehe [betrieb.md](betrieb.md).

## Voraussetzungen

| Was | Version | Prüfen |
|---|---|---|
| Python | 3.14 (3.12 und neuer erlaubt, getestet wird mit 3.14) | `python3 --version` |
| [uv](https://docs.astral.sh/uv/) | 0.12 oder neuer | `uv --version` |
| Node.js | 24 (Vite 8 braucht mindestens 22) | `node --version` |
| git | beliebig | `git --version` |
| Sprachmodell | ein OpenAI-kompatibler Endpunkt, z. B. llama.cpp-Router mit Qwen 9B | siehe [llm-anbindung.md](llm-anbindung.md) |

Ohne erreichbares Modell startet die App trotzdem: Oberfläche, Welt, Spielstände und Einstellungen funktionieren, nur die Agenten denken nicht (die Kopfzeile zeigt einen roten Punkt am Modellnamen).

## 1. Quellcode

```bash
git clone <repository> simulacra
cd simulacra
```

## 2. Backend

```bash
cd backend
uv venv .venv --python 3.14
uv pip install --python .venv/bin/python -r requirements.lock      # genau die gepinnten Versionen
uv pip install --python .venv/bin/python -e . --group dev            # das Paket selbst und die Testwerkzeuge
cd ..
```

## 3. Frontend

```bash
cd frontend
npm ci
cd ..
```

Für die Browser-Tests (optional, ca. 150 MB): `cd frontend && npx playwright install chromium`.

## 4. Modell anbinden

Die Einstellungen kommen aus Umgebungsvariablen mit dem Präfix `SIM_` oder aus `backend/.env` (Vorlage: `.env.example` im Projektordner). Die drei wichtigsten:

```bash
# backend/.env
SIM_LLM_BASE_URL=http://maintux:8080/v1          # Endpunkt des Routers
SIM_LLM_API_KEY_FILE=~/.config/qwen/maintux-api-key   # Datei mit dem API-Schlüssel (oder SIM_LLM_API_KEY=…)
SIM_LLM_MODEL=qwen3.8-9b-uncensored              # Modellkennung, wie sie der Router unter /v1/models meldet
```

Alle weiteren Werte: [konfiguration.md](konfiguration.md). Prüfen, ob das Modell erreichbar ist:

```bash
cd backend && .venv/bin/python -c "from simulacra.config import get_settings; s=get_settings(); print(s.llm_base_url, s.llm_model)"
```

Nach dem Start zeigt `http://127.0.0.1:8090/api/health` unter `llm` an, ob der Router antwortet und das Modell kennt.

**Oder im Tool (ab AP17c):** Menü → Einstellungen → **Modelle**. Dort wählt man die Betriebsart: **Eingebaut** (Simulacra startet `llama-server` selbst; die Laufzeit holt „Laufzeit installieren“ aus den offiziellen llama.cpp-Releases, Modelle lädt man von Hugging Face und misst sie mit dem Probelauf) oder **Externer Server** (Adresse und Schlüssel, mit Verbindungstest). Die Wahl steht in `data/llm.json`. Steht `SIM_LLM_BASE_URL` in der Umgebung oder in `backend/.env` (so schreibt es auch `install.sh`), gewinnt das: die Betriebsart ist dann fest „Externer Server“ und das Tool ändert die Adresse nicht; Modelle lassen sich trotzdem laden und messen.

## 5. Starten und beenden

```bash
scripts/dev.sh     # Backend auf 127.0.0.1:8090, Vite-Dev-Server auf 127.0.0.1:5173 (beide im Hintergrund)
scripts/stop.sh    # beides beenden
```

Im Browser `http://127.0.0.1:5173` öffnen. Logs liegen in `data/logs/`, die Datenbank in `data/live.db`, Spielstände in `data/saves/`.

Ohne Vite (gebautes Frontend, wie im Container):

```bash
cd frontend && npm run build && cd ..
cd backend && SIM_DATA_DIR=../data SIM_STATIC_DIR=../frontend/dist .venv/bin/python -m simulacra   # API, WebSocket und Oberfläche auf :8090
```

Dann `http://127.0.0.1:8090` öffnen. Die Simulation startet angehalten; ▶ in der Kopfzeile setzt sie in Gang.

## 6. Tests

```bash
cd backend && .venv/bin/python -m pytest -q                 # ca. 950 Tests, 5 min, ohne Modell und ohne Netz
cd backend && .venv/bin/python -m pytest -q tests/acceptance   # nur die Abnahme (§17)
cd frontend && npm run typecheck && npm test                # TypeScript und Vitest
cd frontend && npx playwright test                          # Browser-Tests mit Fake-Modell (ca. 3 min)
```

Ist Port 8192 belegt (etwa durch einen Langlauf), wählen die Browser-Tests andere Ports: `SIM_E2E_BACKEND_PORT=8196 SIM_E2E_FRONTEND_PORT=5179 npx playwright test`.

Zusätzlich, nur auf Zuruf: `pytest -m integration` (braucht das echte Modell), `pytest -m slow` (sieben Simulationstage mit Fake-Modell) und der Langlauf (`scripts/langlauf.py`, siehe [status/langlauf.md](status/langlauf.md)).

## Häufige Stolpersteine

| Beobachtung | Abhilfe |
|---|---|
| `backend/.venv fehlt` beim Start | Schritt 2 ausführen |
| `frontend/node_modules fehlt` | Schritt 3 ausführen |
| `… läuft bereits` | `scripts/stop.sh`, dann erneut starten |
| Roter Punkt am Modellnamen | Endpunkt, Schlüssel und Modellname prüfen (Schritt 4); `curl -H "Authorization: Bearer $(cat <schlüsseldatei>)" <SIM_LLM_BASE_URL>/models` |
| Zeitabhängige Tests schlagen gelegentlich fehl | sie messen Takte in Echtzeit; unter hoher Last (z. B. paralleler Compiler-Lauf) einzeln wiederholen |
