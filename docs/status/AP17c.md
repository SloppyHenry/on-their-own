# AP17c-1 – Install-Skript

Plan: [AP17c-plan.md](../arbeitspakete/AP17c-plan.md). Mockup: [modelle.html](../mockups/modelle.html) (Reiter „Install-Skript“). Handbuch: [installation.md](../installation.md).

## Gebaut
- `install.sh` im Projektordner: sieben Schritte wie im Mockup (Rechner prüfen, Voraussetzungen, Projekt, llama.cpp, Modell, Dienst, Fertig mit Selbsttest). Läuft mit der bash 3.2 von macOS. Schalter `--yes`, `--dry-run`, `--no-model`, `--no-llm`, `--headless`, `--model`, `--update`, `--uninstall`, `--purge`.
- `scripts/start.sh`: Modell und Simulacra im Vordergrund, wenn man keinen Dienst will.
- `backend/simulacra/data/models.json`: kuratierte Modelle (Qwen3-4B, -8B, -14B in Q4_K_M, Dateinamen und Größen gegen Hugging Face geprüft).
- Hardware: NVIDIA über `nvidia-smi` (VRAM, CUDA-Version), Apple Silicon über `sysctl` (zwei Drittel des gemeinsamen Speichers), Vulkan an den Treiberdateien, sonst Prozessor.
- llama.cpp: nimmt die offiziellen Releases von `ggml-org/llama.cpp` (heute als Vorabversionen `bNNNNN` markiert, deshalb nicht `/releases/latest`), wählt die erste passende Datei mit Rückfall (CUDA 13.4, CUDA 12.8, Vulkan, Prozessor), prüft den `digest`, entpackt, probiert `llama-server --version` und nimmt bei Fehler den nächsten Kandidaten. Ältere Versionen werden aufgeräumt.
- Modell: größtes Modell der Liste, das in den nutzbaren Speicher passt; Download fortsetzbar, SHA-256 aus der Hugging-Face-API.
- `backend/.env`: nur ein eigener, markierter Block; eigene Einträge außerhalb gehen vor. `--headless` erzeugt `SIM_ACCESS_TOKEN` und `SIM_HOST=0.0.0.0`.
- Dienste: `systemd --user` (Linux) und `launchd` (macOS) für das Modell und für Simulacra; Standard ja bei `--headless`, sonst nein.

## Geprüft
- **Echter Lauf** auf diesem Mac (Apple M1, 16 GB) in einer frischen Kopie: Backend-Umgebung und Oberfläche gebaut, llama.cpp b11714 (Metal) geladen und geprüft, Qwen3-4B (2,5 GB) geladen, Prüfsumme stimmt, `backend/.env` geschrieben. Danach `scripts/start.sh`: `llama-server` meldet gesund, `/api/health` der App zeigt das Modell als erreichbar und verfügbar. Eine Anfrage mit `json_schema` und ohne Denken dauerte 2,9 s bei etwa 20 Token/s. **Nicht geprüft:** `launchd`-Dienste auf dem Mac, `--uninstall`, Linux mit CUDA **und** eigenem Modell (thirdtux hat dafür keinen freien Grafikspeicher).
- **Tests:** `backend/tests/test_install_script.py` (13): Syntax, shellcheck, Auswahl der llama.cpp-Datei und des Modells für Mac, NVIDIA (CUDA 12 und 13), Prozessor ohne Grafik, knappen Speicher, `--model`, `--no-llm`, `--headless`, nicht unterstützte Systeme, Leerzeichen im Pfad, Rückgriff auf das vorige Release.
- Gefunden und behoben beim Testen: ein Absturz durch `pipefail` bei der Token-Erzeugung, ein Rückgabewert der Aufräumschleife, eine Kopie ohne `backend/simulacra/data`.

## Lauf auf thirdtux (17.10.2026, `ssh thirdtux`, Ubuntu, RTX 3060 12 GB, 16 GB RAM)
- Auf der Karte lief schon der Dienst `rea-llm.service` (Qwen3.6-35B-A3B auf Port 8080, 10,4 von 12 GB belegt, mit API-Schlüssel). Das Skript hätte ohne Korrektur den **gesamten** Grafikspeicher gerechnet und ein 8B- oder 14B-Modell daneben starten wollen. Jetzt zählt es den **freien** Speicher, warnt („Grafikkarte belegt, nichts wird beendet oder verdrängt“), schlägt nur das kleinste Modell mit Standard „nein“ vor.
- Installiert wurde deshalb **nur die App** (`./install.sh --yes --headless --no-llm`): `uv` und Node 24 im Benutzerordner, Backend und Oberfläche, Dienst `simulacra.service` (systemd --user, mit linger). Läuft auf `http://thirdtux:8090`; von außen ohne Token HTTP 401, Startseite 200. Der Dienst `rea-llm` und seine Grafikkartenbelegung blieben unberührt.
- Es ist noch **kein Modell** für Simulacra eingerichtet (Standardadresse zeigt auf maintux, offline).
- Auf dem Weg gefundene und behobene Fehler: (1) ein zweiter Lauf löschte das Zugangs-Token (Block wurde ohne Token neu geschrieben; Test `test_zweiter_lauf_behaelt_das_token`), (2) `thirdtux` löst nur zu IPv6 auf, der Server lauschte aber nur auf IPv4 (jetzt `::` bei vorhandenem IPv6), (3) die Speicherrechnung ignorierte belegte Grafikkarten.

## Einschränkungen
- CUDA-Auswahl nach der Treiberversion von `nvidia-smi`; bei einem Fehler fällt das Skript auf Vulkan und Prozessor zurück. Auf einer echten NVIDIA-Karte ungetestet.
- Die Liste kuratierter Modelle ist klein; die Live-Liste von Hugging Face kommt mit AP17c-2. Der Probelauf mit dem Messprompt (Siegel) kommt mit AP17c-3.
- Das Backend startet das Modell noch nicht selbst; das tun die Dienste oder `scripts/start.sh`.
