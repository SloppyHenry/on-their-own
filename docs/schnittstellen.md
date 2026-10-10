# Schnittstellen

Pydantic-Modelle im Backend sind die Quelle der Wahrheit; TypeScript-Typen werden daraus erzeugt (ab AP03).

## REST

### `GET /api/health` (AP00)
Liefert den Zustand des Backends und prüft das LLM (`GET <base_url>/models`, Timeout 3 s). Fehler des LLM führen nie zu einem Fehlerstatus der Route; sie stehen in `llm.error`.

```json
{
  "status": "ok",
  "version": "0.1.0",
  "data_dir": "/…/simulacra/data",
  "llm": {
    "reachable": true,
    "error": null,
    "models": ["bonsai2-27b", "qwen3.8-9b-uncensored"],
    "base_url": "http://maintux:8080/v1",
    "configured_model": "qwen3.8-9b-uncensored",
    "model_available": true
  }
}
```
