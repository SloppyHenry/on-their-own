#!/usr/bin/env bash
# Läuft auf maintux im Projektverzeichnis (aufgerufen von deploy_maintux.sh): Backup, Bauen, Starten, Prüfen, bei Fehler zurück.
set -euo pipefail
# shellcheck source=scripts/_compose.sh
source "$(dirname "$0")/_compose.sh"

PORT="${SIM_PUBLISH:-8090}"
SRC_KEY="${SIM_KEY_SOURCE:-$HOME/llm/api-key}"

# Der Schlüssel des Routers bleibt, wo er ist; der Container (Benutzer 10001) liest eine Kopie in einem nur für dich zugänglichen Ordner.
if [[ -f "$SRC_KEY" ]]; then
  install -d -m 0700 "$(dirname "$SIM_KEY_FILE")"
  install -m 0444 "$SRC_KEY" "$SIM_KEY_FILE"
fi
[[ -f "$SIM_KEY_FILE" ]] || die "API-Schlüssel nicht gefunden ($SRC_KEY). Pfad mit SIM_KEY_SOURCE=… angeben."

if [[ -n "$(sim_compose ps -a -q on-their-own)" ]]; then
  echo "== Backup vor dem Ausrollen"
  "$ROOT/scripts/backup.sh"
  docker image inspect on-their-own:latest >/dev/null 2>&1 && docker tag on-their-own:latest on-their-own:previous
fi

echo "== Bauen"
sim_compose build
echo "== Starten"
sim_compose up -d

healthy() { [[ "$(docker inspect -f '{{.State.Health.Status}}' on-their-own 2>/dev/null)" == "healthy" ]]; }
for _ in $(seq 1 60); do healthy && break; sleep 2; done

if healthy && curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null; then
  echo "== Läuft"
  curl -fsS "http://127.0.0.1:$PORT/api/health"; echo
  exit 0
fi

echo "== FEHLER: Container wurde nicht gesund. Letzte Logzeilen:" >&2
sim_compose logs --tail 40 on-their-own >&2 || true
if docker image inspect on-their-own:previous >/dev/null 2>&1; then
  echo "== Zurück auf die vorherige Version" >&2
  docker tag on-their-own:previous on-their-own:latest
  sim_compose up -d --no-build --force-recreate
fi
exit 1
