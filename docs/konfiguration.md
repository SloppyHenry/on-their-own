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

## Festlegungen

- **Modell je Simulation:** Das Modell (`SIM_LLM_MODEL` als Vorbelegung) wird beim Anlegen einer Simulation gewählt, im Spielstand gespeichert und danach nicht mehr geändert. Es ist kein Laufzeit-Parameter. Temperatur, Top-p, Token-Limits, Timeout und Wiederholungen bleiben ab AP07 zur Laufzeit einstellbar.

## Weltregeln (AP01, `WorldRules`)

Werden in der Datenbank gespeichert und über `WorldEngine.set_rules()` **sofort** übernommen (Ereignis `simulation.parameter_changed`). Die Regler dazu kommen mit AP07.

| Regel | Standard | Grenzen | Wirkung |
|---|---|---|---|
| `resource_scarcity` | 1.0 | 0.1–3.0 | skaliert Nachwuchs und Obergrenze der Quellen (Bestand wird sofort gekappt) |
| `gather_time_mult` | 1.0 | 0.25–4 | Dauer des Sammelns |
| `build_cost_mult` | 1.0 | 0.25–4 | Baukosten (aufgerundet, mindestens 1) |
| `build_duration_mult` | 1.0 | 0.25–4 | Bauzeit |
| `max_objects` | 150 | 20–500 | Höchstzahl Objekte in der Welt (Bauen und Pflanzen) |
| `movement_blocked_locations` | `[]` | Orts-IDs | gesperrte Orte; Wegfindung betritt sie nicht |
| `home_radius` | `null` | 3–64 oder `null` | Bewegungsfreiheit: Kacheln um das Zuhause (`home` in der Weltdatei) |
| `failure_penalty` | `time` | `none`/`time`/`energy` | Folge einer abgelehnten oder gescheiterten Aktion |
| `failure_penalty_minutes` | 1 | 1–30 | Dauer bei `time` |
| `needs_enabled` | `true` | – | Bedürfnisse laufen (aus: Werte bleiben stehen, nichts schränkt die Agenten ein) |
| `energy_decay_per_hour` | 3.0 | 0–20 | Energieverlust im Wachzustand |
| `hunger_rise_per_hour` / `thirst_rise_per_hour` | 3.0 / 4.0 | 0–20 | Anstieg (im Schlaf halbiert) |
| `energy_per_tile` | 0.05 | 0–1 | Energiekosten je Schritt |
| `plant_hours_per_stage` | 8 | 1–48 | Wachstumsdauer je Stufe (4 Stufen, nur bei Bewässerung der letzten 12 h) |
