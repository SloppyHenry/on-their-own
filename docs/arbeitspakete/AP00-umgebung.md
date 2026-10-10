# AP00 – Umgebung, Gerüst, LLM-Sondierung

**Auftrag:** §2, §19 · **Abhängig von:** – · **Umfang:** S · **Meilenstein:** M1

## Ziel
Ein leeres, aber startfähiges Projekt mit gepinnten Abhängigkeiten, Start- und Stoppskripten und einer gemessenen Grundlage, wie sich die Modelle auf maintux für strukturierte Agentenaktionen verhalten. Alle späteren Entscheidungen zu Prompt-Länge, JSON-Zwang und Denkmodus stützen sich auf diese Messungen.

## Ausgangslage
- Ordner `~/Projekte/simulacra` enthält nur `docs/`. Noch kein git-Repo.
- LLM: `http://maintux:8080/v1`, Key in `~/.config/qwen/maintux-api-key` (Mac). Router mit `parallel = 1`, `reasoning-budget = 2048`, `reasoning-effort = medium` als Voreinstellung.
- Mac: Python 3.14, Node 24, npm 11; kein Docker.

## Lieferumfang
1. git-Repo mit `.gitignore` (u. a. `data/`, `node_modules/`, `.venv/`, `*.db`, Secrets).
2. Backend-Gerüst `backend/simulacra/` mit `config.py`, `app.py` (FastAPI-Fabrik), Route `GET /api/health`.
3. Frontend-Gerüst `frontend/` (Vite, React, TypeScript, Tailwind) mit einer Platzhalter-Seite, die `/api/health` anzeigt. Diese Seite ist der einzige erlaubte Platzhalter und wird in AP04 ersetzt.
4. Skripte `scripts/dev.sh` (Backend auf 127.0.0.1:8090, Vite auf 5173 mit Proxy), `scripts/stop.sh`, `scripts/probe_llm.py`.
5. Bericht `docs/llm-anbindung.md` mit Messwerten.
6. `docs/offene-fragen.md`, `docs/konfiguration.md` (Grundgerüst), `docs/status/AP00.md`.

## Konfiguration (erste Fassung)
Alle Werte als Umgebungsvariablen mit Präfix `SIM_`, Standardwerte in `config.py`, lokale Überschreibung in `.env` (git-ignoriert).

| Variable | Standard | Bedeutung |
|---|---|---|
| `SIM_LLM_BASE_URL` | `http://maintux:8080/v1` | OpenAI-kompatibler Endpunkt |
| `SIM_LLM_API_KEY_FILE` | `~/.config/qwen/maintux-api-key` | Datei mit dem Key; alternativ `SIM_LLM_API_KEY` |
| `SIM_LLM_MODEL` | `qwen3.8-9b-uncensored` | Modellkennung im Router |
| `SIM_LLM_TIMEOUT_S` | `90` | Timeout pro Anfrage |
| `SIM_DATA_DIR` | `./data` | SQLite, Spielstände, Logs |
| `SIM_HOST` / `SIM_PORT` | `127.0.0.1` / `8090` | Backend-Adresse |

Der Key wird nie geloggt und nie ans Frontend gegeben.

## Arbeitsschritte
1. `git init`, Grundstruktur laut Übersicht anlegen.
2. Python: `backend/pyproject.toml` mit gepinnten Versionen, venv `backend/.venv`. Prüfen, dass alle Pakete unter 3.14 (Mac) **und** 3.12 (Container) installierbar sind; falls ein Paket unter 3.14 fehlt, wird das dokumentiert und lokal 3.12 über `uv` oder pyenv vorgeschlagen.
3. Frontend: `npm create vite` (React + TS), Tailwind einrichten, Proxy `/api` und `/ws` auf 8090. Versionen in `package.json` exakt pinnen (`--save-exact`), `package-lock.json` einchecken.
4. `config.py` mit pydantic-settings; `GET /api/health` liefert App-Version, Datenpfad, LLM-Erreichbarkeit (`GET /v1/models` mit Timeout 3 s) und Liste der Modelle.
5. `dev.sh`: startet beide Prozesse, schreibt PIDs nach `data/run/`, leitet Logs nach `data/logs/`; `stop.sh` beendet sie sauber.
6. **LLM-Sondierung** mit `probe_llm.py` (siehe unten), Ergebnis in `docs/llm-anbindung.md`.
7. Statusbericht, Commit, Freigabe.

## LLM-Sondierung (Messplan)
Für `qwen3.8-9b-uncensored` und `bonsai2-27b`, je 20 Durchläufe mit einem realistischen Entscheidungsprompt (Weltbeschreibung, 6 Kandidaten-Optionen, Antwortschema mit `option_id`, `reason`, `utterance`, `importance`):

| Messung | Varianten |
|---|---|
| JSON-Treue | (a) nur Prompt-Anweisung, (b) `response_format: json_object`, (c) `response_format: json_schema` (Grammatik in llama.cpp) |
| Denkmodus | (a) Standard des Routers, (b) `chat_template_kwargs: {enable_thinking: false}`, (c) `reasoning_effort: low/medium` |
| Kosten | Prompt-Tokens, Ausgabe-Tokens, Zeit bis zur ersten Antwort, Gesamtzeit, Tokens/s (aus `timings`) |
| Prompt-Cache | Zwei Agenten abwechselnd mit gleichem vs. unterschiedlichem Systemprompt-Präfix: wie stark sinkt die Prompt-Verarbeitungszeit? |
| Modellwechsel | Dauer, wenn der Router von einem anderen Modell auf das gewählte umschalten muss |

**Erwartetes Ergebnis:** eine Empfehlung „Variante X ist Standard“ mit Zahlen, z. B. JSON-Schema plus Denken aus, und eine Schätzung der möglichen Entscheidungen pro Minute. Diese Zahlen setzen die Standardwerte für Entscheidungsintervall und Geschwindigkeit in AP02 und AP07.

## Tests
- `test_config.py`: Standardwerte, Überschreibung per Umgebung, Key aus Datei, Key erscheint nicht in `repr`.
- `test_health.py`: `/api/health` mit erreichbarem und nicht erreichbarem (gemocktem) LLM.
- Manuell: `scripts/dev.sh` → Browser zeigt Health-Status; `scripts/stop.sh` beendet alles.

## Abnahme
- [ ] `scripts/dev.sh` startet Backend und Frontend; die Seite zeigt „LLM erreichbar“ und die Modellliste von maintux.
- [ ] `scripts/stop.sh` hinterlässt keine laufenden Prozesse.
- [ ] pytest grün, Ausgabe im Statusbericht.
- [ ] `docs/llm-anbindung.md` enthält Messwerte beider Modelle und eine begründete Standardvariante.

## Risiken
| Risiko | Gegenmaßnahme |
|---|---|
| Ein Paket gibt es unter Python 3.14 noch nicht als Wheel | Lokal 3.12 über `uv` (nach Rückfrage installieren) |
| `json_schema` wird vom Fork anders unterstützt als vom Original | Sondierung deckt das auf; Rückfall auf `json_object` plus Pydantic-Prüfung |
| Denken lässt sich per Request nicht abschalten | Rückfall: eigener Preset-Eintrag im Router mit `reasoning-budget = 0` (Änderung auf maintux nur nach Freigabe) |

## Offene Fragen an dich
- Soll die App lokal zwingend unter Python 3.14 laufen, oder ist eine 3.12-venv per `uv` auf dem Mac in Ordnung?
