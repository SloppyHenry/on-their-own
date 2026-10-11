# Betrieb auf maintux

Die ganze App läuft in **einem Docker-Container** (`simulacra`): FastAPI liefert API, WebSocket und das gebaute Frontend aus, Port **8090**. Das Sprachmodell bleibt wie bisher der llama.cpp-Router auf dem Host (Port 8080, GPU); der Container erreicht ihn über `host.docker.internal`. Daten (`live.db`, `saves/`, `backups/`) liegen im Volume `simulacra-data`.

```
maintux (Host)
├── llama-server (systemd --user, :8080, GPU)  ◄── bleibt wie er ist
└── Docker
    └── simulacra  :8090 ── /data (Volume simulacra-data)
        └── LLM-Aufrufe → http://host.docker.internal:8080/v1
```

Erreichbar im Heimnetz unter `http://maintux:8090`, nicht aus dem Internet.

**Grundregel:** Ausrollen, Neustarten und Wiederherstellen auf maintux passiert nur nach ausdrücklicher Freigabe von Henry.

## Dateien

| Datei | Zweck |
|---|---|
| `deploy/Dockerfile` | zweistufig: Node 24 baut das Frontend, Python 3.14 (slim) führt aus; Benutzer `sim` (UID 10001), Healthcheck auf `/api/health` |
| `deploy/compose.yaml` | Dienst, Port, Volume, Geheimnis, Grenzen (2 GB, 4 CPUs), Log-Rotation (5 × 10 MB) |
| `deploy/env.example` | Vorlage für `deploy/.env` (alles optional) |
| `backend/requirements.lock` | gepinnte Abhängigkeiten für das Image |
| `scripts/deploy_maintux.sh` | Mac: Tests → rsync → Backup, Bauen, Starten, Prüfen, Rückfall |
| `scripts/_remote_up.sh` | maintux: der Teil nach dem Kopieren (wird von `deploy_maintux.sh` aufgerufen) |
| `scripts/backup.sh`, `restore.sh` | Sicherung und Wiederherstellung (maintux) |

Python 3.14 ist dieselbe Version wie in der Entwicklung und in den Tests (die Spezifikation nannte 3.12; getestet wurde nie mit 3.12).

## Vor dem ersten Ausrollen (nur lesend prüfen)

- `docker --version`, `docker compose version`; Benutzer `henry` in der Gruppe `docker`.
- Docker startet beim Hochfahren: `systemctl is-enabled docker` (Voraussetzung dafür, dass die App einen Neustart von maintux übersteht; der Container selbst hat `restart: unless-stopped`).
- Port 8090 frei: `ss -ltn | grep 8090` (8080 Router, 8081 webconfig sind belegt).
- Router vom Container aus erreichbar: `docker run --rm --add-host host.docker.internal:host-gateway curlimages/curl -s http://host.docker.internal:8080/v1/models` (mit Schlüssel, siehe unten). Blockiert eine Firewall (ufw/nftables) die Docker-Bridge, braucht es eine Regel, die du mit sudo setzt; ich schlage sie dann vor.
- Schlüsseldatei des Routers (Standard `~/llm/api-key`, mit `SIM_KEY_SOURCE=…` änderbar). Das Skript legt daraus eine Kopie `~/simulacra-secrets/llm_api_key` an (Ordner 0700, Datei 0444), weil der Container als UID 10001 liest. Der Schlüssel steht nie im Image.
- Freier Platz: das Image ist klein (Zielgröße unter 250 MB), das Volume wächst mit der Simulation (gemessen: ein Spielstand nach einem Simulationstag ist ca. 3 MB groß; Autosaves bleiben auf 5 begrenzt).

## Ausrollen und Aktualisieren

Auf dem Mac, nach Freigabe:

```bash
scripts/deploy_maintux.sh --dry-run   # zeigt nur die Schritte
scripts/deploy_maintux.sh             # Tests, Rückfrage, dann ausrollen
scripts/deploy_maintux.sh --with-e2e  # zusätzlich die Browser-Tests (ca. 2 Minuten)
```

Ablauf: 1) Backend-, Typ- und Vitest-Tests lokal (Abbruch bei Fehler) · 2) Rückfrage · 3) `rsync` nach `maintux:~/simulacra` (ohne `data/`, `.env`, `node_modules`, `.git`) · 4) auf maintux: Backup des Volumes (`backup.sh`), das alte Image wird `simulacra:previous`, `docker compose build`, `up -d`, Warten auf „healthy“ (bis 2 Minuten) und `GET /api/health` · 5) **Bei Fehler** Logzeilen und automatische Rückkehr auf `simulacra:previous`.

Der Rauchtest mit einem Einzelschritt im pausierten Zustand ist **nicht** Teil des Skripts, weil er den Live-Stand verändert; er geschieht nur auf Zuruf.

Die Simulation startet nach einem Neustart des Containers **pausiert** (`SIM_AUTOSTART=false`): Zeit, Positionen, Gedächtnis, Spielstände und Parameter sind wieder da, ▶ setzt sie fort. Mit `SIM_AUTOSTART=true` in `deploy/.env` läuft sie sofort weiter.

## Alltag (auf maintux)

```bash
cd ~/simulacra
docker compose -f deploy/compose.yaml ps                  # Status und Gesundheit
docker compose -f deploy/compose.yaml logs -f --tail 100  # Logs
docker compose -f deploy/compose.yaml restart             # Neustart (nichts geht verloren)
docker compose -f deploy/compose.yaml stop                # anhalten
docker compose -f deploy/compose.yaml up -d --no-build    # wieder starten
```

Die Einstellungen aus `deploy/env.example` stehen in `deploy/.env` (nicht im Repository). Danach `docker compose … up -d`, damit sie wirken.

## Zugangsschutz (optional)

Standard: aus, die App ist im Heimnetz offen. Einschalten: in `deploy/.env` `SIM_ACCESS_TOKEN=<langes Zufallstoken>` setzen (`openssl rand -base64 24`), `up -d`. Die Oberfläche fragt dann einmal nach dem Token und merkt es sich 30 Tage als Cookie (HttpOnly, SameSite=Strict). Ohne Anmeldung antworten `/api/*` mit 401 und `/ws` schließt mit Code 4401; frei bleiben `/api/health` (Healthcheck) und die statischen Dateien. Nach zehn Fehlversuchen in einer Minute sperrt die Anmeldung kurz (429). Ausschalten: Variable leeren. Das ist ein einfacher Schutz für das Heimnetz, keine Benutzerverwaltung; über HTTP ohne TLS wird das Token im Klartext übertragen.

## Backup und Wiederherstellung

```bash
scripts/backup.sh                      # → ~/simulacra-backups/simulacra-JJJJMMTT-HHMMSS-NN.tar.gz, die letzten 14 bleiben
scripts/restore.sh <datei.tar.gz>      # fragt nach, sichert vorher, stoppt, spielt ein, startet wieder
```

Das Backup enthält `live.db` und alle Spielstände (`saves/`) samt `manifest.json` mit Prüfsummen. Es entsteht über die SQLite-Backup-API aus dem **laufenden** Container und ist konsistent, ohne die Simulation anzuhalten. Die Wiederherstellung prüft Archiv, Prüfsummen, Integrität und Schema-Version (kein Backup aus einer neueren Programmversion), sichert den aktuellen Stand vorher doppelt (nach `~/simulacra-backups` und im Volume unter `/data/backups`), und lässt bei jedem Fehler den bisherigen Stand unangetastet. Läuft die App, wird sie danach wieder gestartet.

Einzelne Spielstände (Export als ZIP, Import) laufen unabhängig davon in der Oberfläche ([spielstaende.md](spielstaende.md)). Ein nächtliches Backup per systemd-Timer ist möglich, wird aber nur nach Freigabe eingerichtet.

## Abhängigkeiten erneuern

```bash
cd backend && uv pip compile pyproject.toml -o requirements.lock --python-version 3.14 --no-header
```

Prüfen, ob es Wheels für Linux gibt (das Image hat keinen Compiler): `uv pip install --dry-run --python-platform x86_64-manylinux_2_28 --python-version 3.14 --only-binary :all: -r requirements.lock --target /tmp/x`.

## Fehlersuche

| Beobachtung | Ursache und Schritt |
|---|---|
| Roter Punkt am Modellnamen in der Kopfzeile / `/api/health` mit `llm.reachable: false` | Router läuft nicht oder blockiert: auf maintux `curl -s localhost:8080/v1/models`; aus dem Container siehe oben (Firewall auf der Docker-Bridge?). Die App bleibt bedienbar und läuft weiter, sobald der Router wieder antwortet. |
| Container „unhealthy“ | `docker compose … logs --tail 100`; Healthcheck fragt nur `/api/health` an, ein fehlendes Modell zählt nicht. |
| Skript bricht mit „API-Schlüssel nicht gefunden“ ab | `SIM_KEY_SOURCE=/pfad/zur/datei scripts/deploy_maintux.sh` |
| Port belegt | anderer Port: `SIM_PUBLISH=8091` in `deploy/.env` (die URL im Heimnetz ändert sich entsprechend) |
| Der Router lädt gerade ein anderes Modell (z. B. durch pi) | die Simulation wartet; für längere Läufe pausieren oder das Modell nicht wechseln. |
| Update schlug fehl | das Skript kehrt selbst zu `simulacra:previous` zurück; Daten wurden vorher gesichert (`~/simulacra-backups`). |
| Daten ansehen | `docker run --rm -v simulacra-data:/data alpine ls -la /data` |

## Was getestet ist und was nicht

Getestet (ohne Docker, siehe [Statusbericht AP10](status/AP10.md)): Auslieferung des gebauten Frontends durch das Backend, Zugangsschutz, Backup/Restore (Python und Shell-Skripte mit einem Docker-Ersatz), Frontend-Build aus sauberem Kontext, Backend mit ausschließlich den gepinnten Abhängigkeiten unter Python 3.14. **Nicht** getestet: `docker build` und der Container selbst; das geschieht erstmals auf maintux nach Freigabe.
