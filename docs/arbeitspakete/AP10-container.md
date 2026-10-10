# AP10 – Docker-Container und Betrieb auf maintux

**Auftrag:** §2, §19 (Start-/Stoppskripte) · **Abhängig von:** AP04 (erste Probe), AP09 (endgültig) · **Umfang:** M · **Meilenstein:** M6

## Ziel
Die gesamte App läuft auf maintux in einem Docker-Container, startet mit einem Befehl, überlebt Neustarts von Container und Rechner ohne Datenverlust und spricht den llama.cpp-Router auf dem Host an. Ausrollen und Neustarts auf maintux nur mit deiner ausdrücklichen Freigabe.

## Aufbau
```
maintux (Host)
├── llama-server (systemd --user, Port 8080, GPU)   ◄── bleibt wie es ist
└── Docker
    └── simulacra (Container)
        ├── Uvicorn/FastAPI :8090  ── liefert API, WebSocket und das gebaute Frontend
        ├── /data  ◄── Volume simulacra-data (live.db, saves/, logs/)
        └── LLM-Aufrufe → http://host.docker.internal:8080/v1
```
- **Ein Container** reicht: das Frontend ist nach dem Build statisch und wird von FastAPI ausgeliefert. Kein Nginx, keine zweite Datenbank.
- **Warum das LLM nicht in den Container:** es braucht die GPU, läuft bereits als Dienst für alle Modelle und wird auch von pi und anderen Programmen genutzt.

## Lieferumfang
1. `deploy/Dockerfile` (mehrstufig).
2. `deploy/compose.yaml`.
3. `deploy/env.example` und Anleitung für die Secret-Datei.
4. Skripte `scripts/deploy_maintux.sh`, `scripts/backup.sh`, `scripts/restore.sh`.
5. `docs/betrieb.md` (Start, Stopp, Update, Backup, Fehlersuche).

## Dockerfile (Entwurf)
- Stufe 1 `node:<LTS>-slim`: `npm ci`, `npm run build` → `frontend/dist`.
- Stufe 2 `python:3.12-slim`: Abhängigkeiten aus gepinnter Lock-Datei, Backend-Paket, `dist` nach `/app/static`.
- Nicht-Root-Benutzer `sim` (UID 10001), `/data` gehört diesem Benutzer.
- `HEALTHCHECK` auf `/api/health`.
- Keine Secrets im Image; `.dockerignore` schließt `data/`, `.env`, `node_modules`, `.venv` aus.
- Zielgröße unter 250 MB.

## compose.yaml (Entwurf)
```yaml
services:
  simulacra:
    build: { context: .., dockerfile: deploy/Dockerfile }
    image: simulacra:latest
    container_name: simulacra
    restart: unless-stopped
    ports: ["8090:8090"]
    environment:
      SIM_HOST: 0.0.0.0
      SIM_PORT: "8090"
      SIM_DATA_DIR: /data
      SIM_LLM_BASE_URL: http://host.docker.internal:8080/v1
      SIM_LLM_API_KEY_FILE: /run/secrets/llm_api_key
    secrets: [llm_api_key]
    extra_hosts: ["host.docker.internal:host-gateway"]
    volumes: ["simulacra-data:/data"]
    mem_limit: 2g
    cpus: 4
    logging: { driver: json-file, options: { max-size: "10m", max-file: "5" } }
secrets:
  llm_api_key: { file: /home/henry/llm/api-key }
volumes:
  simulacra-data: {}
```
Der Key bleibt in der bestehenden Datei auf maintux und wird nur als Secret eingebunden.

## Zu prüfen auf maintux (vor dem ersten Ausrollen, nur lesend)
- Port 8090 frei (8080 Router, 8081 webconfig belegt).
- Docker-Version, Compose-Plugin vorhanden, Benutzer `henry` in der Gruppe `docker`.
- Erreichbarkeit `host.docker.internal:8080` aus einem Testcontainer: Der Router lauscht auf `0.0.0.0`; eine Firewall (ufw/nftables) könnte die Docker-Bridge blockieren – Status war im Setup „nicht geprüft“. Falls blockiert, schlage ich die Regel vor; Ausführung durch dich (sudo).
- Freier Speicher (Stand: ca. 125 GB frei auf `/`).

## Zugang im Netz
- Standard: erreichbar im Heimnetz unter `http://maintux:8090`.
- Optional: einfacher Zugangsschutz per Token (`SIM_ACCESS_TOKEN`), im Browser einmal eingeben, als Cookie gespeichert. Entscheidung von dir.
- Kein Zugriff aus dem Internet vorgesehen.

## Ausrollen (`scripts/deploy_maintux.sh`)
1. Tests lokal grün (Abbruch sonst).
2. Quellcode per `rsync` nach `~/simulacra` auf maintux (ohne `data/`, `.env`).
3. Vorher automatisches Backup des Volumes (`backup.sh`).
4. `docker compose build`, `docker compose up -d`.
5. Warten auf Healthcheck, danach `/api/health` und ein kurzer Rauchtest (Snapshot abrufen, ein Einzelschritt im pausierten Zustand – nur mit deiner Zustimmung, da er den Live-Stand verändert).
6. Bei Fehler: alter Image-Tag wird wieder gestartet (`simulacra:previous`).

## Backup und Wiederherstellung
- `backup.sh`: SQLite-Backup aus dem laufenden Container (konsistent), plus `saves/` als tar.gz nach `~/simulacra-backups/` mit Datum; die letzten 14 bleiben.
- `restore.sh`: Container stoppen, Backup zurückspielen, starten; vorher Sicherung des aktuellen Stands.
- Optional später: nächtliches Backup per systemd-Timer (nur nach Freigabe).

## Zusammenspiel mit der GPU
- Der Router hält nur ein Modell. Wenn du gleichzeitig mit pi ein anderes Modell nutzt, lädt der Router um, und die Simulation wartet. Die Statusanzeige zeigt das als „Modell wird geladen“.
- Empfehlung in `docs/betrieb.md`: für längere Simulationsläufe Energiesparmodus oder Pause, wenn das Modell anderweitig gebraucht wird.

## Tests
- Image baut ohne Netzwerkzugriff zur Laufzeit; Container startet, Healthcheck grün.
- Container neu starten → Simulation, Spielstände und Parameter vorhanden.
- LLM nicht erreichbar (Router gestoppt – nur in einer Testumgebung, nicht auf maintux ohne Freigabe; alternativ falsche URL) → App bleibt bedienbar, Status „Modell nicht erreichbar“, nach Wiederkehr automatisch weiter.
- Backup → Restore → identischer Stand.

## Abnahme
- [ ] `http://maintux:8090` zeigt die Leitstelle; die Simulation läuft gegen den Router auf dem Host.
- [ ] `docker compose restart` und Neustart von maintux verlieren nichts.
- [ ] Backup und Restore vorgeführt.
- [ ] `docs/betrieb.md` vollständig.

## Offene Fragen an dich
- Port 8090 in Ordnung?
- Zugangsschutz per Token gewünscht?
- Soll ich Docker auf dem Mac nachinstallieren, um den Container vorab lokal zu testen, oder direkt auf maintux testen?
