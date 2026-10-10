# Konfiguration

Alle Einstellungen sind Umgebungsvariablen mit Präfix `SIM_`. Reihenfolge (stärkste zuerst): Umgebung → `.env` im Startordner (`backend/`) → Standardwert in `backend/simulacra/config.py`. `.env` ist git-ignoriert; Vorlage: [`.env.example`](../.env.example).

Der API-Key wird nie geloggt, erscheint nicht in `repr()` oder `model_dump_json()` der Einstellungen und wird nie ans Frontend gegeben.

## Start-Konfiguration (AP00)

| Variable | Standard | Wirkung | Wirksam |
|---|---|---|---|
| `SIM_LLM_BASE_URL` | `http://maintux:8080/v1` | OpenAI-kompatibler Endpunkt | Neustart |
| `SIM_LLM_API_KEY_FILE` | `~/.config/qwen/maintux-api-key` | Datei mit dem Key (eine Zeile) | Neustart |
| `SIM_LLM_API_KEY` | – | Key direkt; hat Vorrang vor der Datei | Neustart |
| `SIM_LLM_MODEL` | `qwen3.8-9b-uncensored` | Modellkennung im Router | Neustart (ab AP07 zur Laufzeit) |
| `SIM_LLM_TIMEOUT_S` | `90` | Timeout je Anfrage in Sekunden | Neustart (ab AP07 zur Laufzeit) |
| `SIM_DATA_DIR` | `./data` (von `scripts/dev.sh` auf `<Projekt>/data` gesetzt) | SQLite, Spielstände, Logs | Neustart |
| `SIM_HOST` | `127.0.0.1` | Adresse des Backends | Neustart |
| `SIM_PORT` | `8090` | Port des Backends | Neustart |

Laufzeit-Parameter (Slider, Autonomie, Gedächtnis, Welt) kommen mit AP07 in eine eigene Registry und werden hier ergänzt.
